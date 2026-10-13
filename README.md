# Contract Analyser

> A high-precision contract analysis, verification, and comparison system built with Next.js 16 (Turbopack), TypeScript, PostgreSQL, and PDF.js.
> Every factual assertion is strictly grounded in verbatim quotes programmatically verified against canonical contract text before being presented to the user.

---

## What It Does

Upload legal contracts (searchable PDF or DOCX), query them in natural language, and receive precise, objective answers.
- **Strict Verbatim Quotations**: Answers are backed by programmatic inline `<q>` citations verified against the document before display. If a quote is paraphrased, altered, or hallucinated, it is clearly flagged as `unverified` and never represented as genuine.
- **Absence Honesty**: When a clause, penalty, or topic is not in the contract, the system explicitly reports that it was not found rather than inventing plausible legal terms.
- **Real PDF Canvas Highlighting**: Clicking any citation instantly navigates the document viewer to the exact page, auto-scrolls, and highlights the exact words on the rendered PDF canvas across multiple lines or page boundaries.
- **Large-Document Scaling & Coverage**: For lengthy contracts (e.g. 100+ pages), queries route dynamically between full-context, map-reduce, and BM25 retrieval. Answers provide an explicit coverage tracker and use hedged wording when only partial sections were read.
- **Multi-Document Comparative Analysis**: Ask questions across multiple agreements simultaneously. The model structures answers by topic side-by-side, strictly attributing quotes to their source document.
- **Contract Version Comparison**: Aligns two contract versions, extracts numerical signals (liability caps, notice days, interest rates), highlights substantive vs cosmetic changes, and validates summaries against hallucinated numbers (D-041).
- **Autonomous Agent Research Mode (Part C, Option 2)**: For multi-step inquiries, an agent loop autonomously queries tools (`search_document`, `get_section`, `list_clauses`), emits live progress trace events, enforces hard round caps, and validates final synthesis through the quote verifier.

---

## Evaluation Benchmark & Metrics

We evaluate the system against 12 representative legal questions spanning present terms, absent provisions, 125-page framework agreements, multi-contract diffs, and autonomous agent lookups using `npm run eval`.

| Metric | Target | Measured Result | Status |
|---|---|---|---|
| **Quote Fabrication Rate** | $\le 5\%$ (after strict verification) | **0%** (0 unverified of 10 proposed) | **PASS** |
| **Unverified Shown as Genuine** | **0.0%** (Hard Invariant) | **0.0%** (0 leaked across all suites) | **PASS** |
| **Present Recall** | $\ge 90\%$ | **100%** (8/8 facts cited with verified quotes) | **PASS** |
| **Absence Honesty** | **100.0%** | **100%** (3/3 absence claims honest) | **PASS** |
| **Large-Doc Coverage Mode** | Complete map-reduce on existence queries | **100.0%** complete coverage verified | **PASS** |
| **Agent Robustness** | Zero uncaught crashes on invalid tool calls | **100.0%** structured error recovery | **PASS** |

*Evaluation run against `openai/gpt-4o` on OpenRouter. Full detailed results logged in [`evals/report.md`](file:///c:/projects/Citation-assignment/evals/report.md).*

---

## Architecture & Core Invariants

1. **Deterministic Canonical Text & Index Map**:
   - Each uploaded file is normalized into a canonical text string with exact character offset pointers to pages and rendered PDF text items.
2. **Never Trust the Model**:
   - The LLM never dictates start/end offsets or quote verification status. Our code locates quotes, normalizes spacing, checks word boundaries, and verifies source documents.
3. **Partial Coverage Transparency**:
   - The system tracks `chunksRead` vs `chunksTotal`. If partial reading occurs, unconditional negative assertions are strictly blocked by prompt guards.
4. **Resilient System Polish**:
   - Per-IP rate limiting (60 req/min) and global daily token ceiling (500k tokens) protect resources.
   - Background stale-job sweeper transitions stuck jobs to `failed` with a 1-click `Retry` option.
   - SHA-256 content deduplication prevents accidental duplicate processing.

---

## Quickstart & Local Setup

### Prerequisites
- Node.js 20+ (v24 recommended)
- Docker Desktop (for PostgreSQL container)
- OpenAI or OpenRouter API key

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd contract-analyser
npm install
```

### 2. Configure Environment
Create a `.env` file in the project root:
```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/contract_analyser # gitleaks:allow

# LLM Provider (OpenRouter or OpenAI)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your-api-key-here
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

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Click **"Seed Sample Contracts"** in the UI to instantly load pre-configured legal fixtures (MSA 2024, Mutual NDA, Amendment No 1, and 125-page Enterprise Framework).

---

## Verification & Testing

The repository contains 10 comprehensive unit and acceptance test suites (82 automated tests):

```bash
# Run all 10 test suites
npm test

# Run the 12-question evaluation benchmark
npm run eval

# Verify production Next.js build
npm run build
```

### Test Suites Included:
1. `tests/stream-parser.test.ts`: Incremental `<q>` tag parsing across token boundaries.
2. `tests/quotes.test.ts`: Normalisation, whitespace tolerance, word boundary checks, wrong document detection.
3. `tests/phase1-ingestion.test.ts`: PDF/DOCX validation, text extraction, scanned PDF quality gate, 150-page scaling.
4. `tests/phase2-chat.test.ts`: Persistence, stop mid-stream, quote verification, prompt injection defense.
5. `tests/phase3-large-docs.test.ts`: Router, map-reduce batching, coverage hedging.
6. `tests/phase4-citations.test.ts`: Real PDF canvas text span matching, multi-line, cross-page split, fallback.
7. `tests/phase5-multi-doc.test.ts`: Multi-doc chat sessions, topical side-by-side prompt, document attribution.
8. `tests/phase6-compare.test.ts`: Clause aligner, financial signal extraction, anti-fabrication validator (D-041).
9. `tests/phase7-agent.test.ts`: Agent tools, error recovery, live SSE trace, round/call caps.
10. `tests/phase8-polish.test.ts`: Token bucket rate limiter, daily token ceiling, stale sweeper + retry, SHA-256 duplicate alert.

---

## Status: Finished vs Not Finished

### Finished & Verified
- [x] Complete PDF & DOCX text extraction with text item coordinate preservation (D-035).
- [x] Scanned PDF quality gate rejecting image-only documents (`no_text_layer`).
- [x] Chat interface with streamed token rendering, Stop response button, and persistence.
- [x] Programmatic quote verification engine with whitespace normalisation and multi-page splitting.
- [x] Interactive PDF.js viewer with real canvas text layer highlighting, occurrence navigator, and canonical fallback.
- [x] Context router with map-reduce batching and transparent Coverage banner.
- [x] Multi-document chat with side-by-side comparative topical synthesis.
- [x] Contract version comparison with deterministic signal extraction and anti-fabrication guard (D-041).
- [x] Part C (Option 2): Autonomous Agent Research loop with 3 tools, live SSE trace UI, and round caps.
- [x] Rate limiting (60 req/min), daily token ceiling, stale job sweeper with Retry, and duplicate upload alerts.
- [x] Evaluation harness (`npm run eval`) with 12/12 passing benchmark questions.

### Not Finished / Future Roadmap
*(Detailed architectural blueprints and implementation specifications are documented in [`docs/FUTURE_ROADMAP.md`](file:///c:/projects/Citation-assignment/docs/FUTURE_ROADMAP.md))*
- [ ] **OCR for Scanned Documents**: Documents lacking a digital text layer are rejected at the quality gate (`D-021`, `D-022`) rather than processed via optical character recognition.
- [ ] **Multi-Tenant Authentication**: The system operates in single-tenant mode without user accounts or role-based access control (`D-033`).
- [ ] **Export to Annotated PDF**: Currently, highlights are rendered interactively on the client PDF.js canvas; exporting modified PDF files with embedded ISO-standard highlight annotation dictionaries is not yet implemented.

---

## Detailed Notes & Walkthrough
- [Architecture & Invariants](file:///c:/projects/Citation-assignment/docs/ARCHITECTURE.md)
- [Future Technical Roadmap](file:///c:/projects/Citation-assignment/docs/FUTURE_ROADMAP.md)
- [Submission Reflection Note](file:///c:/projects/Citation-assignment/docs/NOTE.md)
- [Video Demo Script](file:///c:/projects/Citation-assignment/docs/DEMO_SCRIPT.md)
- [Submission Checklist & Claims Audit](file:///c:/projects/Citation-assignment/docs/SUBMISSION_CHECKLIST.md)
- [Production Deployment Guide](file:///c:/projects/Citation-assignment/docs/DEPLOY.md)
