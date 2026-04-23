import type { SkillCase } from '../SkillCase.js';

/** Dataset loaded from a file or in-memory source. */
export interface SkillDataset {
  readonly cases: readonly SkillCase[];
}

/**
 * Secondary port — loads a skill evaluation dataset from a given path.
 *
 * Adapters: FileSystemDatasetLoader (real), InMemoryDatasetLoader (fake/test).
 */
export interface DatasetLoader {
  /**
   * Loads the dataset at `datasetPath`.
   *
   * @param datasetPath Absolute path to the JSON dataset file.
   * @throws {Error} when the file is missing or its content is invalid.
   */
  load(datasetPath: string): Promise<SkillDataset>;
}
