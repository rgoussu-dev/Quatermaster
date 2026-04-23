import type { DimensionId } from './DimensionScore.js';

/** Aggregate view of one project snapshot for the delta report. */
export interface ProjectAggregateView {
  readonly evaluatedAt: string;
  readonly overallScore: number;
  readonly overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/** Delta between two snapshots of the same dimension. */
export interface DimensionDelta {
  readonly id: DimensionId;
  readonly label: string;
  readonly previousScore: number;
  readonly currentScore: number;
  readonly scoreChange: number;
  readonly previousGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly currentGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/** Pure-data delta between two readiness runs of the same project. */
export interface ProjectEvaluationDelta {
  readonly previous: ProjectAggregateView;
  readonly current: ProjectAggregateView;
  /** Change in overall score (current − previous). */
  readonly overallScoreChange: number;
  readonly dimensions: readonly DimensionDelta[];
}
