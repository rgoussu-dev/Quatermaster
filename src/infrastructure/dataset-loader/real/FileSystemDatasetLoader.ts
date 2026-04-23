import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import type { DatasetLoader, SkillDataset } from '../../../domain/contract/ports/DatasetLoader.js';
import type { SkillCase, ExpectedArtifact } from '../../../domain/contract/SkillCase.js';

const ScenarioTypeSchema = z.enum(['ideal', 'realistic', 'adversarial']);

const ExpectedArtifactSchema = z.object({
  path: z.string().min(1),
  mustExist: z.boolean().optional(),
  contentPattern: z.string().optional(),
  /**
   * Path to a golden file, always resolved relative to the dataset JSON.
   * Paths that escape the dataset directory (`..`, absolute paths) are
   * rejected at load time to prevent unintended filesystem reads.
   * The loader reads the file and inlines the content as `goldenContent`
   * on the runtime DTO.
   */
  goldenPath: z.string().optional(),
  /** Allow authors to inline golden content directly instead of a path. */
  goldenContent: z.string().optional(),
});

const SkillCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  expectedBehavior: z.string().min(1),
  threshold: z.number().int().min(0).max(100).default(70),
  scenarioType: ScenarioTypeSchema.optional(),
  expectedArtifacts: z.array(ExpectedArtifactSchema).optional(),
  metricWeights: z.record(z.string(), z.number().min(0).finite()).optional(),
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
      throw new Error(`Dataset at "${datasetPath}" failed validation: ${result.error.message}`);
    }

    const datasetDir = dirname(datasetPath);
    const cases = await Promise.all(result.data.cases.map((c) => normalizeCase(c, datasetDir)));
    return { cases };
  }
}

type ParsedCase = z.infer<typeof SkillCaseSchema>;
type ParsedArtifact = z.infer<typeof ExpectedArtifactSchema>;

/**
 * Strips keys whose values are `undefined` so the result is assignable to
 * `SkillCase` under `exactOptionalPropertyTypes: true`. Also resolves
 * `goldenPath` fields on expected artifacts by reading the referenced file.
 */
async function normalizeCase(parsed: ParsedCase, datasetDir: string): Promise<SkillCase> {
  const base: SkillCase = {
    id: parsed.id,
    prompt: parsed.prompt,
    expectedBehavior: parsed.expectedBehavior,
    threshold: parsed.threshold,
  };

  const artifacts = parsed.expectedArtifacts
    ? await Promise.all(parsed.expectedArtifacts.map((a) => normalizeArtifact(a, datasetDir)))
    : undefined;

  return {
    ...base,
    ...(parsed.scenarioType !== undefined ? { scenarioType: parsed.scenarioType } : {}),
    ...(artifacts !== undefined ? { expectedArtifacts: artifacts } : {}),
    ...(parsed.metricWeights !== undefined ? { metricWeights: parsed.metricWeights } : {}),
    ...(parsed.seedRepoPath !== undefined ? { seedRepoPath: parsed.seedRepoPath } : {}),
  };
}

async function normalizeArtifact(
  parsed: ParsedArtifact,
  datasetDir: string,
): Promise<ExpectedArtifact> {
  const goldenContent = await resolveGoldenContent(parsed, datasetDir);
  const base: ExpectedArtifact = { path: parsed.path };
  return {
    ...base,
    ...(parsed.mustExist !== undefined ? { mustExist: parsed.mustExist } : {}),
    ...(parsed.contentPattern !== undefined ? { contentPattern: parsed.contentPattern } : {}),
    ...(goldenContent !== undefined ? { goldenContent } : {}),
  };
}

async function resolveGoldenContent(
  parsed: ParsedArtifact,
  datasetDir: string,
): Promise<string | undefined> {
  if (parsed.goldenContent !== undefined) return parsed.goldenContent;
  if (parsed.goldenPath === undefined) return undefined;

  const absolute = resolve(datasetDir, parsed.goldenPath);
  if (!isInsideDirectory(absolute, resolve(datasetDir))) {
    throw new Error(
      `goldenPath "${parsed.goldenPath}" for artifact "${parsed.path}" escapes the dataset directory`,
    );
  }

  // Second pass: resolve symlinks. If either realpath fails (typically
  // because the file doesn't yet exist) we fall through to the readFile
  // call below, which will surface a helpful error. If the file does
  // exist and a symlink points outside the dataset directory, we reject
  // here so a hostile dataset can't exfiltrate files via a symlink.
  try {
    const realDatasetDir = await realpath(resolve(datasetDir));
    const realTarget = await realpath(absolute);
    if (!isInsideDirectory(realTarget, realDatasetDir)) {
      throw new Error(
        `goldenPath "${parsed.goldenPath}" for artifact "${parsed.path}" resolves (via symlink) outside the dataset directory`,
      );
    }
  } catch (err) {
    if (err instanceof Error && /resolves \(via symlink\)/.test(err.message)) {
      throw err;
    }
    // realpath failed for another reason — let readFile surface it.
  }

  try {
    return await readFile(absolute, 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to load goldenPath "${parsed.goldenPath}" for artifact "${parsed.path}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * True when `candidate` lives inside `dir`. Handles the Windows
 * cross-drive case (where `path.relative` returns an absolute path)
 * and rejects the `dir === candidate` edge.
 */
function isInsideDirectory(candidate: string, dir: string): boolean {
  const rel = relative(dir, candidate);
  if (rel === '' || rel.startsWith('..')) return false;
  if (isAbsolute(rel)) return false;
  return true;
}
