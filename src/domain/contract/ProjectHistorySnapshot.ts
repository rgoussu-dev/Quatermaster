import type { DimensionId } from './DimensionScore.js';

/** Compact per-dimension entry kept in history. */
export interface HistoryDimensionSnapshot {
  readonly id: DimensionId;
  readonly label: string;
  readonly weight: number;
  readonly score: number;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Compact persistence form of a readiness EvaluationResult. Stored under
 * `.quatermaster/history/<slug>/<timestamp>.json` so iterations on the
 * project setup can be compared over time.
 *
 * Findings and topRecommendations are intentionally omitted — they rot
 * quickly and the reader wants score movement, not historical prose.
 */
export interface ProjectHistorySnapshot {
  readonly projectPath: string;
  readonly evaluatedAt: string;
  readonly overallScore: number;
  readonly overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly dimensions: readonly HistoryDimensionSnapshot[];
}
