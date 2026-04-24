import { describe, it, expect } from 'vitest';
import { score } from '../../src/domain/core/evaluation/DeterministicScorer.js';
import type { ProjectSnapshot } from '../../src/domain/contract/ProjectSnapshot.js';

function baseSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    projectPath: '/x',
    claudeMd: null,
    readmeMd: null,
    contributingMd: null,
    agentsMd: null,
    directoryTree: '',
    testFilePaths: [],
    testFileSamples: [],
    claudeConfigPaths: [],
    claudeSettingsJson: null,
    sourceFilePaths: [],
    sourceFileSamples: [],
    exportedSymbolDocCoverage: null,
    brokenDocLinks: [],
    hasLockfile: false,
    ciConfigPaths: [],
    ...overrides,
  };
}

function docScore(overrides: Partial<ProjectSnapshot> = {}) {
  return score(baseSnapshot(overrides)).documentation;
}

function findingSources(overrides: Partial<ProjectSnapshot> = {}): string[] {
  return docScore(overrides).findings.map((f) => f.source);
}

describe('scoreDocumentation', () => {
  describe('README structural quality', () => {
    it('rewards a README with install + usage + code fence + sections', () => {
      const readme = [
        '# Project',
        'A '.repeat(200),
        '## Install',
        '```sh',
        'npm install',
        '```',
        '## Usage',
        '```ts',
        'import x from "x";',
        '```',
      ].join('\n');
      const result = docScore({ readmeMd: readme });
      expect(result.findings.map((f) => f.source)).not.toContain('readme-no-install-section');
      expect(result.findings.map((f) => f.source)).not.toContain('readme-no-usage-section');
      expect(result.findings.map((f) => f.source)).not.toContain('readme-no-code-fence');
      expect(result.findings.map((f) => f.source)).not.toContain('thin-readme');
    });

    it('flags a README missing Install/Usage sections', () => {
      const readme = '# Project\n\n' + 'content '.repeat(80) + '\n## History\nOld notes.';
      expect(findingSources({ readmeMd: readme })).toEqual(
        expect.arrayContaining(['readme-no-install-section', 'readme-no-usage-section']),
      );
    });

    it('flags a thin README that has no code fence', () => {
      expect(findingSources({ readmeMd: '# tiny' })).toEqual(
        expect.arrayContaining(['thin-readme', 'readme-no-code-fence']),
      );
    });

    it('produces a critical finding when README is absent', () => {
      const result = docScore({ readmeMd: null });
      const critical = result.findings.find((f) => f.severity === 'critical');
      expect(critical?.source).toBe('no-readme');
    });
  });

  describe('CLAUDE.md graded quality', () => {
    it('awards architecture + commands when both are mentioned', () => {
      const claudeMd =
        'Long CLAUDE.md body. '.repeat(30) +
        '\n\nArchitecture: hexagonal with ports and adapters.\n\nRun `npm test`.';
      expect(findingSources({ claudeMd })).not.toEqual(
        expect.arrayContaining(['claude-md-no-architecture', 'claude-md-no-commands']),
      );
    });

    it('flags CLAUDE.md that lacks commands and architecture notes', () => {
      const claudeMd = 'Just some prose about the project. '.repeat(10);
      expect(findingSources({ claudeMd })).toEqual(
        expect.arrayContaining(['claude-md-no-architecture', 'claude-md-no-commands']),
      );
    });

    it('flags a very short CLAUDE.md as thin', () => {
      expect(findingSources({ claudeMd: 'hi' })).toContain('claude-md-thin');
    });
  });

  describe('contributor-oriented onboarding', () => {
    it('accepts AGENTS.md alone', () => {
      expect(findingSources({ agentsMd: '# Agents\n\nRules for agents.' })).not.toContain(
        'no-contributor-doc',
      );
    });

    it('accepts CONTRIBUTING.md alone', () => {
      expect(findingSources({ contributingMd: '# Contributing' })).not.toContain(
        'no-contributor-doc',
      );
    });

    it('flags missing onboarding doc', () => {
      expect(findingSources()).toContain('no-contributor-doc');
    });
  });

  describe('TSDoc coverage', () => {
    it('produces no finding at ≥60% coverage', () => {
      const sources = findingSources({
        exportedSymbolDocCoverage: { documented: 8, total: 10 },
      });
      expect(sources).not.toContain('partial-tsdoc-coverage');
      expect(sources).not.toContain('low-tsdoc-coverage');
    });

    it('flags partial coverage between 30% and 60%', () => {
      expect(
        findingSources({ exportedSymbolDocCoverage: { documented: 4, total: 10 } }),
      ).toContain('partial-tsdoc-coverage');
    });

    it('flags low coverage below 30%', () => {
      expect(
        findingSources({ exportedSymbolDocCoverage: { documented: 1, total: 10 } }),
      ).toContain('low-tsdoc-coverage');
    });

    it('awards points proportionally to the coverage ratio', () => {
      const full = docScore({ exportedSymbolDocCoverage: { documented: 10, total: 10 } }).score;
      const half = docScore({ exportedSymbolDocCoverage: { documented: 5, total: 10 } }).score;
      const none = docScore({ exportedSymbolDocCoverage: { documented: 0, total: 10 } }).score;
      expect(full).toBeGreaterThan(half);
      expect(half).toBeGreaterThan(none);
    });
  });

  describe('broken doc links', () => {
    it('applies a penalty and a finding when links are broken', () => {
      const clean = docScore({ exportedSymbolDocCoverage: { documented: 10, total: 10 } }).score;
      const broken = docScore({
        exportedSymbolDocCoverage: { documented: 10, total: 10 },
        brokenDocLinks: [
          { source: 'README.md', target: 'docs/missing.md' },
          { source: 'CLAUDE.md', target: 'src/gone.ts' },
        ],
      });
      expect(broken.score).toBeLessThan(clean);
      expect(broken.findings.map((f) => f.source)).toContain('broken-doc-links');
    });

    it('caps the penalty at 15 points', () => {
      const many = docScore({
        exportedSymbolDocCoverage: { documented: 10, total: 10 },
        brokenDocLinks: Array.from({ length: 10 }, (_, i) => ({
          source: 'README.md',
          target: `docs/gone-${i}.md`,
        })),
      }).score;
      const three = docScore({
        exportedSymbolDocCoverage: { documented: 10, total: 10 },
        brokenDocLinks: Array.from({ length: 3 }, (_, i) => ({
          source: 'README.md',
          target: `docs/gone-${i}.md`,
        })),
      }).score;
      expect(three - many).toBe(0);
    });
  });

  describe('overall clamping', () => {
    it('never returns a score below 0', () => {
      const result = docScore({
        brokenDocLinks: Array.from({ length: 20 }, (_, i) => ({
          source: 'README.md',
          target: `gone-${i}.md`,
        })),
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('never returns a score above 100', () => {
      const readme =
        '# Project\n' +
        'a '.repeat(200) +
        '\n## Install\n```sh\nnpm install\n```\n## Usage\n```ts\nx();\n```';
      const claudeMd =
        'Project uses hexagonal architecture with ports and adapters. '.repeat(5) +
        '\nRun `npm test`.';
      const result = docScore({
        readmeMd: readme,
        claudeMd,
        agentsMd: '# Agents',
        contributingMd: '# Contributing',
        directoryTree: 'docs/\n  adr/',
        exportedSymbolDocCoverage: { documented: 20, total: 20 },
      });
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThan(85);
    });
  });
});
