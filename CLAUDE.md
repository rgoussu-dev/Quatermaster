# Quatermaster — Agent Notes

This file is the briefing for any agent contributing to this repo. It is
deliberately lean: deep guidance lives in `.claude/skills/` and auto-loads
when relevant. Keep this file focused on what every session needs.

## What this project is

An evaluator for how ready a project — or a single skill — is for agentic
coding. Two CLIs:

- `evaluate <path>` — readiness score on 4 dimensions, persists history,
  shows delta vs previous run.
- `evaluate-skill <skill.md> --dataset <cases.json>` — actually runs the
  skill against prompts and scores the filesystem outcome (stdout +
  produced files) along a weighted metric vector.

See `README.md` for the public surface, `plan.md` for the original design,
`measure-the-immeasurable.md` for the conceptual frame.

## Commands you will run

```sh
npm run typecheck   # tsc --noEmit — must pass before committing
npm test            # vitest run — must pass before committing
npm run build       # emits dist/, needed only to exercise the CLI
npm run format      # prettier over the tree
```

There is no separate lint step; prettier handles style, TS does the rest.

A `.claude/hooks/pre-commit-check.sh` PreToolUse hook runs typecheck and
tests before any Claude-issued `git commit`. It is the gate that keeps
trunk green; do not bypass it.

## Architecture — where things go

Hexagonal, strict one-way dependencies:
`application → domain ← infrastructure`. Domain never imports from
infrastructure or application.

```
src/
├── application/cli/                  CLI composition root + reporter
├── domain/
│   ├── contract/
│   │   ├── kernel/                   Action/Query/Result/Handler/Mediator
│   │   ├── ports/                    Secondary-port interfaces
│   │   └── *.ts                      DTOs
│   └── core/
│       ├── evaluation/               EvaluateProject use case + pure scoring
│       └── skill-evaluation/         EvaluateSkill use case + pure scoring
└── infrastructure/<concern>/
    ├── real/                         Production adapter
    └── fake/                         In-memory test double (not a mock)
```

Tests mirror this: `tests/<aggregate>/<Name>.test.ts` with
`<Name>Scenario.ts` (data builders) and `<Name>Factory.ts` (wires a
`Mediator` from fakes).

## Skills available in this repo

`.claude/skills/` holds the deep guidance. They auto-load when relevant.

- **`typescript-conventions`** — strict-TS settings, ESM `.js` suffix,
  no-mocks rule, `Result` over `throw`, readonly DTOs, comment policy.
  Loads when editing `*.ts`.
- **`adding-a-port`** — five-step recipe for introducing a new secondary
  port (interface + real + fake + handler injection + Scenario/Factory
  pair). Loads when adding a new I/O concern.
- **`adding-a-metric`** — recipe for adding a metric to `FitnessScorer`,
  including `null`-returning convention and dataset/schema extension.
  Loads when touching `src/domain/core/skill-evaluation/`.

## Commits

Conventional commits with a scope matching the aggregate being touched:

```
feat(skill-eval): add diff-similarity metric vs golden artifact content
feat(evaluate): persist history snapshots and report per-run deltas
fix(judge): avoid spawning claude CLI in project cwd
```

Don't amend pushed commits; create new ones. Don't skip hooks.

## Running Quatermaster on Quatermaster

```sh
node bin/quatermaster.js evaluate .
```

Re-run after improvements to see the delta. The history lives under
`.quatermaster/history/` and is gitignored.
