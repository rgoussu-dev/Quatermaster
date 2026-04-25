---
name: typescript-conventions
description: |
  Use when writing or reviewing TypeScript in the Quatermaster repo.
  Covers strict-TS settings, ESM import suffixes, the no-mocks rule,
  Result-over-throw for domain errors, the readonly DTO convention, and
  the comment policy. TRIGGER on any edit to *.ts files under src/ or
  tests/. SKIP for build configs, JSON datasets, and Markdown.
---

# typescript-conventions

These conventions are **non-negotiable** in this repo. The compiler
enforces most of them; the rest are caught in review.

## Compiler strictness

`tsconfig.json` has `strict: true` together with
`exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`.

Practical consequences:

- **Don't spread `undefined` into an optional field.** Guard explicitly:

  ```ts
  return { ...base, ...(x !== undefined ? { x } : {}) };
  ```

  Spreading `{ x: undefined }` is a type error under
  `exactOptionalPropertyTypes`.

- **Index access is `T | undefined`.** Always narrow before use:

  ```ts
  const first = items[0];
  if (first === undefined) return Result.failure(emptyError);
  ```

## ESM imports

Always suffix relative imports with `.js`, even when pointing at `.ts`
sources. TypeScript resolves at compile time; Node executes the emitted
JavaScript.

```ts
import { Mediator } from './domain/contract/kernel/Mediator.js';
```

Imports without `.js` will compile but fail at runtime.

## No mocks — fakes only

Every secondary port has a `fake/` adapter under
`src/infrastructure/<concern>/fake/`. Tests import only ports + fakes,
never the real adapter, never `vi.mock`, never any mocking library.

The fake is the canonical reference implementation of the port's
contract. If a test needs a behavior the fake doesn't have, extend the
fake, don't reach for a mock.

## Result over throw for domain errors

Domain handlers return `Result<T, DomainError>` — a discriminated union
with a stable `kind` discriminator on the error variant. Only
infrastructure adapters throw, and only for truly exceptional conditions
(network failures, unparseable inputs).

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

Map `Result.failure` to transport-shaped errors at the application layer
(CLI exit code + stderr in this repo). Domain code never knows about
transport.

## Readonly DTOs

Every DTO field is `readonly`. Arrays are `ReadonlyArray<T>`. Objects
that travel between layers are immutable.

```ts
type EvaluationResult = {
  readonly score: number;
  readonly dimensions: ReadonlyArray<DimensionScore>;
};
```

## Comments

- **No premature comments.** Names carry the load.
- Comment only on non-obvious constraints, workarounds, or invariants —
  the _why_, never the _what_.
- Never reference task IDs, PR numbers, or authors in comments.
- Public API gets TSDoc `/** … */` on every exported symbol; the doc
  describes what the symbol does and when a caller would reach for it.

## Anti-patterns

- `as any` to silence the compiler. Wrong — model the type properly or
  add a Zod schema at the trust boundary.
- A `vi.mock("./real/Adapter.js")` call. Wrong — wire the test through
  the fake and the Factory.
- Throwing `new Error("user not found")` in a handler. Wrong — return
  `Result.failure({ kind: "user-not-found", … })`.
- A mutable `let result = …; result.foo = bar` pattern on a DTO. Wrong —
  build a new immutable value and return it.
