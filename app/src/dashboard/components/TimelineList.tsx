import { useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import type { NoteEntry } from '@/modules/note/domain/types';

interface TimelineListProps {
  entries: NoteEntry[];
  activeTag: string | null;
  onTagClick: (tag: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function extractTags(text: string): string[] {
  return Array.from(text.matchAll(/(#\p{L}[\p{L}\p{N}_]*)/gu), (m) => m[0]);
}

function renderTextWithTags(
  text: string,
  activeTag: string | null,
  onTagClick: (tag: string) => void,
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(/(#\p{L}[\p{L}\p{N}_]*)/gu)) {
    if (match.index! > last) parts.push(text.slice(last, match.index));
    const tag = match[0];
    parts.push(
      <button
        key={match.index}
        className={`timeline__hashtag${activeTag === tag ? ' timeline__hashtag--active' : ''}`}
        onClick={() => onTagClick(tag)}
        title={activeTag === tag ? 'Quitar filtro' : `Filtrar por ${tag}`}
      >
        {tag}
      </button>
    );
    last = match.index! + tag.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

interface TimelineItemProps {
  entry: NoteEntry;
  activeTag: string | null;
  onTagClick: (tag: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

function TimelineItem({ entry, activeTag, onTagClick, onUpdate, onDelete }: TimelineItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(entry.text);

  function startEdit() {
    setEditValue(entry.text);
    setEditing(true);
  }

  function saveEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== entry.text) onUpdate(entry.id, trimmed);
    setEditing(false);
  }

  function cancelEdit() {
    setEditValue(entry.text);
    setEditing(false);
  }

  return (
    <div className="timeline__item">
      <span className="timeline__time">{formatTime(entry.at)}</span>
      <span className={`timeline__tag timeline__tag--${entry.kind}`}>
        {entry.kind === 'auto' ? 'auto' : 'nota'}
      </span>
      {editing ? (
        <input
          className="timeline__edit-field"
          value={editValue}
          maxLength={1000}
          autoFocus
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
          onBlur={saveEdit}
        />
      ) : (
        <span className="timeline__text">
          {renderTextWithTags(entry.text, activeTag, onTagClick)}
        </span>
      )}
      <div className="timeline__actions">
        {entry.kind === 'user' && !editing && (
          <button className="timeline__action-btn" onClick={startEdit} aria-label="Editar nota">
            <Pencil size={13} />
          </button>
        )}
        <button
          className="timeline__action-btn timeline__action-btn--delete"
          onClick={() => onDelete(entry.id)}
          aria-label="Eliminar nota"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export function TimelineList({ entries, activeTag, onTagClick, onUpdate, onDelete }: TimelineListProps) {
  const sorted = [...entries].sort((a, b) => a.at - b.at);
  const displayed = activeTag
    ? sorted.filter((n) => extractTags(n.text).includes(activeTag))
    : sorted;

  return (
    <div>
      {activeTag && (
        <div className="timeline__filter">
          <span>Filtrando por</span>
          <button className="timeline__filter-chip" onClick={() => onTagClick(activeTag)}>
            {activeTag}
            <X size={11} />
          </button>
        </div>
      )}
      {displayed.length === 0 ? (
        <p className="timeline-empty">
          {activeTag ? `Sin notas con ${activeTag}.` : 'Aún no hay registros de hoy.'}
        </p>
      ) : (
        <div className="timeline">
          {displayed.map((entry) => (
            <TimelineItem
              key={entry.id}
              entry={entry}
              activeTag={activeTag}
              onTagClick={onTagClick}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
