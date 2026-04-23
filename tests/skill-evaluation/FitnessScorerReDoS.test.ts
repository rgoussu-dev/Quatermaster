import { describe, it, expect } from 'vitest';
import { FitnessScorer } from '../../src/domain/core/skill-evaluation/FitnessScorer.js';
import type { SkillCase } from '../../src/domain/contract/SkillCase.js';
import type { AgentRunOutcome } from '../../src/domain/contract/AgentRunOutcome.js';
import type { SkillJudgeResponse } from '../../src/domain/contract/ports/SkillJudge.js';

function baseOutcome(files: Record<string, string>): AgentRunOutcome {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    durationMs: 0,
    fileChanges: [],
    postRunFiles: new Map(Object.entries(files)),
    workspacePath: '/tmp/ws',
  };
}

const judgement: SkillJudgeResponse = { score: 80, observations: ['ok'] };

describe('FitnessScorer contentPattern ReDoS guard', () => {
  it('rejects a nested-quantifier content pattern without executing it', () => {
    const skillCase: SkillCase = {
      id: 'redos',
      prompt: 'x',
      expectedBehavior: 'x',
      threshold: 70,
      expectedArtifacts: [{ path: 'f.txt', contentPattern: '(a+)+$' }],
    };
    const outcome = baseOutcome({ 'f.txt': 'a'.repeat(20) + '!' });
    const scorer = new FitnessScorer();
    const { metrics } = scorer.score(skillCase, outcome, judgement);
    const artifactMetric = metrics.find((m) => m.metricId === 'artifact-presence');
    expect(artifactMetric?.rationale).toMatch(/nested quantifier/);
  });

  it('rejects overly long patterns', () => {
    const skillCase: SkillCase = {
      id: 'long',
      prompt: 'x',
      expectedBehavior: 'x',
      threshold: 70,
      expectedArtifacts: [{ path: 'f.txt', contentPattern: 'a'.repeat(1000) }],
    };
    const outcome = baseOutcome({ 'f.txt': 'aaaaa' });
    const scorer = new FitnessScorer();
    const { metrics } = scorer.score(skillCase, outcome, judgement);
    const artifactMetric = metrics.find((m) => m.metricId === 'artifact-presence');
    expect(artifactMetric?.rationale).toMatch(/longer than/);
  });
});
