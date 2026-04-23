import type { Handler } from '../../contract/kernel/Handler.js';
import type { Result } from '../../contract/kernel/Result.js';
import { success, failure } from '../../contract/kernel/Result.js';
import type { SkillRunner } from '../../contract/ports/SkillRunner.js';
import type { DatasetLoader } from '../../contract/ports/DatasetLoader.js';
import type { SkillJudge } from '../../contract/ports/SkillJudge.js';
import type { SkillEvaluationResult, SkillCaseResult } from '../../contract/SkillEvaluationResult.js';
import type { SkillCase } from '../../contract/SkillCase.js';
import { EvaluateSkill } from './EvaluateSkill.js';
import { SkillEvaluationError } from './SkillEvaluationError.js';

/**
 * Handles EvaluateSkill queries: loads the dataset, runs each case through the skill,
 * judges each output in parallel, then aggregates the results.
 */
export class EvaluateSkillHandler implements Handler<EvaluateSkill> {
  constructor(
    private readonly skillRunner: SkillRunner,
    private readonly datasetLoader: DatasetLoader,
    private readonly skillJudge: SkillJudge,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supports(): ReadonlySet<new (...args: any[]) => EvaluateSkill> {
    return new Set([EvaluateSkill]);
  }

  async handle(action: EvaluateSkill): Promise<Result<SkillEvaluationResult>> {
    try {
      const dataset = await this.datasetLoader.load(action.datasetPath);

      const caseResults = await Promise.all(
        dataset.cases.map((skillCase) => this.evaluateCase(action.skillPath, skillCase)),
      );

      const passedCases = caseResults.filter((r) => r.passed).length;

      return success({
        skillPath: action.skillPath,
        datasetPath: action.datasetPath,
        evaluatedAt: new Date().toISOString(),
        passRate: dataset.cases.length === 0 ? 0 : passedCases / dataset.cases.length,
        totalCases: dataset.cases.length,
        passedCases,
        cases: caseResults,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('dataset') || message.includes('load')) {
        return failure(SkillEvaluationError.datasetLoadFailed(message));
      }
      return failure(SkillEvaluationError.skillRunFailed(message));
    }
  }

  private async evaluateCase(skillPath: string, skillCase: SkillCase): Promise<SkillCaseResult> {
    const actualOutput = await this.skillRunner.run(skillPath, skillCase.prompt);
    const judgement = await this.skillJudge.judge({
      actualOutput,
      expectedBehavior: skillCase.expectedBehavior,
    });

    const threshold = skillCase.threshold;
    return {
      id: skillCase.id,
      prompt: skillCase.prompt,
      actualOutput,
      score: judgement.score,
      passed: judgement.score >= threshold,
      observations: judgement.observations,
    };
  }
}
