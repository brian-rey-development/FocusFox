import { useState, useEffect, useCallback, useRef } from 'react';
import { sendMessage } from '@/shared/messages';
import type { Settings } from '@/modules/settings/domain/types';
import { msToMinutes, minutesToMs } from '../domain';
import { SettingsSection } from '../components/SettingsSection';
import { MinuteStepper } from '../components/MinuteStepper';
import { ToggleField } from '../components/ToggleField';
import { DomainList } from '../components/DomainList';
import { DomainAddInput } from '../components/DomainAddInput';
import { DataActions } from '../components/DataActions';

interface FooterMeta {
  version: string;
  schemaVersion: number;
  counts: { projects: number; tasks: number; pomodoros: number };
  lastExportAt: number | null;
}

type SectionKey = 'pomodoro' | 'allowlist' | 'datos';

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savedSections, setSavedSections] = useState<Record<SectionKey, boolean>>({
    pomodoro: false,
    allowlist: false,
    datos: false,
  });
  const [footerMeta, setFooterMeta] = useState<FooterMeta | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRefs = useRef<Record<SectionKey, ReturnType<typeof setTimeout> | null>>({
    pomodoro: null,
    allowlist: null,
    datos: null,
  });

  const fetchSettings = useCallback(async () => {
    try {
      const data = await sendMessage<Settings>('settings:get');
      setSettings(data);
    } catch (e) {
      console.error('[FocusFox]', e);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    let cancelled = false;
    sendMessage<FooterMeta>('meta:getFooter')
      .then((m) => { if (!cancelled) setFooterMeta(m); })
      .catch((e) => { console.error('[FocusFox]', e); });
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      for (const key of Object.keys(savedTimerRefs.current) as SectionKey[]) {
        const t = savedTimerRefs.current[key];
        if (t !== null) clearTimeout(t);
      }
    };
  }, [fetchSettings]);

  if (!settings) return <div className="settings-loading">Cargando...</div>;

  function markSaved(section: SectionKey) {
    const existing = savedTimerRefs.current[section];
    if (existing !== null) clearTimeout(existing);
    setSavedSections((prev) => ({ ...prev, [section]: true }));
    savedTimerRefs.current[section] = setTimeout(() => {
      setSavedSections((prev) => ({ ...prev, [section]: false }));
      savedTimerRefs.current[section] = null;
    }, 1500);
  }

  function update(patch: Partial<Omit<Settings, 'id'>>) {
    setSettings((prev) => prev ? { ...prev, ...patch } : prev);
  }

  async function doSave(section: SectionKey, patch: Partial<Omit<Settings, 'id'>>) {
    setSaveError(null);
    try {
      await sendMessage('settings:update', patch);
      markSaved(section);
    } catch (e) {
      console.error('[FocusFox]', e);
      setSaveError('Error al guardar. Intenta de nuevo.');
    }
  }

  function debouncedUpdate(section: SectionKey, patch: Partial<Omit<Settings, 'id'>>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    update(patch);
    debounceRef.current = setTimeout(() => {
      doSave(section, patch);
    }, 300);
  }

  async function updateNow(section: SectionKey, patch: Partial<Omit<Settings, 'id'>>) {
    update(patch);
    await doSave(section, patch);
  }

  return (
    <div className="settings-view">
      <SettingsSection title="Pomodoro" saved={savedSections.pomodoro}>
        <div className="settings-steppers">
          <MinuteStepper
            label="Duración trabajo"
            value={msToMinutes(settings.workMs)}
            onChange={(v) => debouncedUpdate('pomodoro', { workMs: minutesToMs(v) })}
            min={1}
            max={120}
          />
          <MinuteStepper
            label="Descanso corto"
            value={msToMinutes(settings.shortBreakMs)}
            onChange={(v) => debouncedUpdate('pomodoro', { shortBreakMs: minutesToMs(v) })}
            min={1}
            max={60}
          />
          <MinuteStepper
            label="Descanso largo"
            value={msToMinutes(settings.longBreakMs)}
            onChange={(v) => debouncedUpdate('pomodoro', { longBreakMs: minutesToMs(v) })}
            min={1}
            max={120}
          />
          <MinuteStepper
            label="Ciclos antes de descanso largo"
            value={settings.longBreakEvery}
            onChange={(v) => debouncedUpdate('pomodoro', { longBreakEvery: v })}
            min={2}
            max={10}
            showSuffix={false}
          />
        </div>
        <div className="settings-toggles">
          <ToggleField
            label="Iniciar descanso automáticamente"
            description="Al terminar un pomodoro, el descanso comienza automáticamente"
            value={settings.autoStartBreaks}
            onChange={(v) => { void updateNow('pomodoro', { autoStartBreaks: v }); }}
          />
          <ToggleField
            label="Iniciar siguiente pomodoro automáticamente"
            description="Al terminar un descanso, el siguiente pomodoro comienza automáticamente"
            value={settings.autoStartNextWork}
            onChange={(v) => { void updateNow('pomodoro', { autoStartNextWork: v }); }}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Sitios permitidos" saved={savedSections.allowlist}>
        <p className="settings-allowlist-desc">
          Cuando estás en foco, solo podés navegar a estos dominios. Coincide con subdominios automáticamente.
        </p>
        <DomainAddInput
          onAdd={(domain) => { void updateNow('allowlist', { allowlist: [...settings.allowlist, domain] }); }}
          existing={settings.allowlist}
        />
        <DomainList
          domains={settings.allowlist}
          onChange={(updated) => { void updateNow('allowlist', { allowlist: updated }); }}
        />
      </SettingsSection>

      <SettingsSection title="Datos" saved={savedSections.datos}>
        {saveError && <p className="settings-save-error">{saveError}</p>}
        <DataActions onSaved={() => { void fetchSettings(); markSaved('datos'); }} />
      </SettingsSection>

      {footerMeta && (
        <div className="settings-footer">
          <div className="settings-footer__row">
            <span className="settings-footer__item">FocusFox v{footerMeta.version}</span>
            <span className="settings-footer__item">esquema v{footerMeta.schemaVersion}</span>
          </div>
          <div className="settings-footer__row">
            <span className="settings-footer__item">{footerMeta.counts.projects} proyectos</span>
            <span className="settings-footer__item">{footerMeta.counts.tasks} tareas</span>
            <span className="settings-footer__item">{footerMeta.counts.pomodoros} pomodoros</span>
          </div>
          {footerMeta.lastExportAt && (
            <div className="settings-footer__row">
              <span className="settings-footer__item">
                Última exportación: {new Date(footerMeta.lastExportAt).toLocaleString('es-AR')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
