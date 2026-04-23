import type { AgentRunOutcome } from '../../contract/AgentRunOutcome.js';
import type { SkillCase, ExpectedArtifact } from '../../contract/SkillCase.js';
import type { FileDiff } from '../../contract/FileDiff.js';
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

  private weighted(
    skillCase: SkillCase,
    raw: Omit<MetricScore, 'weight'>,
  ): MetricScore {
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

    const changesByPath = new Map(outcome.fileChanges.map((c) => [c.path, c]));
    const misses: string[] = [];
    let satisfied = 0;

    for (const artifact of expected) {
      const change = changesByPath.get(artifact.path);
      const mustExist = artifact.mustExist ?? true;
      const exists =
        change !== undefined &&
        (change.changeType === 'created' || change.changeType === 'modified');

      if (mustExist && !exists) {
        misses.push(`missing ${artifact.path}`);
        continue;
      }
      if (!mustExist && exists) {
        misses.push(`unexpectedly present ${artifact.path}`);
        continue;
      }
      if (artifact.contentPattern && change?.contentAfter !== undefined) {
        let re: RegExp;
        try {
          re = new RegExp(artifact.contentPattern);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          misses.push(`invalid content pattern ${artifact.path}: ${reason}`);
          continue;
        }
        if (!re.test(change.contentAfter)) {
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
    const withGolden = expected.filter((a) => a.goldenContent !== undefined);
    if (withGolden.length === 0) return null;

    const changesByPath = new Map(outcome.fileChanges.map((c) => [c.path, c]));
    const perArtifact: { path: string; similarity: number }[] = [];
    for (const artifact of withGolden) {
      const produced = producedContent(changesByPath.get(artifact.path));
      const similarity =
        produced === null ? 0 : lineSimilarity(produced, artifact.goldenContent!);
      perArtifact.push({ path: artifact.path, similarity });
    }

    const avg = Math.round(
      perArtifact.reduce((sum, r) => sum + r.similarity, 0) / perArtifact.length,
    );
    const rationale = perArtifact
      .map((r) => `${r.path}: ${r.similarity}%`)
      .join(', ');

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

  private scoreJudge(
    judgement: SkillJudgeResponse,
  ): Omit<MetricScore, 'weight'> {
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

/**
 * Returns the post-run content of a produced file, or `null` if the file
 * was deleted, never produced, or had no captured contentAfter.
 */
function producedContent(change: FileDiff | undefined): string | null {
  if (!change) return null;
  if (change.changeType === 'deleted') return null;
  return change.contentAfter ?? null;
}

function aggregate(metrics: readonly MetricScore[]): number {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = metrics.reduce((sum, m) => sum + m.score * m.weight, 0);
  return Math.round(weightedSum / totalWeight);
}
