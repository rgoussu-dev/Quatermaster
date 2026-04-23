# Quatermaster

Measure how ready a project — or a single skill — is for agentic coding, and
iterate on the result.

Two CLIs, one feedback loop:

- `quatermaster evaluate <path>` — scores a repo on 4 dimensions (Claude Code
  setup, project structure, test infrastructure, documentation) using a blend
  of deterministic checks and an LLM judge. Writes a history snapshot on each
  run and prints a delta against the previous one.
- `quatermaster evaluate-skill <skill.md> --dataset <cases.json>` — actually
  runs the skill against prompts in a dataset. With `--workspace` the skill
  runs in an isolated tmp dir and is scored along a vector of metrics
  (artifact presence, exit code, LLM judge, and — when golden files are
  supplied — diff similarity).

## Install

```sh
npm install
npm run build
```

The `claude` CLI must be on `PATH` if you use the default judge backend
(`--judge claude-cli`, no API key needed). Use `--judge api` with
`ANTHROPIC_API_KEY` set for the SDK backend.

## Quick start

```sh
# Readiness eval on the current project
node bin/quatermaster.js evaluate .

# Second run shows per-dimension delta vs the first
node bin/quatermaster.js evaluate .

# Skill eval with workspace + artifact scoring
node bin/quatermaster.js evaluate-skill ./skill.md \
  --dataset ./cases.json --workspace
```

History lives in `<cwd>/.quatermaster/history/<slug>/<iso>.json`. Opt out
with `--no-history`; relocate with `--history-dir <path>`.

See `examples/cases.json` for a minimal dataset covering ideal, realistic,
and adversarial scenarios, including a case with a golden file for
diff-similarity scoring and per-case `metricWeights` overrides.

## Scripts

| Script              | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run typecheck` | `tsc --noEmit` (strict, exactOptionalPropertyTypes) |
| `npm test`          | `vitest run`                                        |
| `npm run build`     | Emit compiled JS to `dist/`                         |
| `npm run format`    | Prettier over the tree                              |

## Architecture

Hexagonal, ports + adapters:

```
src/
├── application/cli/          CLI composition root + reporter
├── domain/
│   ├── contract/             DTOs, ports, kernel (Action/Query/Result/Mediator)
│   └── core/                 Pure handlers (EvaluateProject, EvaluateSkill, ...)
└── infrastructure/
    ├── project-scanner/      Reads filesystem into a ProjectSnapshot
    ├── llm-judge/            Anthropic SDK + claude-cli adapters
    ├── skill-runner/         Runs a skill against a prompt
    ├── agent-workspace/      Tmp-dir isolation + filesystem diff capture
    ├── skill-judge/          Judges skill output against expected behaviour
    ├── dataset-loader/       Parses + validates JSON datasets (Zod)
    └── history-store/        Persists evaluation snapshots
```

Every port has a `real/` adapter and a `fake/` adapter. Tests use fakes (not
mocks) wired through `Scenario` + `Factory` helpers in `tests/<aggregate>/`.

## What gets sent to the LLM

`evaluate` ships a snapshot of your project to whichever backend you pick
(`--judge api` → Anthropic API; `--judge claude-cli` → local `claude` CLI,
which uses your subscription). The snapshot includes:

- Full `CLAUDE.md` content (with `<untrusted-content>` fencing applied).
- Up to 2,000 chars of `README.md`.
- A depth-4, 200-line cap directory tree.
- Contents of `.claude/settings.json` with best-effort redaction of
  credential-shaped keys (`token`, `apiKey`, `password`, `Bearer …`, etc.).
- Paths (and short excerpts) of test files, CI configs, and `.claude/` files.

Use `--no-history` to avoid persisting snapshots, and review the redaction
in `src/infrastructure/llm-judge/redact.ts` before running against a
sensitive repo. The workspace adapter (`--workspace`) runs skills with full
filesystem and network access — it only isolates the cwd to a tmp dir.

## Scoring model

Each dimension is a weighted blend:

```
finalScore = 0.4 × deterministicScore + 0.6 × llmScore
```

Fitness scoring for the skill workspace path aggregates a metric vector
(artifact presence 0.4, diff similarity 0.3, exit code 0.1, LLM judge 0.5 —
normalised). Weights can be overridden per case via `metricWeights`.

See `plan.md` and `measure-the-immeasurable.md` for the conceptual frame.

## License

MIT — see `LICENSE`.
