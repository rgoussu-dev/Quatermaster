import type { ProjectSnapshot } from '../ProjectSnapshot.js';
import type { DimensionId } from '../DimensionScore.js';

/** Input for a single-dimension qualitative judgement. */
export interface JudgeRequest {
  readonly snapshot: ProjectSnapshot;
  readonly dimension: DimensionId;
  /** Rubric describing the scoring criteria for this dimension. */
  readonly rubric: string;
}

/** The LLM judge's structured response for one dimension. */
export interface JudgeResponse {
  readonly dimension: DimensionId;
  /** Score in [0, 100] as judged by the LLM. */
  readonly llmScore: number;
  /** Key qualitative observations, each a concise sentence. */
  readonly observations: readonly string[];
  /** The single most impactful next step for this dimension. */
  readonly recommendation: string;
}

/**
 * Secondary port — calls an LLM to produce qualitative scores
 * and observations for a given project snapshot and rubric.
 *
 * Adapters: AnthropicLLMJudge (real), StubLLMJudge (fake/test).
 */
export interface LLMJudge {
  /**
   * Judges a single dimension for the given snapshot.
   *
   * @throws {Error} when the LLM API call fails or returns malformed output.
   */
  judge(request: JudgeRequest): Promise<JudgeResponse>;
}
