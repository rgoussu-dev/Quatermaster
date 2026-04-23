import type { ScenarioType } from './SkillCase.js';
import type { ScenarioBucket } from './SkillEvaluationResult.js';

/** Minimal per-metric snapshot used for history diffs. */
export interface HistoryMetricSnapshot {
  readonly metricId: string;
  readonly score: number;
}

/** Compact per-case snapshot kept on disk for future delta computation. */
export interface HistoryCaseSnapshot {
  readonly id: string;
  readonly score: number;
  readonly passed: boolean;
  readonly scenarioType?: ScenarioType;
  readonly metrics?: readonly HistoryMetricSnapshot[];
}

/**
 * Compact persistence form of a SkillEvaluationResult. Stored under
 * `.quatermaster/history/<slug>/<timestamp>.json` so iterations on the
 * skill can be compared over time without bloating the repo with full
 * stdout / file content captures.
 */
export interface EvaluationHistorySnapshot {
  readonly skillPath: string;
  readonly datasetPath: string;
  readonly evaluatedAt: string;
  readonly passRate: number;
  readonly totalCases: number;
  readonly passedCases: number;
  readonly cases: readonly HistoryCaseSnapshot[];
  readonly scenarioBreakdown?: Readonly<Partial<Record<ScenarioType, ScenarioBucket>>>;
}
