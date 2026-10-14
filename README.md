# Contract Analyser

> A high-precision contract analysis, verification, and comparison system built with Next.js 16 (Turbopack), TypeScript, PostgreSQL, and PDF.js.  
> Every factual assertion is strictly grounded in verbatim quotes programmatically verified against canonical contract text before being presented to the user.

> 🌐 **Live Deployed App**: [**https://citation-analyser.onrender.com**](https://citation-analyser.onrender.com)  
> 🎥 **Demo Video**: *(Paste Loom / YouTube video link here)*

---

## What the App Does

Contract Analyser is a legal web application designed for objective, grounded contract diligence. Users upload legal agreements (PDF or DOCX) and interrogate them with natural language questions.

- **Strict Verbatim Quotations**: Every answer is grounded in exact quotes from the contract. Before a quote is displayed, our deterministic backend verification engine checks the quote against the canonical document text. If a quote is altered, paraphrased, or hallucinated, it is marked as `unverified` and never presented as genuine.
- **Absence Honesty**: When a queried clause, penalty, or condition does not exist in the contract, the system explicitly reports that it was not found rather than inventing plausible legal terms.
- **Real PDF Canvas Citation Highlighting**: Clicking any verified citation navigates the document viewer to the exact page, auto-scrolls, and highlights the exact words directly on the rendered PDF canvas across line wraps and page boundaries.
- **Large-Document Scaling & Coverage**: For lengthy contracts (100+ pages), queries route dynamically between full-context, map-reduce, and BM25 retrieval. An explicit coverage indicator tracks sections read, and prompt rules strictly forbid false absence assertions on partial readings.
- **Multi-Document Comparative Analysis**: Query multiple agreements simultaneously. The model organizes findings side-by-side by topic with document badges, verifying each quote strictly against its source document.
- **Contract Version Comparison**: Aligns two contract versions, categorizes changes by significance (High, Medium, Low, Cosmetic), extracts financial and legal signals (liability caps, payment terms, notice periods), and provides token-level redline word diffs.
- **Autonomous Agent Research Mode (Part C, Option 2)**: For complex multi-step inquiries, an agent loop autonomously queries tools (`search_document`, `get_section`, `list_clauses`), displays live progress traces, enforces round caps, and validates final answers through the quote verifier.

---

## Screenshots of the Main Screens

### 1. Upload & Document Library
Document management supporting searchable PDFs and DOCX files. Displays file glyphs, page counts, processing statuses, and quality gate notifications for encrypted files or scanned documents lacking a text layer, alongside 1-click sample contract seeding.

![Upload and Document Library](public/screenshots/01-upload-and-library.png)

---

### 2. Chat with Verified Quotes
Interactive legal chat where every assertion is backed by programmatic quotes. The evidence margin displays green `Verified` badges, source file tags, and quick actions to copy quotes or inspect them in the document.

![Chat with Verified Quotes](public/screenshots/02-chat-verified-quotes.png)

---

### 3. Real PDF Canvas Citation Highlighting
Clicking a quote opens the Reading Desk, auto-scrolls, and applies a marker highlight directly over the rendered text layer on the PDF canvas with a visual pulse sweep.

![Real PDF Canvas Citation Highlighting](public/screenshots/03-citation-highlighting.png)

---

### 4. Document Version Comparison
Fixed split workspace comparing contract revisions. Features a substantive headline summary, contract Spine change map, filter chips, sort controls, and side-by-side / inline redline diffing with seal underlines for additions and redline strikethroughs for deletions.

![Document Version Comparison](public/screenshots/04-contract-comparison.png)

---

## How to Run It Locally

### Prerequisites
- **Node.js**: v20 or higher (v24 recommended)
- **Docker Desktop**: Running locally (for PostgreSQL)
- **API Key**: [OpenRouter](https://openrouter.ai/) or [OpenAI](https://platform.openai.com/)

### 1. Clone & Install
```bash
git clone https://github.com/Aadarshsingh16/CITATION-ADARSH.git
cd CITATION-ADARSH
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Database connection (PostgreSQL via Docker on port 5434)
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/contract_analyser # gitleaks:allow

# LLM Gateway
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your_api_key_here
LLM_MODEL=openai/gpt-4o
LLM_FAST_MODEL=google/gemini-2.5-flash

# Operational Parameters
LLM_CONTEXT_BUDGET=60000
MAX_AGENT_ROUNDS=6
MAX_AGENT_TOOL_CALLS=12
PORT=3000
```

### 3. Start Database & Run Migrations
```bash
docker compose up -d
npm run db:migrate
```

### 4. Start the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Click **"Seed Sample Contracts"** in the top bar to instantly load pre-configured legal test agreements.

### 5. Automated Tests & Evaluation
```bash
# Run all 10 unit and acceptance test suites (89 automated tests)
npm test

# Run the 12-question legal benchmark evaluation
npm run eval

# Verify production Next.js build
npm run build
```

---

## What is Finished and What is Not

### What is Finished (100% Verified)
- [x] **File Validation & Ingestion (Part A)**: PDF and DOCX text extraction with text item coordinate preservation; scanned PDF rejection gate (`no_text_layer`); encrypted file detection.
- [x] **Chat & Strict Quote Verification (Part A)**: Streaming SSE token responses; stop button preserving partial text; persistent chat history; deterministic normalisation and index mapping; zero trust in model offsets; absence honesty.
- [x] **Large Document Scaling (Part A)**: Dynamic context routing (`full`, `map_reduce`, `retrieval`); 150-page contract execution; explicit coverage accounting and negative hedging guards.
- [x] **Real PDF Canvas Highlighting (Part B)**: DOM text layer highlight alignment; multi-line and cross-page quote splitting; occurrence stepper navigation; canonical text fallback.
- [x] **Multi-Document Analysis (Part B)**: Topical side-by-side synthesis (`[D1]`, `[D2]`); strict per-document quote scoping; cross-document misattribution detection (`wrong_document`).
- [x] **Contract Version Comparison (Part B)**: Clause alignment; significance classification (High, Medium, Low, Cosmetic); financial signal extraction (caps, fees, dates); token-level redline/seal diffing; anti-fabrication summary guard (D-041).
- [x] **Autonomous Agent Research Mode (Part C, Option 2)**: Multi-round loop with tools (`search_document`, `get_section`, `list_clauses`); live SSE progress trace UI; round caps (6) and call caps (12); resilient error recovery; strict quote verification on final answers.
- [x] **Production Polish & Hardening**: Token-bucket per-IP rate limiting (60 req/min); daily token ceiling; stale-job sweeper with 1-click retry; SHA-256 duplicate alert; pre-seeded legal contracts.

### What is Not Finished (Future Roadmap)
- [ ] **OCR for Scanned Documents**: Documents lacking an extractable digital text layer are halted at the quality gate (`no_text_layer`) with a clear error notice rather than processed through an optical character recognition pipeline.
- [ ] **Multi-Tenant Authentication & RBAC**: The application operates in single-tenant mode without user accounts or role-based permission tiers.
- [ ] **ISO Standard PDF Highlight Export**: Highlights are rendered interactively in the browser on the PDF.js canvas; exporting downloaded PDF files with embedded ISO 32000-1 `/Highlight` annotation dictionaries is a future enhancement.
