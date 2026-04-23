import { z } from 'zod';
import type { EvaluationHistorySnapshot } from '../../../domain/contract/EvaluationHistorySnapshot.js';
import type { ProjectHistorySnapshot } from '../../../domain/contract/ProjectHistorySnapshot.js';
import type { SnapshotValidator } from './FileSystemEvaluationHistoryStore.js';

const GradeSchema = z.enum(['A', 'B', 'C', 'D', 'F']);
const ScenarioSchema = z.enum(['ideal', 'realistic', 'adversarial']);

const HistoryMetricSchema = z.object({
  metricId: z.string(),
  score: z.number(),
});

const HistoryCaseSchema = z.object({
  id: z.string(),
  score: z.number(),
  passed: z.boolean(),
  scenarioType: ScenarioSchema.optional(),
  metrics: z.array(HistoryMetricSchema).optional(),
});

const ScenarioBucketSchema = z.object({
  total: z.number(),
  passed: z.number(),
});

const SkillSnapshotSchema = z.object({
  skillPath: z.string(),
  datasetPath: z.string(),
  evaluatedAt: z.string(),
  passRate: z.number(),
  totalCases: z.number(),
  passedCases: z.number(),
  cases: z.array(HistoryCaseSchema),
  scenarioBreakdown: z.record(ScenarioSchema, ScenarioBucketSchema.optional()).optional(),
});

const HistoryDimensionSchema = z.object({
  id: z.enum(['claude-code-setup', 'project-structure', 'test-infrastructure', 'documentation']),
  label: z.string(),
  weight: z.number(),
  score: z.number(),
  grade: GradeSchema,
});

const ProjectSnapshotSchema = z.object({
  projectPath: z.string(),
  evaluatedAt: z.string(),
  overallScore: z.number(),
  overallGrade: GradeSchema,
  dimensions: z.array(HistoryDimensionSchema),
});

/** Validator for persisted skill-evaluation history entries. */
export const validateSkillSnapshot: SnapshotValidator<EvaluationHistorySnapshot> = (raw) => {
  const parsed = SkillSnapshotSchema.safeParse(raw);
  return parsed.success ? (parsed.data as EvaluationHistorySnapshot) : null;
};

/** Validator for persisted project-evaluation history entries. */
export const validateProjectSnapshot: SnapshotValidator<ProjectHistorySnapshot> = (raw) => {
  const parsed = ProjectSnapshotSchema.safeParse(raw);
  return parsed.success ? (parsed.data as ProjectHistorySnapshot) : null;
};
