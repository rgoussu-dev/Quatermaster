/** How significant a finding is for its dimension score. */
export type FindingSeverity = 'info' | 'warning' | 'critical';

/**
 * A single, concrete observation within one evaluation dimension.
 * Findings come from both deterministic checks and the LLM judge.
 */
export interface Finding {
  /** Short, actionable description of what was observed. */
  readonly description: string;
  readonly severity: FindingSeverity;
  /** File or pattern this finding refers to, relative to project root. */
  readonly location?: string;
  /** Where this finding originates: a rule key or 'llm-judge'. */
  readonly source: string;
}
