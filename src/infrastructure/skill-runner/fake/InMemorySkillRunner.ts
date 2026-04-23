import type { SkillRunner } from '../../../domain/contract/ports/SkillRunner.js';

/**
 * Fake implementation of SkillRunner.
 * Returns preset outputs keyed by (skillPath, prompt) or falls back to a default.
 * The canonical reference for tests.
 */
export class InMemorySkillRunner implements SkillRunner {
  constructor(
    private readonly outputs: Map<string, string> = new Map(),
    private readonly defaultOutput = 'Stub skill output',
  ) {}

  async run(skillPath: string, userPrompt: string): Promise<string> {
    const key = `${skillPath}::${userPrompt}`;
    return this.outputs.get(key) ?? this.defaultOutput;
  }
}
