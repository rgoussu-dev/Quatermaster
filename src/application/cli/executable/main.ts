import { program } from 'commander';
import { join, resolve } from 'node:path';
import { EvaluateProject } from '../../../domain/core/evaluation/EvaluateProject.js';
import { toProjectHistorySnapshot } from '../../../domain/core/evaluation/toProjectHistorySnapshot.js';
import { computeProjectEvaluationDelta } from '../../../domain/core/evaluation/computeProjectEvaluationDelta.js';
import { EvaluateSkill } from '../../../domain/core/skill-evaluation/EvaluateSkill.js';
import { toHistorySnapshot } from '../../../domain/core/skill-evaluation/toHistorySnapshot.js';
import { computeEvaluationDelta } from '../../../domain/core/skill-evaluation/computeEvaluationDelta.js';
import {
  projectHistoryKey,
  skillHistoryKey,
} from '../../../infrastructure/history-store/real/FileSystemEvaluationHistoryStore.js';
import {
  bootstrapEvaluateProject,
  bootstrapEvaluateSkill,
  ConfigurationError,
  type EvaluateProjectBootstrap,
  type EvaluateSkillBootstrap,
  type JudgeMode,
} from '../../configurator/index.js';
import {
  printReport,
  printSkillReport,
  printSkillDelta,
  printProjectDelta,
  printError,
} from './reporter.js';

program
  .name('quatermaster')
  .description("Evaluates a project's agentic coding readiness.")
  .version('0.1.0');

program
  .command('evaluate <path>')
  .description("Evaluate a project's agentic coding readiness and print a scored report.")
  .option(
    '--judge <mode>',
    'LLM judge backend: "claude-cli" (uses local claude CLI, no API key needed) or "api" (uses ANTHROPIC_API_KEY)',
    'claude-cli',
  )
  .option(
    '--history-dir <path>',
    'Directory for persisted evaluation snapshots. Defaults to <cwd>/.quatermaster/history.',
  )
  .option('--no-history', 'Skip loading and writing the per-run history snapshot.')
  .action(
    async (targetPath: string, opts: { judge: string; history: boolean; historyDir?: string }) => {
      const projectPath = resolve(targetPath);
      const bootstrap = runBootstrap(() =>
        bootstrapEvaluateProject({
          judge: parseJudgeMode(opts.judge),
          historyDir: opts.historyDir ?? join(process.cwd(), '.quatermaster', 'history'),
          history: opts.history,
        }),
      );
      const { mediator, history } = bootstrap;

      const key = projectHistoryKey(projectPath);
      const previous = history ? await history.loadLatest(key) : null;

      const result = await mediator.dispatch(new EvaluateProject(projectPath));

      if (!result.ok) {
        printError(result.error);
        process.exit(1);
      }

      printReport(result.value);

      const current = toProjectHistorySnapshot(result.value);
      if (previous) {
        printProjectDelta(computeProjectEvaluationDelta(previous, current));
      }
      if (history) {
        await history.save(key, current);
      }
    },
  );

program
  .command('evaluate-skill <skill-path>')
  .description('Run a skill against a dataset and validate outputs with an LLM judge.')
  .requiredOption('--dataset <path>', 'Path to the JSON dataset file.')
  .option(
    '--judge <mode>',
    'LLM judge backend: "claude-cli" (uses local claude CLI, no API key needed) or "api" (uses ANTHROPIC_API_KEY)',
    'claude-cli',
  )
  .option(
    '--workspace',
    'Run each case in an isolated tmp workspace and score filesystem artifacts in addition to stdout.',
    false,
  )
  .option(
    '--keep-workspace',
    'Leave the tmp workspace on disk after each run for post-mortem inspection (debugging only).',
    false,
  )
  .option(
    '--history-dir <path>',
    'Directory for persisted evaluation snapshots. Defaults to <cwd>/.quatermaster/history.',
  )
  .option('--no-history', 'Skip loading and writing the per-run history snapshot.')
  .action(
    async (
      skillPath: string,
      opts: {
        dataset: string;
        judge: string;
        workspace: boolean;
        keepWorkspace: boolean;
        history: boolean;
        historyDir?: string;
      },
    ) => {
      const resolvedSkillPath = resolve(skillPath);
      const resolvedDatasetPath = resolve(opts.dataset);
      const bootstrap = runBootstrap(() =>
        bootstrapEvaluateSkill({
          judge: parseJudgeMode(opts.judge),
          historyDir: opts.historyDir ?? join(process.cwd(), '.quatermaster', 'history'),
          history: opts.history,
          workspace: opts.workspace,
          keepWorkspace: opts.keepWorkspace,
        }),
      );
      const { mediator, history } = bootstrap;

      const key = skillHistoryKey(resolvedSkillPath, resolvedDatasetPath);
      const previous = history ? await history.loadLatest(key) : null;

      const result = await mediator.dispatch(
        new EvaluateSkill(resolvedSkillPath, resolvedDatasetPath),
      );

      if (!result.ok) {
        printError(result.error);
        process.exit(1);
      }

      printSkillReport(result.value);

      const current = toHistorySnapshot(result.value);
      if (previous) {
        printSkillDelta(computeEvaluationDelta(previous, current));
      }
      if (history) {
        await history.save(key, current);
      }
    },
  );

program.parse();

function parseJudgeMode(mode: string): JudgeMode {
  if (mode === 'api' || mode === 'claude-cli') return mode;
  console.error(`Error: unknown --judge mode "${mode}". Use "claude-cli" or "api".`);
  process.exit(1);
}

/**
 * Runs a bootstrap call and turns any `ConfigurationError` into a clean
 * non-zero exit with the user-facing message. Other errors bubble up so
 * genuine programming bugs still produce a stack trace.
 */
function runBootstrap<T extends EvaluateProjectBootstrap | EvaluateSkillBootstrap>(
  bootstrap: () => T,
): T {
  try {
    return bootstrap();
  } catch (err) {
    if (err instanceof ConfigurationError) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}
