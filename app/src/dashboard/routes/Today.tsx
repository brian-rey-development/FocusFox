import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { sendMessage } from '@/shared/messages';
import { dayKey } from '@/shared/time';
import type { NoteEntry } from '@/modules/note/domain/types';
import { useDashStore } from '../store';
import { QuickNoteInput } from '../components/QuickNoteInput';
import { TimelineList } from '../components/TimelineList';

export const TodayView = forwardRef<{ focusInput: () => void }>(function TodayView(_props, ref) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const today = dayKey(Date.now());
  const pushToast = useDashStore((s) => s.pushToast);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => inputRef.current?.focus(),
  }));

  const fetchNotes = useCallback(async () => {
    try {
      const data = await sendMessage<NoteEntry[]>('notes:listDay', { day: today });
      setNotes(data);
    } catch {
      pushToast({ message: 'No se pudieron cargar las notas', kind: 'error' });
    }
  }, [today, pushToast]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function handleAddNote(text: string) {
    try {
      const note = await sendMessage<NoteEntry>('note:add', { day: today, kind: 'user', text });
      setNotes((prev) => [note, ...prev]);
    } catch {
      pushToast({ message: 'No se pudo guardar la nota', kind: 'error' });
    }
  }

  return (
    <div className="today-view">
      <QuickNoteInput onSubmit={handleAddNote} ref={inputRef} />
      <TimelineList entries={notes} />
    </div>
  );
});
