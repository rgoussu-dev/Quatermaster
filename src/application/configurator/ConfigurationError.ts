/**
 * Thrown by configurator bindings when something the user controls is
 * missing or invalid (e.g. no `ANTHROPIC_API_KEY` for `--judge api`).
 *
 * Distinct from domain `Result.failure` — configuration problems surface
 * before any action is dispatched, at the application boundary. The CLI
 * catches this class specifically so it can exit cleanly with the
 * message, instead of printing an internal stack trace.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
