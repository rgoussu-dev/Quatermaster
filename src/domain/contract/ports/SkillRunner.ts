/**
 * Secondary port — runs a skill against a single user prompt and returns the raw text output.
 *
 * Adapters: ClaudeCodeSkillRunner (real), InMemorySkillRunner (fake/test).
 */
export interface SkillRunner {
  /**
   * Executes the skill at `skillPath` with `userPrompt` as the task.
   *
   * @param skillPath Absolute path to the skill markdown file.
   * @param userPrompt The task text passed to the skill.
   * @returns Raw text output produced by the skill.
   * @throws {Error} when the runner fails to produce output.
   */
  run(skillPath: string, userPrompt: string): Promise<string>;
}
