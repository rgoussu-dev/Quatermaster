import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { DatasetLoader, SkillDataset } from '../../../domain/contract/ports/DatasetLoader.js';

const SkillCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  expectedBehavior: z.string().min(1),
  threshold: z.number().int().min(0).max(100).default(70),
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

    return result.data;
  }
}
