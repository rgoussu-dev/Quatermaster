import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
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

  it('accepts filenames that start with two dots (e.g. `..golden.txt`)', async () => {
    // Regression test — an earlier `rel.startsWith('..')` guard would
    // incorrectly reject this legitimate in-directory filename.
    const goldenPath = join(rootDir, '..golden.txt');
    await writeFile(goldenPath, 'content\n', 'utf-8');

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
            expectedArtifacts: [{ path: 'X.txt', goldenPath: '..golden.txt' }],
          },
        ],
      }),
      'utf-8',
    );

    const loader = new FileSystemDatasetLoader();
    const dataset = await loader.load(datasetPath);
    expect(dataset.cases[0]?.expectedArtifacts?.[0]?.goldenContent).toBe('content\n');
  });

  it('rejects a symlink inside the dataset dir that points outside', async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), 'quatermaster-outside-'));
    const outsideFile = join(outsideDir, 'secret.txt');
    await writeFile(outsideFile, 'do not leak\n', 'utf-8');

    await mkdir(join(rootDir, 'golden'), { recursive: true });
    const linkPath = join(rootDir, 'golden', 'link.txt');
    await symlink(outsideFile, linkPath);

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
            expectedArtifacts: [{ path: 'X.txt', goldenPath: 'golden/link.txt' }],
          },
        ],
      }),
      'utf-8',
    );

    const loader = new FileSystemDatasetLoader();
    await expect(loader.load(datasetPath)).rejects.toThrow(/resolves \(via symlink\)/);

    await rm(outsideDir, { recursive: true, force: true });
  });
});
