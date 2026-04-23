import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

/** Options controlling how the claude CLI subprocess is spawned. */
export interface RunClaudeOptions {
  /**
   * Working directory for the subprocess. Defaults to `os.tmpdir()` so the
   * judge/runner can never pick up the caller's CLAUDE.md, .claude/settings,
   * or uncommitted work and start acting on them. Callers that *want* the
   * subprocess to see a specific workspace (e.g. FileSystemAgentRunWorkspace)
   * pass their own directory.
   */
  readonly cwd?: string;
  /**
   * When true, disables all built-in tools (`--tools ""`). Use for pure
   * text-in-text-out callers (judges, text-only skill runs) where agentic
   * tool use would derail the output. Workspace-based runs should leave
   * this false so the skill can actually produce artifacts.
   */
  readonly noTools?: boolean;
}

/**
 * Outcome of a `claude` subprocess call. The `full` variant returns stdout,
 * stderr, and the exit code so callers (e.g. the workspace adapter) can
 * preserve them in their own outcome types. Code is `-1` when the process
 * was killed before emitting an exit status.
 */
export interface ClaudeRunOutcome {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** Grace period between SIGTERM and SIGKILL when killing a hung subprocess. */
const KILL_GRACE_MS = 2_000;

/** Env vars we never want to forward to the `claude` CLI subprocess. */
const STRIPPED_ENV_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];

/**
 * Builds the argv for the `claude` CLI. Pure — split from the spawn call so
 * it can be unit-tested without touching the child_process APIs.
 */
export function buildClaudeArgs(prompt: string, opts: RunClaudeOptions = {}): string[] {
  const args: string[] = [];
  if (opts.noTools) {
    // Empty string disables all built-in tools; claude CLI treats this as
    // "text-only" mode. See `claude --help` under --tools.
    args.push('--tools', '');
  }
  args.push('-p', prompt);
  return args;
}

/**
 * Spawns `claude -p <prompt>` and resolves with stdout.
 * Rejects if the process exits non-zero or exceeds the timeout.
 */
export async function runClaudeCLI(
  prompt: string,
  timeoutMs: number,
  opts: RunClaudeOptions = {},
): Promise<string> {
  const { stdout, stderr, exitCode } = await runClaudeCLIFull(prompt, timeoutMs, opts);
  if (exitCode !== 0) {
    throw new Error(`claude CLI exited ${exitCode}: ${stderr.slice(0, 300)}`);
  }
  return stdout;
}

/**
 * Lower-level variant of {@link runClaudeCLI} that resolves with the full
 * outcome (stdout, stderr, exit code) instead of rejecting on non-zero
 * exits. Used by callers — like the workspace adapter — that want to
 * preserve the failure context.
 *
 * Still rejects on spawn errors and timeouts (timeouts SIGTERM the process
 * group, then SIGKILL after a short grace period).
 */
export async function runClaudeCLIFull(
  prompt: string,
  timeoutMs: number,
  opts: RunClaudeOptions = {},
): Promise<ClaudeRunOutcome> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', buildClaudeArgs(prompt, opts), {
      cwd: opts.cwd ?? tmpdir(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildChildEnv(),
      detached: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      killGroup(proc.pid, 'SIGTERM');
      killTimer = setTimeout(() => killGroup(proc.pid, 'SIGKILL'), KILL_GRACE_MS);
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      if (timedOut) {
        reject(new Error(`claude CLI timed out after ${timeoutMs}ms`));
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      reject(new Error(`Failed to spawn claude CLI: ${err.message}. Is it installed and in PATH?`));
    });
  });
}

function buildChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of STRIPPED_ENV_KEYS) {
    delete env[key];
  }
  env['NO_COLOR'] = '1';
  env['FORCE_COLOR'] = '0';
  return env;
}

function killGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    // Negative pid targets the whole process group so children the CLI may
    // have forked are also reaped.
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Process already exited — nothing to do.
    }
  }
}

/**
 * Extracts the first JSON object or ```json``` fenced block from `output`.
 *
 * Heuristic — picks the first fenced block, otherwise the substring from
 * the first `{` to the last `}`. Prose that contains a stray `{` before the
 * real JSON can cause a parse error; callers wrap the result with Zod and
 * treat that as an adapter-level failure.
 */
export function extractJSON(output: string): unknown {
  const fenceMatch = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch?.[1]) {
    return JSON.parse(fenceMatch[1]);
  }
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return JSON.parse(output.slice(start, end + 1));
  }
  throw new Error(`No JSON found in claude CLI output: "${output.slice(0, 300)}"`);
}
