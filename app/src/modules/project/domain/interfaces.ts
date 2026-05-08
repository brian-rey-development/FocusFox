import type { Project, ProjectColor } from './types';

export interface ProjectRepo {
  list(opts?: { includeArchived?: boolean }): Promise<Project[]>;
  create(input: { name: string; color: ProjectColor }): Promise<Project>;
  update(id: string, patch: Partial<Project>): Promise<Project>;
  archive(id: string): Promise<void>;
  unarchive(id: string): Promise<void>;
}
