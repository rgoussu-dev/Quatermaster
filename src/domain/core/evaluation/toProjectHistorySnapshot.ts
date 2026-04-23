import type { EvaluationResult } from '../../contract/EvaluationResult.js';
import type {
  ProjectHistorySnapshot,
  HistoryDimensionSnapshot,
} from '../../contract/ProjectHistorySnapshot.js';
import type { DimensionScore } from '../../contract/DimensionScore.js';

/**
 * Projects a full EvaluationResult into the compact shape persisted to disk.
 * Drops findings and topRecommendations — history only needs enough signal
 * to show score movement between runs.
 */
export function toProjectHistorySnapshot(result: EvaluationResult): ProjectHistorySnapshot {
  return {
    projectPath: result.projectPath,
    evaluatedAt: result.evaluatedAt,
    overallScore: result.overallScore,
    overallGrade: result.overallGrade,
    dimensions: result.dimensions.map(toDimensionSnapshot),
  };
}

function toDimensionSnapshot(d: DimensionScore): HistoryDimensionSnapshot {
  return {
    id: d.dimension,
    label: d.label,
    weight: d.weight,
    score: d.score,
    grade: d.grade,
  };
}
