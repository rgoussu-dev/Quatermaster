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
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', buildClaudeArgs(prompt, opts), {
      cwd: opts.cwd ?? tmpdir(),
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
      if (code !== 0) {
        reject(new Error(`claude CLI exited ${code}: ${stderr.slice(0, 300)}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(
        new Error(`Failed to spawn claude CLI: ${err.message}. Is it installed and in PATH?`),
      );
    });
  });
}

/** Extracts the first JSON object or ```json``` fenced block from `output`. */
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
