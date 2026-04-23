import type { Handler } from '../../contract/kernel/Handler.js';
import type { Result } from '../../contract/kernel/Result.js';
import { success, failure } from '../../contract/kernel/Result.js';
import type { SkillRunner } from '../../contract/ports/SkillRunner.js';
import type { DatasetLoader, SkillDataset } from '../../contract/ports/DatasetLoader.js';
import type { SkillJudge } from '../../contract/ports/SkillJudge.js';
import type { AgentRunWorkspace } from '../../contract/ports/AgentRunWorkspace.js';
import type {
  SkillEvaluationResult,
  SkillCaseResult,
  ScenarioBucket,
} from '../../contract/SkillEvaluationResult.js';
import type { SkillCase, ScenarioType } from '../../contract/SkillCase.js';
import { EvaluateSkill } from './EvaluateSkill.js';
import { SkillEvaluationError } from './SkillEvaluationError.js';
import { FitnessScorer } from './FitnessScorer.js';

/**
 * Handles EvaluateSkill queries: loads the dataset, runs each case through the
 * skill, judges each output in parallel, then aggregates the results.
 *
 * When an `AgentRunWorkspace` is injected, each case is run in an isolated
 * workspace and scored via the multi-metric `FitnessScorer` (artifacts, exit
 * code, LLM judge). Without a workspace, falls back to the text-only path
 * using `SkillRunner` and the LLM judge alone.
 */
export class EvaluateSkillHandler implements Handler<EvaluateSkill> {
  private readonly fitnessScorer: FitnessScorer;

  constructor(
    private readonly skillRunner: SkillRunner,
    private readonly datasetLoader: DatasetLoader,
    private readonly skillJudge: SkillJudge,
    private readonly workspace?: AgentRunWorkspace,
  ) {
    this.fitnessScorer = new FitnessScorer();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supports(): ReadonlySet<new (...args: any[]) => EvaluateSkill> {
    return new Set([EvaluateSkill]);
  }

  async handle(action: EvaluateSkill): Promise<Result<SkillEvaluationResult>> {
    let dataset: SkillDataset;
    try {
      dataset = await this.datasetLoader.load(action.datasetPath);
    } catch (err) {
      return failure(SkillEvaluationError.datasetLoadFailed(errorMessage(err)));
    }

    let caseResults: SkillCaseResult[];
    try {
      caseResults = await Promise.all(
        dataset.cases.map((skillCase) => this.evaluateCase(action.skillPath, skillCase)),
      );
    } catch (err) {
      if (err instanceof SkillJudgeFailure) {
        return failure(SkillEvaluationError.skillJudgeFailed(err.message));
      }
      return failure(SkillEvaluationError.skillRunFailed(errorMessage(err)));
    }

    const passedCases = caseResults.filter((r) => r.passed).length;
    const scenarioBreakdown = buildScenarioBreakdown(caseResults);

    const result: SkillEvaluationResult = {
      skillPath: action.skillPath,
      datasetPath: action.datasetPath,
      evaluatedAt: new Date().toISOString(),
      passRate: dataset.cases.length === 0 ? 0 : passedCases / dataset.cases.length,
      totalCases: dataset.cases.length,
      passedCases,
      cases: caseResults,
      ...(scenarioBreakdown ? { scenarioBreakdown } : {}),
    };
    return success(result);
  }

  private async evaluateCase(skillPath: string, skillCase: SkillCase): Promise<SkillCaseResult> {
    if (this.workspace) {
      return this.evaluateCaseWithWorkspace(skillPath, skillCase, this.workspace);
    }
    return this.evaluateCaseTextOnly(skillPath, skillCase);
  }

  private async evaluateCaseTextOnly(
    skillPath: string,
    skillCase: SkillCase,
  ): Promise<SkillCaseResult> {
    const actualOutput = await this.skillRunner.run(skillPath, skillCase.prompt);
    const judgement = await this.runJudge({
      actualOutput,
      expectedBehavior: skillCase.expectedBehavior,
    });

    return {
      id: skillCase.id,
      prompt: skillCase.prompt,
      actualOutput,
      score: judgement.score,
      passed: judgement.score >= skillCase.threshold,
      observations: judgement.observations,
      ...(skillCase.scenarioType ? { scenarioType: skillCase.scenarioType } : {}),
    };
  }

  private async evaluateCaseWithWorkspace(
    skillPath: string,
    skillCase: SkillCase,
    workspace: AgentRunWorkspace,
  ): Promise<SkillCaseResult> {
    const outcome = await workspace.run({
      skillPath,
      userPrompt: skillCase.prompt,
      ...(skillCase.seedRepoPath ? { seedRepoPath: skillCase.seedRepoPath } : {}),
    });

    const judgement = await this.runJudge({
      actualOutput: outcome.stdout,
      expectedBehavior: skillCase.expectedBehavior,
    });

    const { overallScore, metrics } = this.fitnessScorer.score(skillCase, outcome, judgement);

    return {
      id: skillCase.id,
      prompt: skillCase.prompt,
      actualOutput: outcome.stdout,
      score: overallScore,
      passed: overallScore >= skillCase.threshold,
      observations: judgement.observations,
      metrics,
      fileChanges: outcome.fileChanges,
      ...(skillCase.scenarioType ? { scenarioType: skillCase.scenarioType } : {}),
    };
  }

  private async runJudge(request: {
    actualOutput: string;
    expectedBehavior: string;
  }): ReturnType<SkillJudge['judge']> {
    try {
      return await this.skillJudge.judge(request);
    } catch (err) {
      throw new SkillJudgeFailure(errorMessage(err));
    }
  }
}

class SkillJudgeFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillJudgeFailure';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function buildScenarioBreakdown(
  results: readonly SkillCaseResult[],
): Partial<Record<ScenarioType, ScenarioBucket>> | undefined {
  const tagged = results.filter((r) => r.scenarioType !== undefined);
  if (tagged.length === 0) return undefined;

  const buckets: Partial<Record<ScenarioType, { total: number; passed: number }>> = {};
  for (const r of tagged) {
    const tag = r.scenarioType;
    if (!tag) continue;
    const current = buckets[tag] ?? { total: 0, passed: 0 };
    buckets[tag] = {
      total: current.total + 1,
      passed: current.passed + (r.passed ? 1 : 0),
    };
  }
  return buckets;
}
