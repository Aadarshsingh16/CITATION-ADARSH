# Submission Note: Architectural Decisions, Tradeoffs, and Failure Modes

## 1. How Quote Verification Works, and Where It Could Fail

### The Architecture
Our quote verification pipeline is built on the core invariant: **the language model is never trusted to determine quote veracity, canonical offsets, or source attribution**. Every quote proposed by the model must be enclosed in structured `<q id="..." doc="...">` tags. The backend runtime intercepts these tags and routes candidate text through our deterministic multi-tier verification engine ([`src/lib/quotes/index.ts`](file:///c:/projects/Citation-assignment/src/lib/quotes/index.ts)):

1. **Deterministic Normalisation & Index Map**: The canonical text and candidate quote are mapped into normalised character arrays (collapsing unicode whitespace, non-breaking spaces, curly quotes, en/em dashes, and ligatures like `fi`/`fl`). An index map array maintains an exact 1-to-1 pointer back to the raw source character offsets.
2. **Whitespace-Insensitive & Hyphen-Tolerant Alignment**: Exact character sequences are located across arbitrary line wraps, extra whitespace inserted by PDF text extraction, and line-end hyphenations (`termi-` / `nation`).
3. **Word-Boundary & Minimum Length Enforcement**: To eliminate false positive matches (e.g., matching `"of the"` inside `"of theory"`), matches must satisfy regex word boundary constraints. Furthermore, quotes under 15 characters are rejected with `too_short` to prevent ambiguous or ungrounded short token snippets.
4. **Strict Per-Document Scoping**: Quotes must match the specific document designated by `doc="D1"`. If identical or similar text appears in another loaded contract, our cross-document verifier detects misattributions and flags them as `wrong_document`.
5. **Exact PDF Canvas Mapping**: Through stored PDF text item coordinates ([`src/lib/ingestion/extract-pdf.ts`](file:///c:/projects/Citation-assignment/src/lib/ingestion/extract-pdf.ts)), the canonical offsets map directly into the PDF.js text layer DOM spans, highlighting exact words and splitting across page breaks.

### Failure Modes and Limitations
- **Extraction Order Inversions**: Multi-column layouts, tables, and callout text boxes can cause PDF extraction engines to interleave words from adjacent columns. If the visual reading order differs from the stream extraction order, genuine quotes spanning columns will fail verification and be marked `not_found`.
- **Model Minor Word Alterations**: If a model replaces a single word (e.g. "shall" $\to$ "will" or "written notice" $\to$ "formal notice"), strict verification intentionally rejects it. Such quotes are visibly badge-flagged as `unverified` and never leaked as genuine.
- **Scanned Text Artifacts**: Without OCR, scanned contracts or image-only pages contain no text layer and are stopped by the quality gate (`no_text_layer`).

---

## 2. How Large Documents Were Handled

Contracts regularly exceed single-prompt context windows and latency budgets. We handled scaling through an intelligent routing and coverage architecture ([`src/lib/chunking/router.ts`](file:///c:/projects/Citation-assignment/src/lib/chunking/router.ts)):

1. **Context-Budget Aware Mode Routing**:
   - **`full` mode**: When the complete contract fits comfortably within the token budget (e.g. $\le 60,000$ tokens), the entire text is provided directly for maximum reasoning context.
   - **`map_reduce` mode**: Triggered when the contract exceeds budget and the query requires exhaustive verification (e.g. existence queries like *"Is there an indemnity clause?"* or *"What are all termination triggers?"*). The document is segmented into chunk batches (~6,000 tokens) with 1-chunk overlap. A concurrent Map phase verifies candidate quotes directly against each chunk, and a Reduce phase synthesizes the final verified response.
   - **`retrieval` mode**: For targeted factual lookups on large agreements (e.g., *"What is the governing law?"*), BM25 keyword search scores chunks and includes adjacent context buffers.
2. **The Coverage Object & Hedging Invariant**:
   Every response carries an explicit `Coverage` payload (`chunksRead`, `chunksTotal`, `complete`, `mode`). Whenever partial reading occurs (`complete: false`), the system prompt strictly forbids categorical negative statements (e.g., asserting *"This clause does not exist in the contract"*). Instead, the model is constrained to hedged, truthful language: *"I did not find [topic] in the 12 sections searched (12 of 85 sections)."*

---

## 3. Part C: Option 2 — Autonomous Agentic Document Research

### Motivation & Implementation
We chose **Option 2 (Agentic Document Research)** because real-world legal diligence requires iterative, multi-hop investigation. Rather than relying on a single retrieval shot, complex legal queries demand:
1. Scanning structural clause headings (`list_clauses`).
2. Conducting keyword searches (`search_document`).
3. Drilling down into specific clause definitions (`get_section`).

The autonomous agent loop ([`src/lib/agent/loop.ts`](file:///c:/projects/Citation-assignment/src/lib/agent/loop.ts)) executes tool calls with hard safety bounds:
- **Round & Call Caps**: Hard limit of 6 iterative rounds and 12 total tool calls. If the agent exhausts its budget, it terminates cleanly and synthesizes an answer using accumulated evidence, accompanied by an honest partial coverage warning.
- **Resilient Recovery**: Unknown tools, missing parameters, or unselected documents return structured error feedback rather than throwing exceptions. If a model fails to format native tool calls, a JSON text action fallback parses tool execution seamlessly.
- **Live SSE Trace**: Each tool invocation emits real-time Server-Sent Events displaying tool name, arguments, elapsed milliseconds, and status in the `AgentTraceUI`.
- **Final Quote Verification**: Crucially, final answers produced by the agent loop pass through the same strict quote verification engine before display.

### Hardest Technical Challenge
The hardest challenge was ensuring deterministic quote verification on the agent's synthesized output. Agents have a tendency to summarize and paraphrase the evidence they uncovered during tool execution. Enforcing strict `<q>` tags in the agent loop's system instructions and feeding the final text through the verification engine ensured that even autonomous agent answers never hallucinate unverified quotes.

---

## 4. What to Build Next

1. **OCR Pipeline for Scanned Contracts**: Integrate a local Tesseract worker or cloud vision model to process scanned and low-DPI PDF pages, feeding into the same canonical offset map.
2. **Hybrid Semantic + BM25 Embeddings**: Augment BM25 keyword retrieval with dense vector embeddings (e.g., `text-embedding-3-small`) to improve retrieval for conceptually synonymous legal provisions (e.g., "hold harmless" $\leftrightarrow$ "indemnification").
3. **True PDF Annotation & Sticky Notes**: Leverage PDF.js canvas viewport coordinates to persist persistent highlight layers and export marked-up contracts with downloadable annotations.
4. **Multi-Tenant Workspaces & RBAC**: Introduce organizational tenancy, role-based document access controls, and audited client matter separation.
