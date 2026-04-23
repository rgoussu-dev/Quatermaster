import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemEvaluationHistoryStore } from '../../src/infrastructure/history-store/real/FileSystemEvaluationHistoryStore.js';
import { InMemoryEvaluationHistoryStore } from '../../src/infrastructure/history-store/fake/InMemoryEvaluationHistoryStore.js';
import type { EvaluationHistorySnapshot } from '../../src/domain/contract/EvaluationHistorySnapshot.js';

const SKILL = '/skills/x.md';
const DATASET = '/data/x.json';

function snap(evaluatedAt: string, passed: number): EvaluationHistorySnapshot {
  return {
    skillPath: SKILL,
    datasetPath: DATASET,
    evaluatedAt,
    totalCases: 2,
    passedCases: passed,
    passRate: passed / 2,
    cases: [
      { id: 'a', score: 80, passed: true },
      { id: 'b', score: passed === 2 ? 90 : 40, passed: passed === 2 },
    ],
  };
}

describe('InMemoryEvaluationHistoryStore', () => {
  it('returns null when no history exists', async () => {
    const store = new InMemoryEvaluationHistoryStore();
    expect(await store.loadLatest(SKILL, DATASET)).toBeNull();
  });

  it('returns the latest saved snapshot', async () => {
    const store = new InMemoryEvaluationHistoryStore();
    await store.save(snap('2026-04-22T00:00:00Z', 1));
    await store.save(snap('2026-04-23T00:00:00Z', 2));

    const latest = await store.loadLatest(SKILL, DATASET);
    expect(latest?.evaluatedAt).toBe('2026-04-23T00:00:00Z');
    expect(latest?.passedCases).toBe(2);
  });

  it('keys snapshots by (skillPath, datasetPath)', async () => {
    const store = new InMemoryEvaluationHistoryStore();
    await store.save(snap('2026-04-22T00:00:00Z', 1));

    expect(await store.loadLatest(SKILL, '/other/dataset.json')).toBeNull();
    expect(await store.loadLatest('/other/skill.md', DATASET)).toBeNull();
  });
});

describe('FileSystemEvaluationHistoryStore', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'quatermaster-history-test-'));
    return async () => {
      await rm(rootDir, { recursive: true, force: true });
    };
  });

  it('returns null when the history directory does not exist yet', async () => {
    const store = new FileSystemEvaluationHistoryStore(rootDir);
    expect(await store.loadLatest(SKILL, DATASET)).toBeNull();
  });

  it('round-trips a snapshot via disk', async () => {
    const store = new FileSystemEvaluationHistoryStore(rootDir);
    const original = snap('2026-04-22T00:00:00Z', 2);
    await store.save(original);

    const loaded = await store.loadLatest(SKILL, DATASET);
    expect(loaded).toMatchObject({
      skillPath: SKILL,
      datasetPath: DATASET,
      evaluatedAt: '2026-04-22T00:00:00Z',
      passedCases: 2,
    });
  });

  it('returns the most recent snapshot when multiple exist', async () => {
    const store = new FileSystemEvaluationHistoryStore(rootDir);
    await store.save(snap('2026-04-22T00:00:00Z', 1));
    await store.save(snap('2026-04-23T00:00:00Z', 2));

    const latest = await store.loadLatest(SKILL, DATASET);
    expect(latest?.evaluatedAt).toBe('2026-04-23T00:00:00Z');
  });
});
