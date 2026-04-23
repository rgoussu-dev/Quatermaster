import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { EvaluationHistoryStore } from '../../../domain/contract/ports/EvaluationHistoryStore.js';

/**
 * Real adapter — writes snapshots as JSON under `<rootDir>/<slug>/<iso>.json`.
 * Generic over snapshot type so the same implementation serves skill-eval
 * and project-eval history. The slug is derived by the caller via the
 * helpers exported from this module so keys stay consistent between
 * `save` and `loadLatest`.
 *
 * Malformed or unreadable history files are ignored rather than crashing
 * the evaluation — a stale history directory should never block a fresh run.
 */
export class FileSystemEvaluationHistoryStore<T extends { readonly evaluatedAt: string }>
  implements EvaluationHistoryStore<T>
{
  constructor(private readonly rootDir: string) {}

  async save(key: string, snapshot: T): Promise<void> {
    const dir = join(this.rootDir, sanitize(key));
    await mkdir(dir, { recursive: true });
    const filename = `${snapshot.evaluatedAt.replace(/[:.]/g, '-')}.json`;
    await writeFile(join(dir, filename), JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  async loadLatest(key: string): Promise<T | null> {
    const dir = join(this.rootDir, sanitize(key));
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return null;
    }

    const snapshots = entries.filter((f) => f.endsWith('.json')).sort();
    for (let i = snapshots.length - 1; i >= 0; i -= 1) {
      const name = snapshots[i];
      if (!name) continue;
      try {
        const raw = await readFile(join(dir, name), 'utf-8');
        const parsed = JSON.parse(raw) as T;
        if (typeof (parsed as { evaluatedAt?: unknown }).evaluatedAt !== 'string') {
          continue;
        }
        return parsed;
      } catch {
        continue;
      }
    }
    return null;
  }
}

/** Key for a skill-eval history entry. */
export function skillHistoryKey(skillPath: string, datasetPath: string): string {
  return `${basenameNoExt(skillPath)}__${basenameNoExt(datasetPath)}`;
}

/** Key for a project-eval history entry. */
export function projectHistoryKey(projectPath: string): string {
  return `project__${basenameNoExt(projectPath)}__${shortHash(projectPath)}`;
}

function basenameNoExt(p: string): string {
  return basename(p, extname(p));
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** Small deterministic suffix so two projects with the same basename don't collide. */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}
