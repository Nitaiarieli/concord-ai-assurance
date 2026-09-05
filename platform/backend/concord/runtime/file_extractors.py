"""Bounded text extraction only; no rendering, networking or embedded-code execution.

The extraction contract is intentionally narrow. DOCX means its main document
body, CSV means one comma-delimited UTF-8 table, and HTML means static body text.
An unsupported or malformed supported document never silently becomes empty.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
import zlib
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import PurePosixPath
from xml.etree import ElementTree


SUPPORTED_FILE_EXTENSIONS = frozenset({".md", ".json", ".txt", ".csv", ".html", ".htm", ".docx"})
MAX_EXTRACTED_CHARACTERS = 1_000_000
MAX_EXTRACTED_BYTES = 1_048_576
MAX_CSV_ROWS = 10_000
MAX_CSV_COLUMNS = 256
MAX_HTML_TAGS = 50_000
MAX_STRUCTURE_DEPTH = 64
MAX_DOCX_MEMBERS = 128
MAX_DOCX_EXPANDED_BYTES = 8_000_000
MAX_DOCX_XML_BYTES = 2_000_000
MAX_DOCX_XML_NODES = 50_000
MAX_DOCX_COMPRESSION_RATIO = 100


class ExtractionError(ValueError):
    """Safe error without source content or host paths."""


@dataclass(frozen=True)
class ExtractedText:
    title: str
    content: str
    format: str
    scope: str


def _utf8(raw: bytes) -> str:
    try:
        value = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ExtractionError("Text document must be UTF-8") from exc
    if "\x00" in value:
        raise ExtractionError("NUL bytes are unsupported in text documents")
    return value


def _bounded(value: str) -> str:
    if len(value) > MAX_EXTRACTED_CHARACTERS or len(value.encode("utf-8")) > MAX_EXTRACTED_BYTES:
        raise ExtractionError("Extracted text limit exceeded")
    return value


def _csv(raw: bytes) -> str:
    text = _utf8(raw)
    rows: list[str] = []
    characters = 0
    try:
        # csv's default field-size limit remains in force; do not change global
        # parser state shared by other sources or request threads.
        for index, row in enumerate(csv.reader(io.StringIO(text, newline=""), strict=True)):
            if index >= MAX_CSV_ROWS or len(row) > MAX_CSV_COLUMNS:
                raise ExtractionError("CSV row or column limit exceeded")
            line = " | ".join(field.replace("\r\n", "\n").replace("\r", "\n") for field in row)
            characters += len(line) + 1
            if characters > MAX_EXTRACTED_CHARACTERS:
                raise ExtractionError("Extracted text limit exceeded")
            rows.append(line)
    except csv.Error as exc:
        raise ExtractionError("Invalid CSV or CSV field size limit exceeded") from exc
    return "\n".join(rows)


class _BodyText(HTMLParser):
    SUPPRESSED = {"head", "script", "style", "template", "noscript", "svg", "math", "iframe", "object"}
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
    BREAKS = {"p", "div", "section", "article", "header", "footer", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "br", "hr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self.characters = 0
        self.tags = 0

    def _append(self, value: str) -> None:
        self.characters += len(value)
        if self.characters > MAX_EXTRACTED_CHARACTERS:
            raise ExtractionError("Extracted text limit exceeded")
        self.parts.append(value)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tags += 1
        if self.tags > MAX_HTML_TAGS:
            raise ExtractionError("HTML tag limit exceeded")
        if tag in self.BREAKS and not any(item in self.SUPPRESSED for item in self.stack):
            self._append("\n")
        if tag not in self.VOID:
            self.stack.append(tag)
            if len(self.stack) > MAX_STRUCTURE_DEPTH:
                raise ExtractionError("HTML structure depth limit exceeded")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag in self.stack:
            index = len(self.stack) - 1 - self.stack[::-1].index(tag)
            del self.stack[index:]
        if tag in self.BREAKS and not any(item in self.SUPPRESSED for item in self.stack):
            self._append("\n")

    def handle_data(self, data: str) -> None:
        if "title" in self.stack:
            self.title_parts.append(data)
        if not any(item in self.SUPPRESSED for item in self.stack) and "title" not in self.stack:
            self._append(data)


def _html(raw: bytes, fallback_title: str) -> tuple[str, str]:
    parser = _BodyText()
    try:
        parser.feed(_utf8(raw))
        parser.close()
    except (RecursionError, ValueError) as exc:
        if isinstance(exc, ExtractionError):
            raise
        raise ExtractionError("Invalid HTML document") from exc
    title = " ".join("".join(parser.title_parts).split()) or fallback_title
    lines = [" ".join(line.split()) for line in "".join(parser.parts).splitlines()]
    return title, _bounded("\n".join(line for line in lines if line))


def _docx(raw: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            members = archive.infolist()
            if len(members) > MAX_DOCX_MEMBERS:
                raise ExtractionError("DOCX member count limit exceeded")
            names: set[str] = set()
            expanded = 0
            for member in members:
                path = PurePosixPath(member.filename)
                if (member.filename in names or path.is_absolute() or ".." in path.parts
                        or "\\" in member.filename or "\x00" in member.filename):
                    raise ExtractionError("Invalid or duplicate DOCX member path")
                names.add(member.filename)
                expanded += member.file_size
                if expanded > MAX_DOCX_EXPANDED_BYTES:
                    raise ExtractionError("DOCX expanded size limit exceeded")
                if member.flag_bits & 1:
                    raise ExtractionError("Encrypted DOCX is unsupported")
                if member.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}:
                    raise ExtractionError("Unsupported DOCX compression")
                if member.file_size > max(1, member.compress_size) * MAX_DOCX_COMPRESSION_RATIO:
                    raise ExtractionError("DOCX compression ratio limit exceeded")
            if "word/document.xml" not in names:
                raise ExtractionError("DOCX main document body is missing")
            document = archive.getinfo("word/document.xml")
            if document.file_size > MAX_DOCX_XML_BYTES:
                raise ExtractionError("DOCX XML size limit exceeded")
            with archive.open(document) as stream:
                xml_raw = stream.read(MAX_DOCX_XML_BYTES + 1)
            if len(xml_raw) > MAX_DOCX_XML_BYTES:
                raise ExtractionError("DOCX XML size limit exceeded")
    except (zipfile.BadZipFile, zipfile.LargeZipFile, zlib.error, EOFError,
            RuntimeError, NotImplementedError, OSError) as exc:
        raise ExtractionError("Invalid DOCX archive") from exc
    xml = _utf8(xml_raw)
    if re.search(r"<!\s*(?:DOCTYPE|ENTITY)\b", xml, re.IGNORECASE):
        raise ExtractionError("DOCX DTD and entity declarations are unsupported")
    encoding = re.match(r"\s*<\?xml[^?]*encoding\s*=\s*['\"]([^'\"]+)", xml, re.IGNORECASE)
    if encoding and encoding.group(1).lower() not in {"utf-8", "utf8"}:
        raise ExtractionError("DOCX XML must use UTF-8")
    try:
        root = ElementTree.fromstring(xml)
    except (ElementTree.ParseError, RecursionError) as exc:
        raise ExtractionError("Invalid DOCX XML") from exc
    word_ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    if root.tag != word_ns + "document":
        raise ExtractionError("Unsupported DOCX document namespace")
    body = root.find(word_ns + "body")
    if body is None:
        raise ExtractionError("DOCX main document body is missing")
    # Verify bounds before extracting. XML external relationships, field code,
    # deleted runs and embedded documents are not traversed or evaluated.
    pending = [(root, 1)]
    nodes = 0
    while pending:
        node, depth = pending.pop()
        nodes += 1
        if nodes > MAX_DOCX_XML_NODES or depth > MAX_STRUCTURE_DEPTH:
            raise ExtractionError("DOCX XML structure limit exceeded")
        pending.extend((child, depth + 1) for child in node)
    parts: list[str] = []
    characters = 0
    excluded = {word_ns + "del", word_ns + "instrText"}
    pending = [(body, False)]
    while pending:
        node, after = pending.pop()
        if node.tag in excluded:
            continue
        value = ""
        if after and node.tag in {word_ns + "p", word_ns + "tr"}:
            value = "\n"
        elif not after:
            if node.tag == word_ns + "t":
                value = node.text or ""
            elif node.tag in {word_ns + "br", word_ns + "cr"}:
                value = "\n"
            elif node.tag == word_ns + "tab":
                value = "\t"
            elif node.tag == word_ns + "tc":
                value = "\t"
            pending.append((node, True))
            pending.extend((child, False) for child in reversed(node))
        if value:
            characters += len(value)
            if characters > MAX_EXTRACTED_CHARACTERS:
                raise ExtractionError("Extracted text limit exceeded")
            parts.append(value)
    return "".join(parts).strip()


def extract_text(raw: bytes, suffix: str, fallback_title: str) -> ExtractedText:
    """Extract one supported non-JSON document, or fail without partial text."""
    suffix = suffix.lower()
    title = fallback_title
    if suffix == ".md":
        content = _bounded(_utf8(raw))
        title = next((line.lstrip("# ").strip() for line in content.splitlines()
                      if line.startswith("# ") and line.lstrip("# ").strip()), fallback_title)
        scope = "markdown_text"
    elif suffix == ".txt":
        content, scope = _bounded(_utf8(raw)), "plain_text"
    elif suffix == ".csv":
        content, scope = _csv(raw), "comma_delimited_rows"
    elif suffix in {".html", ".htm"}:
        title, content = _html(raw, fallback_title)
        scope = "static_body_text"
    elif suffix == ".docx":
        content, scope = _docx(raw), "main_document_body"
    else:
        raise ExtractionError("Unsupported file format")
    return ExtractedText(title=title[:1024], content=_bounded(content), format=suffix[1:], scope=scope)
