import type {
  SkillJudge,
  SkillJudgeRequest,
  SkillJudgeResponse,
} from '../../../domain/contract/ports/SkillJudge.js';

/**
 * Fake implementation of SkillJudge.
 * Returns a preset response or a neutral 70-point score — the canonical reference for tests.
 */
export class StubSkillJudge implements SkillJudge {
  constructor(private readonly response?: SkillJudgeResponse) {}

  async judge(_request: SkillJudgeRequest): Promise<SkillJudgeResponse> {
    return (
      this.response ?? {
        score: 70,
        observations: ['Stub observation'],
      }
    );
  }
}
