/**
 * A single test case for skill evaluation.
 * Each case defines a user prompt and the criteria the skill output must satisfy.
 */
export interface SkillCase {
  /** Unique identifier for this case within the dataset. */
  readonly id: string;
  /** The prompt sent to the skill under evaluation. */
  readonly prompt: string;
  /** Natural-language description of what a passing response must do or contain. */
  readonly expectedBehavior: string;
  /**
   * Minimum score (0–100) to consider this case passed.
   * @default 70
   */
  readonly threshold: number;
}
