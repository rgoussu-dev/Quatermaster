/**
 * A lightweight, serialisable snapshot of the target project's content.
 * Sent to the LLM judge as context. Contains only text artefacts relevant
 * to agentic readiness — no secrets, no large binaries.
 */
export interface ProjectSnapshot {
  readonly projectPath: string;
  /** Content of CLAUDE.md at project root, or null if absent. */
  readonly claudeMd: string | null;
  /** Content of top-level README.md, or null if absent. */
  readonly readmeMd: string | null;
  /** Compact directory tree listing, depth-limited to 4 levels, max 200 lines. */
  readonly directoryTree: string;
  /** Test file paths relative to the project root, capped at 50. */
  readonly testFilePaths: readonly string[];
  /** Sampled test file content (first 5 files, first 100 lines each). */
  readonly testFileSamples: readonly { path: string; content: string }[];
  /** Paths of files under .claude/ (settings, hooks, skills, etc.). */
  readonly claudeConfigPaths: readonly string[];
  /** Content of .claude/settings.json, or null if absent. */
  readonly claudeSettingsJson: string | null;
  /** Source file paths relative to root, capped at 100. */
  readonly sourceFilePaths: readonly string[];
  /** Sampled source file content (first 5 files under src/ or lib/, first 100 lines each). */
  readonly sourceFileSamples: readonly { path: string; content: string }[];
  /** True if a lockfile exists (package-lock.json, Cargo.lock, poetry.lock, etc.). */
  readonly hasLockfile: boolean;
  /** Paths of CI config files (.github/workflows/, .gitlab-ci.yml, etc.). */
  readonly ciConfigPaths: readonly string[];
}
