/**
 * Judgement for a single skill evaluation case.
 */
export interface SkillCaseResult {
  readonly id: string;
  readonly prompt: string;
  readonly actualOutput: string;
  /** Score in [0, 100] assigned by the LLM judge. */
  readonly score: number;
  /** True when score ≥ the case threshold. */
  readonly passed: boolean;
  /** Concise observations from the judge explaining the score. */
  readonly observations: readonly string[];
}

/**
 * Aggregate result of running all dataset cases through a skill.
 */
export interface SkillEvaluationResult {
  readonly skillPath: string;
  readonly datasetPath: string;
  /** ISO 8601 timestamp of when the evaluation ran. */
  readonly evaluatedAt: string;
  /** Fraction of cases that passed, in [0, 1]. */
  readonly passRate: number;
  readonly totalCases: number;
  readonly passedCases: number;
  readonly cases: readonly SkillCaseResult[];
}
