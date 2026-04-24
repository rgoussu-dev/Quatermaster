import { describe, it, expect } from 'vitest';
import { topRecommendations } from '../../src/domain/core/evaluation/ScoreAggregator.js';
import type { DimensionScore } from '../../src/domain/contract/DimensionScore.js';
import type { Finding } from '../../src/domain/contract/Finding.js';

function dim(
  dimension: DimensionScore['dimension'],
  weight: number,
  findings: readonly Finding[],
): DimensionScore {
  return {
    dimension,
    label: dimension,
    weight,
    score: 70,
    grade: 'B',
    findings,
  };
}

describe('topRecommendations', () => {
  it('excludes neutral LLM observations tagged source "llm-judge"', () => {
    const dims = [
      dim('claude-code-setup', 0.35, [
        {
          description: 'CLAUDE.md is comprehensive and covers conventions thoroughly.',
          severity: 'info',
          source: 'llm-judge',
        },
        {
          description: 'No MCP server configuration found.',
          severity: 'info',
          source: 'mcp-missing',
        },
      ]),
    ];
    const recs = topRecommendations(dims);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toContain('No MCP server configuration');
    expect(recs.join(' ')).not.toContain('comprehensive');
  });

  it('keeps LLM recommendations (distinct source) in the list', () => {
    const dims = [
      dim('documentation', 0.15, [
        {
          description: 'Add diagrams to the architecture section.',
          severity: 'warning',
          source: 'llm-judge:recommendation',
        },
      ]),
    ];
    const recs = topRecommendations(dims);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toContain('Add diagrams');
  });

  it('dedupes findings with the same description across dimensions', () => {
    const dims = [
      dim('claude-code-setup', 0.35, [
        {
          description: 'No MCP server configuration found.',
          severity: 'info',
          source: 'mcp-missing',
        },
      ]),
      dim('documentation', 0.15, [
        {
          description: 'No MCP server configuration found.',
          severity: 'info',
          source: 'llm-judge:recommendation',
        },
      ]),
    ];
    const recs = topRecommendations(dims);
    expect(recs).toHaveLength(1);
  });

  it('dedupes case-insensitively and ignores trailing punctuation', () => {
    const dims = [
      dim('claude-code-setup', 0.35, [
        {
          description: 'No MCP server configuration found.',
          severity: 'warning',
          source: 'mcp-missing',
        },
        {
          description: 'no MCP server configuration found',
          severity: 'warning',
          source: 'llm-judge:recommendation',
        },
      ]),
    ];
    expect(topRecommendations(dims)).toHaveLength(1);
  });

  it('prefers higher-weight dimensions within the same severity bucket', () => {
    const dims = [
      dim('documentation', 0.15, [
        {
          description: 'Doc issue A.',
          severity: 'warning',
          source: 'doc-rule',
        },
      ]),
      dim('claude-code-setup', 0.35, [
        {
          description: 'Setup issue B.',
          severity: 'warning',
          source: 'setup-rule',
        },
      ]),
    ];
    const recs = topRecommendations(dims);
    expect(recs[0]).toContain('Setup issue B');
    expect(recs[1]).toContain('Doc issue A');
  });

  it('still orders critical before warning before info regardless of weight', () => {
    const dims = [
      dim('documentation', 0.15, [
        {
          description: 'Critical doc problem.',
          severity: 'critical',
          source: 'doc-critical',
        },
      ]),
      dim('claude-code-setup', 0.35, [
        {
          description: 'Setup warning.',
          severity: 'warning',
          source: 'setup-warn',
        },
      ]),
    ];
    const recs = topRecommendations(dims);
    expect(recs[0]).toContain('Critical doc problem');
    expect(recs[1]).toContain('Setup warning');
  });

  it('respects the limit argument', () => {
    const dims = [
      dim(
        'claude-code-setup',
        0.35,
        Array.from({ length: 8 }, (_, i) => ({
          description: `Issue ${i}`,
          severity: 'warning' as const,
          source: `rule-${i}`,
        })),
      ),
    ];
    expect(topRecommendations(dims, 3)).toHaveLength(3);
  });
});
