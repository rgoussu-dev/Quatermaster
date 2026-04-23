/** Input for judging a single skill case output. */
export interface SkillJudgeRequest {
  readonly actualOutput: string;
  /** Natural-language description of what a passing response must do or contain. */
  readonly expectedBehavior: string;
}

/** Structured judgement for a single case. */
export interface SkillJudgeResponse {
  /** Score in [0, 100]. */
  readonly score: number;
  /** Concise observations explaining the score. */
  readonly observations: readonly string[];
}

/**
 * Secondary port — judges whether a skill's actual output satisfies the expected behavior.
 *
 * Adapters: AnthropicSkillJudge (real), ClaudeCodeSkillJudge (claude-cli), StubSkillJudge (fake/test).
 */
export interface SkillJudge {
  /**
   * Scores how well `actualOutput` satisfies `expectedBehavior`.
   *
   * @throws {Error} when the LLM call fails or returns malformed output.
   */
  judge(request: SkillJudgeRequest): Promise<SkillJudgeResponse>;
}
