---
name: adding-a-port
description: |
  Use when adding a new secondary port to Quatermaster — a new external
  dependency that the domain talks to (LLM judge, dataset loader,
  history store, etc.). TRIGGER when the user asks to add an integration,
  a new I/O concern, or a dependency the domain currently lacks. SKIP
  for changes inside an existing port's adapters (real or fake).
---

# adding-a-port

Quatermaster is hexagonal. A new I/O concern arrives as a port (the
interface), a real adapter (production I/O), and a fake adapter (test
double). Tests are wired through a Scenario + Factory pair against the
port. Follow these five steps in order.

## 1. Define the port

Create the interface under `src/domain/contract/ports/<Name>.ts`. Write
TSDoc that names the adapters that will implement it and describes the
contract a caller can rely on.

```ts
/**
 * Reads cached evaluation history for a given project slug.
 *
 * Implemented by `FileSystemEvaluationHistoryStore` (production) and
 * `InMemoryEvaluationHistoryStore` (tests).
 */
export interface EvaluationHistoryStore {
  readonly load: (slug: string) => Promise<HistorySnapshot | undefined>;
  readonly save: (snapshot: HistorySnapshot) => Promise<void>;
}
```

## 2. Add the real adapter

Place it under `src/infrastructure/<concern>/real/<Real>.ts`. Keep it
thin — real I/O and parsing live here. Pure logic does not.

If parsing user-controlled input, validate at the boundary with a Zod
schema; the resolved domain shape is what the rest of the code sees.

## 3. Add the fake adapter

Place it under `src/infrastructure/<concern>/fake/<Fake>.ts`. The fake
returns preset data keyed by the inputs relevant to tests. It is the
canonical reference implementation of the port — if the real adapter has
behaviors the fake doesn't model, extend the fake.

Tests **never** import the real adapter. If a test needs to assert
filesystem effects, model them in the fake.

## 4. Wire the port into the use case

If the port is used by a use case, inject it through the handler's
constructor:

```ts
export class EvaluateProjectHandler implements Handler<EvaluateProject> {
  constructor(
    private readonly scanner: ProjectScanner,
    private readonly history: EvaluationHistoryStore,
  ) {}
  // …
}
```

Handlers take ports as dependencies — never construct adapters inline.

## 5. Add Scenario + Factory + test

Test file lives under `tests/<aggregate>/<Behavior>.test.ts`. Two
companions:

- `<Behavior>Scenario.ts` — data builders for the new port (preset
  responses, canonical inputs).
- `<Behavior>Factory.ts` — assembles a `Mediator` with the new fake
  wired in alongside any existing fakes the case needs.

The test imports only the Scenario, the Factory, and the port interface.
It dispatches an action through the Mediator and asserts on the
`Result`.

## Anti-patterns

- Adding a port without a fake. Wrong — the fake comes first; tests
  cannot exist without it.
- Constructing the real adapter inside a handler. Wrong — inject through
  the constructor at the composition root.
- A test that imports the real adapter "just to verify". Wrong — extend
  the fake to cover the case, or write a separate adapter integration
  test under `tests/infrastructure/`.
