import chalk, { type ChalkInstance } from 'chalk';
import type { EvaluationResult } from '../../../domain/contract/EvaluationResult.js';
import type { SkillEvaluationResult } from '../../../domain/contract/SkillEvaluationResult.js';
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
    console.log(`  ${icon}  ${scoreStr.padEnd(8)}  ${chalk.dim(c.id.padEnd(16))}  ${prompt}`);
  }

  const failed = result.cases.filter((c) => !c.passed);
  if (failed.length > 0) {
    console.log();
    console.log(divider);
    console.log(chalk.bold('FAILED CASES'));
    for (const c of failed) {
      console.log();
      console.log(`  ${chalk.red.bold(c.id)}  ${c.score}/100`);
      for (const obs of c.observations) {
        console.log(`    ${chalk.dim('•')} ${obs}`);
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
