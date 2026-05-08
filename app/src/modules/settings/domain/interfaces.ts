import type { Settings } from './types';

export interface SettingsRepo {
  get(): Promise<Settings>;
  update(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings>;
}
