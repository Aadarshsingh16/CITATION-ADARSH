---
name: eval-harness
description: Use when building or running the evaluation script that measures quote fabrication, absence honesty, coverage and agent robustness against the configured model. Produces numbers for the README and the note.
---

# Eval harness

Purpose: back claims with numbers. We measure the product's behaviour instead of asserting it.
Run with `npm run eval`. Uses the env-configured model. Never commit keys. Keep a dev database separate from the deployed one.

## Layout
```
evals/
  fixtures/        small and large contracts (text PDFs, DOCX), version pairs, a scanned PDF
  questions.json   [{ id, doc, question, kind, expect }]
  run.ts           runs each question through the real pipeline and writes results
  report.md        generated output (commit the summary, not secrets)
```
`kind`: `present` (answer exists), `absent` (answer does not exist), `existence_large`, `multi_doc`, `agent`.
`expect`: for present, a list of key facts or a phrase that must be in a verified quote. For absent, `not_found`.

## Metrics
1. **Fabrication rate**: quotes proposed by the model that failed verification divided by quotes proposed.
2. **Unverified shown as genuine**: must be 0. The run fails if any unverified quote renders as verified.
3. **Present recall**: share of `present` questions whose answer includes a verified quote containing the expected fact.
4. **Absence honesty**: for `absent` questions, share where the answer says not found and gives no quote that verifies.
   On partial coverage, share of answers that avoid asserting absence.
5. **Large-document coverage**: for the 150-page fixture, `chunksRead / chunksTotal` and a check that existence questions
   used map_reduce with complete coverage.
6. **Whitespace tolerance**: unit-level, quotes with rewrapped whitespace still verify.
7. **Agent robustness**: scripted bad tool calls (unknown tool, missing args, nonsense) all handled with zero crashes, cap respected.
8. **Latency and cost notes**: median time to first token, total tokens per mode.

## Output
Print a table and write `evals/report.md` with the date, model name (not the key), per-metric numbers, and the failing
cases listed with question id and reason. Use these numbers in the README and the half-page note, stating the sample size.

## Rules
- Do not tune the questions to make numbers look good. Add hard cases (tables, repeated clauses, near-miss wording).
- If a metric is bad, report it honestly and note what you would do about it.
- Runs against a dev index only. Never run it against production data.
- The 3 to 5 minute demo should include one run of a small eval or screenshot of the report.
