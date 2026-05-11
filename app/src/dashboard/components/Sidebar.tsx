import { Timer, ListTodo, BarChart3, Plus } from 'lucide-react';
import type { Tab } from '../hooks/useHashRoute';
import type { Project } from '@/modules/project/domain/types';
import type { Tick } from '@/shared/engine-types';
import { PROJECT_COLOR_HEX } from '@/modules/project/domain/types';
import { MiniTimer } from './MiniTimer';

interface SidebarProps {
  tab: Tab;
  projects: Project[];
  selectedProjectId: string | null;
  tick: Tick | null;
  onNavigate: (tab: Tab, params?: Record<string, string>) => void;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
}

const NAV_ITEMS: Array<{ tab: Tab; icon: React.ReactNode; label: string; shortcut: string }> = [
  { tab: 'hoy', icon: <Timer size={18} aria-hidden="true" />, label: 'Hoy', shortcut: '1' },
  { tab: 'tareas', icon: <ListTodo size={18} aria-hidden="true" />, label: 'Tareas', shortcut: '2' },
  { tab: 'stats', icon: <BarChart3 size={18} aria-hidden="true" />, label: 'Estadísticas', shortcut: '3' },
];

export function Sidebar({ tab, projects, selectedProjectId, tick, onNavigate, onSelectProject, onCreateProject }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Barra lateral">
      <div className="sidebar__brand">
        <Timer size={20} aria-hidden="true" />
        <span>FocusFox</span>
      </div>

      <nav className="sidebar__nav" aria-label="Vistas">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.tab}
            className={`sidebar__nav-item${tab === item.tab ? ' sidebar__nav-item--active' : ''}`}
            onClick={() => onNavigate(item.tab)}
            aria-current={tab === item.tab ? 'page' : undefined}
          >
            {item.icon}
            <span className="sidebar__nav-label">{item.label}</span>
            <span className="sidebar__nav-shortcut">{item.shortcut}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar__section">
        <span className="sidebar__section-title">Proyectos</span>
        <div className="sidebar__project-list">
          {projects.map((p) => (
            <button
              key={p.id}
              className={`sidebar__project-item${selectedProjectId === p.id ? ' sidebar__project-item--active' : ''}`}
              onClick={() => { onSelectProject(p.id); onNavigate('tareas', { projectId: p.id }); }}
            >
              <span
                className="sidebar__project-dot"
                style={{ backgroundColor: PROJECT_COLOR_HEX[p.color] }}
                aria-hidden="true"
              />
              <span className="sidebar__project-name">{p.name}</span>
            </button>
          ))}
          <button className="sidebar__project-add" onClick={onCreateProject}>
            <Plus size={14} aria-hidden="true" />
            <span>Nuevo proyecto</span>
          </button>
        </div>
      </div>

      {tick && tick.phase !== 'idle' && (
        <div className="sidebar__mini-timer">
          <MiniTimer tick={tick} onClick={() => onNavigate('hoy')} />
        </div>
      )}
    </aside>
  );
}
