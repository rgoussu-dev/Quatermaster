import type { Token } from './Token.js';

/**
 * Resolver closure for a {@link Container} binding.
 * Receives the container so bindings can pull their own dependencies.
 */
export type Resolver<T> = (container: Container) => T;

/**
 * Minimal typed DI container. Bindings are lazy and cached per container
 * instance — the first `resolve` for a given token runs its resolver, every
 * subsequent call returns the same value.
 *
 * `bind` throws on re-registration so accidental double-wiring is caught at
 * boot. Use `rebind` when an override is intentional (profiles, tests).
 */
export class Container {
  private readonly resolvers = new Map<Token<unknown>, Resolver<unknown>>();
  private readonly singletons = new Map<Token<unknown>, unknown>();

  bind<T>(token: Token<T>, resolver: Resolver<T>): void {
    if (this.resolvers.has(token as Token<unknown>)) {
      throw new Error(
        `Token "${token.description}" is already bound. Use rebind() for intentional overrides.`,
      );
    }
    this.resolvers.set(token as Token<unknown>, resolver as Resolver<unknown>);
  }

  bindValue<T>(token: Token<T>, value: T): void {
    this.bind(token, () => value);
  }

  rebind<T>(token: Token<T>, resolver: Resolver<T>): void {
    this.resolvers.set(token as Token<unknown>, resolver as Resolver<unknown>);
    this.singletons.delete(token as Token<unknown>);
  }

  rebindValue<T>(token: Token<T>, value: T): void {
    this.rebind(token, () => value);
  }

  resolve<T>(token: Token<T>): T {
    if (this.singletons.has(token as Token<unknown>)) {
      return this.singletons.get(token as Token<unknown>) as T;
    }

    const resolver = this.resolvers.get(token as Token<unknown>);
    if (!resolver) {
      throw new Error(`No binding registered for token "${token.description}".`);
    }
    const value = resolver(this) as T;
    this.singletons.set(token as Token<unknown>, value);
    return value;
  }

  tryResolve<T>(token: Token<T>): T | undefined {
    if (!this.resolvers.has(token as Token<unknown>)) return undefined;
    return this.resolve(token);
  }

  has(token: Token<unknown>): boolean {
    return this.resolvers.has(token);
  }
}
