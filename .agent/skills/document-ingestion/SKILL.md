---
name: document-ingestion
description: Use when working on upload, validation, text extraction, scanned-PDF detection, canonical text, page offsets or processing status. Defines extraction rules and the quality gate.
---

# Document ingestion

## Goal
Turn an uploaded file into one canonical text string plus page offsets, or reject it with a clear reason.
The user must always see what stage processing is at.

## Steps
1. **Validate**: extension is .pdf or .docx, content matches magic bytes (`%PDF-` for PDF, ZIP header `PK` plus
   `word/document.xml` for DOCX), size under 25MB, pages under 400. Reject others with a specific message.
2. **Store** raw file (see DECISIONS D-031). Create the `documents` row with status `uploading` then `extracting`.
3. **Extract**
   - PDF: pdf.js per page. Join text items into lines using their positions where available, otherwise by
     item order, inserting a space between items on the same line when the gap is meaningful and a newline at
     line changes. Update progress per page ("Extracting page 42 of 150").
   - DOCX: mammoth raw text (or equivalent). No true pages. Create virtual sections of about 3000 characters
     broken at paragraph boundaries and label them "Section n".
4. **Quality gate (PDF)**: a page with fewer than 20 non-whitespace chars is unreadable. If total chars under 100 or
   80 percent or more of pages unreadable: status `rejected`, reason `no_text_layer`, message explains it looks
   scanned and what to do. Otherwise accept and store `unreadable_pages`. Encrypted: `rejected`, `encrypted`.
   Never save an empty document as successful.
5. **Canonicalise**: concatenate pages with a single `\n` between them. Record `pages[i] = {page_number, start_offset,
   end_offset}` into that exact string. Do not re-trim or modify the string after offsets are recorded.
   Optional: detect lines repeated on most pages (headers, footers, page numbers) and record them but keep them in
   the text unless a decision says otherwise. Whatever you do, offsets must match the stored text.
6. **Chunk and index**: see chunking-and-coverage. Status `indexing` then `ready`.
7. Any exception: status `failed` with a readable `status_detail` and a retry action. Never leave a document in a
   permanent in-progress state.

## Rules
- The stored `text` is the single source of truth. Never extract again for verification or highlighting.
- The user message for each rejection must say what happened and what to do next.
- Status must be observable: client polls `GET /api/documents/:id` (or SSE) and shows stage and progress.
- Deleting a document removes the file, text, pages, chunks, quotes and its chats (or marks them for multi-doc chats).

## Tests
- Text PDF fixture ingests, offsets slice back to the page text.
- Image-only PDF fixture is rejected with `no_text_layer`.
- Mixed PDF (some blank pages) accepted with `unreadable_pages` populated.
- Encrypted PDF rejected. Corrupt PDF gives `failed`, not a crash.
- Renamed .exe rejected by magic bytes. .txt rejected by extension.
- DOCX with a table and a numbered list extracts in reading order.
- 150-page fixture ingests with progress updates and completes.

## PDF text-item offset map (D-035)
While building the canonical text from pdf.js items, record per page `items = { starts: number[], lens: number[] }` where `starts[i]` is the offset
of item i's string in the canonical text and `lens[i]` its length (separators we insert are not part of any item). Store with the page row.
Pin `pdfjs-dist` to one version for extraction and for the client renderer. Test: for every item, `text.slice(start, start+len) === item.str`.

## Interrupted jobs and limits (D-039, D-040)
On server start, mark documents stuck in `extracting` or `indexing` as `failed` ("Processing was interrupted") and let Retry rerun from the stored raw file.
Apply per-IP upload limits. Rejected uploads return a reason code and are shown as dismissible cards, not saved as library documents.

## Arabic hedge (D-044)
Count Arabic letters as text in the quality gate. Never crash on right-to-left content. Include one bilingual fixture in the tests.
