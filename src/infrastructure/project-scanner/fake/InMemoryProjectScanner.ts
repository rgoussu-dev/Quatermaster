import type { ProjectScanner } from '../../../domain/contract/ports/ProjectScanner.js';
import type { ProjectSnapshot } from '../../../domain/contract/ProjectSnapshot.js';

/**
 * Fake implementation of ProjectScanner.
 * Returns a preset snapshot — the canonical reference implementation for tests.
 */
export class InMemoryProjectScanner implements ProjectScanner {
  constructor(private readonly snapshot: ProjectSnapshot) {}

  async scan(_projectPath: string): Promise<ProjectSnapshot> {
    return this.snapshot;
  }
}
