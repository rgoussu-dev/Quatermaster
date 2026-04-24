import { describe, expect, it } from 'vitest';
import { Container } from '../../../src/application/configurator/Container.js';
import { token } from '../../../src/application/configurator/Token.js';

describe('Container', () => {
  it('bind throws on double-bind of the same token', () => {
    const t = token<string>('greeting');
    const container = new Container();
    container.bind(t, () => 'hello');
    expect(() => container.bind(t, () => 'world')).toThrow(/already bound/);
  });

  it('resolve caches the first value (singleton per container)', () => {
    const t = token<{ n: number }>('box');
    const container = new Container();
    let calls = 0;
    container.bind(t, () => ({ n: ++calls }));

    const first = container.resolve(t);
    const second = container.resolve(t);

    expect(first).toBe(second);
    expect(calls).toBe(1);
  });

  it('rebind replaces the resolver and clears the cached singleton', () => {
    const t = token<string>('mode');
    const container = new Container();
    container.bind(t, () => 'prod');
    expect(container.resolve(t)).toBe('prod');

    container.rebind(t, () => 'test');
    expect(container.resolve(t)).toBe('test');
  });

  it('tryResolve returns undefined when the token is unbound', () => {
    const t = token<string>('missing');
    const container = new Container();
    expect(container.tryResolve(t)).toBeUndefined();
  });

  it('tryResolve returns the value when the token is bound (including undefined values)', () => {
    const a = token<string>('bound');
    const b = token<string | undefined>('optional');
    const container = new Container();
    container.bind(a, () => 'x');
    container.bindValue(b, undefined);

    expect(container.tryResolve(a)).toBe('x');
    expect(container.has(b)).toBe(true);
    expect(container.tryResolve(b)).toBeUndefined();
  });

  it('resolve throws for an unbound token', () => {
    const t = token<string>('unbound');
    const container = new Container();
    expect(() => container.resolve(t)).toThrow(/No binding registered/);
  });

  it('resolvers can pull their own dependencies from the container', () => {
    const a = token<number>('a');
    const b = token<number>('b');
    const container = new Container();
    container.bind(a, () => 2);
    container.bind(b, (c) => c.resolve(a) * 3);

    expect(container.resolve(b)).toBe(6);
  });
});
