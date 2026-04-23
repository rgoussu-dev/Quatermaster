import type { FileDiff } from './FileDiff.js';
import type { ScenarioType } from './SkillCase.js';

/**
 * A single component of the multi-metric fitness score for one case.
 * Each metric is independently computed (deterministic check, semantic
 * similarity, LLM-as-judge, …) and carries its own weight and rationale.
 */
export interface MetricScore {
  /** Stable id — e.g. `artifact-presence`, `exit-code`, `llm-judge`. */
  readonly metricId: string;
  /** Human-readable label for reporting. */
  readonly label: string;
  /** Score in [0, 100]. */
  readonly score: number;
  /** Weight in [0, 1]. Weights are normalised at aggregation time. */
  readonly weight: number;
  /** Short explanation of how the score was produced. */
  readonly rationale: string;
}

/**
 * Judgement for a single skill evaluation case.
 */
export interface SkillCaseResult {
  readonly id: string;
  readonly prompt: string;
  readonly actualOutput: string;
  /** Aggregate fitness score in [0, 100] (weighted combination of `metrics`). */
  readonly score: number;
  /** True when score ≥ the case threshold. */
  readonly passed: boolean;
  /** Concise observations from the judge explaining the score. */
  readonly observations: readonly string[];
  /** Per-metric breakdown when a FitnessScorer was used. */
  readonly metrics?: readonly MetricScore[];
  /** Filesystem changes captured from a sandboxed workspace run. */
  readonly fileChanges?: readonly FileDiff[];
  /** Scenario tag inherited from the case. */
  readonly scenarioType?: ScenarioType;
}

/** Pass/total counts for a single scenario bucket. */
export interface ScenarioBucket {
  readonly total: number;
  readonly passed: number;
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
  /** Pass/total counts grouped by scenario tag, when scenarios are used. */
  readonly scenarioBreakdown?: Readonly<Partial<Record<ScenarioType, ScenarioBucket>>>;
}
