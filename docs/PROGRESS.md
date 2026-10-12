# Progress log

One entry per passed phase gate, written from what was actually observed. Feeds the README "finished and not finished"
section and the claims audit in `docs/SUBMISSION_CHECKLIST.md`.

| Date | Phase | What was run | Result observed | Not working / OPEN | Commit / tag |
|---|---|---|---|---|---|
| 2026-10-13 | P0 | `npm run build`, `docker compose up -d`, `npm run db:migrate`, `/api/health` check, `npm run llm:check`, hooks verification | Build passes, 11 Postgres tables migrated with pages.items and document_files bytea, /api/health returns 200 {status:ok,db:ok} (503 on db failure), llm:check exits non-zero without key, git hooks pass | GATE NOT PASSED YET. Outstanding: deployed URL on Render (see docs/DEPLOY.md), llm:check on two candidate models with API key, model choice (D-004) | In progress / no tag |
| 2026-10-13 | P1 | `npm test` (12 tests), `npm run build`, sample contracts seeding | A1 to A5 passed, 150-page PDF ingested with progress, scanned PDF rejected with no_text_layer, D-035 item offset map invariant holds, BM25 and chunking verified, Library and Viewer UI active | Live deployed URL test on Render pending user deploy | In progress / no tag |
| 2026-10-13 | P2 | `npm test` (42 tests: 8 stream parser, 15 quotes, 12 ingestion, 7 chat acceptance), `npm run build` | A6 to A13 passed. Quotes engine strictly normalises and matches with page splitting. Fake quote rejected with not_found. Quote misattribution flagged wrong_document. Stop preserves partial text and verified quotes. Chat history persisted. Production build compiled cleanly. | P2 gate code complete on main. Live deployed URL test on Render pending user deploy | In progress / no tag |
