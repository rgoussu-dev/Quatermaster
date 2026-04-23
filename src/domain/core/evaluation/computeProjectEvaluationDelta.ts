import type {
  ProjectHistorySnapshot,
  HistoryDimensionSnapshot,
} from '../../contract/ProjectHistorySnapshot.js';
import type {
  ProjectEvaluationDelta,
  DimensionDelta,
  ProjectAggregateView,
} from '../../contract/ProjectEvaluationDelta.js';

/**
 * Compares two snapshots of the same project path and returns a structured
 * delta: overall score change + per-dimension score and grade moves.
 *
 * Pure — no IO, no time reads. Dimensions that are present in only one
 * snapshot are omitted (rubric changes happen; we report shared dimensions).
 */
export function computeProjectEvaluationDelta(
  previous: ProjectHistorySnapshot,
  current: ProjectHistorySnapshot,
): ProjectEvaluationDelta {
  const previousById = new Map(previous.dimensions.map((d) => [d.id, d]));

  const dimensions: DimensionDelta[] = [];
  for (const cur of current.dimensions) {
    const prev = previousById.get(cur.id);
    if (!prev) continue;
    dimensions.push(buildDimensionDelta(prev, cur));
  }

  return {
    previous: toAggregate(previous),
    current: toAggregate(current),
    overallScoreChange: current.overallScore - previous.overallScore,
    dimensions,
  };
}

function toAggregate(snapshot: ProjectHistorySnapshot): ProjectAggregateView {
  return {
    evaluatedAt: snapshot.evaluatedAt,
    overallScore: snapshot.overallScore,
    overallGrade: snapshot.overallGrade,
  };
}

function buildDimensionDelta(
  prev: HistoryDimensionSnapshot,
  cur: HistoryDimensionSnapshot,
): DimensionDelta {
  return {
    id: cur.id,
    label: cur.label,
    previousScore: prev.score,
    currentScore: cur.score,
    scoreChange: cur.score - prev.score,
    previousGrade: prev.grade,
    currentGrade: cur.grade,
  };
}
