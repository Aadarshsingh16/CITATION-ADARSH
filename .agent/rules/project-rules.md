# Project rules (always apply)

1. **Secrets.** Never commit secrets. `.env*` is gitignored. Read `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`,
   `DATABASE_URL` from the environment only. No hardcoded keys or model names. Keep `.env.example` current.
2. **Docs first.** Before starting a phase, read `docs/PHASES.md` for that phase, `docs/ARCHITECTURE.md`,
   `docs/DECISIONS.md`, `docs/EDGE_CASES.md` and the relevant skills in `.agent/skills/`.
3. **No phase skipping.** Do not start phase N+1 until phase N's exit gate passed and you observed it. After each
   phase, report what works, what does not, and anything OPEN, then stop and wait for approval.
4. **Never claim without running.** Do not say a feature works, a test passes or the build succeeds unless you
   ran it and saw it. Paste the actual command output in your report. If you could not run something, say so.
5. **Decisions are logged.** Any choice that is not already in `docs/DECISIONS.md` gets a new row with
   alternatives and reasons. Rows marked OPEN are the owner's call: ask, do not guess.
6. **Edge cases are tracked.** Tick items in `docs/EDGE_CASES.md` only after observing them. Add new ones you find.
7. **Ask when ambiguous.** If a requirement, design or scope question is unclear, ask the owner before building.
8. **Honesty in the product.** Never present an unverified quote as verified. Never state something is absent from
   a document unless coverage was complete. Never use "verified" for anything our code did not check.
9. **Never throw into the user's stream.** Verification, tool calls and background work fail soft: degrade to
   unverified, partial coverage or an error state with retry.
10. **Single sources of truth.** Quote matching only in `src/lib/quotes.ts`. Chunking only in `src/lib/chunking/`.
    LLM access only through `src/lib/llm/client.ts`.
11. **UI states.** A feature is not done until every applicable state in `docs/DESIGN.md` exists and was seen.
12. **Commits and workflow.** Work and push directly on `main` only — no feature or phase branches. Small commits with conventional messages (feat:, fix:, docs:, test:, chore:). No secrets, no generated junk, no large binaries.
13. **Tests for risky logic.** Write tests for quote matching, chunking, tool validation and comparison alignment
    before or with the implementation.
14. **User-facing text.** Plain language, say what happened and what to do next, no em dashes.
15. **Scope discipline.** Do not build extras before the P8 gate. Do not add libraries without a reason noted
    in `docs/DECISIONS.md`.
16. **Audit amendments are binding.** `docs/ARCHITECTURE.md` "Amendments", `docs/DECISIONS.md` rows D-034 and later, and the
    "Added acceptance tests" in `docs/PROJECT_BRIEF.md` supersede earlier text where they conflict.
17. **Test on the deployed app.** After deploying to Render, test in a private window. Do not report a phase as done based only on localhost.
18. **File ownership.** Do not edit `src/lib/quotes.ts` or `src/lib/types.ts` after the P2 gate without asking.
19. **Knowledge graph (graphify).** Before reading raw files across the codebase to explore structure or architecture, consult `graphify-out/wiki/index.md` or run `graphify query "<question>"` / `graphify path` to retrieve exact symbols, file paths and relationships with minimal token usage. Keep the graph in sync with `graphify update .`.

