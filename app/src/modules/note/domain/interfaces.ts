import type { NoteEntry, NoteEntryKind, NoteEntryRefType } from './types';

export interface NoteRepo {
  add(input: {
    day: string;
    kind: NoteEntryKind;
    text: string;
    refType?: NoteEntryRefType;
    refId?: string;
  }): Promise<NoteEntry>;
  listForDay(day: string): Promise<NoteEntry[]>;
  get(id: string): Promise<NoteEntry | undefined>;
  update(id: string, patch: { text: string }): Promise<NoteEntry>;
  delete(id: string): Promise<void>;
}
