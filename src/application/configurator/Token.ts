/**
 * Typed injection key for the {@link Container}.
 *
 * Branded by a phantom type parameter so `resolve(token)` is statically
 * typed. Two tokens are distinct iff they are the same instance — identity
 * is by reference, not by description. Keep tokens in a single `tokens.ts`
 * module so callers never construct ad-hoc duplicates.
 */
export class Token<T> {
  declare readonly _phantom?: T;

  constructor(readonly description: string) {}
}

/** Factory for {@link Token}s. Prefer this over calling `new Token(...)` directly. */
export function token<T>(description: string): Token<T> {
  return new Token<T>(description);
}
