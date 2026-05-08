import { z } from 'zod';

export const ProjectColorSchema = z.enum(['orange', 'amber', 'green', 'blue', 'purple', 'red']);
export type ProjectColor = z.infer<typeof ProjectColorSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: ProjectColorSchema,
  createdAt: z.number(),
  archived: z.boolean(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  color: ProjectColorSchema,
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
