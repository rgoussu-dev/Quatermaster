#!/usr/bin/env bash
# PreToolUse hook — runs format:check + typecheck + tests before the agent
# is allowed to execute `git commit`. Receives the tool-call JSON on stdin;
# matches on the literal substring so we don't depend on jq.
#
# Exit 0 = allow the tool call; exit 1 = block and surface the failure.

set -u
input=$(cat)

if ! echo "$input" | grep -q 'git commit'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if ! npm run format:check --silent >/dev/null 2>&1; then
  echo "pre-commit: prettier check failed — run 'npm run format' before committing." >&2
  exit 1
fi

if ! npm run typecheck --silent >/dev/null 2>&1; then
  echo "pre-commit: typecheck failed — run 'npm run typecheck' and fix before committing." >&2
  exit 1
fi

if ! npm test --silent -- --run >/dev/null 2>&1; then
  echo "pre-commit: tests failed — run 'npm test' and fix before committing." >&2
  exit 1
fi

exit 0
