---
name: document-comparison
description: Use when building the version-comparison feature: clause-level alignment, change classification, deterministic signals, LLM significance judging, and the results UI with filter and sort.
---

# Document comparison

Two versions of a contract go in. A clause-level change list with plain-language summaries and significance comes out.
It is not a character diff, and a reworded sentence is not the same as a liability cap moving from AED 100,000 to AED 1,000,000.

## Pipeline
1. **Parse into units** (`clause-parser.ts`, shared with chunking): numbered clauses, else paragraphs. Each unit has
   `ref`, `heading`, `text`, `start`, `end` (offsets into its document's canonical text).
2. **Align** (`align.ts`):
   - First pass: match units with the same normalised heading, or same ref and similar text (similarity at least 0.6).
   - Second pass: for the remaining units, compute token-level similarity (Jaccard or TF-IDF cosine) and greedily take
     the best pairs above 0.55, one-to-one.
   - A pair with the same text but different ref is `moved` (renumbered), not added plus removed.
   - Unmatched units in A are `removed`, in B are `added`.
   - Identical normalised text is `unchanged` and is not sent to the LLM.
3. **Signals** (`signals.ts`) for each `modified` pair, computed deterministically on A and B text:
   - numbers and currency amounts (AED 100,000 vs AED 1,000,000), with the old and new values and the ratio
   - dates and durations (30 days vs 90 days)
   - percentages
   - modal verbs: shall, must, will, may, should (e.g. shall changed to may)
   - negations (not, no, never) added or removed
   - party and defined term changes (capitalised terms that appear or disappear)
   - length change
   - `sameWordsDifferentOrder` (pure rewording indicator)
4. **Judge** (`judge.ts`): one batched LLM call per few changed units. Input: both texts plus the signals. Output JSON:
   `{ id, significance: 'high'|'medium'|'low'|'cosmetic', category, summary }`.
   Categories: liability, payment, termination, term_and_renewal, scope, ip, confidentiality, governing_law,
   obligations, definitions, other.
   Summary: one plain-language sentence that states the substance with the actual values, e.g.
   "Liability cap raised from AED 100,000 to AED 1,000,000." Never "the wording changed" for a substantive change.
5. **Floor rules** after the judge: if signals show a numeric value change, a modal change or a negation change, significance is
   at least `medium`. Monetary change by 2x or more is `high`. Signals can raise significance, never lower it. If there are no signals and
   words are only reordered or synonymous, `cosmetic`.
6. **Overall summary**: one LLM call over the high and medium items, a short paragraph of what changed in substance.
7. Added and removed clauses go through the judge too (an added indemnity is high).

## UI
- Left: change list. Row: kind icon (added, removed, modified, moved), clause ref, significance badge, one-line summary.
- Right: side-by-side texts for the selected change, with the changed words highlighted (word-level diff inside the
  aligned pair is fine here, because the unit-level alignment already happened).
- Controls: significance filter (All, High, Medium, Low, Cosmetic), sort by significance or document order, counts per level.
- Overall summary at the top. States: running with progress, no differences, filter empty, failure with retry.
- Low alignment confidence (many unmatched units): show a notice that the documents may not be versions of the same contract.

## Test fixtures (create two small contracts in `evals/fixtures/`)
Prepared pair must include: cap AED 100,000 to AED 1,000,000 (high), pure rewording (cosmetic), a renumbered clause (moved),
an added clause, a removed clause, notice period 30 to 90 days (medium or high), "shall" to "may" (at least medium),
a party name change.

## Unit tests
- Alignment pairs the right clauses when one is renumbered.
- Signals extracts old and new amounts and the ratio.
- Floor rules raise a cosmetic judge result when a number changed.
- Identical docs produce no changes. Unrelated docs trigger the low-confidence notice.
