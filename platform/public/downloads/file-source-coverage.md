# File and folder source coverage

This source scans a configured directory and its non-hidden subdirectories on
the runtime's polling schedule. It does not scan an entire machine, infer an
organization's architecture, or infer operating-system/enterprise permissions.
The filesystem adapter requires POSIX directory descriptors with no-follow
support (Linux, or an appropriate Linux container).

## Supported formats

| Extension | Extracted content | Stable identity | Access rule |
|---|---|---|---|
| `.md` | UTF-8 Markdown text; first level-one heading supplies the title | `file:<relative path>` | Explicit source `identities`, otherwise unknown |
| `.txt` | UTF-8 plain text | `file:<relative path>` | Explicit source `identities`, otherwise unknown |
| `.csv` | UTF-8, comma-delimited rows, preserving field text | `file:<relative path>` | Explicit source `identities`, otherwise unknown |
| `.html`, `.htm` | Static body text and document title | `file:<relative path>` | Explicit source `identities`, otherwise unknown |
| `.docx` | Main document body text, including paragraph and table text | `file:<relative path>` | Explicit source `identities`, otherwise unknown |
| `.json` | Existing Concord document contract: `id`, `title`, `content`, `acl`, `schema_version: 1` | Explicit `id` | Explicit document `acl`; null means unknown |

Extension matching is case-insensitive. UTF-8 BOM text is accepted. Renaming a
path-identified file is observed as removing one scoped object and adding
another. JSON's explicit ID survives a rename. Source metadata records the
relative path, extraction format/scope, and SHA-256 of original non-JSON file
bytes. File-byte and configured-identity changes update revision fingerprints.

The source-level `identities` setting is an operator declaration; it is not
proof that the same users can access the source application or filesystem. `null`
means unknown and `[]` means no identities. Neither permits retrieval.

## Extraction boundaries

- HTML extraction does not run JavaScript, load CSS/images, resolve links, or
  reproduce browser visibility. Script/style/template/noscript, head content
  except the title, and embedded SVG/MathML/iframe/object content are excluded.
  Unusual or malformed-but-parseable HTML follows the standard-library parser's
  interpretation. Files requiring rendering need a separate supported adapter.
- DOCX reads only `word/document.xml` in the normal WordprocessingML namespace.
  Headers, footers, comments, footnotes, tracked deleted runs, field instructions,
  embedded documents/media, and external relationships are not indexed. Table
  text is flattened. No layout preservation, macro execution or network lookup
  occurs. Encrypted archives, DTD/entity declarations, and non-UTF-8 XML are
  rejected. A file in another XML namespace requires an explicit future parser.
- CSV is one document, not a per-row database. Comma is the supported delimiter;
  it is not guessed. Formula-looking strings remain text and are never executed.
- PDF (including scanned documents), legacy `.doc`, XLS/XLSX, PPT/PPTX, arbitrary
  JSON, audio, images and arbitrary archives are outside scope. Hidden files and
  directories are excluded. An unsupported extension is skipped; a complete
  scan claims coverage only for the supported non-hidden formats above.

## Limits and failure behavior

Existing configurable bounds remain: maximum file count, raw bytes per file,
raw bytes for the scan, directory entries, and traversal depth. Total extracted
UTF-8 bytes also respect `max_total_bytes`; the runtime independently limits
each document to 1 MiB and the indexed snapshot to 16 MiB.

Additional fixed extraction limits:

| Limit | Value |
|---|---:|
| Extracted text per non-JSON file | 1,000,000 characters and 1,048,576 UTF-8 bytes |
| CSV rows / columns | 10,000 / 256 |
| CSV field size | Python standard-library CSV default (normally 131,072 characters) |
| HTML tags / nesting | 50,000 / 64 |
| DOCX archive members | 128 |
| DOCX declared total expanded bytes | 8,000,000 |
| DOCX main XML bytes | 2,000,000 |
| DOCX compression ratio per member | 100:1 |
| DOCX XML nodes / nesting | 50,000 / 64 |

Malformed supported files, excessive limits, symlinks, unreadable entries,
concurrent file replacement, or partial traversal make the snapshot incomplete.
The runtime retains its prior records for recovery, blocks affected registered
retrieval according to its source-health policy, and does not infer deletion
from that observation. Successful subsequent complete scans can recover.

These limits deliberately reject some legitimate large/complex files. Nothing
silently truncates content and then reports a fully synchronized document.

## Validation performed

The new tests use real temporary folders, UTF-8 text/CSV/HTML, and generated DOCX
ZIP files. They check deterministic provenance, outside file edits reaching both
registered local retrieval routes, allowed/denied identities, incomplete
extraction retaining prior records without false deletion, malformed ZIP/XML,
DTD/encoding rejection, archive path/duplicate checks, compression/XML/structure
limits, and CSV bounds. They do not establish fidelity for arbitrary customer
documents or compatibility with an external application API.
