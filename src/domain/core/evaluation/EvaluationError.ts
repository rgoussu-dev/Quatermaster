import type { DomainError } from '../../contract/kernel/DomainError.js';

/** Sealed error hierarchy for the evaluation aggregate. */
export type EvaluationError =
  | { readonly kind: 'scan-failed'; readonly message: string }
  | { readonly kind: 'llm-judge-failed'; readonly message: string }
  | { readonly kind: 'invalid-path'; readonly message: string };

/** Factory functions for EvaluationError variants. */
export const EvaluationError = {
  scanFailed: (message: string): EvaluationError & DomainError => ({
    kind: 'scan-failed',
    message,
  }),
  llmJudgeFailed: (message: string): EvaluationError & DomainError => ({
    kind: 'llm-judge-failed',
    message,
  }),
  invalidPath: (message: string): EvaluationError & DomainError => ({
    kind: 'invalid-path',
    message,
  }),
} as const;
