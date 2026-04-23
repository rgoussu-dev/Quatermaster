import type { Action } from './Action.js';
import type { Handler } from './Handler.js';
import type { Result } from './Result.js';
import { failure } from './Result.js';

/**
 * Dispatches Actions to their registered Handlers.
 *
 * Constructed from a collection of handlers — the registry is built internally
 * from each handler's `supports()`. Never inject a Map directly.
 * Duplicate registrations throw at construction time.
 */
export class Mediator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly registry = new Map<Function, Handler<any>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(handlers: ReadonlyArray<Handler<any>>) {
    for (const handler of handlers) {
      for (const ctor of handler.supports()) {
        if (this.registry.has(ctor)) {
          throw new Error(`Duplicate handler registration for ${ctor.name}`);
        }
        this.registry.set(ctor, handler);
      }
    }
  }

  /**
   * Dispatches an action to its registered handler.
   * Returns Failure with kind 'no-handler' when no handler matches.
   */
  async dispatch<R>(action: Action<R>): Promise<Result<R>> {
    const ctor = action.constructor;
    const handler = this.registry.get(ctor);
    if (!handler) {
      return failure({ kind: 'no-handler', message: `No handler registered for ${ctor.name}` }) as Result<R>;
    }
    return handler.handle(action as Action<unknown>) as Promise<Result<R>>;
  }
}
