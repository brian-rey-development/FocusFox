import type { NoteEntry } from '@/modules/note/domain/types';

interface TimelineListProps {
  entries: NoteEntry[];
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Matches #tag supporting Unicode letters (i18n-safe)
const HASHTAG_RE = /(#\p{L}[\p{L}\p{N}_]*)/gu;

function renderTextWithTags(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  HASHTAG_RE.lastIndex = 0;

  while ((match = HASHTAG_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(
      <span key={match.index} className="timeline__hashtag">
        {match[0]}
      </span>
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length > 0 ? parts : text;
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
          <span className="timeline__text">{renderTextWithTags(entry.text)}</span>
        </div>
      ))}
    </div>
  );
}
