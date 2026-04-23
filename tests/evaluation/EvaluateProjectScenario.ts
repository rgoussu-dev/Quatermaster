import type { ProjectSnapshot } from '../../src/domain/contract/ProjectSnapshot.js';
import type { JudgeResponse } from '../../src/domain/contract/ports/LLMJudge.js';
import type { DimensionId } from '../../src/domain/contract/DimensionScore.js';

const BASE_TREE = `
src/
  application/
    cli/
  domain/
    contract/
    core/
  infrastructure/
`.trim();

/** A snapshot representing a well-configured keel project. */
export function wellConfiguredSnapshot(): ProjectSnapshot {
  return {
    projectPath: '/test/well-configured',
    claudeMd:
      `# Project\n\nThis project uses hexagonal architecture with ports and adapters.\nAll business logic lives in domain/core. Tests use the Scenario+Factory+fakes pattern.\nCommit via trunk-based development with Conventional Commits.`.repeat(
        2,
      ),
    readmeMd: `# My Project\n\nA well-documented project.\n\n## Build\n\n\`npm run build\`\n\n## Test\n\n\`npm test\`\n\n## Architecture\n\nHexagonal architecture with domain, application, and infrastructure layers.`,
    directoryTree: BASE_TREE + '\ntests/\n  evaluation/\n.github/\n  workflows/',
    testFilePaths: [
      'tests/evaluation/EvaluateProjectScenario.ts',
      'tests/evaluation/EvaluateProjectFactory.ts',
      'tests/evaluation/EvaluateProject.test.ts',
      'tests/user/UserScenario.ts',
      'tests/user/UserFactory.ts',
      'tests/user/User.test.ts',
    ],
    testFileSamples: [
      {
        path: 'tests/evaluation/EvaluateProject.test.ts',
        content: `/**\n * Tests for the EvaluateProject query.\n */\nimport { describe, it, expect } from 'vitest';\n\ndescribe('EvaluateProject', () => {\n  it('should evaluate a project', async () => {\n    expect(true).toBe(true);\n  });\n});\n`,
      },
    ],
    claudeConfigPaths: ['.claude/settings.json', '.claude/hooks/pre-commit.sh'],
    claudeSettingsJson: JSON.stringify({ hooks: { preToolUse: [] }, permissions: { allow: [] } }),
    sourceFilePaths: [
      'src/application/cli/executable/main.ts',
      'src/domain/contract/kernel/Mediator.ts',
      'src/domain/core/evaluation/EvaluateProjectHandler.ts',
      'src/infrastructure/project-scanner/real/FileSystemScanner.ts',
      'vitest.config.ts',
    ],
    sourceFileSamples: [
      {
        path: 'src/domain/contract/ports/ProjectScanner.ts',
        content: `/**\n * Secondary port — reads a project and returns a snapshot.\n */\nexport interface ProjectScanner {\n  scan(projectPath: string): Promise<ProjectSnapshot>;\n}\n`,
      },
    ],
    hasLockfile: true,
    ciConfigPaths: ['.github/workflows/ci.yml'],
  };
}

/** A snapshot representing a minimal, nearly-empty project. */
export function minimalSnapshot(): ProjectSnapshot {
  return {
    projectPath: '/test/minimal',
    claudeMd: null,
    readmeMd: null,
    directoryTree: 'src/\n  index.ts',
    testFilePaths: [],
    testFileSamples: [],
    claudeConfigPaths: [],
    claudeSettingsJson: null,
    sourceFilePaths: ['src/index.ts'],
    sourceFileSamples: [],
    hasLockfile: false,
    ciConfigPaths: [],
  };
}

/** Stub judge responses for the well-configured scenario. */
export function wellConfiguredJudgeResponses(): Record<DimensionId, JudgeResponse> {
  const make = (dimension: DimensionId, score: number): JudgeResponse => ({
    dimension,
    llmScore: score,
    observations: [`${dimension} is well set up`, 'Good patterns observed'],
    recommendation: `Continue maintaining ${dimension} quality`,
  });
  return {
    'claude-code-setup': make('claude-code-setup', 85),
    'project-structure': make('project-structure', 80),
    'test-infrastructure': make('test-infrastructure', 75),
    documentation: make('documentation', 70),
  };
}

/** Stub judge responses for the minimal scenario. */
export function minimalJudgeResponses(): Record<DimensionId, JudgeResponse> {
  const make = (dimension: DimensionId): JudgeResponse => ({
    dimension,
    llmScore: 10,
    observations: [`${dimension} is essentially absent`],
    recommendation: `Set up basic ${dimension} infrastructure`,
  });
  return {
    'claude-code-setup': make('claude-code-setup'),
    'project-structure': make('project-structure'),
    'test-infrastructure': make('test-infrastructure'),
    documentation: make('documentation'),
  };
}
