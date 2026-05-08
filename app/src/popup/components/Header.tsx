import { Timer, LayoutDashboard } from 'lucide-react';
import type { Phase } from '../PopupStore';

interface HeaderProps {
  phase: Phase;
}

const CHIP_LABELS: Record<Phase, string> = {
  loading: '',
  idle: 'Inactivo',
  active: 'Trabajando',
  break: 'Descanso',
  error: 'Error',
};

const CHIP_CLASSES: Record<Phase, string> = {
  loading: '',
  idle: 'popup-header__chip--idle',
  active: 'popup-header__chip--active',
  break: 'popup-header__chip--break',
  error: 'popup-header__chip--active',
};

export function Header({ phase }: HeaderProps) {
  function handleDashboard() {
    browser.tabs.create({ url: browser.runtime.getURL('dashboard/index.html') });
    window.close();
  }

  return (
    <header className="popup-header">
      <div className="popup-header__brand">
        <Timer className="popup-header__brand-icon" aria-hidden="true" />
        <span>FocusFox</span>
        {phase !== 'loading' && (
          <span className={`popup-header__chip ${CHIP_CLASSES[phase]}`}>
            {CHIP_LABELS[phase]}
          </span>
        )}
      </div>
      <button
        className="popup-header__dashboard-btn"
        onClick={handleDashboard}
        aria-label="Open dashboard"
        title="Dashboard"
      >
        <LayoutDashboard size={16} aria-hidden="true" />
      </button>
    </header>
  );
}
