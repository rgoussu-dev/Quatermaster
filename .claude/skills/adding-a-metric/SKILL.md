---
name: adding-a-metric
description: |
  Use when adding a new metric to Quatermaster's FitnessScorer (the
  skill-evaluation scoring component). TRIGGER on requests to score a
  new aspect of skill output, edits under
  src/domain/core/skill-evaluation/, or extensions to SkillCase /
  ExpectedArtifact. SKIP for project-evaluation scoring (different code
  path).
---

# adding-a-metric

`FitnessScorer` (in `src/domain/core/skill-evaluation/`) emits a metric
**only when it applies**. The scorer normalises weights across the
metrics that fired, so a metric that returns `null` is correctly
excluded from the final score rather than diluting it. Follow this
pattern when adding a new metric.

## 1. Register the metric id and default weight

Add the id to `METRIC_IDS` and a default weight to
`DEFAULT_METRIC_WEIGHTS`. Keep the default weight modest until you have
empirical evidence for a stronger one — re-balancing later requires a
dataset re-run.

```ts
export const METRIC_IDS = [
  'diff-similarity',
  'exit-code',
  // …
  'your-new-metric',
] as const;

export const DEFAULT_METRIC_WEIGHTS: Record<MetricId, number> = {
  // …
  'your-new-metric': 0.1,
};
```

## 2. Add a dedicated `scoreX` method that returns `null` when inapplicable

Mirror the shape of `scoreArtifacts` and `scoreSimilarity`. The method
returns `null` when the case doesn't opt in — that is what keeps weight
normalisation clean.

```ts
private scoreYourNewMetric(case: SkillCase, run: SkillRun): MetricEmission | null {
  if (!case.expectsYourNewMetric) return null;
  // … compute the score …
  return { id: "your-new-metric", value: score, weight };
}
```

## 3. Extend `SkillCase` / `ExpectedArtifact` if per-case configuration is needed

If the metric requires a new field on the case (a golden value, a
threshold, a regex), add it to `SkillCase.ts` (the runtime DTO) and to
the Zod schema in the dataset loader. Keep the JSON-only shape
(`goldenPath`) separate from the resolved domain shape (`goldenContent`)
the same way existing fields do — the loader normalises one to the
other.

## 4. History snapshots forward `metrics[]` automatically

`toHistorySnapshot` forwards whatever `metrics[]` is present, so a new
metric is picked up by the history pipeline with no further work. Verify
by running `evaluate-skill` against a dataset and checking
`.quatermaster/history/<slug>/<iso>.json`.

## Test the metric

Add a test case under `tests/skill-evaluation/` that exercises the new
metric — both the "applies" and "does not apply" branches. The latter
asserts the metric is absent from the result, which keeps weight
normalisation honest.

## Anti-patterns

- A metric that returns `0` instead of `null` when inapplicable. Wrong —
  that pulls the weighted average down. Return `null` so normalisation
  excludes the metric entirely.
- A metric whose default weight is large (`> 0.3`) without empirical
  justification. Wrong — start small and tune from data.
- Adding a JSON field directly to `SkillCase.ts` without updating the
  Zod schema. Wrong — the loader will silently drop it.
