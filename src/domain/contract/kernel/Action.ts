/**
 * Sealed marker base for all domain operations.
 * Every Command and Query is an Action; the mediator dispatches by runtime type.
 *
 * @typeParam R  The success-value type the action produces.
 */
export interface Action<R> {
  readonly _resultType?: R;
}
