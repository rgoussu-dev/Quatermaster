import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type {
  AgentRunWorkspace,
  AgentRunRequest,
} from '../../../domain/contract/ports/AgentRunWorkspace.js';
import type { AgentRunOutcome } from '../../../domain/contract/AgentRunOutcome.js';
import type { FileDiff } from '../../../domain/contract/FileDiff.js';

/** Paths skipped when snapshotting or copying a seed repo. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.quatermaster']);
/** Hard cap to avoid loading huge binary blobs into memory. */
const MAX_FILE_BYTES = 256 * 1024;

/** Options for the filesystem-backed agent workspace adapter. */
export interface FileSystemAgentRunWorkspaceOptions {
  /** Per-run call timeout in milliseconds. Default 120s. */
  readonly timeoutMs?: number;
  /**
   * When true, leaves the tmp workspace directory on disk after the run
   * so it can be inspected post-mortem. Default false — the workspace is
   * removed once the outcome has been captured, to avoid accumulating
   * tmp dirs across many evaluation runs.
   */
  readonly keepWorkspace?: boolean;
}

/**
 * Real adapter — runs the skill inside a fresh tmp directory, captures the
 * filesystem state, and returns stdout + diff + post-run file contents.
 *
 * Isolation is tmp-dir only (no chroot / network sandbox). Callers are
 * responsible for not running untrusted skills with this adapter. By
 * default the tmp directory is removed after the outcome has been
 * captured; pass `{ keepWorkspace: true }` for post-mortem debugging.
 */
export class FileSystemAgentRunWorkspace implements AgentRunWorkspace {
  private readonly timeoutMs: number;
  private readonly keepWorkspace: boolean;

  constructor(options: FileSystemAgentRunWorkspaceOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.keepWorkspace = options.keepWorkspace ?? false;
  }

  async run(request: AgentRunRequest): Promise<AgentRunOutcome> {
    const skillContent = await readFile(request.skillPath, 'utf-8');
    const workspacePath = await mkdtemp(join(tmpdir(), 'quatermaster-agent-'));

    try {
      if (request.seedRepoPath) {
        await cp(request.seedRepoPath, workspacePath, {
          recursive: true,
          filter: shouldCopy,
        });
      }

      const before = await snapshot(workspacePath);
      const prompt = buildPrompt(skillContent, request.userPrompt);
      const started = Date.now();
      const { stdout, stderr, exitCode } = await spawnClaude(
        prompt,
        workspacePath,
        this.timeoutMs,
      );
      const durationMs = Date.now() - started;

      const after = await snapshot(workspacePath);
      const fileChanges = diff(before, after);

      return {
        stdout,
        stderr,
        exitCode,
        durationMs,
        fileChanges,
        postRunFiles: after,
        workspacePath,
      };
    } finally {
      if (!this.keepWorkspace) {
        await rm(workspacePath, { recursive: true, force: true });
      }
    }
  }
}

function buildPrompt(skillContent: string, userPrompt: string): string {
  return `You are executing a Claude Code skill. Follow the skill instructions exactly.

SKILL INSTRUCTIONS:
${skillContent}

USER REQUEST:
${userPrompt}`;
}

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

function spawnClaude(
  prompt: string,
  cwd: string,
  timeoutMs: number,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', prompt], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`claude CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(
        new Error(`Failed to spawn claude CLI: ${err.message}. Is it installed and in PATH?`),
      );
    });
  });
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await walk(root, root, out);
  return out;
}

async function walk(
  root: string,
  dir: string,
  out: Map<string, string>,
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, abs, out);
    } else if (entry.isFile()) {
      const info = await stat(abs);
      if (info.size > MAX_FILE_BYTES) {
        out.set(relative(root, abs), `__binary_or_too_large__:${info.size}`);
      } else {
        out.set(relative(root, abs), await readFile(abs, 'utf-8'));
      }
    }
  }
}

function diff(
  before: Map<string, string>,
  after: Map<string, string>,
): FileDiff[] {
  const changes: FileDiff[] = [];
  for (const [path, contentAfter] of after) {
    const contentBefore = before.get(path);
    if (contentBefore === undefined) {
      changes.push({ path, changeType: 'created', contentAfter });
    } else if (contentBefore !== contentAfter) {
      changes.push({ path, changeType: 'modified', contentBefore, contentAfter });
    }
  }
  for (const [path, contentBefore] of before) {
    if (!after.has(path)) {
      changes.push({ path, changeType: 'deleted', contentBefore });
    }
  }
  return changes;
}

function shouldCopy(absPath: string): boolean {
  for (const segment of absPath.split(sep)) {
    if (SKIP_DIRS.has(segment)) return false;
  }
  return true;
}
