import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { LLMJudge, JudgeRequest, JudgeResponse } from '../../../domain/contract/ports/LLMJudge.js';

const SYSTEM_PROMPT = `You are an expert agentic coding readiness evaluator. Your task is to score a software project on a specific dimension and provide actionable findings.

SCORING SCALE:
  0–19:  F — Absent or fundamentally broken
  20–39: D — Minimal or severely inadequate
  40–59: C — Partially present but significant gaps
  60–79: B — Mostly present with some gaps
  80–100: A — Well-configured and optimised

You will call the submit_evaluation tool with your assessment. Be specific and actionable in your observations and recommendation. Base your score strictly on the evidence in the snapshot.`;

const JudgeInputSchema = z.object({
  llmScore: z.number().int().min(0).max(100),
  observations: z.array(z.string()).min(1).max(5),
  recommendation: z.string().min(1),
});

function buildUserMessage(req: JudgeRequest): string {
  const { snapshot, dimension, rubric } = req;
  const testList = snapshot.testFilePaths.slice(0, 20).join('\n') || '(none)';
  const testSamples = snapshot.testFileSamples
    .map((s) => `--- ${s.path} ---\n${s.content}`)
    .join('\n\n') || '(none)';
  const readme = snapshot.readmeMd ? snapshot.readmeMd.slice(0, 2000) : '(not present)';

  return `DIMENSION: ${dimension}

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

Score this project on the "${dimension}" dimension.`;
}

/** Real adapter — calls Claude claude-haiku-4-5-20251001 with prompt caching and tool-use for structured output. */
export class AnthropicLLMJudge implements LLMJudge {
  constructor(private readonly client: Anthropic) {}

  async judge(request: JudgeRequest): Promise<JudgeResponse> {
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [
        {
          name: 'submit_evaluation',
          description: 'Submit the dimension evaluation scores and findings.',
          input_schema: {
            type: 'object',
            properties: {
              llmScore: {
                type: 'integer',
                minimum: 0,
                maximum: 100,
                description: 'Score from 0 to 100 for this dimension.',
              },
              observations: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 5,
                description: 'Concise, specific observations about this dimension.',
              },
              recommendation: {
                type: 'string',
                description: 'The single most impactful next step to improve this dimension.',
              },
            },
            required: ['llmScore', 'observations', 'recommendation'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_evaluation' },
      messages: [{ role: 'user', content: buildUserMessage(request) }],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error(`LLM did not call submit_evaluation for dimension ${request.dimension}`);
    }

    const parsed = JudgeInputSchema.parse(toolUse.input);

    return {
      dimension: request.dimension,
      llmScore: parsed.llmScore,
      observations: parsed.observations,
      recommendation: parsed.recommendation,
    };
  }
}
