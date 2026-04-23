import type {
  EvaluationHistorySnapshot,
  HistoryCaseSnapshot,
  HistoryMetricSnapshot,
} from '../../contract/EvaluationHistorySnapshot.js';
import type {
  EvaluationDelta,
  CaseDelta,
  CaseStatusChange,
  MetricDelta,
  AggregateView,
} from '../../contract/EvaluationDelta.js';

/**
 * Compares two snapshots of the same (skill, dataset) pair and returns a
 * structured delta: aggregate pass-rate change, per-case score moves,
 * per-metric breakdowns for shared cases, and dataset-shape changes.
 *
 * Pure — no IO, no time reads.
 */
export function computeEvaluationDelta(
  previous: EvaluationHistorySnapshot,
  current: EvaluationHistorySnapshot,
): EvaluationDelta {
  const previousById = new Map(previous.cases.map((c) => [c.id, c]));
  const currentById = new Map(current.cases.map((c) => [c.id, c]));

  const cases: CaseDelta[] = [];
  for (const cur of current.cases) {
    const prev = previousById.get(cur.id);
    if (!prev) continue;
    cases.push(buildCaseDelta(prev, cur));
  }

  const newCases = current.cases
    .filter((c) => !previousById.has(c.id))
    .map((c) => c.id);
  const removedCases = previous.cases
    .filter((c) => !currentById.has(c.id))
    .map((c) => c.id);

  return {
    previous: toAggregate(previous),
    current: toAggregate(current),
    passRatePointsChange: round1((current.passRate - previous.passRate) * 100),
    cases,
    newCases,
    removedCases,
  };
}

function toAggregate(snapshot: EvaluationHistorySnapshot): AggregateView {
  return {
    evaluatedAt: snapshot.evaluatedAt,
    passedCases: snapshot.passedCases,
    totalCases: snapshot.totalCases,
    passRate: snapshot.passRate,
  };
}

function buildCaseDelta(
  prev: HistoryCaseSnapshot,
  cur: HistoryCaseSnapshot,
): CaseDelta {
  return {
    caseId: cur.id,
    previousScore: prev.score,
    currentScore: cur.score,
    scoreChange: cur.score - prev.score,
    statusChange: classifyStatus(prev.passed, cur.passed),
    metricDeltas: buildMetricDeltas(prev.metrics, cur.metrics),
  };
}

function classifyStatus(prevPassed: boolean, curPassed: boolean): CaseStatusChange {
  if (prevPassed && curPassed) return 'still-passing';
  if (!prevPassed && !curPassed) return 'still-failing';
  if (curPassed) return 'newly-passing';
  return 'newly-failing';
}

function buildMetricDeltas(
  prevMetrics: readonly HistoryMetricSnapshot[] | undefined,
  curMetrics: readonly HistoryMetricSnapshot[] | undefined,
): readonly MetricDelta[] {
  if (!prevMetrics || !curMetrics) return [];
  const prevById = new Map(prevMetrics.map((m) => [m.metricId, m]));
  const out: MetricDelta[] = [];
  for (const cur of curMetrics) {
    const prev = prevById.get(cur.metricId);
    if (!prev) continue;
    out.push({
      metricId: cur.metricId,
      previousScore: prev.score,
      currentScore: cur.score,
      change: cur.score - prev.score,
    });
  }
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
