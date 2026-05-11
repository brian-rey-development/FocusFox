import { X } from 'lucide-react';

interface DomainListProps {
  domains: string[];
  onChange: (updated: string[]) => void;
}

export function DomainList({ domains, onChange }: DomainListProps) {
  if (domains.length === 0) {
    return <p className="domain-list__empty">Si dejás la lista vacía, vas a bloquear todo cuando estés en foco.</p>;
  }

  return (
    <div className="domain-list">
      {domains.map((d) => (
        <div key={d} className="domain-list__row">
          <span className="domain-list__domain">{d}</span>
          <button
            className="domain-list__remove"
            onClick={() => onChange(domains.filter((x) => x !== d))}
            aria-label={`Eliminar ${d}`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
