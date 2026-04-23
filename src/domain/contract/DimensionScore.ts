import type { Finding } from './Finding.js';

/** Identifier for each evaluation dimension. */
export type DimensionId =
  | 'claude-code-setup'
  | 'project-structure'
  | 'test-infrastructure'
  | 'documentation';

/**
 * Score and findings for a single evaluation dimension.
 * Score is in [0, 100] — 0 means entirely absent, 100 means fully optimised.
 */
export interface DimensionScore {
  readonly dimension: DimensionId;
  /** Human-readable label used in CLI output. */
  readonly label: string;
  /** Weight in the overall score, decimal in (0, 1]. All weights must sum to 1. */
  readonly weight: number;
  /** Numeric score in [0, 100]. */
  readonly score: number;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly findings: readonly Finding[];
}
