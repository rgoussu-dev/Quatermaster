import { program } from 'commander';
import Anthropic from '@anthropic-ai/sdk';
import { join, resolve } from 'node:path';
import { Mediator } from '../../../domain/contract/kernel/Mediator.js';
import { EvaluateProject } from '../../../domain/core/evaluation/EvaluateProject.js';
import { EvaluateProjectHandler } from '../../../domain/core/evaluation/EvaluateProjectHandler.js';
import { toProjectHistorySnapshot } from '../../../domain/core/evaluation/toProjectHistorySnapshot.js';
import { computeProjectEvaluationDelta } from '../../../domain/core/evaluation/computeProjectEvaluationDelta.js';
import { EvaluateSkill } from '../../../domain/core/skill-evaluation/EvaluateSkill.js';
import { EvaluateSkillHandler } from '../../../domain/core/skill-evaluation/EvaluateSkillHandler.js';
import { toHistorySnapshot } from '../../../domain/core/skill-evaluation/toHistorySnapshot.js';
import { computeEvaluationDelta } from '../../../domain/core/skill-evaluation/computeEvaluationDelta.js';
import { FileSystemScanner } from '../../../infrastructure/project-scanner/real/FileSystemScanner.js';
import { AnthropicLLMJudge } from '../../../infrastructure/llm-judge/real/AnthropicLLMJudge.js';
import { ClaudeCodeJudge } from '../../../infrastructure/llm-judge/claude-cli/ClaudeCodeJudge.js';
import { ClaudeCodeSkillRunner } from '../../../infrastructure/skill-runner/real/ClaudeCodeSkillRunner.js';
import { FileSystemAgentRunWorkspace } from '../../../infrastructure/agent-workspace/real/FileSystemAgentRunWorkspace.js';
import { FileSystemDatasetLoader } from '../../../infrastructure/dataset-loader/real/FileSystemDatasetLoader.js';
import {
  FileSystemEvaluationHistoryStore,
  projectHistoryKey,
  skillHistoryKey,
} from '../../../infrastructure/history-store/real/FileSystemEvaluationHistoryStore.js';
import { ClaudeCodeSkillJudge } from '../../../infrastructure/skill-judge/claude-cli/ClaudeCodeSkillJudge.js';
import { AnthropicSkillJudge } from '../../../infrastructure/skill-judge/real/AnthropicSkillJudge.js';
import type { EvaluationHistorySnapshot } from '../../../domain/contract/EvaluationHistorySnapshot.js';
import type { ProjectHistorySnapshot } from '../../../domain/contract/ProjectHistorySnapshot.js';
import type { LLMJudge } from '../../../domain/contract/ports/LLMJudge.js';
import type { SkillJudge } from '../../../domain/contract/ports/SkillJudge.js';
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
    async (
      targetPath: string,
      opts: { judge: string; history: boolean; historyDir?: string },
    ) => {
      const judge = buildJudge(opts.judge);
      const projectPath = resolve(targetPath);
      const scanner = new FileSystemScanner();
      const handler = new EvaluateProjectHandler(scanner, judge);
      const mediator = new Mediator([handler]);

      const historyStore = opts.history
        ? new FileSystemEvaluationHistoryStore<ProjectHistorySnapshot>(
            opts.historyDir ?? join(process.cwd(), '.quatermaster', 'history'),
          )
        : null;
      const key = projectHistoryKey(projectPath);
      const previous = historyStore ? await historyStore.loadLatest(key) : null;

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
      if (historyStore) {
        await historyStore.save(key, current);
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
        history: boolean;
        historyDir?: string;
      },
    ) => {
      const resolvedSkillPath = resolve(skillPath);
      const resolvedDatasetPath = resolve(opts.dataset);
      const skillJudge = buildSkillJudge(opts.judge);
      const runner = new ClaudeCodeSkillRunner();
      const loader = new FileSystemDatasetLoader();
      const workspace = opts.workspace ? new FileSystemAgentRunWorkspace() : undefined;
      const handler = new EvaluateSkillHandler(runner, loader, skillJudge, workspace);
      const mediator = new Mediator([handler]);

      const historyStore = opts.history
        ? new FileSystemEvaluationHistoryStore<EvaluationHistorySnapshot>(
            opts.historyDir ?? join(process.cwd(), '.quatermaster', 'history'),
          )
        : null;
      const key = skillHistoryKey(resolvedSkillPath, resolvedDatasetPath);
      const previous = historyStore ? await historyStore.loadLatest(key) : null;

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
      if (historyStore) {
        await historyStore.save(key, current);
      }
    },
  );

program.parse();

function buildSkillJudge(mode: string): SkillJudge {
  if (mode === 'api') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      console.error('Error: --judge api requires ANTHROPIC_API_KEY to be set.');
      process.exit(1);
    }
    return new AnthropicSkillJudge(new Anthropic({ apiKey }));
  }
  if (mode === 'claude-cli') {
    return new ClaudeCodeSkillJudge();
  }
  console.error(`Error: unknown --judge mode "${mode}". Use "claude-cli" or "api".`);
  process.exit(1);
}

function buildJudge(mode: string): LLMJudge {
  if (mode === 'api') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      console.error('Error: --judge api requires ANTHROPIC_API_KEY to be set.');
      process.exit(1);
    }
    return new AnthropicLLMJudge(new Anthropic({ apiKey }));
  }
  if (mode === 'claude-cli') {
    return new ClaudeCodeJudge();
  }
  console.error(`Error: unknown --judge mode "${mode}". Use "claude-cli" or "api".`);
  process.exit(1);
}
