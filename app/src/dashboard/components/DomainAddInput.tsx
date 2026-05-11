import { useState } from 'react';
import { normalizeDomain, isValidDomain } from '../domain';

interface DomainAddInputProps {
  onAdd: (domain: string) => void;
  existing: string[];
}

export function DomainAddInput({ onAdd, existing }: DomainAddInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleAdd() {
    const normalized = normalizeDomain(value);

    if (!normalized) {
      setError('Ingresá un dominio válido.');
      return;
    }

    if (!isValidDomain(normalized)) {
      setError('El formato del dominio no es válido.');
      return;
    }

    if (existing.some((d) => d.toLowerCase() === normalized)) {
      setError('Este dominio ya está en la lista.');
      return;
    }

    onAdd(normalized);
    setValue('');
    setError('');
  }

  return (
    <div className="domain-add-input">
      <div className="domain-add-input__row">
        <input
          className="domain-add-input__field"
          type="text"
          placeholder="ej: github.com"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button
          className="domain-add-input__btn"
          onClick={handleAdd}
          disabled={!value.trim()}
        >
          Agregar
        </button>
      </div>
      {error && <p className="domain-add-input__error">{error}</p>}
    </div>
  );
}
