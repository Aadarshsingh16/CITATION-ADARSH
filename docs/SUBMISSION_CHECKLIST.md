# Submission checklist

Counts against us: claiming something works when it does not, a committed API key, an app that only holds up on a small sample.
Do this list on Day 3 and do not skip the claims audit.

## 1. Secrets and repo
- [ ] `.env*` ignored. Run a secret scan over the full git history (gitleaks or trufflehog). Result pasted below.
- [ ] `.env.example` has every variable and no real values
- [ ] No keys in screenshots, the demo video, or the README
- [ ] Repo has a sensible commit history (small conventional commits per phase)
- [ ] `npm run build` and `npm test` pass from a clean clone

## 2. Deployed app (test in a private window with a contract not used in development)
- [ ] Upload PDF and DOCX, wrong type rejected, scanned PDF rejected with the explanation
- [ ] Processing status visible on a 100+ page file
- [ ] Chat streams, Stop keeps partial text, history reopens after reload
- [ ] Verified quote opens the real PDF page and highlights, including a repeated and a cross-page quote
- [ ] Absent-answer question says not found
- [ ] Large-document existence question reports coverage
- [ ] Multi-document question compares across documents, quotes labelled by document
- [ ] Comparison of the sample pair finds the planted changes and ranks the cap change high
- [ ] Deep research toggle shows live steps, cap works, a bad tool call does not crash
- [ ] Rate limit message appears when exceeded
- [ ] Kill and restart the server mid-ingestion: Retry works
- [ ] First load after idle is acceptable (note the cold start if not)

## 3. README
- [ ] What the app does
- [ ] Screenshots: upload, chat with verified quotes, citation highlighting, comparison (plus agent trace)
- [ ] Run locally instructions tested by following them from scratch
- [ ] Finished vs not finished, honest and specific
- [ ] Known limitations, including no auth and no OCR
- [ ] Live link and demo link

## 4. Claims audit
For every sentence in the README or video that says the app does something, fill a row. If there is no evidence, remove the claim.

| Claim | Where it was tested (deployed) | Evidence (screenshot, eval id, test name) |
|---|---|---|
| | | |

## 5. Eval numbers for the note
- [ ] Fabrication rate, repair rate, unverified-shown-as-genuine = 0, absence honesty, large-doc coverage, agent robustness, with sample sizes

## 6. Demo video (3 to 5 minutes), unlisted link
- [ ] Follows `docs/DEMO_SCRIPT.md`, shows what does not work

## 7. Half-page note
- [ ] `docs/NOTE.md` filled in: verification and where it fails, large documents, Part C choice and hardest part, what next

## 8. Submit
- [ ] GitHub link, deployed link, README, video link, note
