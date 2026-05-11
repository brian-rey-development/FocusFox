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

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [footerMeta, setFooterMeta] = useState<FooterMeta | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await sendMessage<Settings>('settings:get');
      setSettings(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSettings();
    let cancelled = false;
    sendMessage<FooterMeta>('meta:getFooter')
      .then((m) => { if (!cancelled) setFooterMeta(m); })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [fetchSettings]);

  if (!settings) return null;

  function update(patch: Partial<Omit<Settings, 'id'>>) {
    setSaved(false);
    try {
      setSettings((prev) => prev ? { ...prev, ...patch } : prev);
    } catch {}
  }

  function debouncedUpdate(patch: Partial<Omit<Settings, 'id'>>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    update(patch);
    debounceRef.current = setTimeout(() => {
      doSave(patch);
    }, 300);
  }

  async function doSave(patch: Partial<Omit<Settings, 'id'>>) {
    try {
      await sendMessage('settings:update', patch);
      setSaved(true);
      savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
    } catch {
      setSaved(false);
    }
  }

  async function updateNow(patch: Partial<Omit<Settings, 'id'>>) {
    update(patch);
    await doSave(patch);
  }

  return (
    <div className="settings-view">
      <SettingsSection title="Pomodoro" saved={saved}>
        <div className="settings-steppers">
          <MinuteStepper
            label="Duración trabajo"
            value={msToMinutes(settings.workMs)}
            onChange={(v) => debouncedUpdate({ workMs: minutesToMs(v) })}
            min={1}
            max={120}
          />
          <MinuteStepper
            label="Descanso corto"
            value={msToMinutes(settings.shortBreakMs)}
            onChange={(v) => debouncedUpdate({ shortBreakMs: minutesToMs(v) })}
            min={1}
            max={60}
          />
          <MinuteStepper
            label="Descanso largo"
            value={msToMinutes(settings.longBreakMs)}
            onChange={(v) => debouncedUpdate({ longBreakMs: minutesToMs(v) })}
            min={1}
            max={120}
          />
          <MinuteStepper
            label="Ciclos antes de descanso largo"
            value={settings.longBreakEvery}
            onChange={(v) => debouncedUpdate({ longBreakEvery: v })}
            min={2}
            max={10}
            showSuffix={false}
          />
        </div>
        <div className="settings-toggles">
          <ToggleField
            label="Iniciar descanso automáticamente"
            value={settings.autoStartBreaks}
            onChange={(v) => updateNow({ autoStartBreaks: v })}
          />
          <ToggleField
            label="Iniciar siguiente pomodoro automáticamente"
            value={settings.autoStartNextWork}
            onChange={(v) => updateNow({ autoStartNextWork: v })}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Sitios permitidos" saved={saved}>
        <p className="settings-allowlist-desc">
          Cuando estás en foco, solo podés navegar a estos dominios. Coincide con subdominios automáticamente.
        </p>
        <DomainAddInput
          onAdd={(domain) => updateNow({ allowlist: [...settings.allowlist, domain] })}
          existing={settings.allowlist}
        />
        <DomainList
          domains={settings.allowlist}
          onChange={(updated) => updateNow({ allowlist: updated })}
        />
      </SettingsSection>

      <SettingsSection title="Datos" saved={saved}>
        <DataActions onSaved={fetchSettings} />
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
