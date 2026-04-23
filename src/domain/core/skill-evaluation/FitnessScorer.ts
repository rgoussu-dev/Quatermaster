import type { AgentRunOutcome } from '../../contract/AgentRunOutcome.js';
import type { SkillCase, ExpectedArtifact } from '../../contract/SkillCase.js';
import type { MetricScore } from '../../contract/SkillEvaluationResult.js';
import type { SkillJudgeResponse } from '../../contract/ports/SkillJudge.js';

/** Default metric weights — only applied when not overridden by the case. */
export const DEFAULT_METRIC_WEIGHTS: Readonly<Record<string, number>> = {
  'artifact-presence': 0.4,
  'exit-code': 0.1,
  'llm-judge': 0.5,
};

/** Known metric ids the scorer can emit. */
export const METRIC_IDS = {
  artifactPresence: 'artifact-presence',
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
    const exit = this.scoreExitCode(outcome);
    const llm = this.scoreJudge(judgement);

    const metrics: MetricScore[] = [];
    if (artifact) metrics.push(this.weighted(skillCase, artifact));
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
        const re = new RegExp(artifact.contentPattern);
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

function aggregate(metrics: readonly MetricScore[]): number {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = metrics.reduce((sum, m) => sum + m.score * m.weight, 0);
  return Math.round(weightedSum / totalWeight);
}
