import { z } from 'zod';
import { runClaudeCLI, extractJSON } from '../../claude-cli/runClaudeCLI.js';
import type { LLMJudge, JudgeRequest, JudgeResponse } from '../../../domain/contract/ports/LLMJudge.js';

const JudgeSchema = z.object({
  llmScore: z.number().int().min(0).max(100),
  observations: z.array(z.string()).min(1).max(5),
  recommendation: z.string().min(1),
});

function buildPrompt(request: JudgeRequest): string {
  const { snapshot, dimension, rubric } = request;
  const testList = snapshot.testFilePaths.slice(0, 20).join('\n') || '(none)';
  const testSamples =
    snapshot.testFileSamples.map((s) => `--- ${s.path} ---\n${s.content}`).join('\n\n') ||
    '(none)';
  const readme = snapshot.readmeMd ? snapshot.readmeMd.slice(0, 2000) : '(not present)';

  return `You are an expert agentic coding readiness evaluator.

SCORING SCALE:
  0–19:  F — Absent or fundamentally broken
  20–39: D — Minimal or severely inadequate
  40–59: C — Partially present but significant gaps
  60–79: B — Mostly present with some gaps
  80–100: A — Well-configured and optimised

DIMENSION: ${dimension}

RUBRIC:
${rubric}

PROJECT SNAPSHOT
================
Path: ${snapshot.projectPath}

CLAUDE.md:
${snapshot.claudeMd ?? '(not present)'}

README.md:
${readme}

DIRECTORY TREE:
${snapshot.directoryTree}

.CLAUDE/SETTINGS.JSON:
${snapshot.claudeSettingsJson ?? '(not present)'}

CLAUDE CONFIG FILES:
${snapshot.claudeConfigPaths.join('\n') || '(none)'}

TEST FILES (${snapshot.testFilePaths.length} total):
${testList}

TEST SAMPLES:
${testSamples}

CI CONFIGS:
${snapshot.ciConfigPaths.join('\n') || '(none)'}
================

Score this project on the "${dimension}" dimension.
Respond with ONLY a JSON code block — no other text:

\`\`\`json
{"llmScore": <0-100>, "observations": ["concise observation", ...up to 5], "recommendation": "single most impactful next step"}
\`\`\``;
}


/**
 * LLM judge adapter that uses the local `claude` CLI (Claude Code).
 * Requires no ANTHROPIC_API_KEY — leverages the user's Claude subscription.
 * Each call spawns a `claude -p` subprocess and parses the JSON response.
 */
export class ClaudeCodeJudge implements LLMJudge {
  /** @param timeoutMs  Per-dimension call timeout. Default 90s — CLI startup adds ~2–5s overhead. */
  constructor(private readonly timeoutMs = 90_000) {}

  async judge(request: JudgeRequest): Promise<JudgeResponse> {
    const output = await runClaudeCLI(buildPrompt(request), this.timeoutMs, {
      noTools: true,
    });
    const raw = extractJSON(output);
    const parsed = JudgeSchema.parse(raw);
    return {
      dimension: request.dimension,
      llmScore: parsed.llmScore,
      observations: parsed.observations,
      recommendation: parsed.recommendation,
    };
  }
}
