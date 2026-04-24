import { readFile, access, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
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

    const [
      claudeMd,
      altClaudeMd,
      readmeMd,
      contributingRoot,
      contributingDocs,
      agentsMd,
      claudeSettingsJson,
      directoryTree,
    ] = await Promise.all([
      readOptional(join(projectPath, 'CLAUDE.md')),
      readOptional(join(projectPath, '.claude', 'CLAUDE.md')),
      readOptional(join(projectPath, 'README.md')),
      readOptional(join(projectPath, 'CONTRIBUTING.md')),
      readOptional(join(projectPath, 'docs', 'CONTRIBUTING.md')),
      readOptional(join(projectPath, 'AGENTS.md')),
      readOptional(join(projectPath, '.claude', 'settings.json')),
      generateTree(projectPath),
    ]);

    const resolvedClaudeMd = claudeMd ?? altClaudeMd;
    const claudeMdSourcePath = claudeMd !== null ? 'CLAUDE.md' : '.claude/CLAUDE.md';
    const contributingMd = contributingRoot ?? contributingDocs;
    const contributingSourcePath =
      contributingRoot !== null ? 'CONTRIBUTING.md' : 'docs/CONTRIBUTING.md';

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

    const exportedSymbolDocCoverage = await computeExportedDocCoverage(
      projectPath,
      sourceFilePaths,
    );

    const brokenDocLinks = await computeBrokenDocLinks(projectPath, [
      { source: 'README.md', content: readmeMd },
      { source: claudeMdSourcePath, content: resolvedClaudeMd },
      { source: 'AGENTS.md', content: agentsMd },
      { source: contributingSourcePath, content: contributingMd },
    ]);

    return {
      projectPath,
      claudeMd: resolvedClaudeMd,
      readmeMd,
      contributingMd,
      agentsMd,
      directoryTree,
      testFilePaths,
      testFileSamples,
      claudeConfigPaths,
      claudeSettingsJson,
      sourceFilePaths,
      sourceFileSamples,
      exportedSymbolDocCoverage,
      brokenDocLinks,
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

const EXPORT_RE =
  /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:class|interface|type|enum|function|const|let|var)\s+[A-Za-z_$]/;

const TSDOC_CLOSE_RE = /\*\/\s*$/;

async function computeExportedDocCoverage(
  projectPath: string,
  sourceFilePaths: readonly string[],
): Promise<{ documented: number; total: number } | null> {
  const tsFiles = sourceFilePaths.filter(
    (p) => (p.startsWith('src/') || p.startsWith('lib/')) && /\.ts$/.test(p) && !/\.d\.ts$/.test(p),
  );
  if (tsFiles.length === 0) return null;

  let documented = 0;
  let total = 0;

  for (const rel of tsFiles) {
    const content = await readOptional(join(projectPath, rel));
    if (content === null) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined || !EXPORT_RE.test(line)) continue;
      total += 1;
      // Walk backwards over blank lines and decorators to find a TSDoc close.
      let j = i - 1;
      while (j >= 0) {
        const prev = lines[j];
        if (prev === undefined) break;
        const trimmed = prev.trim();
        if (trimmed === '' || trimmed.startsWith('@')) {
          j -= 1;
          continue;
        }
        if (TSDOC_CLOSE_RE.test(prev)) documented += 1;
        break;
      }
    }
  }

  return { documented, total };
}

const MD_LINK_PATTERN = '(!?)\\[([^\\]]*)\\]\\(([^)]+)\\)';

async function computeBrokenDocLinks(
  projectPath: string,
  docs: readonly { source: string; content: string | null }[],
): Promise<{ source: string; target: string }[]> {
  const broken: { source: string; target: string }[] = [];
  const linkRe = new RegExp(MD_LINK_PATTERN, 'g');
  for (const { source, content } of docs) {
    if (content === null) continue;
    const baseDir = dirname(source);
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    linkRe.lastIndex = 0;
    while ((match = linkRe.exec(content)) !== null) {
      const rawTarget = match[3];
      if (rawTarget === undefined) continue;
      const target = rawTarget.trim();
      if (target === '' || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
      const withoutFragment = target.split('#')[0];
      if (withoutFragment === undefined || withoutFragment === '') continue;
      if (seen.has(withoutFragment)) continue;
      seen.add(withoutFragment);
      const resolved = withoutFragment.startsWith('/')
        ? join(projectPath, withoutFragment)
        : join(projectPath, baseDir, withoutFragment);
      try {
        await access(resolved);
      } catch {
        broken.push({ source, target: withoutFragment });
      }
    }
  }
  return broken;
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
