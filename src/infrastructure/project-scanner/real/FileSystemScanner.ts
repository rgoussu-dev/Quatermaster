import { readFile, access, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { glob } from 'glob';
import type { ProjectScanner } from '../../../domain/contract/ports/ProjectScanner.js';
import type { ProjectSnapshot } from '../../../domain/contract/ProjectSnapshot.js';

const IGNORED = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'target',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  'coverage',
]);

const LOCKFILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'go.sum',
  'Gemfile.lock',
];

const CI_PATTERNS = [
  '.github/workflows',
  '.gitlab-ci.yml',
  '.circleci/config.yml',
  'Jenkinsfile',
  '.travis.yml',
  'azure-pipelines.yml',
  'Makefile',
];

const TEST_GLOBS = [
  '**/*.test.ts',
  '**/*.test.js',
  '**/*.spec.ts',
  '**/*.spec.js',
  '**/test_*.py',
  '**/*_test.py',
  '**/Test*.java',
  '**/*Test.java',
];

const SOURCE_GLOBS = [
  'src/**/*.ts',
  'src/**/*.js',
  'lib/**/*.ts',
  'lib/**/*.js',
  '*.config.ts',
  '*.config.js',
  '*.config.mjs',
  '*.config.cjs',
  '.mocharc',
  '.mocharc.*',
  'pytest.ini',
  'pyproject.toml',
];

async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function generateTree(rootPath: string, maxDepth = 4, maxLines = 200): Promise<string> {
  const lines: string[] = [];

  async function walk(dir: string, depth: number, prefix: string): Promise<void> {
    if (depth >= maxDepth || lines.length >= maxLines) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const filtered = entries.filter((e) => !IGNORED.has(e.name));
    filtered.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of filtered) {
      if (lines.length >= maxLines) {
        lines.push('[tree truncated]');
        return;
      }
      lines.push(`${prefix}${entry.name}${entry.isDirectory() ? '/' : ''}`);
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), depth + 1, prefix + '  ');
      }
    }
  }

  await walk(rootPath, 0, '');
  return lines.join('\n');
}

/** Real adapter — reads from the local filesystem. */
export class FileSystemScanner implements ProjectScanner {
  async scan(projectPath: string): Promise<ProjectSnapshot> {
    await access(projectPath);

    const [claudeMd, altClaudeMd, readmeMd, claudeSettingsJson, directoryTree] = await Promise.all([
      readOptional(join(projectPath, 'CLAUDE.md')),
      readOptional(join(projectPath, '.claude', 'CLAUDE.md')),
      readOptional(join(projectPath, 'README.md')),
      readOptional(join(projectPath, '.claude', 'settings.json')),
      generateTree(projectPath),
    ]);

    const resolvedClaudeMd = claudeMd ?? altClaudeMd;

    const testFilePaths = (
      await glob(TEST_GLOBS, { cwd: projectPath, ignore: ['node_modules/**'] })
    )
      .slice(0, 50)
      .map((p) => p.replace(/\\/g, '/'));

    const testFileSamples = await Promise.all(
      testFilePaths.slice(0, 5).map(async (p) => {
        const content = (await readOptional(join(projectPath, p))) ?? '';
        return { path: p, content: content.split('\n').slice(0, 100).join('\n') };
      }),
    );

    const claudeConfigPaths = await collectClaudeConfigPaths(projectPath);

    const sourceFilePaths = (
      await glob(SOURCE_GLOBS, { cwd: projectPath, ignore: ['node_modules/**', 'dist/**'] })
    )
      .slice(0, 100)
      .map((p) => p.replace(/\\/g, '/'));

    const sourceFileSamples = await Promise.all(
      sourceFilePaths
        .filter((p) => p.startsWith('src/') || p.startsWith('lib/'))
        .slice(0, 5)
        .map(async (p) => {
          const content = (await readOptional(join(projectPath, p))) ?? '';
          return { path: p, content: content.split('\n').slice(0, 100).join('\n') };
        }),
    );

    const hasLockfile = (
      await Promise.all(
        LOCKFILES.map((f) =>
          access(join(projectPath, f))
            .then(() => true)
            .catch(() => false),
        ),
      )
    ).some(Boolean);

    const ciConfigPaths = await collectCIConfigs(projectPath);

    return {
      projectPath,
      claudeMd: resolvedClaudeMd,
      readmeMd,
      directoryTree,
      testFilePaths,
      testFileSamples,
      claudeConfigPaths,
      claudeSettingsJson,
      sourceFilePaths,
      sourceFileSamples,
      hasLockfile,
      ciConfigPaths,
    };
  }
}

async function collectClaudeConfigPaths(projectPath: string): Promise<string[]> {
  const claudeDir = join(projectPath, '.claude');
  const paths: string[] = [];
  try {
    await collectFilesRecursive(claudeDir, projectPath, paths, 3);
  } catch {
    // .claude directory doesn't exist
  }
  return paths;
}

async function collectFilesRecursive(
  dir: string,
  root: string,
  acc: string[],
  maxDepth: number,
): Promise<void> {
  if (maxDepth <= 0) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFilesRecursive(full, root, acc, maxDepth - 1);
    } else {
      acc.push(relative(root, full).replace(/\\/g, '/'));
    }
  }
}

async function collectCIConfigs(projectPath: string): Promise<string[]> {
  const results: string[] = [];
  for (const pattern of CI_PATTERNS) {
    const full = join(projectPath, pattern);
    try {
      const s = await stat(full);
      if (s.isDirectory()) {
        const files = await readdir(full);
        for (const f of files) {
          results.push(join(pattern, f).replace(/\\/g, '/'));
        }
      } else {
        results.push(pattern);
      }
    } catch {
      // not present
    }
  }
  return results;
}
