---
name: chunking-and-coverage
description: Use when working on splitting documents, retrieval, map-reduce over large contracts, mode selection, or the coverage object and its wording rules. Defines how partial reading is tracked and never misrepresented.
---

# Chunking and coverage

## The honesty rule
If the app read only part of a document it must not answer as though it read all of it. Stating that a clause does
not exist after reading part of the document is the worst possible output. Coverage is data, not decoration: the
prompt, the code and the UI all use it.

## Chunking
- Parse clause structure first: numbered headings (`1.`, `1.1`, `Article 5`, `Clause 12.3`, `Section 4`), ALL-CAPS
  headings, then paragraphs. Split at those boundaries.
- Target about 1500 tokens per retrieval chunk, hard max 2500. Merge tiny clauses, split huge ones at paragraph
  boundaries. Map-reduce batches group consecutive chunks up to about 6000 tokens with a small overlap.
- Each chunk stores `start_offset`, `end_offset` into the canonical text, `ordinal`, `heading`, `clause_ref`, `token_est`.
- Token estimate: `ceil(chars / 4)`.

## Modes
| Mode | When | Coverage |
|---|---|---|
| full | Doc(s) fit `LLM_CONTEXT_BUDGET` | complete |
| map_reduce | Over budget and the question is existence, absence, "list all", "does it contain", or summary | complete if no map call failed |
| retrieval | Over budget and the question is targeted | partial, always |
| agent | Part C | chunks actually retrieved or read |

Router: heuristics (keywords like "is there", "does it contain", "any clause", "list all", "summarise") then a tiny LLM
classification only if unsure. When in doubt for a large document, prefer map_reduce.

## Map-reduce
1. Map over ALL batches, concurrency 4. Each call receives the question and one batch and returns JSON:
   `{ relevant: boolean, candidates: [{ quote, why }] }`. The prompt forbids paraphrase in `quote`.
2. Verify every candidate immediately against that batch's text region using `verifyQuote`. Discard unverified ones.
3. Reduce: one call receiving ONLY verified candidates (with doc and clause refs) plus the question. It writes the
   answer using `<q>` tags that reference those quotes. Verified again on output.
4. A failed map call is retried once. If it still fails, mark those chunks as unread and set `complete=false`.

## Coverage object
```ts
type Coverage = { mode; chunksTotal; chunksRead; complete; unreadablePages: number[]; perDoc: Record<string,{chunksTotal;chunksRead}> }
```
`chunksRead` counts chunks the model actually saw. `complete` is true only if every chunk of every selected document
was read AND no unreadable pages exist.

## Prompt rules (inject based on coverage)
- Complete: "You have the full text. If the document does not contain it, say it was not found in the document."
- Partial: "You have read N of M sections. You must NOT say that something does not exist or is absent. Say what you found
  and that other sections were not read. Use wording like: I did not find X in the sections I searched."
- Always: answer only from provided text, support claims with `<q>` quotes copied exactly, say so when the answer is not present.

## UI
Message header shows the mode. A partial coverage banner is shown on that message and cannot be dismissed.

## Tests
- Chunker on a numbered contract keeps clause boundaries and offsets slice back to the chunk text.
- Router picks map_reduce for "Is there a termination for convenience clause?" and retrieval for "What is the notice period in 14.2?".
- Map-reduce with one forced failing batch yields `complete=false` and the hedged prompt.
- A test asserts that when `complete=false` the system prompt contains the forbidden-absence instruction.
- 150-page fixture: map-reduce covers all chunks and reports `chunksRead === chunksTotal`.
