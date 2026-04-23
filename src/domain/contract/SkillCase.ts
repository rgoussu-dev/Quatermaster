/**
 * Test scenario taxonomy from the "measuring the immeasurable" talk:
 * ideal = clean intent, realistic = partial/fuzzy, adversarial = rule-bending.
 */
export type ScenarioType = 'ideal' | 'realistic' | 'adversarial';

/** A file the skill is expected to produce or modify in its workspace. */
export interface ExpectedArtifact {
  /** Path relative to the workspace root. */
  readonly path: string;
  /** When true (default), the file must exist after the run. */
  readonly mustExist?: boolean;
  /** Optional regex source the file's final content must match. */
  readonly contentPattern?: string;
}

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
   * Minimum overall fitness score (0–100) to consider this case passed.
   * @default 70
   */
  readonly threshold: number;
  /** Scenario tag used to report robustness across input classes. */
  readonly scenarioType?: ScenarioType;
  /** Files the agent must produce or modify in its workspace. */
  readonly expectedArtifacts?: readonly ExpectedArtifact[];
  /**
   * Per-metric weights overriding the defaults. Values need not sum to 1 —
   * the aggregator normalises them. Unknown keys are ignored.
   */
  readonly metricWeights?: Readonly<Record<string, number>>;
  /** Optional seed directory copied into the workspace before the run. */
  readonly seedRepoPath?: string;
}
