import { describe, it, expect } from 'vitest';
import { mkdtemp, readdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemAgentRunWorkspace } from '../../src/infrastructure/agent-workspace/real/FileSystemAgentRunWorkspace.js';

/**
 * These tests cover only the parts of the adapter that don't require the
 * real `claude` CLI: workspace creation + cleanup behaviour. The happy
 * path (full spawn + snapshot diff) is exercised end-to-end by the
 * evaluate-skill CLI integration.
 *
 * Trick: passing a non-existent `seedRepoPath` makes `cp` throw before we
 * ever reach the claude spawn. The adapter's finally block still runs,
 * which is exactly what we want to observe.
 */

const WORKSPACE_PREFIX = 'quatermaster-agent-';

async function currentWorkspaces(): Promise<string[]> {
  const all = await readdir(tmpdir());
  return all.filter((f) => f.startsWith(WORKSPACE_PREFIX));
}

async function writeSkill(): Promise<string> {
  const skillDir = await mkdtemp(join(tmpdir(), 'ws-skill-'));
  const skillPath = join(skillDir, 'skill.md');
  await writeFile(skillPath, '# Skill\n', 'utf-8');
  return skillPath;
}

describe('FileSystemAgentRunWorkspace cleanup', () => {
  it('removes the tmp workspace after run() by default', async () => {
    const skillPath = await writeSkill();
    const before = new Set(await currentWorkspaces());

    const ws = new FileSystemAgentRunWorkspace();
    await expect(
      ws.run({
        skillPath,
        userPrompt: 'x',
        seedRepoPath: '/definitely/not/a/real/path/__quatermaster_test__',
      }),
    ).rejects.toThrow();

    const after = await currentWorkspaces();
    const leaked = after.filter((f) => !before.has(f));
    expect(leaked).toEqual([]);
  });

  it('keeps the tmp workspace on disk when keepWorkspace is true', async () => {
    const skillPath = await writeSkill();
    const before = new Set(await currentWorkspaces());

    const ws = new FileSystemAgentRunWorkspace({ keepWorkspace: true });
    await expect(
      ws.run({
        skillPath,
        userPrompt: 'x',
        seedRepoPath: '/definitely/not/a/real/path/__quatermaster_test__',
      }),
    ).rejects.toThrow();

    const after = await currentWorkspaces();
    const leaked = after.filter((f) => !before.has(f));
    expect(leaked).toHaveLength(1);

    // Confirm the dir still exists on disk so post-mortem inspection would work.
    const info = await stat(join(tmpdir(), leaked[0]!));
    expect(info.isDirectory()).toBe(true);
  });
});
