import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { sendMessage } from '@/shared/messages';
import { dayKey } from '@/shared/time';
import type { NoteEntry } from '@/modules/note/domain/types';
import { useDashStore } from '../store';
import { QuickNoteInput } from '../components/QuickNoteInput';
import { TimelineList } from '../components/TimelineList';

export const TodayView = forwardRef<{ focusInput: () => void }>(function TodayView(_props, ref) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const today = dayKey(Date.now());
  const pushToast = useDashStore((s) => s.pushToast);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => inputRef.current?.focus(),
  }));

  const fetchNotes = useCallback(async () => {
    try {
      const data = await sendMessage<NoteEntry[]>('note:listForDay', { day: today });
      setNotes(data);
    } catch (e) {
      console.error('[FocusFox]', e);
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
    } catch (e) {
      console.error('[FocusFox]', e);
      pushToast({ message: 'No se pudo guardar la nota', kind: 'error' });
    }
  }

  async function handleUpdateNote(id: string, text: string) {
    try {
      const updated = await sendMessage<NoteEntry>('note:update', { id, patch: { text } });
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch (e) {
      console.error('[FocusFox]', e);
      pushToast({ message: 'No se pudo actualizar la nota', kind: 'error' });
    }
  }

  async function handleDeleteNote(id: string) {
    try {
      await sendMessage('note:delete', { id });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setActiveTag((tag) => {
        // clear filter if no remaining notes contain it
        return tag;
      });
    } catch (e) {
      console.error('[FocusFox]', e);
      pushToast({ message: 'No se pudo eliminar la nota', kind: 'error' });
    }
  }

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag));
  }

  return (
    <div className="today-view">
      <QuickNoteInput onSubmit={handleAddNote} ref={inputRef} />
      <TimelineList
        entries={notes}
        activeTag={activeTag}
        onTagClick={handleTagClick}
        onUpdate={handleUpdateNote}
        onDelete={handleDeleteNote}
      />
    </div>
  );
});
