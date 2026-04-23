import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemDatasetLoader } from '../../src/infrastructure/dataset-loader/real/FileSystemDatasetLoader.js';

describe('FileSystemDatasetLoader goldenPath escape guard', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'quatermaster-dataset-escape-'));
    return async () => {
      await rm(rootDir, { recursive: true, force: true });
    };
  });

  it('rejects absolute goldenPath values', async () => {
    const datasetPath = join(rootDir, 'cases.json');
    await writeFile(
      datasetPath,
      JSON.stringify({
        cases: [
          {
            id: 'c1',
            prompt: 'x',
            expectedBehavior: 'x',
            threshold: 70,
            expectedArtifacts: [{ path: 'X.txt', goldenPath: '/etc/hostname' }],
          },
        ],
      }),
      'utf-8',
    );
    const loader = new FileSystemDatasetLoader();
    await expect(loader.load(datasetPath)).rejects.toThrow(/escapes the dataset directory/);
  });

  it('rejects parent-traversal goldenPath values', async () => {
    const datasetPath = join(rootDir, 'cases.json');
    await writeFile(
      datasetPath,
      JSON.stringify({
        cases: [
          {
            id: 'c1',
            prompt: 'x',
            expectedBehavior: 'x',
            threshold: 70,
            expectedArtifacts: [{ path: 'X.txt', goldenPath: '../../etc/hostname' }],
          },
        ],
      }),
      'utf-8',
    );
    const loader = new FileSystemDatasetLoader();
    await expect(loader.load(datasetPath)).rejects.toThrow(/escapes the dataset directory/);
  });
});
