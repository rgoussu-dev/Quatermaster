/**
 * CLI DTO — carries the raw arguments from the `evaluate` subcommand
 * before they are validated and mapped to a domain action.
 */
export interface EvaluateCommand {
  /** Absolute or relative path to the project to evaluate. */
  readonly projectPath: string;
}
