import type { DatasetLoader, SkillDataset } from '../../../domain/contract/ports/DatasetLoader.js';

/**
 * Fake implementation of DatasetLoader.
 * Returns preset datasets keyed by path — the canonical reference for tests.
 */
export class InMemoryDatasetLoader implements DatasetLoader {
  constructor(private readonly datasets: Map<string, SkillDataset> = new Map()) {}

  async load(datasetPath: string): Promise<SkillDataset> {
    const dataset = this.datasets.get(datasetPath);
    if (!dataset) {
      throw new Error(`dataset not found at path: ${datasetPath}`);
    }
    return dataset;
  }
}
