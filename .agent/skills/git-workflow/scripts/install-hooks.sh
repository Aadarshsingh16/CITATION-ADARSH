#!/usr/bin/env bash
# Installs the versioned hooks into the repository and activates them.
set -e
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(git rev-parse --show-toplevel)"
mkdir -p "$root/.githooks"
cp "$here/hooks/pre-commit" "$root/.githooks/pre-commit"
cp "$here/hooks/commit-msg" "$root/.githooks/commit-msg"
chmod +x "$root/.githooks/pre-commit" "$root/.githooks/commit-msg"
git -C "$root" config core.hooksPath .githooks
echo "Hooks installed in .githooks and activated (core.hooksPath)."
echo "Commit .githooks/ so the hooks are versioned: git add .githooks && git commit -m 'chore(infra): add commit hooks'"
