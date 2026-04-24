import { Mediator } from '../../domain/contract/kernel/Mediator.js';
import type { EvaluationHistoryStore } from '../../domain/contract/ports/EvaluationHistoryStore.js';
import type { EvaluationHistorySnapshot } from '../../domain/contract/EvaluationHistorySnapshot.js';
import type { ProjectHistorySnapshot } from '../../domain/contract/ProjectHistorySnapshot.js';
import { Container } from './Container.js';
import { applyEvaluationModule } from './modules/EvaluationModule.js';
import { applySkillEvaluationModule } from './modules/SkillEvaluationModule.js';
import {
  applyProductionProfile,
  type JudgeMode,
  type ProductionProfileOptions,
} from './profiles/ProductionProfile.js';
import { applyTestProfile } from './profiles/TestProfile.js';
import {
  EvaluateProjectHandlerToken,
  EvaluateSkillHandlerToken,
  ProjectHistoryStoreToken,
  SkillHistoryStoreToken,
} from './tokens.js';

/** CLI options for the `evaluate` command. */
export interface EvaluateProjectBootstrapOptions {
  readonly judge: JudgeMode;
  readonly historyDir: string;
  readonly history: boolean;
}

/** CLI options for the `evaluate-skill` command. */
export interface EvaluateSkillBootstrapOptions {
  readonly judge: JudgeMode;
  readonly historyDir: string;
  readonly history: boolean;
  readonly workspace: boolean;
  readonly keepWorkspace: boolean;
}

/** The bits the CLI needs to run the `evaluate` command. */
export interface EvaluateProjectBootstrap {
  readonly mediator: Mediator;
  readonly history: EvaluationHistoryStore<ProjectHistorySnapshot> | null;
}

/** The bits the CLI needs to run the `evaluate-skill` command. */
export interface EvaluateSkillBootstrap {
  readonly mediator: Mediator;
  readonly history: EvaluationHistoryStore<EvaluationHistorySnapshot> | null;
}

/**
 * Wires a container for the `evaluate` command and exposes a ready-to-use
 * Mediator plus the history store (or `null` when `--no-history` is set).
 */
export function bootstrapEvaluateProject(
  options: EvaluateProjectBootstrapOptions,
): EvaluateProjectBootstrap {
  const container = buildProductionContainer({
    judge: options.judge,
    historyDir: options.historyDir,
  });
  const mediator = new Mediator([container.resolve(EvaluateProjectHandlerToken)]);
  const history = options.history ? container.resolve(ProjectHistoryStoreToken) : null;
  return { mediator, history };
}

/**
 * Wires a container for the `evaluate-skill` command. `workspace: true`
 * enables the artifact-capturing agent runner; otherwise the handler runs
 * in text-only mode.
 */
export function bootstrapEvaluateSkill(
  options: EvaluateSkillBootstrapOptions,
): EvaluateSkillBootstrap {
  const container = buildProductionContainer({
    judge: options.judge,
    historyDir: options.historyDir,
    enableWorkspace: options.workspace,
    keepWorkspace: options.keepWorkspace,
  });
  const mediator = new Mediator([container.resolve(EvaluateSkillHandlerToken)]);
  const history = options.history ? container.resolve(SkillHistoryStoreToken) : null;
  return { mediator, history };
}

function buildProductionContainer(options: ProductionProfileOptions): Container {
  const container = new Container();
  applyProductionProfile(container, options);
  applyEvaluationModule(container);
  applySkillEvaluationModule(container);
  return container;
}

/**
 * Builds a container with the test profile + both domain modules applied.
 * Tests call `rebind*` on the returned container to inject scenario-specific
 * adapters before resolving the handler they need.
 */
export function buildTestContainer(): Container {
  const container = new Container();
  applyTestProfile(container);
  applyEvaluationModule(container);
  applySkillEvaluationModule(container);
  return container;
}
