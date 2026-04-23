import { spawn } from 'node:child_process';

/**
 * Spawns `claude -p <prompt>` and resolves with stdout.
 * Rejects if the process exits non-zero or exceeds the timeout.
 */
export async function runClaudeCLI(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', prompt], {
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
