import type { NoteEntry } from '@/modules/note/domain/types';

interface TimelineListProps {
  entries: NoteEntry[];
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TimelineList({ entries }: TimelineListProps) {
  if (entries.length === 0) {
    return <p className="timeline-empty">Aún no hay registros de hoy.</p>;
  }

  const sorted = [...entries].sort((a, b) => a.at - b.at);

  return (
    <div className="timeline">
      {sorted.map((entry) => (
        <div key={entry.id} className="timeline__item">
          <span className="timeline__time">{formatTime(entry.at)}</span>
          <span className={`timeline__tag timeline__tag--${entry.kind}`}>
            {entry.kind === 'auto' ? 'auto' : 'nota'}
          </span>
          <span className="timeline__text">{entry.text}</span>
        </div>
      ))}
    </div>
  );
}
