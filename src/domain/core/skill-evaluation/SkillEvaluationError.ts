import type { DomainError } from '../../contract/kernel/DomainError.js';

/** Sealed error hierarchy for the skill evaluation aggregate. */
export type SkillEvaluationError =
  | { readonly kind: 'dataset-load-failed'; readonly message: string }
  | { readonly kind: 'skill-run-failed'; readonly message: string }
  | { readonly kind: 'skill-judge-failed'; readonly message: string }
  | { readonly kind: 'invalid-path'; readonly message: string };

/** Factory functions for SkillEvaluationError variants. */
export const SkillEvaluationError = {
  datasetLoadFailed: (message: string): SkillEvaluationError & DomainError => ({
    kind: 'dataset-load-failed',
    message,
  }),
  skillRunFailed: (message: string): SkillEvaluationError & DomainError => ({
    kind: 'skill-run-failed',
    message,
  }),
  skillJudgeFailed: (message: string): SkillEvaluationError & DomainError => ({
    kind: 'skill-judge-failed',
    message,
  }),
  invalidPath: (message: string): SkillEvaluationError & DomainError => ({
    kind: 'invalid-path',
    message,
  }),
} as const;
