---
name: quote-verification
description: Use when writing or changing anything that locates, verifies, highlights or displays a quote from a document. Defines the normalisation and index-map algorithm, the never-trust-the-model rule, and the tests that must always pass.
---

# Quote verification

This is the most important part of the product. A quote is "verified" only when our code found it in
the document's canonical text. Everything else is unverified.

## Rules
1. All matching lives in `src/lib/quotes.ts`. Server verification and client highlighting both import it.
2. Never use model-reported page numbers, offsets or positions. Locate the quote ourselves.
3. Verify against the document named in the quote's `doc` attribute only. If the text exists only in a
   different selected doc, return `wrong_document`. Never re-attribute.
4. Strict matching only. No fuzzy fallback.
5. The verifier must never throw. Wrap it. On error return `{status: 'unverified', reason: 'verifier_error'}`.
6. Offsets returned are into the canonical text, so the viewer can highlight them directly.

## API
```ts
type Match = { start: number; end: number }          // offsets in canonical text, end exclusive
type VerifyResult =
  | { status: 'verified'; matches: Match[]; withGaps?: boolean }
  | { status: 'unverified'; reason: 'not_found' | 'too_short' | 'wrong_document' | 'verifier_error' | 'malformed' }

normalise(text: string): { norm: string; map: number[] }   // map[i] = original index of norm[i]
locateAll(quote: string, docText: string, opts?): Match[]
verifyQuote(quote: string, docText: string, opts?): VerifyResult
pickMatch(matches: Match[], preferRange?: {start:number,end:number}): Match   // prefer one inside the cited chunk
splitByPages(match: Match, pages: {start:number,end:number}[]): {page:number,start:number,end:number}[]
```

## Algorithm
Normalise, char by char (so the index map stays exact):
1. NFKC the single char (expands ligatures such as the "fi" ligature).
2. Remove soft hyphen (U+00AD) and zero-width chars (U+200B to U+200D, U+FEFF).
3. Curly quotes to straight (U+2018, U+2019 to `'`, U+201C, U+201D to `"`).
4. All dash variants (U+2010 to U+2015, U+2212) to `-`.
5. Lowercase.
6. Drop all whitespace (including NBSP and newlines).
Each emitted normalised char records the original index of the char it came from.

Line-end hyphenation: build two variants of the document text and search both.
- Variant A: remove `-` followed by whitespace-with-newline between letters (joins "termi-\nnation").
- Variant B: keep the hyphen (real compounds like "sub-\ncontractor" become "sub-contractor" after whitespace removal).
Map matches back through each variant's own index map.

Matching:
1. Normalise the quote. If shorter than `MIN_QUOTE_CHARS` (15) return `too_short`.
2. Find all occurrences of the normalised quote in the normalised text (indexOf loop, advancing by 1).
3. Convert each occurrence to original offsets: `start = map[i]`, `end = map[i + len - 1] + 1`.
4. Word-boundary check on the ORIGINAL text: if the quote starts with a letter or digit, the original char before `start`
   must not be a letter or digit. Same at `end`. Drop failures.
5. De-duplicate overlapping matches from variants A and B.
6. No matches: `not_found`.

Ellipsis: split the quote on `...` or the ellipsis char. Normalise each segment (each at least 15 chars, else `too_short`).
Find the first segment, then each next segment within `ELLIPSIS_WINDOW` (default 1500 original chars) after the previous end.
Return one match from the first start to the last end with `withGaps: true`. Any missing segment gives `not_found`.

Pages: `splitByPages` clips a match against page boundary offsets and returns one range per page, so a quote crossing a page
break highlights on both pages.

## Stream parsing (`src/lib/llm/stream-parser.ts`)
Parse `<q id="1" doc="D1">text</q>` incrementally from streamed tokens. Be tolerant of attributes in any order, single or
double quotes, and tags split across chunks. Hide tag syntax from the rendered text and render a pill. An unclosed tag at
the end of the stream (or on Stop) is dropped. Quotes naming a doc id that was not sent are dropped and counted.

## Tests that must always pass (`src/lib/quotes.test.ts`)
Build a fixture text and assert:
1. Exact quote verifies, offsets slice back to the original words (ignoring whitespace).
2. Same quote with different spacing and line breaks verifies.
3. Quote across 3 lines verifies, offsets cover all 3.
4. Quote across a page boundary verifies and `splitByPages` returns 2 ranges.
5. Quote appearing twice returns 2 matches. `pickMatch` prefers the one inside the preferred range.
6. Curly quotes, en dash vs hyphen, ligature, NBSP all verify.
7. Line-end hyphenation "termi-\nnation" verifies both as "termination" and as "termi-nation".
8. Space inserted mid-word by extraction ("Termi nation") verifies.
9. One changed word returns `not_found`. A paraphrase returns `not_found`.
10. Quote under 15 chars returns `too_short`.
11. Mid-word substring ("of the" inside "of theory" only) returns `not_found`.
12. Ellipsis quote with both segments in order verifies `withGaps`. Out-of-order segments fail.
13. Quote present only in doc B, asserted for doc A: `wrong_document` at the caller level.
14. Garbage input (empty string, only whitespace, huge string, undefined text) never throws.
15. Offsets supplied by the model are never read anywhere (grep test or code review check).

## Telemetry
Per answer record `proposed`, `verified`, `unverified` (by reason), `dropped`. Store in `messages.stats`. The eval harness
reads these.

## Repair pass (D-036)
After streaming, collect quotes with status `unverified` and reason `not_found`. Make one call with only those quotes, the claims they
support and the cited chunk text: "Re-copy the exact wording from the text, or answer none." Re-verify with `verifyQuote`. Never accept a
repaired quote without verification. At most one repair pass per answer. Record `repaired` in telemetry. Prompt tip to reduce failures: quote
first, claim second, and present chunks inside clear delimiters so the model copies instead of recalls.

## Highlighting handoff
`verifyQuote` returns offsets in the canonical text. The viewer uses `splitByPages` and the per-page item map (document-ingestion skill) to mark
text-layer spans. Do not re-match quotes against the rendered DOM.
