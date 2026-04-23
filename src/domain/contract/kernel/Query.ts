import type { Action } from './Action.js';

/**
 * Read-side action — pure read, no side effects.
 *
 * @typeParam R  The success-value type the query produces.
 */
export interface Query<R> extends Action<R> {
  readonly _queryBrand: void;
}
