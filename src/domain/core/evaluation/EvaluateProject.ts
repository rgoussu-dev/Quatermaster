import type { Query } from '../../contract/kernel/Query.js';
import type { EvaluationResult } from '../../contract/EvaluationResult.js';

/**
 * Evaluates a project's agentic coding readiness.
 * Read-only operation — no side effects beyond file system reads and API calls.
 */
export class EvaluateProject implements Query<EvaluationResult> {
  readonly _queryBrand = undefined as unknown as void;
  readonly _resultType = undefined as unknown as EvaluationResult;

  constructor(
    /** Absolute path to the project root to evaluate. */
    readonly projectPath: string,
  ) {}
}
