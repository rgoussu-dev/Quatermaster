import type { Action } from './Action.js';
import type { Result } from './Result.js';

/**
 * A handler for one or more related Action types.
 * Self-declares its supported actions via `supports()` — the mediator
 * builds its registry from these declarations at construction time.
 *
 * Handlers must never throw for expected domain failures; return Result.failure instead.
 *
 * @typeParam A  The Action base type this handler covers.
 */
export interface Handler<A extends Action<unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supports(): ReadonlySet<new (...args: any[]) => A>;
  handle(action: A): Promise<Result<unknown>>;
}
