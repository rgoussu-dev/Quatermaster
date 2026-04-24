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

  // README presence + graded structural quality (35 pts).
  if (snapshot.readmeMd !== null) {
    pts += 10;
    pts += scoreReadmeStructure(snapshot.readmeMd, findings);
  } else {
    findings.push({
      description: 'No README.md found.',
      severity: 'critical',
      source: 'no-readme',
    });
  }

  // CLAUDE.md: up to 20 pts here (5 presence + up to 15 graded quality).
  // Most of the CLAUDE.md signal is already counted under claude-code-setup.
  if (snapshot.claudeMd !== null) {
    pts += 5;
    pts += scoreClaudeMdQuality(snapshot.claudeMd, findings);
  }

  // Contributor-oriented onboarding doc (15 pts).
  if (snapshot.agentsMd !== null || snapshot.contributingMd !== null) {
    pts += 15;
  } else {
    findings.push({
      description:
        'No AGENTS.md or CONTRIBUTING.md found. Add contributor-oriented onboarding so agents can ramp up safely.',
      severity: 'warning',
      source: 'no-contributor-doc',
    });
  }

  // docs/ or adr/ directory (15 pts).
  const hasDocsDir =
    /\bdocs[/\\]/.test(snapshot.directoryTree) || /\badr[/\\]/.test(snapshot.directoryTree);
  if (hasDocsDir) {
    pts += 15;
  } else {
    findings.push({
      description: 'No docs/ or adr/ directory found.',
      severity: 'info',
      source: 'no-docs-dir',
    });
  }

  // TSDoc coverage over exported symbols (up to 20 pts).
  pts += scoreTsdocCoverage(snapshot.exportedSymbolDocCoverage, findings);

  // Broken relative links in README/CLAUDE/AGENTS/CONTRIBUTING (penalty, capped).
  if (snapshot.brokenDocLinks.length > 0) {
    const penalty = Math.min(snapshot.brokenDocLinks.length * 5, 15);
    pts -= penalty;
    const preview = snapshot.brokenDocLinks
      .slice(0, 3)
      .map((l) => `${l.source} → ${l.target}`)
      .join('; ');
    const more =
      snapshot.brokenDocLinks.length > 3 ? ` (+${snapshot.brokenDocLinks.length - 3} more)` : '';
    findings.push({
      description: `Broken relative links in project docs: ${preview}${more}. Fix or remove stale paths.`,
      severity: 'warning',
      source: 'broken-doc-links',
    });
  }

  return { score: Math.max(0, Math.min(pts, 100)), findings };
}

const README_H2_RE = /^##\s+\S/m;
const README_FENCE_RE = /```[a-zA-Z0-9_+-]*\n/;
const README_INSTALL_RE = /^##\s+(install|installation|setup|getting started|quick ?start)/im;
const README_USAGE_RE = /^##\s+(usage|example|examples|how to use|api)/im;

function scoreReadmeStructure(readme: string, findings: Finding[]): number {
  let pts = 0;

  if (readme.length > 300) {
    pts += 5;
  } else {
    findings.push({
      description:
        'README.md is very short (<300 chars). Add build, usage, and architecture sections.',
      severity: 'warning',
      source: 'thin-readme',
    });
  }

  if (README_FENCE_RE.test(readme)) {
    pts += 5;
  } else {
    findings.push({
      description:
        'README.md has no fenced code block. Add runnable examples so agents can copy them.',
      severity: 'warning',
      source: 'readme-no-code-fence',
    });
  }

  const headingCount = (readme.match(/^##\s+\S/gm) ?? []).length;
  if (headingCount >= 2 && README_H2_RE.test(readme)) {
    pts += 5;
  } else {
    findings.push({
      description:
        'README.md has fewer than two top-level sections. Break it into navigable sections.',
      severity: 'info',
      source: 'readme-thin-structure',
    });
  }

  if (README_INSTALL_RE.test(readme)) {
    pts += 5;
  } else {
    findings.push({
      description: 'README.md has no Install / Setup / Getting Started section.',
      severity: 'info',
      source: 'readme-no-install-section',
    });
  }

  if (README_USAGE_RE.test(readme)) {
    pts += 5;
  } else {
    findings.push({
      description: 'README.md has no Usage / Examples section.',
      severity: 'info',
      source: 'readme-no-usage-section',
    });
  }

  return pts;
}

const CLAUDE_COMMAND_RE =
  /```(?:sh|bash|zsh|shell|console)?\s*\n|\bnpm\s+(?:run|test|install)\b|\byarn\s+\w+|\bpnpm\s+\w+/i;
const CLAUDE_ARCH_RE =
  /architecture|hexagonal|ports?\s+and\s+adapters?|layer|directory|convention/i;

function scoreClaudeMdQuality(claudeMd: string, findings: Finding[]): number {
  let pts = 0;

  if (claudeMd.length > 200) {
    pts += 5;
  } else {
    findings.push({
      description:
        'CLAUDE.md is very short (<200 chars). Expand it with architecture, conventions, and workflow instructions.',
      severity: 'warning',
      source: 'claude-md-thin',
    });
    return pts;
  }

  if (CLAUDE_COMMAND_RE.test(claudeMd)) {
    pts += 5;
  } else {
    findings.push({
      description:
        'CLAUDE.md does not mention project commands. Document build/test/lint commands.',
      severity: 'info',
      source: 'claude-md-no-commands',
    });
  }

  if (CLAUDE_ARCH_RE.test(claudeMd)) {
    pts += 5;
  } else {
    findings.push({
      description:
        'CLAUDE.md does not describe architecture or conventions. Explain how the codebase is organised.',
      severity: 'info',
      source: 'claude-md-no-architecture',
    });
  }

  return pts;
}

function scoreTsdocCoverage(
  coverage: ProjectSnapshot['exportedSymbolDocCoverage'],
  findings: Finding[],
): number {
  if (coverage === null) return 0;
  if (coverage.total === 0) return 0;

  const ratio = coverage.documented / coverage.total;
  const pts = Math.round(ratio * 20);

  if (ratio < 0.3) {
    findings.push({
      description: `Only ${coverage.documented}/${coverage.total} exported symbols have TSDoc. Document public surfaces.`,
      severity: 'warning',
      source: 'low-tsdoc-coverage',
    });
  } else if (ratio < 0.6) {
    findings.push({
      description: `TSDoc coverage is ${coverage.documented}/${coverage.total}. Aim for ≥60% on exported symbols.`,
      severity: 'info',
      source: 'partial-tsdoc-coverage',
    });
  }

  return pts;
}
