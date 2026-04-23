import type { Handler } from '../../contract/kernel/Handler.js';
import type { Result } from '../../contract/kernel/Result.js';
import { success, failure } from '../../contract/kernel/Result.js';
import type { ProjectScanner } from '../../contract/ports/ProjectScanner.js';
import type { LLMJudge } from '../../contract/ports/LLMJudge.js';
import type { EvaluationResult } from '../../contract/EvaluationResult.js';
import { EvaluateProject } from './EvaluateProject.js';
import { EvaluationError } from './EvaluationError.js';
import { score as deterministicScore } from './DeterministicScorer.js';
import { aggregate, overallScore, topRecommendations } from './ScoreAggregator.js';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const RUBRIC_CLAUDE_SETUP = `
Evaluate the Claude Code configuration quality:
- CLAUDE.md Quality (40 pts): present (+10), describes architecture/conventions clearly (+10), includes testing patterns and workflow (+10), substantive >200 words and project-specific (+10)
- Hooks (25 pts): pre-commit hooks configured in .claude/settings.json (+10), hooks enforce formatting/linting/tests (+15)
- MCP Servers (15 pts): .mcp.json or MCP configuration present (+5), relevant MCP servers configured (+10)
- Skills and Permissions (20 pts): custom skills present under .claude/skills/ (+10), tool permissions explicitly configured (+10)
`.trim();

const RUBRIC_PROJECT_STRUCTURE = `
Evaluate the architectural structure for agentic coding readiness:
- Layer Separation (50 pts): evidence of hexagonal architecture — application/, domain/, infrastructure/ (+25), domain and infrastructure cleanly separated (+15), composition root pattern visible (+10)
- Walking Skeleton (30 pts): thin end-to-end slice exists (+15), ports-and-adapters pattern evident (+15)
- Naming and Organisation (20 pts): source directories consistently organised (+10), file names descriptive and consistent (+10)
`.trim();

const RUBRIC_TEST_INFRASTRUCTURE = `
Evaluate the test infrastructure quality:
- Test Presence and Coverage (40 pts): test files present (+15), more than 5 test files (+10), tests organised by aggregate or module (+15)
- Test Patterns (35 pts): evidence of Scenario pattern / test data builders (+15), evidence of Fakes not mocks (+10), tests import only port interfaces not concrete adapters (+10)
- Test Types and Tooling (25 pts): test runner configured (vitest.config, jest.config, etc.) (+10), integration or contract tests (+10), mutation testing configured (+5)
`.trim();

const RUBRIC_DOCUMENTATION = `
Evaluate the documentation quality for agentic coding:
- README Quality (40 pts): README.md present (+10), describes how to build and test (+15), describes the architecture (+15)
- Public API Documentation (35 pts): exported types and interfaces documented (+20), port interfaces documented (+15)
- Architecture Documentation (25 pts): docs/ or adr/ directory present (+15), CLAUDE.md or similar kept up to date (+10)
`.trim();

/**
 * Handles EvaluateProject queries by orchestrating the scanner,
 * deterministic checks, parallel LLM judge calls, and aggregation.
 */
export class EvaluateProjectHandler implements Handler<EvaluateProject> {
  constructor(
    private readonly scanner: ProjectScanner,
    private readonly judge: LLMJudge,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supports(): ReadonlySet<new (...args: any[]) => EvaluateProject> {
    return new Set([EvaluateProject]);
  }

  async handle(action: EvaluateProject): Promise<Result<EvaluationResult>> {
    let snapshot;
    try {
      snapshot = await this.scanner.scan(action.projectPath);
    } catch (err) {
      return failure(EvaluationError.scanFailed(errorMessage(err)));
    }

    const deterministicAssessments = deterministicScore(snapshot);

    let csJudge, psJudge, tiJudge, docJudge;
    try {
      [csJudge, psJudge, tiJudge, docJudge] = await Promise.all([
        this.judge.judge({ snapshot, dimension: 'claude-code-setup', rubric: RUBRIC_CLAUDE_SETUP }),
        this.judge.judge({
          snapshot,
          dimension: 'project-structure',
          rubric: RUBRIC_PROJECT_STRUCTURE,
        }),
        this.judge.judge({
          snapshot,
          dimension: 'test-infrastructure',
          rubric: RUBRIC_TEST_INFRASTRUCTURE,
        }),
        this.judge.judge({ snapshot, dimension: 'documentation', rubric: RUBRIC_DOCUMENTATION }),
      ]);
    } catch (err) {
      return failure(EvaluationError.llmJudgeFailed(errorMessage(err)));
    }

    const dimensions = aggregate([
      {
        dimension: 'claude-code-setup',
        deterministicAssessment: deterministicAssessments['claude-code-setup'],
        judgeResponse: csJudge,
      },
      {
        dimension: 'project-structure',
        deterministicAssessment: deterministicAssessments['project-structure'],
        judgeResponse: psJudge,
      },
      {
        dimension: 'test-infrastructure',
        deterministicAssessment: deterministicAssessments['test-infrastructure'],
        judgeResponse: tiJudge,
      },
      {
        dimension: 'documentation',
        deterministicAssessment: deterministicAssessments['documentation'],
        judgeResponse: docJudge,
      },
    ]);

    const { score, grade } = overallScore(dimensions);

    return success({
      projectPath: action.projectPath,
      evaluatedAt: new Date().toISOString(),
      overallScore: score,
      overallGrade: grade,
      dimensions,
      topRecommendations: topRecommendations(dimensions),
    });
  }
}
