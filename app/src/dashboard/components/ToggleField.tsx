interface ToggleFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleField({ label, description, value, onChange }: ToggleFieldProps) {
  return (
    <label className="toggle-field">
      <div className="toggle-field__body">
        <span className="toggle-field__label">{label}</span>
        {description && <span className="toggle-field__desc">{description}</span>}
      </div>
      <input
        type="checkbox"
        className="toggle-field__input"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        role="switch"
      />
      <span className="toggle-field__visual" aria-hidden="true" />
    </label>
  );
}
