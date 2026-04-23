import type { ProjectSnapshot } from '../../contract/ProjectSnapshot.js';
import type { DimensionId } from '../../contract/DimensionScore.js';
import type { Finding } from '../../contract/Finding.js';

export interface DimensionAssessment {
  readonly score: number;
  readonly findings: readonly Finding[];
}

export type DeterministicAssessments = Record<DimensionId, DimensionAssessment>;

/** Produces rule-based scores and findings from a project snapshot. Pure, no I/O. */
export function score(snapshot: ProjectSnapshot): DeterministicAssessments {
  return {
    'claude-code-setup': scoreClaudeSetup(snapshot),
    'project-structure': scoreProjectStructure(snapshot),
    'test-infrastructure': scoreTestInfrastructure(snapshot),
    documentation: scoreDocumentation(snapshot),
  };
}

function scoreClaudeSetup(snapshot: ProjectSnapshot): DimensionAssessment {
  const findings: Finding[] = [];
  let pts = 0;

  if (snapshot.claudeMd !== null) {
    pts += 30;
  } else {
    findings.push({
      description: 'No CLAUDE.md found at project root.',
      severity: 'critical',
      source: 'claude-md-missing',
    });
  }

  if (snapshot.claudeMd !== null && snapshot.claudeMd.length > 200) {
    pts += 20;
  } else if (snapshot.claudeMd !== null) {
    findings.push({
      description:
        'CLAUDE.md is very short (<200 chars). Add architecture, conventions, and workflow instructions.',
      severity: 'warning',
      source: 'claude-md-thin',
    });
  }

  if (snapshot.claudeSettingsJson !== null) {
    pts += 20;
  } else {
    findings.push({
      description: 'No .claude/settings.json found. Configure tool permissions and hooks.',
      severity: 'warning',
      source: 'settings-missing',
    });
  }

  const hasHooks = snapshot.claudeSettingsJson?.includes('"hooks"') ?? false;
  if (hasHooks) {
    pts += 20;
  } else {
    findings.push({
      description: 'No hooks configured in .claude/settings.json.',
      severity: 'warning',
      source: 'hooks-missing',
    });
  }

  const hasMcp = snapshot.claudeConfigPaths.some((p) => p.includes('mcp'));
  if (hasMcp) {
    pts += 10;
  } else {
    findings.push({
      description: 'No MCP server configuration found.',
      severity: 'info',
      source: 'mcp-missing',
    });
  }

  return { score: pts, findings };
}

function scoreProjectStructure(snapshot: ProjectSnapshot): DimensionAssessment {
  const findings: Finding[] = [];
  let pts = 0;
  const tree = snapshot.directoryTree;

  if (/application[/\\]/.test(tree)) {
    pts += 25;
  } else {
    findings.push({
      description: 'No application/ directory found. Consider hexagonal architecture.',
      severity: 'warning',
      source: 'no-application-layer',
    });
  }

  if (/domain[/\\]/.test(tree)) {
    pts += 25;
  } else {
    findings.push({
      description: 'No domain/ directory found.',
      severity: 'critical',
      source: 'no-domain-layer',
    });
  }

  if (/infrastructure[/\\]/.test(tree)) {
    pts += 25;
  } else {
    findings.push({
      description: 'No infrastructure/ directory found.',
      severity: 'warning',
      source: 'no-infrastructure-layer',
    });
  }

  if (snapshot.ciConfigPaths.length > 0) {
    pts += 15;
  } else {
    findings.push({
      description: 'No CI configuration found.',
      severity: 'warning',
      source: 'no-ci',
    });
  }

  if (snapshot.hasLockfile) {
    pts += 10;
  } else {
    findings.push({
      description: 'No package lockfile found.',
      severity: 'info',
      source: 'no-lockfile',
    });
  }

  return { score: pts, findings };
}

function scoreTestInfrastructure(snapshot: ProjectSnapshot): DimensionAssessment {
  const findings: Finding[] = [];
  let pts = 0;

  if (snapshot.testFilePaths.length > 0) {
    pts += 20;
  } else {
    findings.push({
      description: 'No test files found.',
      severity: 'critical',
      source: 'no-tests',
    });
  }

  if (snapshot.testFilePaths.length >= 5) {
    pts += 20;
  } else if (snapshot.testFilePaths.length > 0) {
    findings.push({
      description: `Only ${snapshot.testFilePaths.length} test file(s) found. Aim for broader coverage.`,
      severity: 'warning',
      source: 'few-tests',
    });
  }

  const hasTestConfig = snapshot.sourceFilePaths.some((p) =>
    /vitest\.config|jest\.config|\.mocharc|pytest\.ini|pyproject\.toml/.test(p),
  );
  if (hasTestConfig) {
    pts += 20;
  } else {
    findings.push({
      description: 'No test framework configuration file found.',
      severity: 'warning',
      source: 'no-test-config',
    });
  }

  const hasScenario = snapshot.testFilePaths.some((p) => /[Ss]cenario/.test(p));
  if (hasScenario) {
    pts += 20;
  } else {
    findings.push({
      description: 'No Scenario pattern found in test files. Add test data builders.',
      severity: 'info',
      source: 'no-scenario-pattern',
    });
  }

  const hasFake =
    snapshot.testFilePaths.some((p) => /[Ff]ake/.test(p)) ||
    snapshot.sourceFilePaths.some((p) => p.includes('/fake/') || p.includes('\\fake\\'));
  if (hasFake) {
    pts += 20;
  } else {
    findings.push({
      description: 'No Fake implementations found. Add fakes for secondary ports.',
      severity: 'info',
      source: 'no-fakes',
    });
  }

  return { score: pts, findings };
}

function scoreDocumentation(snapshot: ProjectSnapshot): DimensionAssessment {
  const findings: Finding[] = [];
  let pts = 0;

  if (snapshot.readmeMd !== null) {
    pts += 25;
  } else {
    findings.push({
      description: 'No README.md found.',
      severity: 'critical',
      source: 'no-readme',
    });
  }

  if (snapshot.readmeMd !== null && snapshot.readmeMd.length > 300) {
    pts += 20;
  } else if (snapshot.readmeMd !== null) {
    findings.push({
      description: 'README.md is too short. Add build instructions and architecture overview.',
      severity: 'warning',
      source: 'thin-readme',
    });
  }

  if (snapshot.claudeMd !== null) {
    pts += 20;
  }

  const hasDocsDir =
    /\bdocs[/\\]/.test(snapshot.directoryTree) || /\badr[/\\]/.test(snapshot.directoryTree);
  if (hasDocsDir) {
    pts += 20;
  } else {
    findings.push({
      description: 'No docs/ or adr/ directory found.',
      severity: 'info',
      source: 'no-docs-dir',
    });
  }

  const hasDocComments = snapshot.testFileSamples.some(
    (s) => s.content.includes('/**') || s.content.includes('///'),
  );
  if (hasDocComments) {
    pts += 15;
  } else {
    findings.push({
      description: 'No doc comments (/** */ or ///) found in sampled files.',
      severity: 'warning',
      source: 'no-doc-comments',
    });
  }

  return { score: Math.min(pts, 100), findings };
}
