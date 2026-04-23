import type { AgentRunOutcome } from '../../contract/AgentRunOutcome.js';
import type { SkillCase, ExpectedArtifact } from '../../contract/SkillCase.js';
import type { MetricScore } from '../../contract/SkillEvaluationResult.js';
import type { SkillJudgeResponse } from '../../contract/ports/SkillJudge.js';
import { lineSimilarity } from './lineSimilarity.js';

/** Default metric weights — only applied when not overridden by the case. */
export const DEFAULT_METRIC_WEIGHTS: Readonly<Record<string, number>> = {
  'artifact-presence': 0.4,
  'diff-similarity': 0.3,
  'exit-code': 0.1,
  'llm-judge': 0.5,
};

/** Known metric ids the scorer can emit. */
export const METRIC_IDS = {
  artifactPresence: 'artifact-presence',
  diffSimilarity: 'diff-similarity',
  exitCode: 'exit-code',
  llmJudge: 'llm-judge',
} as const;

/**
 * Combines metric evaluators into a single fitness score for one case.
 * Pure — takes in the already-captured outcome and LLM judgement and
 * produces the per-metric breakdown + aggregate score.
 */
export class FitnessScorer {
  score(
    skillCase: SkillCase,
    outcome: AgentRunOutcome,
    judgement: SkillJudgeResponse,
  ): { readonly overallScore: number; readonly metrics: readonly MetricScore[] } {
    const artifact = this.scoreArtifacts(skillCase.expectedArtifacts, outcome);
    const similarity = this.scoreSimilarity(skillCase.expectedArtifacts, outcome);
    const exit = this.scoreExitCode(outcome);
    const llm = this.scoreJudge(judgement);

    const metrics: MetricScore[] = [];
    if (artifact) metrics.push(this.weighted(skillCase, artifact));
    if (similarity) metrics.push(this.weighted(skillCase, similarity));
    metrics.push(this.weighted(skillCase, exit));
    metrics.push(this.weighted(skillCase, llm));

    return { overallScore: aggregate(metrics), metrics };
  }

  private weighted(skillCase: SkillCase, raw: Omit<MetricScore, 'weight'>): MetricScore {
    const override = skillCase.metricWeights?.[raw.metricId];
    const defaultWeight = DEFAULT_METRIC_WEIGHTS[raw.metricId] ?? 0;
    const weight = override ?? defaultWeight;
    return { ...raw, weight };
  }

  private scoreArtifacts(
    expected: readonly ExpectedArtifact[] | undefined,
    outcome: AgentRunOutcome,
  ): Omit<MetricScore, 'weight'> | null {
    if (!expected || expected.length === 0) return null;

    const misses: string[] = [];
    let satisfied = 0;

    for (const artifact of expected) {
      const mustExist = artifact.mustExist ?? true;
      const content = outcome.postRunFiles.get(artifact.path);
      const exists = content !== undefined;

      if (mustExist && !exists) {
        misses.push(`missing ${artifact.path}`);
        continue;
      }
      if (!mustExist && exists) {
        misses.push(`unexpectedly present ${artifact.path}`);
        continue;
      }
      if (artifact.contentPattern && content !== undefined) {
        const unsafe = unsafePatternReason(artifact.contentPattern);
        if (unsafe) {
          misses.push(`invalid content pattern ${artifact.path}: ${unsafe}`);
          continue;
        }
        let re: RegExp;
        try {
          re = new RegExp(artifact.contentPattern);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          misses.push(`invalid content pattern ${artifact.path}: ${reason}`);
          continue;
        }
        if (!re.test(content)) {
          misses.push(`content mismatch ${artifact.path}`);
          continue;
        }
      }
      satisfied += 1;
    }

    const score = Math.round((satisfied / expected.length) * 100);
    const rationale =
      misses.length === 0
        ? `All ${expected.length} expected artifact(s) satisfied.`
        : `${satisfied}/${expected.length} satisfied — ${misses.join('; ')}`;

    return {
      metricId: METRIC_IDS.artifactPresence,
      label: 'Artifact presence',
      score,
      rationale,
    };
  }

  private scoreSimilarity(
    expected: readonly ExpectedArtifact[] | undefined,
    outcome: AgentRunOutcome,
  ): Omit<MetricScore, 'weight'> | null {
    if (!expected) return null;
    const withGolden = expected.filter(
      (a): a is ExpectedArtifact & { goldenContent: string } => a.goldenContent !== undefined,
    );
    if (withGolden.length === 0) return null;

    const perArtifact: { path: string; similarity: number }[] = [];
    for (const artifact of withGolden) {
      const produced = outcome.postRunFiles.get(artifact.path);
      const similarity =
        produced === undefined ? 0 : lineSimilarity(produced, artifact.goldenContent);
      perArtifact.push({ path: artifact.path, similarity });
    }

    const avg = Math.round(
      perArtifact.reduce((sum, r) => sum + r.similarity, 0) / perArtifact.length,
    );
    const rationale = perArtifact.map((r) => `${r.path}: ${r.similarity}%`).join(', ');

    return {
      metricId: METRIC_IDS.diffSimilarity,
      label: 'Diff similarity',
      score: avg,
      rationale,
    };
  }

  private scoreExitCode(outcome: AgentRunOutcome): Omit<MetricScore, 'weight'> {
    const ok = outcome.exitCode === 0;
    return {
      metricId: METRIC_IDS.exitCode,
      label: 'Exit code',
      score: ok ? 100 : 0,
      rationale: ok ? 'Agent exited 0.' : `Agent exited ${outcome.exitCode}.`,
    };
  }

  private scoreJudge(judgement: SkillJudgeResponse): Omit<MetricScore, 'weight'> {
    return {
      metricId: METRIC_IDS.llmJudge,
      label: 'LLM judge',
      score: judgement.score,
      rationale:
        judgement.observations.length === 0
          ? 'No observations returned.'
          : judgement.observations.join('; '),
    };
  }
}

const MAX_PATTERN_LENGTH = 512;

// Nested quantifier on a group (a catastrophic-backtracking smell — e.g.
// (a+)+, (.*)+, (\d+)*). Checked as a string before the RegExp is compiled
// so a hostile dataset can't lock the scorer on `re.test(content)`.
const NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)[+*]/;

function unsafePatternReason(pattern: string): string | null {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return `pattern longer than ${MAX_PATTERN_LENGTH} chars`;
  }
  if (NESTED_QUANTIFIER.test(pattern)) {
    return 'nested quantifier rejected to avoid catastrophic backtracking';
  }
  return null;
}

function aggregate(metrics: readonly MetricScore[]): number {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = metrics.reduce((sum, m) => sum + m.score * m.weight, 0);
  return Math.round(weightedSum / totalWeight);
}
