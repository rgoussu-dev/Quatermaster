import type { Query } from '../../contract/kernel/Query.js';
import type { SkillEvaluationResult } from '../../contract/SkillEvaluationResult.js';

/**
 * Runs all cases in a dataset through a skill and judges each output.
 * Read-only operation — no side effects beyond file reads and API calls.
 */
export class EvaluateSkill implements Query<SkillEvaluationResult> {
  readonly _queryBrand = undefined as unknown as void;
  readonly _resultType = undefined as unknown as SkillEvaluationResult;

  constructor(
    /** Absolute path to the skill markdown file. */
    readonly skillPath: string,
    /** Absolute path to the JSON dataset file. */
    readonly datasetPath: string,
  ) {}
}
