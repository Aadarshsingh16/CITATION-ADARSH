# Future Technical Roadmap & Architecture Plans

> This document details the architectural blueprints, technical specifications, and implementation plans for the roadmap items listed in `README.md` under **Not Finished / Future Roadmap**.
> These items were intentionally excluded from the initial 3-day core scope per architectural decisions `D-022` (No OCR in core scope) and `D-033` (Single-tenant / No auth).

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

#### A. Database Schema Updates
```sql
ALTER TABLE documents ADD COLUMN is_ocr BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN ocr_confidence NUMERIC(5, 2); -- average word confidence 0-100%
ALTER TABLE pages ADD COLUMN ocr_words JSONB; -- array of { text, box: [x, y, w, h], confidence }
```

#### B. Component Selection & Tradeoffs
1. **Engine Option A (Self-Hosted / Open-Source: Tesseract.js)**:
   - *Pros*: Zero external API cost, no data leaving the infrastructure boundary (ideal for strict NDA / legal compliance).
   - *Cons*: High CPU and RAM utilization (~1.5s per page on 4 cores), degraded accuracy on low-DPI cursive signatures or slanted scans.
2. **Engine Option B (Cloud API: AWS Textract / Google Cloud Vision)**:
   - *Pros*: State-of-the-art table structure recognition, multi-column reading order detection, handwriting / signature detection, 200ms/page.
   - *Cons*: Variable API cost ($1.50 per 1,000 pages), requires customer data processing agreements (DPA) for confidential contracts.

#### C. Preserving Quote Verification Invariants
- OCR text will populate the identical `documents.text` canonical field and generate `pages.items` coordinate records.
- Quote verification ([`src/lib/quotes/index.ts`](file:///c:/projects/Citation-assignment/src/lib/quotes/index.ts)) requires zero algorithmic changes; canonical text and item offset coordinates will drive highlighting onto the rendered raster image or PDF text layer.

---

## 2. Multi-Tenant Authentication & Role-Based Access Control (RBAC)

### 2.1 Problem Statement & Background
Under `D-033`, the application operates in single-tenant mode without user accounts; all uploaded agreements and chats are globally accessible to anyone with the network URL. For enterprise legal deployment, data isolation and strict confidentiality are mandatory.

### 2.2 Proposed Architecture

```
[Client Request]
       │
       ▼
[Next.js Auth Middleware (Edge / Node)]
       ├─ Validates Session JWT / Cookie
       ├─ Resolves `user_id` and active `organization_id`
       │
       ▼
[Tenant-Scoped Database Context (PostgreSQL RLS)]
       ├─ `SET LOCAL app.current_tenant = :org_id;`
       └─ Row-Level Security automatically filters all queries
       │
       ▼
[Application API Routes & Services]
       ├─ Documents table filtered by `tenant_id`
       ├─ Chat sessions filtered by `tenant_id` AND user membership
       └─ Audit Log writes: User X viewed Document Y at Timestamp Z
```

### 2.3 Technical Specifications & Schema Changes

#### A. Schema Migration
```sql
-- Organizations / Workspaces (Tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Memberships with Roles
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'analyst' NOT NULL,
  UNIQUE(organization_id, user_id)
);

-- Tenant Isolation Keys on Data Tables
ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN created_by_user_id UUID REFERENCES users(id);

ALTER TABLE chats ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE chats ADD COLUMN user_id UUID REFERENCES users(id);
```

#### B. PostgreSQL Row-Level Security (RLS) Policy
```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON documents
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);
```

#### C. Role Permissions Matrix
| Action | Owner / Admin | Analyst | Viewer |
|---|:---:|:---:|:---:|
| Upload / Delete Contracts | Yes | Yes | No |
| Ask Questions & Run Agent Research | Yes | Yes | Yes (Read-Only Chat) |
| Compare Contracts | Yes | Yes | Yes |
| Manage Workspace API Keys & Limits | Yes | No | No |
| View Audit Logs | Yes | No | No |

---

## 3. Export to Annotated PDF

### 3.1 Problem Statement & Background
Currently, citation highlights are rendered interactively on the client using the browser's PDF.js canvas and SVG/DOM overlay. Outside counsel, counterparties, and clients require standard, shareable PDF files with genuine embedded PDF highlight annotations (compatible with Adobe Acrobat, Apple Preview, and PDF viewers).

### 3.2 Proposed Architecture

```
[User Clicks "Export Annotated PDF"]
                 │
                 ▼
[POST /api/documents/:id/export]
  Body: { quoteIds: string[], includeNotes: boolean }
                 │
                 ▼
[Annotation Engine (Server-Side using `pdf-lib`)]
  1. Fetch raw PDF buffer from `document_files`
  2. For each verified quote:
       a. Retrieve stored `pages.items` coordinates
       b. Convert from browser display scale to PDF Native Points (72 DPI)
       c. Compute native QuadPoints: [x1, y1, x2, y2, x3, y3, x4, y4]
       d. Create PDF `/Highlight` annotation dictionary
       e. (Optional) Attach popup note with LLM answer & citation metadata
  3. Re-save modified PDF stream
                 │
                 ▼
[Client Downloads: `Contract_Name_Annotated.pdf`]
```

### 3.3 Technical Specifications & Implementation Logic

#### A. PDF Native Coordinate Conversion
In PDF standard specifications (ISO 32000-1):
- The coordinate origin `(0, 0)` is at the **bottom-left** of the MediaBox.
- Browser DOM / Canvas origin `(0, 0)` is at the **top-left**.
- The coordinate translation formula:
  $$\text{pdf\_y} = \text{page\_height} - (\text{dom\_y} + \text{dom\_height})$$
  $$\text{pdf\_x} = \text{dom\_x}$$

#### B. Code Blueprint (`src/server/export-pdf.ts`)
```typescript
import { PDFDocument, PDFName, PDFArray, PDFNumber, PDFString } from "pdf-lib";

export async function exportAnnotatedPdf(
  rawPdfBuffer: Buffer,
  annotations: Array<{
    pageNumber: number;
    rects: Array<{ x: number; y: number; width: number; height: number }>;
    noteText?: string;
  }>
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(rawPdfBuffer);
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.pageNumber - 1];
    const { height: pageHeight } = page.getSize();

    for (const rect of ann.rects) {
      // Convert to PDF 72 DPI bottom-left origin
      const x1 = rect.x;
      const y1 = pageHeight - (rect.y + rect.height);
      const x2 = rect.x + rect.width;
      const y2 = pageHeight - rect.y;

      const highlightDict = pdfDoc.context.obj({
        Type: "Annot",
        Subtype: "Highlight",
        Rect: [x1, y1, x2, y2],
        C: [1, 0.9, 0], // Yellow highlight RGB
        QuadPoints: [x1, y2, x2, y2, x1, y1, x2, y1],
        Contents: PDFString.of(ann.noteText || "Verified Citation"),
      });

      const annotRef = pdfDoc.context.register(highlightDict);
      page.node.addAnnot(annotRef);
    }
  }

  const modifiedBytes = await pdfDoc.save();
  return Buffer.from(modifiedBytes);
}
```

---

## 4. Prioritization & Phased Delivery Timeline

| Phase | Milestone | Primary Deliverable | Estimated Effort |
|---|---|---|---|
| **Phase 9** | Export Engine | Server-side `pdf-lib` highlight annotation exporter (`GET /api/documents/:id/export`) | 2 days |
| **Phase 10** | Enterprise Auth | Multi-tenant PostgreSQL RLS + NextAuth.js / Clerk organization management | 3 days |
| **Phase 11** | OCR Ingestion | Tesseract.js / AWS Textract background ingestion worker for scanned agreements | 4 days |
