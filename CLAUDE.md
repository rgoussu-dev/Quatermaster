# Quatermaster — Agent Notes

This file is the briefing for any agent contributing to this repo. Read it
before editing code or tests.

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

## Architecture — where things go

Hexagonal, strict one-way dependencies: `application → domain ← infrastructure`.
Domain never imports from infrastructure or application.

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

## Non-negotiable conventions

- **TypeScript strictness.** `strict: true` with
  `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`
  are on. Don't spread `undefined` into an optional field — guard with
  `...(x !== undefined ? { x } : {})`.
- **ESM imports.** Always suffix relative imports with `.js` even when
  pointing at `.ts` sources. TS resolves, Node executes.
- **No mocks.** Every port has a `fake/` adapter that is the canonical test
  double. Tests import only ports + fakes, never the real adapter.
- **Result over throw for domain errors.** Handlers return
  `Result<T, DomainError>`; only infrastructure throws. Errors carry a
  stable `kind` discriminator.
- **Readonly everywhere.** DTOs use `readonly` on every field.
- **No premature comments.** Names carry the load. Only comment on
  non-obvious constraints, workarounds, or invariants.

## Adding a new port

1. Define the interface under `src/domain/contract/ports/<Name>.ts`. Write
   TSDoc listing the adapters that will implement it.
2. Add a `real/` adapter under
   `src/infrastructure/<concern>/real/<Real>.ts`. Keep it thin; real IO and
   parsing live here.
3. Add a `fake/` adapter that returns preset data keyed by the inputs
   relevant to tests.
4. If the port is used by a use case, inject it into the handler via
   constructor. Handlers take ports as dependencies — never construct
   adapters inline.
5. Add or extend a `Scenario + Factory + test` trio that exercises the new
   path through the fake.

## Adding a new metric to the fitness scorer

`FitnessScorer` emits a metric _only when it applies_. Follow the pattern
in `scoreArtifacts` / `scoreSimilarity`:

1. Add the metric id to `METRIC_IDS` and a default weight in
   `DEFAULT_METRIC_WEIGHTS`.
2. Emit the metric from a dedicated `scoreX(...)` method that returns
   `null` when the case doesn't opt in — keeps weight normalisation clean.
3. Extend `SkillCase` / `ExpectedArtifact` if new per-case configuration is
   needed.
4. If the metric is persisted, history snapshots pick it up automatically
   via `toHistorySnapshot` (it forwards whatever `metrics[]` is present).

## Adding to a dataset JSON

The dataset loader (`FileSystemDatasetLoader`) validates input with Zod and
normalises to the domain shape. JSON-only fields (like `goldenPath`, which
resolves to `goldenContent`) live in the Zod schema; the runtime DTO in
`SkillCase.ts` carries only the resolved form. Keep this split when adding
fields.

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
