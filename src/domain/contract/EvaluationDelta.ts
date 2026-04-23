/** Delta between two metric snapshots for the same case. */
export interface MetricDelta {
  readonly metricId: string;
  readonly previousScore: number;
  readonly currentScore: number;
  readonly change: number;
}

/** How a single case's pass/fail status evolved across runs. */
export type CaseStatusChange =
  | 'still-passing'
  | 'still-failing'
  | 'newly-passing'
  | 'newly-failing';

/** Delta between two snapshots of the same case id. */
export interface CaseDelta {
  readonly caseId: string;
  readonly previousScore: number;
  readonly currentScore: number;
  readonly scoreChange: number;
  readonly statusChange: CaseStatusChange;
  readonly metricDeltas: readonly MetricDelta[];
}

/** Pass/fail counts for one run, used in the aggregate delta view. */
export interface AggregateView {
  readonly evaluatedAt: string;
  readonly passedCases: number;
  readonly totalCases: number;
  readonly passRate: number;
}

/**
 * Pure-data delta between two evaluation runs of the same skill + dataset.
 * `newCases` / `removedCases` cover changes to the dataset between runs.
 */
export interface EvaluationDelta {
  readonly previous: AggregateView;
  readonly current: AggregateView;
  /** Change in pass rate, in percentage points (current − previous) × 100. */
  readonly passRatePointsChange: number;
  readonly cases: readonly CaseDelta[];
  readonly newCases: readonly string[];
  readonly removedCases: readonly string[];
}
