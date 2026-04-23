import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemDatasetLoader } from '../../src/infrastructure/dataset-loader/real/FileSystemDatasetLoader.js';

describe('FileSystemDatasetLoader goldenPath resolution', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'quatermaster-dataset-test-'));
    return async () => {
      await rm(rootDir, { recursive: true, force: true });
    };
  });

  it('resolves goldenPath relative to the dataset file and inlines content', async () => {
    const goldenPath = join(rootDir, 'golden', 'CHANGELOG.md');
    await mkdir(join(rootDir, 'golden'), { recursive: true });
    await writeFile(goldenPath, '## v1\n- feat: thing\n', 'utf-8');

    const datasetPath = join(rootDir, 'cases.json');
    await writeFile(
      datasetPath,
      JSON.stringify({
        cases: [
          {
            id: 'c1',
            prompt: 'do it',
            expectedBehavior: 'CHANGELOG.md matches',
            threshold: 70,
            expectedArtifacts: [
              { path: 'CHANGELOG.md', goldenPath: 'golden/CHANGELOG.md' },
            ],
          },
        ],
      }),
      'utf-8',
    );

    const loader = new FileSystemDatasetLoader();
    const dataset = await loader.load(datasetPath);

    const artifact = dataset.cases[0]?.expectedArtifacts?.[0];
    expect(artifact?.goldenContent).toBe('## v1\n- feat: thing\n');
  });

  it('accepts inline goldenContent and skips filesystem access', async () => {
    const datasetPath = join(rootDir, 'cases.json');
    await writeFile(
      datasetPath,
      JSON.stringify({
        cases: [
          {
            id: 'c1',
            prompt: 'do it',
            expectedBehavior: 'anything',
            threshold: 70,
            expectedArtifacts: [
              { path: 'X.txt', goldenContent: 'inlined\n' },
            ],
          },
        ],
      }),
      'utf-8',
    );

    const loader = new FileSystemDatasetLoader();
    const dataset = await loader.load(datasetPath);
    expect(dataset.cases[0]?.expectedArtifacts?.[0]?.goldenContent).toBe('inlined\n');
  });

  it('raises a descriptive error when goldenPath is missing on disk', async () => {
    const datasetPath = join(rootDir, 'cases.json');
    await writeFile(
      datasetPath,
      JSON.stringify({
        cases: [
          {
            id: 'c1',
            prompt: 'do it',
            expectedBehavior: 'anything',
            threshold: 70,
            expectedArtifacts: [
              { path: 'X.txt', goldenPath: 'does-not-exist.txt' },
            ],
          },
        ],
      }),
      'utf-8',
    );

    const loader = new FileSystemDatasetLoader();
    await expect(loader.load(datasetPath)).rejects.toThrow(/goldenPath.*does-not-exist/);
  });
});
