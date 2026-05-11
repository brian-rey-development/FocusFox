interface SettingsSectionProps {
  title: string;
  saved?: boolean;
  children: React.ReactNode;
}

export function SettingsSection({ title, saved, children }: SettingsSectionProps) {
  return (
    <section className="settings-section">
      <div className="settings-section__header">
        <h2 className="settings-section__title">{title}</h2>
        {saved && <span className="settings-section__saved">Guardado</span>}
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}
