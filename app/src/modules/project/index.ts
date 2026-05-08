export type { Project, ProjectColor, CreateProjectInput, UpdateProjectInput } from './domain/types';
export { ProjectSchema, CreateProjectSchema, UpdateProjectSchema, ProjectColorSchema } from './domain/types';
export type { ProjectRepo } from './domain/interfaces';
export { projectStore } from './infrastructure/model';
export { createProjectRepo } from './infrastructure/repository';
export type { ProjectService } from './service';
export { createProjectService } from './service';
export { createProjectHandlers } from './handler';
