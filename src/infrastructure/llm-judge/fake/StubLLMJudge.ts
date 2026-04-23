import type {
  LLMJudge,
  JudgeRequest,
  JudgeResponse,
} from '../../../domain/contract/ports/LLMJudge.js';
import type { DimensionId } from '../../../domain/contract/DimensionScore.js';

/**
 * Fake implementation of LLMJudge.
 * Returns preset responses per dimension — the canonical reference for tests.
 * Falls back to a neutral 50-point response for unspecified dimensions.
 */
export class StubLLMJudge implements LLMJudge {
  constructor(private readonly responses: Partial<Record<DimensionId, JudgeResponse>> = {}) {}

  async judge(request: JudgeRequest): Promise<JudgeResponse> {
    const preset = this.responses[request.dimension];
    if (preset !== undefined) {
      return preset;
    }
    return {
      dimension: request.dimension,
      llmScore: 50,
      observations: ['Stub observation for ' + request.dimension],
      recommendation: 'Stub recommendation for ' + request.dimension,
    };
  }
}
