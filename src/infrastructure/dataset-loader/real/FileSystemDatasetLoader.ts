import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { DatasetLoader, SkillDataset } from '../../../domain/contract/ports/DatasetLoader.js';
import type { SkillCase, ExpectedArtifact } from '../../../domain/contract/SkillCase.js';

const ScenarioTypeSchema = z.enum(['ideal', 'realistic', 'adversarial']);

const ExpectedArtifactSchema = z.object({
  path: z.string().min(1),
  mustExist: z.boolean().optional(),
  contentPattern: z.string().optional(),
});

const SkillCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  expectedBehavior: z.string().min(1),
  threshold: z.number().int().min(0).max(100).default(70),
  scenarioType: ScenarioTypeSchema.optional(),
  expectedArtifacts: z.array(ExpectedArtifactSchema).optional(),
  metricWeights: z.record(z.string(), z.number()).optional(),
  seedRepoPath: z.string().optional(),
});

const SkillDatasetSchema = z.object({
  cases: z.array(SkillCaseSchema).min(1),
});

/** Real adapter — reads and validates a JSON dataset file from disk. */
export class FileSystemDatasetLoader implements DatasetLoader {
  async load(datasetPath: string): Promise<SkillDataset> {
    let raw: string;
    try {
      raw = await readFile(datasetPath, 'utf-8');
    } catch (err) {
      throw new Error(
        `Failed to load dataset at "${datasetPath}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Dataset at "${datasetPath}" is not valid JSON`);
    }

    const result = SkillDatasetSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Dataset at "${datasetPath}" failed validation: ${result.error.message}`,
      );
    }

    return { cases: result.data.cases.map(normalizeCase) };
  }
}

type ParsedCase = z.infer<typeof SkillCaseSchema>;
type ParsedArtifact = z.infer<typeof ExpectedArtifactSchema>;

/**
 * Strips keys whose values are `undefined` so the result is assignable to
 * `SkillCase` under `exactOptionalPropertyTypes: true`.
 */
function normalizeCase(parsed: ParsedCase): SkillCase {
  const base: SkillCase = {
    id: parsed.id,
    prompt: parsed.prompt,
    expectedBehavior: parsed.expectedBehavior,
    threshold: parsed.threshold,
  };
  return {
    ...base,
    ...(parsed.scenarioType !== undefined ? { scenarioType: parsed.scenarioType } : {}),
    ...(parsed.expectedArtifacts !== undefined
      ? { expectedArtifacts: parsed.expectedArtifacts.map(normalizeArtifact) }
      : {}),
    ...(parsed.metricWeights !== undefined ? { metricWeights: parsed.metricWeights } : {}),
    ...(parsed.seedRepoPath !== undefined ? { seedRepoPath: parsed.seedRepoPath } : {}),
  };
}

function normalizeArtifact(parsed: ParsedArtifact): ExpectedArtifact {
  const base: ExpectedArtifact = { path: parsed.path };
  return {
    ...base,
    ...(parsed.mustExist !== undefined ? { mustExist: parsed.mustExist } : {}),
    ...(parsed.contentPattern !== undefined ? { contentPattern: parsed.contentPattern } : {}),
  };
}
