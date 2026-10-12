---
name: git-workflow
description: Use for every commit, branch, merge, tag and push in this project. Defines the commit message format, how to slice work into small commits, the phase gate procedure, hooks that block secrets and bad messages, and how to fix mistakes without rewriting pushed history.
---

# Git workflow

The history is part of what gets reviewed. It should read like a record of real, incremental work that the owner
can explain commit by commit. Never fake it, never squash it away, never leak a key into it.

## Hard rules
1. One logical change per commit. Never a single "initial commit" or "phase done" blob.
2. Every commit builds and its related tests pass. Run them before committing.
3. Conventional Commits format, enforced by the `commit-msg` hook.
4. Never force push. Never rewrite pushed history. Never backdate or fabricate commits.
5. Never stage secrets, `.env*` (except `.env.example`), uploads, `node_modules`, `.next` or build output.
   The `pre-commit` hook blocks these. If a key was ever committed, STOP and tell the owner so it can be rotated.
   Rewriting history does not make a leaked key safe.
6. Commits use the owner's configured git identity. Do not add tool or co-author trailers unless the owner asks.
7. Do not push until the owner has provided the remote. After that, push after every phase and at least daily.
8. Show the owner `git log --oneline --graph -20` and `git status` after each phase and wait for approval.

## One-time setup
1. `git init -b main` if needed. Confirm `.gitignore` covers `.env*` (but not `.env.example`), uploads, `node_modules`, `.next`,
   build output, and local database volumes.
2. Run `bash .agent/skills/git-workflow/scripts/install-hooks.sh` (copies hooks to `.githooks/` and sets `core.hooksPath`).
3. Run `bash .agent/skills/git-workflow/scripts/verify-hooks.sh`. All five checks must print PASS. Paste the output to the owner.
4. Commit the hooks: `chore(infra): add commit hooks for secrets and message format`.
5. Create `docs/PROGRESS.md` from `templates/PROGRESS.md`.

## Commit message format
```
type(scope): imperative summary, 72 characters max

Optional body: why this change, not what. Reference ids such as D-012 or EDGE: cross-page quote.
```
Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `perf`.
Scopes: `ingestion`, `quotes`, `chat`, `chunking`, `viewer`, `multidoc`, `compare`, `agent`, `ui`, `db`, `infra`, `eval`.

Good:
- `feat(quotes): normalise text with an index map back to original offsets`
- `fix(ingestion): reject PDFs with no text layer instead of saving an empty document`
- `test(agent): cover unknown tool and missing argument handling`
- `docs(decisions): record D-034 pdf.js page highlighting`

Bad: `updates`, `fix stuff`, `WIP`, `final version`, `Phase 2 done`, `feat: add everything for chat`.
Summary rules: imperative mood, no trailing period, say what changed in terms of behaviour, no em dashes.

## Before every commit (routine)
1. `git status` to see what is changed. Nothing unexpected.
2. Stage deliberately: `git add -p` or named files. Avoid `git add .` unless you have checked `git status`.
3. `git diff --staged` and read it. Remove debug logs, commented-out code, stray files.
4. Run `npm run build` and the tests for the touched area. Fix before committing.
5. Commit with a message in the format above. If the hook rejects it, fix the message, do not bypass hooks (`--no-verify` is forbidden).

## Slicing work into commits
Split by purpose, in the order a reader would follow the reasoning:
1. tests or fixtures that define the behaviour (`test`)
2. the smallest implementation that makes them pass (`feat`)
3. the next increment, repeated (`feat`)
4. UI that uses it (`feat(ui)`)
5. docs, decisions, edge cases ticked (`docs`)
Never mix refactors with features, or unrelated scopes, in one commit. If you already have a large uncommitted change,
split it with `git add -p` (or `git add -N` then `-p` for new files) into the commits above before committing.

Example sequence for P2:
```
test(quotes): add failing fixtures for whitespace and cross-page matching
feat(quotes): normalise text with an index map
feat(quotes): locate all matches with a word-boundary check
feat(quotes): support ellipsis segments and the too_short rule
feat(chat): parse inline <q> tags from the token stream
feat(chat): stream answers over SSE and abort on stop
feat(chat): verify each quote when its tag closes
feat(ui): add quote pills and cards with verified and unverified states
docs(decisions): record D-012 inline quote protocol
docs(progress): log P2 gate results
```

## Branches, merging, tags
- `main` is always deployable and is what gets deployed.
- Work on `phase/pN-short-name`. Parallel tracks (see `docs/PHASES.md`): `track/a-depth`, `track/b-viewer`, `track/c-compare`.
- Merge into `main` with `git merge --no-ff` so the small commits remain visible. Do not squash-merge.
- After merging, run the build and the full test suite on `main`.
- Tag each passed gate: `git tag -a pN-gate -m "P<N> exit gate passed"`, then `git push origin main --tags`.

## Phase gate procedure
1. Run the exit gate from `docs/PHASES.md` yourself. Observe the result.
2. Add a row to `docs/PROGRESS.md` with what was run, what was observed, and what is not working or OPEN.
3. Tick the handled items in `docs/EDGE_CASES.md` and add rows to `docs/DECISIONS.md` for anything newly decided.
4. Commit docs separately: `docs(progress): log P<N> gate results`.
5. Merge the phase branch into `main` with `--no-ff`, tag `pN-gate`, push with tags.
6. Deploy and smoke test on the deployed URL (private window).
7. Show the owner `git log --oneline --graph -20`, `git status`, and the gate results. Stop and wait for approval.

## Fixing mistakes
| Situation | Do this |
|---|---|
| Typo in the last unpushed commit message | `git commit --amend` |
| Forgot a file in the last unpushed commit | stage it, `git commit --amend --no-edit` |
| Several unpushed commits need restructuring | `git reset --soft <base>` then recommit in logical pieces |
| A pushed commit is wrong | `git revert <sha>` and commit the fix. Do not rewrite history |
| A pushed commit has a poor message | leave it, write better ones from now on |
| A secret was staged but not committed | unstage it (`git restore --staged <file>`), remove it from the file, use the env var |
| A secret was committed (even if unpushed) | stop, tell the owner, rotate the key. Then clean the history only with the owner's approval |
| Merge conflict | resolve deliberately, run build and tests, then commit the merge |

## Reporting to the owner
After each phase, print:
```
git log --oneline --graph -20
git status
git tag --list
```
and the gate evidence. Flag anything that looks unusual (large diffs, files you were unsure about).

## Do not
- Commit generated files, local databases, uploaded documents, screenshots with secrets, or `.env*`.
- Use `git add .` blindly, `git commit -a` without reading the diff, or `--no-verify`.
- Combine unrelated changes, leave `WIP` commits, or leave `main` broken.
- Claim a commit "fixes" or "completes" something you did not run and observe.
