# Phases

Rule: do not start phase N+1 until phase N's exit gate passes and was observed, not assumed.
Every phase ends with a commit, a deploy, and a DECISIONS.md update for anything decided.

Time plan (3 days): Day 1 = P0 to P2 (the vertical slice, deployed). Day 2 = three parallel tracks (below).
Day 3 = P7, integration, P8.
If time slips, cut in this order: extras, quote repair pass, DOCX viewer polish, comparison side-by-side word
highlighting. Never cut verification, coverage honesty, PDF page highlighting, or the deploy.

### Parallel tracks after the P2 gate (decision D-043)
| Track | Phases | Owns (files) | Reads only |
|---|---|---|---|
| A: depth | P3 then P7 | `src/lib/chunking/`, `src/lib/agent/`, map-reduce, modes | `quotes.ts`, shared types |
| B: viewer | P4 then P5 | `src/components/viewer/`, multi-doc UI and prompt | `quotes.ts`, shared types |
| C: comparison | P6 | `src/lib/compare/`, comparison UI | clause parser, shared types |
Rules: `quotes.ts` and `src/lib/types.ts` are frozen after the P2 gate, changes go through the main agent. One branch per track,
merge to main at least once a day, run the full test suite after each merge. If you run one agent at a time,
use this serial order: P3, P4, P5, P6, P7.

---

## P0. Scaffold, docs, empty deploy
**Scope**: Next.js + TS + Tailwind, Drizzle + Postgres (docker-compose locally), env config,
folder skeleton, these docs, `.agent` rules and skills, deploy an empty app.
**Also in P0**: `npm run llm:check` smoke test against the chosen model: streaming works, abort works, a tool call round
trip works, JSON-only output works. If native tool calls are flaky, enable the JSON action fallback (D-038) now, not on Day 3.
**Exit gate**: `npm run dev` and `npm run build` pass. Live URL loads. `.env*` ignored, no secrets in git. `llm:check` output pasted.
**Demo step**: open the deployed URL.

## P1. Upload, extraction, status, library
**Scope**: validation, PDF and DOCX extraction, canonical text and page offsets, quality gate (scanned,
encrypted, partially unreadable), status pipeline with progress, library list, open, delete, chunking
and BM25 index built at ingestion, per-page pdf.js item offset map (D-035), stale-job sweep on start (D-040),
upload and API rate limits (D-039), rejected uploads as dismissible cards (D-045).
**Exit gate**: A1 to A5 pass. A 150-page PDF ingests. Scanned PDF is rejected with the correct message.
Delete removes everything.
**Demo step**: upload good PDF, DOCX, a scan, and a .txt, in that order.

## P2. Streaming chat, stop, history, verified quotes
**Scope**: `/api/chat` SSE, LLM client from env, prompt with `<q>` protocol, stream tag parser, `quotes.ts`
with normalisation and index map, verifier on tag close, quote events, pills and cards, stop with partial save,
history per document, "not in the document" behaviour, telemetry counters.
**Exit gate**: A6 to A13 pass. `quotes.ts` unit tests pass (see quote-verification skill). A forced fake quote is
badged unverified. Stop keeps partial text and already-verified quotes.
**Demo step**: ask a question, then ask about something absent, then stop mid-stream.

## P3. Large documents and coverage
**Scope**: token estimate, mode router, map-reduce over all chunks, retrieval mode, Coverage object on every
message, coverage banner, prompt rules forbidding absence claims on partial coverage, failed map call handling.
**Exit gate**: A14 and A15 pass on a real 150-page file. Absence question on the large file runs map-reduce and
reports complete coverage. A forced partial run shows the banner and hedged wording.
**Demo step**: "Is there a termination for convenience clause?" on the 150-page file.

## P4. Citation highlighting
**Scope**: PDFs render as real pages (pdf.js canvas + text layer) and highlights are mapped onto text-layer spans
using the stored item offsets (D-034, D-035). `splitByPages` gives one range per page, each overlapping item gets a
partial `<mark>`. Multi-line, cross-page and repeated quotes via the same code. Occurrence counter with next and
previous, prefer the match inside the cited chunk, scroll the first highlight into view, open from quote card or pill.
DOCX and any page where item counts disagree use the canonical-text viewer with offset highlighting.
**Exit gate**: B1 to B4 pass on a real rendered PDF page, including a quote that crosses a page break, a quote across
three lines, and a quote that appears twice. DOCX highlight works in the text viewer. Fallback proven by forcing a mismatch.
**Demo step**: click three different quotes including a repeated and a cross-page one, then one in a DOCX.

## P5. Multi-document questions
**Scope**: multi-select in the sidebar, `scope=multi` chats, labelled doc ids in prompt, comparative answer
structure, verification per quote against its own document, `wrong_document` reason, doc label on every quote,
coverage per document.
**Exit gate**: B5 to B7 pass with three documents. Misattributed quote is flagged.
**Demo step**: "How do the termination terms differ across these three contracts?"

## P6. Document comparison
**Scope**: clause parser, alignment, classification, deterministic signals, LLM judge, overall summary, results
UI with filter and sort, side-by-side view with highlighted changes.
**Exit gate**: B8 to B10 pass using a prepared pair that includes an AED 100,000 to AED 1,000,000 cap change,
a pure rewording, a renumbered clause, an added clause and a removed clause.
**Demo step**: compare the prepared pair, filter to High.

## P7. Part C: agentic research (Option 2)
**Scope**: tools and zod schemas, loop with round and tool-call caps, token budget, invalid call handling,
progress SSE events and AgentTrace UI, final answer through the same verifier, coverage from retrieved chunks.
**Exit gate**: C1 to C6 pass. Tests for unknown tool, missing args, nonsense args, and cap reached.
**Demo step**: a question requiring several lookups, then a deliberately looping prompt hitting the cap.

## P8. Evals, docs, polish, submission
**Scope**: eval run and recorded fabrication rate, README with screenshots, demo video script and recording,
half-page note, UI state audit against DESIGN.md, deployed build smoke test with a fresh contract.
**Exit gate**: every row of the PROJECT_BRIEF checklist is verified on the deployed link, in a private window, with a contract
not used during development. The claims audit in `docs/SUBMISSION_CHECKLIST.md` is complete. README states honestly
what is not finished.
**Demo step**: the full 3 to 5 minute video.

---

## Phase workflow
1. Read the phase scope and the relevant skill files.
2. Write or update tests first for the risky parts (quotes, chunking, agent validation).
3. Build.
4. Run the exit gate yourself and record what you saw.
5. Update DECISIONS.md and EDGE_CASES.md (mark which cases are handled).
6. Commit with a conventional message, deploy, smoke test the live app.
7. Report to the owner: what works, what does not, what is OPEN. Then stop for approval.

## Optional extras (only after P8 gate)
Anonymise, export to PDF or Word, clause extraction, semantic search, Arabic and RTL, resumable background
jobs, voice input. Unfinished extras are not shipped and not mentioned as done.
