#!/usr/bin/env bash
# Proves the hooks work, in a throwaway repo. Prints PASS or FAIL per check.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"; cd "$tmp"
git init -q -b main . && git config user.email t@t && git config user.name t
mkdir -p .githooks
cp "$here/hooks/pre-commit" "$here/hooks/commit-msg" .githooks/
chmod +x .githooks/*; git config core.hooksPath .githooks
ok=0; bad=0
check() { if [ "$2" = "$3" ]; then echo "PASS: $1"; ok=$((ok+1)); else echo "FAIL: $1 (expected $2, got $3)"; bad=$((bad+1)); fi; }

echo hello > a.txt; git add a.txt
git commit -q -m "feat(ui): add a file" >/dev/null 2>&1; check "valid message accepted" 0 $?

echo more >> a.txt; git add a.txt
git commit -q -m "updated stuff" >/dev/null 2>&1; r=$?; check "bad message rejected" 1 $([ $r -ne 0 ] && echo 1 || echo 0)

printf 'LLM_API_KEY="%s"\n' "sk-abcdefghijklmnopqrstuvwx1234" > conf.ts; git add conf.ts # gitleaks:allow
git commit -q -m "chore: add config" >/dev/null 2>&1; r=$?; check "fake key blocked" 1 $([ $r -ne 0 ] && echo 1 || echo 0)
git reset -q; rm conf.ts

echo "X=1" > .env.local; git add -f .env.local
git commit -q -m "chore: add env" >/dev/null 2>&1; r=$?; check ".env.local blocked" 1 $([ $r -ne 0 ] && echo 1 || echo 0)
git reset -q; rm .env.local

echo "LLM_API_KEY=" > .env.example; git add .env.example
git commit -q -m "chore: add env example" >/dev/null 2>&1; check ".env.example allowed" 0 $?

cd /; rm -rf "$tmp"
echo "$ok passed, $bad failed"; [ "$bad" -eq 0 ]
