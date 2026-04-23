/**
 * CLI DTO — carries the raw arguments from the `evaluate-skill` subcommand
 * before they are validated and mapped to a domain action.
 */
export interface EvaluateSkillCommand {
  /** Absolute or relative path to the skill markdown file. */
  readonly skillPath: string;
  /** Absolute or relative path to the JSON dataset file. */
  readonly datasetPath: string;
}
