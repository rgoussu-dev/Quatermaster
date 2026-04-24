import { InMemoryDatasetLoader } from '../../../infrastructure/dataset-loader/fake/InMemoryDatasetLoader.js';
import { InMemoryEvaluationHistoryStore } from '../../../infrastructure/history-store/fake/InMemoryEvaluationHistoryStore.js';
import { StubLLMJudge } from '../../../infrastructure/llm-judge/fake/StubLLMJudge.js';
import { InMemoryProjectScanner } from '../../../infrastructure/project-scanner/fake/InMemoryProjectScanner.js';
import { StubSkillJudge } from '../../../infrastructure/skill-judge/fake/StubSkillJudge.js';
import { InMemorySkillRunner } from '../../../infrastructure/skill-runner/fake/InMemorySkillRunner.js';
import type { ProjectSnapshot } from '../../../domain/contract/ProjectSnapshot.js';
import type { Container } from '../Container.js';
import {
  DatasetLoaderToken,
  LLMJudgeToken,
  ProjectHistoryStoreToken,
  ProjectScannerToken,
  SkillHistoryStoreToken,
  SkillJudgeToken,
  SkillRunnerToken,
} from '../tokens.js';

/** Minimal snapshot the `InMemoryProjectScanner` needs when no seed is supplied. */
const EMPTY_SNAPSHOT: ProjectSnapshot = {
  projectPath: '',
  claudeMd: null,
  readmeMd: null,
  directoryTree: '',
  testFilePaths: [],
  testFileSamples: [],
  claudeConfigPaths: [],
  claudeSettingsJson: null,
  sourceFilePaths: [],
  sourceFileSamples: [],
  hasLockfile: false,
  ciConfigPaths: [],
};

/**
 * Binds fakes for the standard test ports. The optional `AgentRunWorkspaceToken`
 * is intentionally left unbound — tests that exercise the workspace-backed
 * skill path bind it themselves via `rebind` so the handler picks it up
 * through `Container.tryResolve`. Tests `rebind*` the other ports as needed
 * (e.g. preload the scanner with a curated snapshot or swap in a routing judge).
 */
export function applyTestProfile(container: Container): void {
  container.bind(ProjectScannerToken, () => new InMemoryProjectScanner(EMPTY_SNAPSHOT));
  container.bind(LLMJudgeToken, () => new StubLLMJudge());
  container.bind(SkillRunnerToken, () => new InMemorySkillRunner());
  container.bind(DatasetLoaderToken, () => new InMemoryDatasetLoader(new Map()));
  container.bind(SkillJudgeToken, () => new StubSkillJudge());
  container.bind(ProjectHistoryStoreToken, () => new InMemoryEvaluationHistoryStore());
  container.bind(SkillHistoryStoreToken, () => new InMemoryEvaluationHistoryStore());
}
