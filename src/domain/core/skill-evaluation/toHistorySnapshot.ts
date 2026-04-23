import type { SkillEvaluationResult, SkillCaseResult } from '../../contract/SkillEvaluationResult.js';
import type {
  EvaluationHistorySnapshot,
  HistoryCaseSnapshot,
} from '../../contract/EvaluationHistorySnapshot.js';

/**
 * Projects a full SkillEvaluationResult into the compact shape persisted to
 * disk. Strips `actualOutput`, `fileChanges`, observations, and rationales —
 * history only needs enough signal to compute deltas between runs.
 */
export function toHistorySnapshot(result: SkillEvaluationResult): EvaluationHistorySnapshot {
  const base: EvaluationHistorySnapshot = {
    skillPath: result.skillPath,
    datasetPath: result.datasetPath,
    evaluatedAt: result.evaluatedAt,
    passRate: result.passRate,
    totalCases: result.totalCases,
    passedCases: result.passedCases,
    cases: result.cases.map(toCaseSnapshot),
  };
  return result.scenarioBreakdown
    ? { ...base, scenarioBreakdown: result.scenarioBreakdown }
    : base;
}

function toCaseSnapshot(c: SkillCaseResult): HistoryCaseSnapshot {
  const base: HistoryCaseSnapshot = {
    id: c.id,
    score: c.score,
    passed: c.passed,
  };
  return {
    ...base,
    ...(c.scenarioType ? { scenarioType: c.scenarioType } : {}),
    ...(c.metrics
      ? { metrics: c.metrics.map((m) => ({ metricId: m.metricId, score: m.score })) }
      : {}),
  };
}
