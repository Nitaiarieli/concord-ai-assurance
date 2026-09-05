"""File-format coverage and failure boundaries using real temporary files."""
import io
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from concord.runtime.core import SyncRuntime
from concord.runtime.file_extractors import ExtractionError, extract_text
from concord.runtime.sources import FilesystemSource


NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def xml_document(body):
    return (f'<?xml version="1.0" encoding="UTF-8"?>'
            f'<w:document xmlns:w="{NAMESPACE}"><w:body>{body}</w:body></w:document>').encode()


def docx(raw_xml, *, extra_members=None, compression=zipfile.ZIP_DEFLATED):
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w", compression=compression) as archive:
        archive.writestr("word/document.xml", raw_xml)
        for name, value in (extra_members or {}).items():
            archive.writestr(name, value)
    return result.getvalue()


class FileFormatCoverageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "source"
        self.root.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content if isinstance(content, bytes) else content.encode("utf-8"))
        return path

    def test_nested_supported_formats_are_extracted_with_provenance(self):
        self.write("notes/guide.txt", "Current refund policy: 45 days.")
        self.write("plans.csv", 'plan,limit\nStarter,100\n"Team, annual",500\n')
        self.write("help.HTML", '<html><head><title>API guide</title><style>.x{}</style></head>'
                   '<body><h1>API limits</h1><p>Current limit: 500.</p>'
                   '<script>secretScript()</script></body></html>')
        self.write("terms.docx", docx(xml_document('<w:p><w:r><w:t>Terms version 2</w:t></w:r></w:p>')))
        source = FilesystemSource(self.root, identities=["jordan", "alex"])
        snapshot = source.scan()
        self.assertTrue(snapshot.complete, snapshot.error)
        self.assertEqual(len(snapshot.documents), 4)
        by_id = {item.id: item for item in snapshot.documents}
        self.assertEqual(by_id["file:help.HTML"].title, "API guide")
        self.assertIn("Current limit: 500.", by_id["file:help.HTML"].content)
        self.assertNotIn("secretScript", by_id["file:help.HTML"].content)
        self.assertNotIn(".x{}", by_id["file:help.HTML"].content)
        self.assertIn("Team, annual | 500", by_id["file:plans.csv"].content)
        self.assertEqual(by_id["file:terms.docx"].content, "Terms version 2")
        for item in snapshot.documents:
            self.assertEqual(item.acl, ["alex", "jordan"])
            self.assertEqual(len(item.metadata["source_bytes_sha256"]), 64)
            self.assertTrue(item.metadata["relative_path"])
            self.assertTrue(item.metadata["extraction_scope"])
        self.assertEqual(snapshot.cursor, source.scan().cursor)

    def test_file_change_and_rename_have_deterministic_id_and_revision(self):
        first_path = self.write("guide.txt", "revision one")
        source = FilesystemSource(self.root)
        first = source.scan().documents[0]
        self.write("guide.txt", "revision two")
        second = source.scan().documents[0]
        self.assertEqual(first.id, second.id)
        self.assertNotEqual(first.revision, second.revision)
        self.assertIsNone(second.acl)
        first_path.rename(self.root / "renamed.txt")
        self.assertEqual(source.scan().documents[0].id, "file:renamed.txt")

    def test_csv_formula_is_literal_text_and_utf8_bom_is_supported(self):
        self.write("data.csv", b'\xef\xbb\xbfvalue\n"=HYPERLINK(""https://example.invalid"", ""x"")"\n')
        snapshot = FilesystemSource(self.root).scan()
        self.assertTrue(snapshot.complete, snapshot.error)
        self.assertIn('=HYPERLINK("https://example.invalid", "x")', snapshot.documents[0].content)

    def test_supported_invalid_files_make_scan_incomplete(self):
        for name, value in [("bad.txt", b"\xff\xfe"), ("bad.csv", 'a,"unterminated'),
                            ("bad.html", b"<p>\x00</p>"), ("bad.docx", b"not a zip")]:
            with self.subTest(name=name):
                path = self.write(name, value)
                snapshot = FilesystemSource(self.root).scan()
                self.assertFalse(snapshot.complete)
                self.assertIsNone(snapshot.cursor)
                self.assertTrue(snapshot.error)
                path.unlink()

    def test_out_of_scope_pdf_and_hidden_files_are_not_claimed(self):
        self.write("guide.txt", "Readable text")
        self.write("scanned.pdf", b"%PDF-1.7 unsupported")
        self.write(".hidden.txt", "Hidden")
        snapshot = FilesystemSource(self.root).scan()
        self.assertTrue(snapshot.complete)
        self.assertEqual([item.id for item in snapshot.documents], ["file:guide.txt"])

    def test_runtime_updates_registered_routes_after_actual_file_edit(self):
        self.write("policy.txt", "Refund window is 30 days")
        runtime = SyncRuntime(str(Path(self.temp.name) / "runtime.sqlite3"),
                              FilesystemSource(self.root, identities=["alex"]))
        try:
            runtime.tick()
            self.assertIn("30 days", runtime.retrieve("Refund", "alex", route="success")["documents"][0]["content"])
            self.write("policy.txt", "Refund window is 45 days")
            runtime.tick()
            for route in ["support", "success"]:
                self.assertIn("45 days", runtime.retrieve("Refund", "alex", route=route)["documents"][0]["content"])
                self.assertEqual(runtime.retrieve("Refund", "jordan", route=route)["documents"], [])
        finally:
            runtime.close()

    def test_incomplete_extraction_cannot_be_used_to_infer_deletion(self):
        original = self.write("policy.txt", "Refund policy")
        runtime = SyncRuntime(str(Path(self.temp.name) / "runtime.sqlite3"),
                              FilesystemSource(self.root, identities=["alex"]))
        try:
            runtime.tick()
            original.unlink()
            invalid = self.write("broken.docx", b"Invalid archive")
            status = runtime.tick()
            self.assertNotEqual(status["status"], "current")
            self.assertEqual([item["id"] for item in status["documents"]], ["file:policy.txt"])
            self.assertEqual(runtime.retrieve("Refund", "alex")["documents"], [])
            invalid.unlink()
            status = runtime.tick()
            self.assertEqual(status["documents"], [])
        finally:
            runtime.close()


class ExtractionBoundaryTests(unittest.TestCase):
    def test_docx_body_includes_tables_and_excludes_deleted_text_and_field_code(self):
        body = ('<w:p><w:r><w:t>Policy</w:t><w:tab/><w:t>2026</w:t><w:br/><w:t>Active</w:t></w:r>'
                '<w:del><w:r><w:t>Old deleted secret</w:t></w:r></w:del>'
                '<w:r><w:instrText>EXTERNAL FIELD URL</w:instrText></w:r></w:p>'
                '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell one</w:t></w:r></w:p></w:tc></w:tr></w:tbl>')
        extracted = extract_text(docx(xml_document(body), extra_members={
            "word/_rels/document.xml.rels": '<Relationships><Relationship Target="https://example.invalid"/></Relationships>',
            "word/header1.xml": "Header outside declared scope",
        }), ".docx", "Example")
        self.assertIn("Policy\t2026\nActive", extracted.content)
        self.assertIn("Cell one", extracted.content)
        self.assertNotIn("Old deleted", extracted.content)
        self.assertNotIn("EXTERNAL", extracted.content)
        self.assertNotIn("Header", extracted.content)
        self.assertEqual(extracted.scope, "main_document_body")

    def test_docx_dtd_and_non_utf8_xml_are_rejected(self):
        dtd = b'<!DOCTYPE doc [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + xml_document('<w:p><w:r><w:t>&x;</w:t></w:r></w:p>')
        for raw in [dtd, xml_document("<w:p/>").decode().encode("utf-16")]:
            with self.subTest(raw=raw[:20]):
                with self.assertRaises(ExtractionError):
                    extract_text(docx(raw), ".docx", "Example")

    def test_docx_duplicate_or_traversal_members_are_rejected(self):
        for extra in [{"../outside.txt": "no"}, {"/absolute.txt": "no"}]:
            with self.assertRaises(ExtractionError):
                extract_text(docx(xml_document("<w:p/>"), extra_members=extra), ".docx", "Example")
        result = io.BytesIO()
        with zipfile.ZipFile(result, "w") as archive:
            archive.writestr("word/document.xml", xml_document("<w:p/>"))
            with self.assertWarns(UserWarning):
                archive.writestr("word/document.xml", xml_document("<w:p/>"))
        with self.assertRaises(ExtractionError):
            extract_text(result.getvalue(), ".docx", "Example")

    def test_docx_compression_members_and_xml_limits_are_enforced(self):
        repeated = xml_document('<w:p><w:r><w:t>' + "A" * 200_000 + '</w:t></w:r></w:p>')
        with self.assertRaisesRegex(ExtractionError, "compression ratio"):
            extract_text(docx(repeated), ".docx", "Example")
        with self.assertRaisesRegex(ExtractionError, "member count"):
            extract_text(docx(xml_document("<w:p/>"), extra_members={f"item-{i}": "x" for i in range(128)}), ".docx", "Example")
        with patch("concord.runtime.file_extractors.MAX_DOCX_XML_BYTES", 10):
            with self.assertRaisesRegex(ExtractionError, "XML size"):
                extract_text(docx(xml_document("<w:p/>")), ".docx", "Example")

    def test_docx_and_html_structure_and_text_limits_are_enforced(self):
        with self.assertRaisesRegex(ExtractionError, "structure"):
            extract_text(docx(xml_document("<w:p>" * 65 + "</w:p>" * 65), compression=zipfile.ZIP_STORED), ".docx", "Example")
        with self.assertRaisesRegex(ExtractionError, "depth"):
            extract_text(("<div>" * 65 + "x" + "</div>" * 65).encode(), ".html", "Example")
        with self.assertRaisesRegex(ExtractionError, "text limit"):
            extract_text(b"x" * 1_000_001, ".txt", "Example")
        with self.assertRaisesRegex(ExtractionError, "text limit"):
            extract_text(("א" * 600_000).encode(), ".txt", "Example")

    def test_csv_column_and_row_limits_are_enforced(self):
        with self.assertRaisesRegex(ExtractionError, "column"):
            extract_text((",".join(["x"] * 257)).encode(), ".csv", "Example")
        with patch("concord.runtime.file_extractors.MAX_CSV_ROWS", 2):
            with self.assertRaisesRegex(ExtractionError, "row"):
                extract_text(b"a\nb\nc\n", ".csv", "Example")


if __name__ == "__main__":
    unittest.main()
