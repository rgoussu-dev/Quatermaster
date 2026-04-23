# Quatermaster — Agentic Coding Readiness Evaluator

## Context

After a conference on measuring AI systems, the goal is a CLI tool that evaluates how well a project is set up for agentic coding. The tool scores 4 dimensions, provides findings, and enables iteration: run it, improve the setup, run it again.

**Language:** TypeScript  
**Evaluation method:** Deterministic checks (40%) + LLM-as-judge via Claude API (60%) per dimension  
**Walking skeleton first:** per keel conventions

---

## Directory Layout

```
quatermaster/
├── bin/quatermaster.js               # ESM shim → dist
├── src/
│   ├── application/cli/
│   │   ├── contract/EvaluateCommand.ts   # CLI DTO: { projectPath: string }
│   │   └── executable/
│   │       ├── main.ts                   # commander + composition root
│   │       └── reporter.ts               # EvaluationResult → stdout
│   ├── domain/
│   │   ├── contract/
│   │   │   ├── kernel/                   # Action, Query, Result, Handler, Mediator
│   │   │   ├── ports/
│   │   │   │   ├── ProjectScanner.ts     # secondary port: scan(path) → ProjectSnapshot
│   │   │   │   └── LLMJudge.ts           # secondary port: judge(request) → JudgeResponse
│   │   │   ├── ProjectSnapshot.ts        # DTO sent to LLM judge
│   │   │   ├── EvaluationResult.ts       # final output
│   │   │   ├── DimensionScore.ts         # per-dimension score + findings
│   │   │   └── Finding.ts                # severity + description + source
│   │   └── core/evaluation/
│   │       ├── EvaluateProject.ts        # Query<EvaluationResult>
│   │       ├── EvaluateProjectHandler.ts # orchestrates scan → deterministic → LLM → aggregate
│   │       ├── DeterministicScorer.ts    # pure functions on ProjectSnapshot
│   │       ├── ScoreAggregator.ts        # weighted combination
│   │       └── EvaluationError.ts        # sealed error hierarchy
│   └── infrastructure/
│       ├── project-scanner/
│       │   ├── real/FileSystemScanner.ts
│       │   └── fake/InMemoryProjectScanner.ts
│       └── llm-judge/
│           ├── real/AnthropicLLMJudge.ts
│           └── fake/StubLLMJudge.ts
└── tests/evaluation/
    ├── EvaluateProjectScenario.ts
    ├── EvaluateProjectFactory.ts
    └── EvaluateProject.test.ts
```

---

## Domain DTOs

**`Finding`** — `{ description, severity: 'info'|'warning'|'critical', location?, source }`

**`DimensionScore`** — `{ dimension: DimensionId, label, weight, score: 0-100, grade: A-F, findings }`

**`ProjectSnapshot`** — `{ projectPath, claudeMd, readmeMd, directoryTree, testFilePaths, testFileSamples, claudeConfigPaths, claudeSettingsJson, sourceFilePaths, hasLockfile, ciConfigPaths }`

**`EvaluationResult`** — `{ projectPath, evaluatedAt, overallScore, overallGrade, dimensions, topRecommendations }`

---

## Port Interfaces

```typescript
interface ProjectScanner {
  scan(projectPath: string): Promise<ProjectSnapshot>;
}

interface LLMJudge {
  judge(request: JudgeRequest): Promise<JudgeResponse>;
}

// JudgeRequest = { snapshot, dimension: DimensionId, rubric: string }
// JudgeResponse = { dimension, llmScore: 0-100, observations: string[], recommendation: string }
```

---

## Dimensions and Weights

| Dimension               | Weight | Key Deterministic Checks                                |
|-------------------------|--------|---------------------------------------------------------|
| `claude-code-setup`     | 35%    | CLAUDE.md presence, hooks in settings.json, MCP config  |
| `project-structure`     | 25%    | Hexagonal dirs, walking skeleton markers                |
| `test-infrastructure`   | 25%    | Test files, framework config, Scenario/Factory pattern  |
| `documentation`         | 15%    | README, TSDoc on exports, ADR directory                 |

**Scoring:** `finalDimensionScore = 0.4 * deterministicScore + 0.6 * llmScore`

**LLM model:** `claude-haiku-4-5-20251001` (fast, cheap; 4 parallel calls per evaluation)

**API calls:** 4 parallel calls in `EvaluateProjectHandler`, one per dimension. Shared system prompt is prompt-cached. Zod validates LLM JSON before trust.

---

## Kernel Types

```typescript
interface Action<R> { readonly _resultType?: R }
interface Query<R> extends Action<R> { readonly _queryBrand: void }
type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError }
interface Handler<A extends Action<unknown>> {
  supports(): ReadonlySet<new (...args: unknown[]) => A>
  handle(action: A): Promise<Result<unknown>>
}
class Mediator {
  constructor(handlers: ReadonlyArray<Handler<Action<unknown>>>)
  async dispatch<R>(action: Action<R>): Promise<Result<R>>
}
```

---

## Walking Skeleton — Build Order

1. **Scaffold** — `package.json`, `tsconfig.json`, `vitest.config.ts`, `bin/quatermaster.js`. Verify `--version` works.
2. **Kernel** — All types in `domain/contract/kernel/`. Verified by typecheck only.
3. **Domain DTOs** — `Finding`, `DimensionScore`, `ProjectSnapshot`, `EvaluationResult`. Interfaces only.
4. **Port interfaces** — `ProjectScanner`, `LLMJudge`.
5. **CLI contract** — `EvaluateCommand`.
6. **Fakes** — `InMemoryProjectScanner` (preset snapshot), `StubLLMJudge` (preset responses). Canonical reference implementations.
7. **Domain command + handler** — `EvaluateProject` query, `DeterministicScorer`, `ScoreAggregator`, `EvaluateProjectHandler`.
8. **First integration test** — `Scenario + Factory + fakes`. Full domain flow, no real I/O.
9. **`FileSystemScanner`** — reads CLAUDE.md, README, tree (depth-4, max 200 lines), test file paths (glob), Claude config paths.
10. **`AnthropicLLMJudge`** — 4 parallel calls, cached system prompt + per-dimension rubric. Zod validation on output.
11. **CLI main + reporter** — composition root wires real adapters; reporter formats coloured table to stdout.
12. **Self-evaluation** — run `quatermaster evaluate .` on itself; iterate on rules and rubrics.

---

## LLM Judge Rubrics

### System prompt (cached across all 4 calls)

```
You are an expert agentic coding readiness evaluator. Score the project on a
specific dimension and provide actionable findings.

SCORING SCALE:
  0–19:  F — Absent or fundamentally broken
  20–39: D — Minimal or severely inadequate
  40–59: C — Partially present but significant gaps
  60–79: B — Mostly present with some gaps
  80–100: A — Well-configured and optimised

Return valid JSON only:
{
  "dimension": "<dimension-id>",
  "llmScore": <integer 0-100>,
  "observations": ["<concise observation>", ...],
  "recommendation": "<single most impactful next step>"
}
```

### Per-dimension rubrics (user message, one per call)

**Claude Code Setup (35%)**
- CLAUDE.md present & substantive >200 words (+10+10+10+10)
- Pre-commit hooks configured in .claude/settings.json (+10+15)
- MCP servers configured (+5+10)
- Custom skills and tool permissions (+10+10)

**Project Structure (25%)**
- Hexagonal dirs (application/, domain/, infrastructure/) (+25)
- Domain and infrastructure cleanly separated (+15)
- Composition root pattern visible (+10)
- Thin end-to-end walking skeleton slice (+15+15)
- Consistent file naming (+10+10)

**Test Infrastructure (25%)**
- Test files present, >5, organised by aggregate (+15+10+15)
- Scenario pattern (data builders) (+15)
- Fakes present, not mocks (+10)
- Tests import only port interfaces (+10)
- Test runner configured (+10), integration tests (+10), mutation testing (+5)

**Documentation (15%)**
- README present, describes build/test, describes architecture (+10+15+15)
- Exported types and port interfaces documented (+20+15)
- ADR directory present, CLAUDE.md kept up to date (+15+10)

---

## CLI Output Format

```
QUATERMASTER EVALUATION REPORT
═══════════════════════════════════════════════
Project: /path/to/project
Evaluated: 2026-04-22T10:15:00Z

OVERALL SCORE: 72/100   Grade: B
───────────────────────────────────────────────
DIMENSION BREAKDOWN
  Claude Code Setup     (35%)  85/100  A   ████████░░
  Project Structure     (25%)  70/100  B   ███████░░░
  Test Infrastructure   (25%)  55/100  C   ██████░░░░
  Documentation         (15%)  60/100  C   ██████░░░░

───────────────────────────────────────────────
TOP RECOMMENDATIONS
  1. [test-infrastructure] Add fake implementations for each secondary port.
  2. [claude-code-setup] Configure pre-commit hooks in .claude/settings.json.
  3. [documentation] Add TSDoc to all exported interfaces and port types.
───────────────────────────────────────────────
```

Exit 0 on any completed evaluation; non-zero only on errors (unreadable path, API failure).

---

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.51.0",
    "chalk": "^5.3.0",
    "commander": "^12.1.0",
    "glob": "^11.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "prettier": "^3.4.0",
    "@types/node": "^22.0.0"
  }
}
```

---

## Verification

1. `npm run typecheck` — zero errors
2. `npm test` — walking skeleton integration test passes (fakes, no real I/O)
3. `node bin/quatermaster.js evaluate .` — produces a scored report for the project itself
4. Verify 4 parallel LLM judge calls complete under 10s with `ANTHROPIC_API_KEY` set