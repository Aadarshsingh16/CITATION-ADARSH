# Future Technical Roadmap & Architecture Plans

> This document details the architectural blueprints, technical specifications, and implementation plans for the roadmap items listed in `README.md` and `docs/PHASES.md` under **Optional Extras (only after P8 gate)**.
> 
> **CRITICAL COMPLIANCE RULE (`docs/PHASES.md:L106`)**:  
> *"Unfinished extras are not shipped and not mentioned as done."*  
> In accordance with this rule, none of the following features are claimed as complete in the shipped product. They are documented here solely as forward-looking engineering specifications.

---

## Compliance Audit: Optional Extras Status Matrix

| Optional Extra (`PHASES.md:L105`) | Shipped in Production UI? | Claimed as Done in README? | Current Architectural Status |
|---|:---:|:---:|---|
| **Anonymise (PII Scrubbing)** | **No** | **No** | Designed below in Section 4. |
| **Export to PDF or Word** | **No** | **No** | Designed below in Section 3 & 5. |
| **Clause Extraction UI** | **No** | **No** | Backend parser exists (`clause-parser.ts`); UI explorer designed in Section 6. |
| **Semantic Search (Vector Embeddings)** | **No** | **No** | BM25 is currently active (`D-020`); dense embeddings designed in Section 7. |
| **Arabic & RTL Layout Engine** | **No** | **No** | Unicode glyph counting active; full RTL layout rendering designed in Section 8. |
| **Resumable Ingestion Checkpoints** | **No** | **No** | Document-level retry active (`D-040`); page-level resumption designed in Section 9. |
| **Voice Input** | **No** | **No** | Designed below in Section 10. |

---

## 1. Optical Character Recognition (OCR) Pipeline for Scanned Contracts

### 1.1 Problem Statement & Background
Under `D-021` and `D-022`, any document where $> 80\%$ of pages have fewer than 20 non-whitespace characters is rejected at the quality gate with reason `no_text_layer`. While this prevents corrupt or ungrounded responses, real-world legal workflows frequently involve countersigned, faxed, or archival scanned agreements.

### 1.2 Proposed Architecture

```
[Uploaded Scanned PDF]
         │
         ▼
[Quality Gate Check: < 20 chars/page] ──(Passed)──► Standard Fast Path
         │ (Triggered)
         ▼
[Background OCR Job Dispatcher]
         │
         ├─► Page Rasterizer (pdfjs-dist Canvas / sharp @ 300 DPI)
         │
         ├─► OCR Engine: Local Worker (Tesseract.js) OR Cloud Vision API (AWS Textract / Google Cloud Vision)
         │       └─ Extracts words with bounding boxes (x, y, width, height) & confidence scores
         │
         ▼
[Canonical Offset Reconstruction]
         ├─ Linearizes OCR tokens into logical reading order
         ├─ Records character-to-bounding-box map into `pages.items`
         └─ Stores normalized canonical string in `documents.text`
         │
         ▼
[Database Persistence & Downstream Pipeline]
         └─ Document status marked `ready (ocr)` -> Chunker & BM25 indexer triggered
```

### 1.3 Technical Specifications & Schema Changes
- Database schema: `is_ocr BOOLEAN`, `ocr_confidence NUMERIC(5, 2)`, and `pages.ocr_words JSONB`.
- Invariant: Canonical text and stored item coordinates feed into [`src/lib/quotes/index.ts`](file:///c:/projects/Citation-assignment/src/lib/quotes/index.ts) without altering verification logic.

---

## 2. Multi-Tenant Authentication & Role-Based Access Control (RBAC)

### 2.1 Problem Statement & Background
Under `D-033`, the application operates in single-tenant mode without user accounts; all uploaded agreements and chats are globally accessible. For enterprise legal deployment, data isolation and strict confidentiality are mandatory.

### 2.2 Proposed Architecture
- Next.js Auth Middleware validating Session JWT / Cookie.
- PostgreSQL Row-Level Security (RLS) automatically isolating queries via `tenant_id`.
- Roles: `owner`, `admin`, `analyst`, `viewer`.

---

## 3. Export to Annotated PDF

### 3.1 Architecture & Implementation Logic
- Uses `pdf-lib` to open the raw PDF buffer.
- Translates browser DOM pixel coordinates into ISO 32000-1 native PDF 72-DPI `QuadPoints`.
- Embeds standard `/Highlight` annotation dictionaries with verified citation metadata.

---

## 4. Contract Entity Anonymisation (PII & Confidentiality Scrubbing)

### 4.1 Problem Statement
Enterprise legal teams cannot send client names, banking details, executive personal numbers, or acquisition targets to third-party commercial LLM endpoints without strict redaction.

### 4.2 Proposed Architecture
```
[Contract Canonical Text]
          │
          ▼
[Presidio / Compromise.js Legal NER Engine]
  - Detects: [ORGANIZATION], [PERSON], [EMAIL], [PHONE], [IBAN/ACCOUNT], [DATE]
          │
          ▼
[Deterministic Bi-Directional Token Vault (Stored in Session Memory)]
  "Horizon Enterprises PJSC"  <──►  "[ENTITY_CUSTOMER_1]"
  "AED 250,000"              <──►  "[FINANCIAL_AMOUNT_1]"
          │
          ▼
[Anonymised Text Sent to LLM Context Window]
          │
          ▼
[Model Emits Answer with Anonymised Tags]
  e.g.: "Under <q doc="D1">[ENTITY_CUSTOMER_1] shall pay [FINANCIAL_AMOUNT_1]</q>"
          │
          ▼
[Client-Side De-Anonymisation Layer]
  Rehydrates tags back to real entity names for authorized user view
```

---

## 5. Export to Word (DOCX) Legal Summary Memo

### 5.1 Proposed Architecture
- Client clicks **"Export Legal Memo"** in chat or comparison view.
- Server invokes `docx` npm library creating a styled Word document containing:
  1. Executive Summary & Question Asked.
  2. Synthesized Answer with Footnoted Verbatim Quotes.
  3. Side-by-Side Multi-Document Comparison Matrix.
  4. Document Metadata & Verification Audit Trail (Timestamp, Model, Verifier Status).

---

## 6. Interactive Clause Taxonomy & Outline Navigator

### 6.1 Proposed Architecture
- Leverages the existing [`src/lib/comparison/clause-parser.ts`](file:///c:/projects/Citation-assignment/src/lib/comparison/clause-parser.ts).
- Introduces an interactive sidebar tree view:
  - Clause 1: Definitions
  - Clause 2: Term and Termination (2.1 Initial Term, 2.2 Convenience, 2.3 Cause)
  - Clause 3: Fees & Invoicing
- Clicking any node filters chat context directly to that clause or triggers targeted agent lookups.

---

## 7. Hybrid Semantic Search (Dense Vector Embeddings)

### 7.1 Proposed Architecture
- Augments existing BM25 keyword retrieval ([`src/lib/chunking/retrieval.ts`](file:///c:/projects/Citation-assignment/src/lib/chunking/retrieval.ts)).
- Uses PostgreSQL `pgvector` with HNSW indexing on 1536-dimensional embeddings.
- **Reciprocal Rank Fusion (RRF)**:
  $$\text{RRF\_Score}(d) = \frac{1}{60 + \text{Rank}_{\text{BM25}}(d)} + \frac{1}{60 + \text{Rank}_{\text{Dense}}(d)}$$
- Resolves legal synonyms (e.g. matching queries for *"hold harmless"* to clauses titled *"Indemnification"*).

---

## 8. Full Arabic & RTL Script Layout Engine

### 8.1 Proposed Architecture
- PDF text extraction in Middle Eastern contracts frequently reverses character sequences (visual order vs. logical order).
- Integration of Unicode Bidirectional Algorithm (`bidi-js`) to normalize logical character runs before indexing.
- Dynamic CSS `direction: rtl` and font loading (`Cairo` / `Amiri`) for Arabic contract rendering.

---

## 9. Granular Resumable Page Checkpoint Ingestion

### 9.1 Proposed Architecture
- Currently, interrupted jobs restart from page 1 via `retryDocument` (`D-040`).
- Roadmap: Store incremental page records in `pages` table during ingestion with `checkpoint_page: number`.
- On server restart or failure, the ingestion worker resumes processing from `checkpoint_page + 1` without discarding already extracted pages.

---

## 10. Voice Input (Speech-to-Text Composer)

### 10.1 Proposed Architecture
- Client-side microphone dictate button embedded in chat composer.
- Uses W3C Web Speech API (`webkitSpeechRecognition`).
- Auto-stops upon silence and populates the query input field for hands-free legal research.
