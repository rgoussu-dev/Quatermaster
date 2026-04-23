import chalk, { type ChalkInstance } from 'chalk';
import type { EvaluationResult } from '../../../domain/contract/EvaluationResult.js';
import type { SkillEvaluationResult } from '../../../domain/contract/SkillEvaluationResult.js';
import type {
  EvaluationDelta,
  CaseStatusChange,
} from '../../../domain/contract/EvaluationDelta.js';
import type { DomainError } from '../../../domain/contract/kernel/DomainError.js';

const BAR_WIDTH = 10;

function bar(score: number): string {
  const filled = Math.round((score / 100) * BAR_WIDTH);
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}

function gradeColor(grade: string): ChalkInstance {
  switch (grade) {
    case 'A': return chalk.green;
    case 'B': return chalk.blue;
    case 'C': return chalk.yellow;
    default: return chalk.red;
  }
}

/** Formats and prints an EvaluationResult to stdout. */
export function printReport(result: EvaluationResult): void {
  const divider = chalk.dim('─'.repeat(56));
  const heavy = chalk.dim('═'.repeat(56));

  console.log();
  console.log(chalk.bold('QUATERMASTER EVALUATION REPORT'));
  console.log(heavy);
  console.log(`Project:   ${chalk.cyan(result.projectPath)}`);
  console.log(`Evaluated: ${chalk.dim(result.evaluatedAt)}`);
  console.log();

  const overall = gradeColor(result.overallGrade);
  console.log(
    `OVERALL SCORE: ${overall.bold(`${result.overallScore}/100`)}   Grade: ${overall.bold(result.overallGrade)}`,
  );
  console.log(divider);
  console.log(chalk.bold('DIMENSION BREAKDOWN'));

  for (const dim of result.dimensions) {
    const col = gradeColor(dim.grade);
    const label = dim.label.padEnd(24);
    const weight = `(${Math.round(dim.weight * 100)}%)`.padEnd(6);
    const scoreStr = `${dim.score}/100`.padEnd(7);
    console.log(
      `  ${label} ${chalk.dim(weight)} ${col(`${scoreStr} ${dim.grade}`)}   ${col(bar(dim.score))}`,
    );
  }

  console.log(divider);
  console.log(chalk.bold('TOP RECOMMENDATIONS'));
  console.log();

  result.topRecommendations.forEach((rec, i) => {
    console.log(`  ${chalk.dim(`${i + 1}.`)} ${rec}`);
  });

  console.log(divider);
  console.log();
}

/** Formats and prints a SkillEvaluationResult to stdout. */
export function printSkillReport(result: SkillEvaluationResult): void {
  const divider = chalk.dim('─'.repeat(56));
  const heavy = chalk.dim('═'.repeat(56));
  const pct = Math.round(result.passRate * 100);
  const passColor = pct >= 80 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;

  console.log();
  console.log(chalk.bold('QUATERMASTER SKILL EVALUATION'));
  console.log(heavy);
  console.log(`Skill:     ${chalk.cyan(result.skillPath)}`);
  console.log(`Dataset:   ${chalk.cyan(result.datasetPath)}`);
  console.log(`Evaluated: ${chalk.dim(result.evaluatedAt)}`);
  console.log();
  console.log(
    `PASS RATE: ${passColor.bold(`${result.passedCases}/${result.totalCases}`)} ${passColor(`(${pct}%)`)}   ${passColor(bar(pct))}`,
  );
  console.log(divider);
  console.log(chalk.bold('CASES'));
  console.log();

  for (const c of result.cases) {
    const icon = c.passed ? chalk.green('✓') : chalk.red('✗');
    const scoreStr = passColor(`${c.score}/100`);
    const prompt = c.prompt.length > 50 ? c.prompt.slice(0, 47) + '...' : c.prompt;
    const tag = c.scenarioType ? chalk.dim(`[${c.scenarioType}] `) : '';
    console.log(
      `  ${icon}  ${scoreStr.padEnd(8)}  ${chalk.dim(c.id.padEnd(16))}  ${tag}${prompt}`,
    );
  }

  if (result.scenarioBreakdown) {
    console.log();
    console.log(divider);
    console.log(chalk.bold('SCENARIO BREAKDOWN'));
    for (const [scenario, bucket] of Object.entries(result.scenarioBreakdown)) {
      if (!bucket) continue;
      const pct = bucket.total === 0 ? 0 : Math.round((bucket.passed / bucket.total) * 100);
      const col = pct >= 80 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;
      console.log(
        `  ${scenario.padEnd(12)} ${col(`${bucket.passed}/${bucket.total}`)}  ${col(bar(pct))}`,
      );
    }
  }

  const failed = result.cases.filter((c) => !c.passed);
  if (failed.length > 0) {
    console.log();
    console.log(divider);
    console.log(chalk.bold('FAILED CASES'));
    for (const c of failed) {
      console.log();
      console.log(`  ${chalk.red.bold(c.id)}  ${c.score}/100`);
      if (c.metrics) {
        for (const m of c.metrics) {
          const weightStr = `(${Math.round(m.weight * 100)}%)`;
          console.log(
            `    ${chalk.dim(m.label.padEnd(20))} ${m.score}/100 ${chalk.dim(weightStr)}  ${chalk.dim(m.rationale)}`,
          );
        }
      } else {
        for (const obs of c.observations) {
          console.log(`    ${chalk.dim('•')} ${obs}`);
        }
      }
      console.log(`    ${chalk.dim('Expected:')} ${c.prompt}`);
    }
  }

  console.log(divider);
  console.log();
}

/** Prints a domain error to stderr. */
export function printError(error: DomainError): void {
  console.error(chalk.red(`Error [${error.kind}]: ${error.message}`));
}

/** Formats and prints the per-run delta computed against the previous snapshot. */
export function printSkillDelta(delta: EvaluationDelta): void {
  const divider = chalk.dim('─'.repeat(56));
  const heavy = chalk.dim('═'.repeat(56));

  console.log();
  console.log(chalk.bold('DELTA vs PREVIOUS RUN'));
  console.log(heavy);
  console.log(
    `Previous: ${chalk.dim(delta.previous.evaluatedAt)}  ${delta.previous.passedCases}/${delta.previous.totalCases}`,
  );
  console.log(
    `Current:  ${chalk.dim(delta.current.evaluatedAt)}  ${delta.current.passedCases}/${delta.current.totalCases}`,
  );
  console.log(
    `Pass-rate change: ${signedPoints(delta.passRatePointsChange)} percentage points`,
  );

  const moved = delta.cases.filter(
    (c) => c.scoreChange !== 0 || c.statusChange === 'newly-passing' || c.statusChange === 'newly-failing',
  );
  if (moved.length > 0) {
    console.log(divider);
    console.log(chalk.bold('CASE CHANGES'));
    for (const c of moved) {
      console.log(
        `  ${statusBadge(c.statusChange)} ${chalk.dim(c.caseId.padEnd(20))} ${c.previousScore} → ${c.currentScore}  ${signedInt(c.scoreChange)}`,
      );
      if (c.metricDeltas.length > 0) {
        for (const m of c.metricDeltas) {
          if (m.change === 0) continue;
          console.log(
            `    ${chalk.dim(m.metricId.padEnd(20))} ${m.previousScore} → ${m.currentScore}  ${signedInt(m.change)}`,
          );
        }
      }
    }
  }

  if (delta.newCases.length > 0 || delta.removedCases.length > 0) {
    console.log(divider);
    console.log(chalk.bold('DATASET CHANGES'));
    if (delta.newCases.length > 0) {
      console.log(`  ${chalk.green('+')} new:     ${delta.newCases.join(', ')}`);
    }
    if (delta.removedCases.length > 0) {
      console.log(`  ${chalk.red('-')} removed: ${delta.removedCases.join(', ')}`);
    }
  }

  console.log(divider);
  console.log();
}

function statusBadge(status: CaseStatusChange): string {
  switch (status) {
    case 'newly-passing':
      return chalk.green('↑ newly passing ');
    case 'newly-failing':
      return chalk.red('↓ newly failing ');
    case 'still-passing':
      return chalk.dim('✓ still passing ');
    case 'still-failing':
      return chalk.yellow('✗ still failing ');
  }
}

function signedInt(n: number): string {
  if (n === 0) return chalk.dim('±0');
  return n > 0 ? chalk.green(`+${n}`) : chalk.red(`${n}`);
}

function signedPoints(n: number): string {
  if (n === 0) return chalk.dim('±0');
  const formatted = n.toFixed(1).replace(/\.0$/, '');
  return n > 0 ? chalk.green(`+${formatted}`) : chalk.red(`${formatted}`);
}

