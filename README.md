# Contract Analyser

> Skeleton. Fill in each section as the phase that produces it passes its gate.
> Do not describe anything as working until it was run and observed.

## What it does
Upload a contract (PDF or DOCX), ask questions in a chat, and get answers drawn only from the document.
Every answer is backed by quotes our code verifies against the document text before they are shown as
verified. Clicking a quote opens the document at that passage and highlights it. Select several documents
to ask one comparative question, compare two versions of a contract, and let an agent research the document
with tools for harder questions.

**Live app:** TODO
**Demo video:** TODO

## Screenshots
| Screen | Image |
|---|---|
| Upload and library | TODO |
| Chat with verified quotes | TODO |
| Citation highlighting | TODO |
| Document comparison | TODO |
| Agent research trace | TODO |

## How it works (short)
- One canonical text per document, with page offsets.
- One shared quote matcher used for verification and highlighting.
- The model never decides positions or sources. We locate quotes ourselves and record what we sent.
- Coverage is tracked on every answer. Partial reading is stated, never hidden.
- Details: `docs/ARCHITECTURE.md`, decisions: `docs/DECISIONS.md`.

## Run locally
```bash
git clone TODO
cd contract-analyser
cp .env.example .env.local        # fill in the values below
docker compose up -d              # local Postgres
npm install
npm run db:migrate
npm run dev                       # http://localhost:3000
```

### Environment variables
| Name | Purpose |
|---|---|
| `LLM_BASE_URL` | OpenAI-compatible API base URL |
| `LLM_API_KEY` | API key (never commit) |
| `LLM_MODEL` | Model name |
| `LLM_CONTEXT_BUDGET` | Token budget for sending a whole document (default 60000) |
| `DATABASE_URL` | Postgres connection string |
| `MAX_AGENT_ROUNDS` | Agent round cap (default 6) |
| `MAX_AGENT_TOOL_CALLS` | Agent tool call cap (default 12) |

### Tests and evals
```bash
npm test                          # unit tests (quotes, chunking, agent validation)
npm run eval                      # fabrication-rate eval against the configured model
```

## Status

### Finished
TODO (list only what was verified on the deployed app)

### Not finished
TODO (be specific)

### Known limitations
- No authentication: anyone with the URL can see all documents.
- Scanned PDFs are rejected, there is no OCR.
- Strict quote matching can reject a genuine quote that the model altered slightly. It is shown as unverified.
- DOCX files have no real pages, the viewer shows sections.
- TODO: add what you find while testing.

## Note
`docs/NOTE.md`: how quote verification works and where it can fail, how large documents are handled, Part C
choice and hardest part, what would come next.
