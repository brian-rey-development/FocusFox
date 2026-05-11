import { z } from 'zod';

export const PROJECT_COLORS = [
  'orange',
  'amber',
  'green',
  'blue',
  'purple',
  'red',
] as const;

export const ProjectColorSchema = z.enum(PROJECT_COLORS);
export type ProjectColor = z.infer<typeof ProjectColorSchema>;

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = {
  orange: '#ff6a00',
  amber: '#f5b82e',
  green: '#23b26b',
  blue: '#2f7df6',
  purple: '#8b5cf6',
  red: '#ef4444',
};

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
