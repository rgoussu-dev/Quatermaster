import { readFile } from 'node:fs/promises';
import { runClaudeCLI } from '../../claude-cli/runClaudeCLI.js';
import type { SkillRunner } from '../../../domain/contract/ports/SkillRunner.js';

/**
 * Real adapter — runs a skill by reading its markdown content and invoking
 * `claude -p` with the skill instructions prepended to the user prompt.
 * Requires the `claude` CLI to be installed and authenticated.
 *
 * Text-only: tools are disabled so the skill can't reach out into the
 * caller's project. Skills that need to produce filesystem artifacts should
 * be evaluated through FileSystemAgentRunWorkspace (the `--workspace` path).
 */
export class ClaudeCodeSkillRunner implements SkillRunner {
  /** @param timeoutMs Per-case call timeout. Default 120s. */
  constructor(private readonly timeoutMs = 120_000) {}

  async run(skillPath: string, userPrompt: string): Promise<string> {
    const skillContent = await readFile(skillPath, 'utf-8');
    const prompt = buildPrompt(skillContent, userPrompt);
    return runClaudeCLI(prompt, this.timeoutMs, { noTools: true });
  }
}

function buildPrompt(skillContent: string, userPrompt: string): string {
  return `You are executing a Claude Code skill. Follow the skill instructions exactly.

SKILL INSTRUCTIONS:
${skillContent}

USER REQUEST:
${userPrompt}`;
}
