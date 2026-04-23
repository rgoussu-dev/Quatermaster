import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { EvaluationHistoryStore } from '../../../domain/contract/ports/EvaluationHistoryStore.js';
import type { EvaluationHistorySnapshot } from '../../../domain/contract/EvaluationHistorySnapshot.js';

/**
 * Real adapter — writes snapshots as JSON under `<rootDir>/<slug>/<iso>.json`.
 * `slug` is derived from the skill + dataset basenames so iterations on the
 * same skill share a folder and sort lexically by timestamp.
 *
 * Malformed or unreadable history files are ignored rather than crashing
 * the evaluation — a stale history directory should never block a fresh run.
 */
export class FileSystemEvaluationHistoryStore implements EvaluationHistoryStore {
  constructor(private readonly rootDir: string) {}

  async save(snapshot: EvaluationHistorySnapshot): Promise<void> {
    const dir = join(this.rootDir, slug(snapshot.skillPath, snapshot.datasetPath));
    await mkdir(dir, { recursive: true });
    const filename = `${snapshot.evaluatedAt.replace(/[:.]/g, '-')}.json`;
    await writeFile(join(dir, filename), JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  async loadLatest(
    skillPath: string,
    datasetPath: string,
  ): Promise<EvaluationHistorySnapshot | null> {
    const dir = join(this.rootDir, slug(skillPath, datasetPath));
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return null;
    }

    const snapshots = entries.filter((f) => f.endsWith('.json')).sort();
    const latest = snapshots[snapshots.length - 1];
    if (!latest) return null;

    try {
      const raw = await readFile(join(dir, latest), 'utf-8');
      const parsed = JSON.parse(raw) as EvaluationHistorySnapshot;
      if (typeof parsed.evaluatedAt !== 'string' || !Array.isArray(parsed.cases)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}

function slug(skillPath: string, datasetPath: string): string {
  return `${sanitize(basenameNoExt(skillPath))}__${sanitize(basenameNoExt(datasetPath))}`;
}

function basenameNoExt(p: string): string {
  return basename(p, extname(p));
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '-');
}
