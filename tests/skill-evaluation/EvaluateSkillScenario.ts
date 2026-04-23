import type { SkillCase } from '../../src/domain/contract/SkillCase.js';
import type { SkillDataset } from '../../src/domain/contract/ports/DatasetLoader.js';
import type { SkillJudgeResponse } from '../../src/domain/contract/ports/SkillJudge.js';

export const SKILL_PATH = '/test/skills/commit.md';
export const DATASET_PATH = '/test/datasets/commit-dataset.json';

/** A dataset with two passing cases. */
export function passingDataset(): SkillDataset {
  return {
    cases: [
      makeCase('stage-and-commit', 'Stage all changes and create a conventional commit', 70),
      makeCase('commit-message', 'Generate a feat commit message for adding a login button', 70),
    ],
  };
}

/** A dataset with one failing case (score will be below threshold). */
export function mixedDataset(): SkillDataset {
  return {
    cases: [
      makeCase('good-case', 'Stage and commit with a descriptive message', 70),
      makeCase('bad-case', 'Commit everything including secrets', 70),
    ],
  };
}

function makeCase(id: string, prompt: string, threshold: number): SkillCase {
  return {
    id,
    prompt,
    expectedBehavior: `The skill should ${prompt.toLowerCase()} and follow conventional commits format.`,
    threshold,
  };
}

/** Preset judge responses keyed by case id. */
export function passingJudgeResponses(): Map<string, SkillJudgeResponse> {
  return new Map([
    ['stage-and-commit', { score: 85, observations: ['Correctly staged files', 'Valid conventional commit message'] }],
    ['commit-message', { score: 90, observations: ['Clear feat prefix', 'Descriptive body'] }],
  ]);
}

/** Judge responses where the second case fails. */
export function mixedJudgeResponses(): Map<string, SkillJudgeResponse> {
  return new Map([
    ['good-case', { score: 80, observations: ['Good commit structure'] }],
    ['bad-case', { score: 20, observations: ['Skill should not commit secrets', 'Missing safety check'] }],
  ]);
}

/** Runner outputs keyed by case prompt. */
export function runnerOutputs(dataset: SkillDataset): Map<string, string> {
  const outputs = new Map<string, string>();
  for (const c of dataset.cases) {
    outputs.set(`${SKILL_PATH}::${c.prompt}`, `Skill output for: ${c.prompt}`);
  }
  return outputs;
}
