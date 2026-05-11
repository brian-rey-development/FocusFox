import { useEffect, useRef, useCallback, useState } from 'react';
import { useDashStore } from './store';
import { useHashRoute } from './hooks/useHashRoute';
import type { Tab } from './hooks/useHashRoute';
import type { Tick } from '@/shared/engine-types';
import type { Project } from '@/modules/project/domain/types';
import { sendMessage, connectPort } from '@/shared/messages';
import { Shell } from './components/Shell';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { TodayView } from './routes/Today';
import { TasksView } from './routes/Tasks';
import { SettingsView } from './routes/Settings';
import { StatsView } from './routes/Stats';
import { ProjectCreateModal } from './components/ProjectCreateModal';

export function App() {
  const [route, navigate] = useHashRoute();
  const tick = useDashStore((s) => s.tick);
  const projects = useDashStore((s) => s.projects);
  const selectedProjectId = useDashStore((s) => s.selectedProjectId);
  const setTick = useDashStore((s) => s.setTick);
  const setProjects = useDashStore((s) => s.setProjects);
  const setSelectedProject = useDashStore((s) => s.setSelectedProject);
  const setTab = useDashStore((s) => s.setTab);
  const pushToast = useDashStore((s) => s.pushToast);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const portRef = useRef<browser.runtime.Port | null>(null);
  const todayRef = useRef<{ focusInput: () => void }>(null);
  const tasksRef = useRef<{ focusInput: () => void }>(null);
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    setTab(route.tab);
  }, [route.tab, setTab]);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await sendMessage<Project[]>('project:list');
      setProjects(data);
    } catch {
      pushToast({ message: 'No se pudieron cargar los proyectos', kind: 'error' });
    }
  }, [setProjects, pushToast]);

  useEffect(() => {
    if (selectedProjectId) return;
    const first = projects.find((p) => !p.archived);
    if (first) setSelectedProject(first.id);
  }, [projects, selectedProjectId, setSelectedProject]);

  const init = useCallback(async () => {
    const port = connectPort('dashboard');
    portRef.current = port;

    port.onMessage.addListener((raw: object) => {
      const msg = raw as { type: string; data?: Tick };
      if (msg.type === 'tick' && msg.data) {
        setTick(msg.data);
      }
    });

    port.onDisconnect.addListener(() => {
      pushToast({ message: 'Conexión perdida. Recargá la página.', kind: 'error' });
    });

    try {
      const tickData = await sendMessage<Tick>('pomodoro:snapshot');
      setTick(tickData);
    } catch {}

    await fetchProjects();
  }, [setTick, fetchProjects, pushToast]);

  useEffect(() => {
    init();
    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [init]);

  useEffect(() => {
    function onFocus() {
      const now = Date.now();
      if (now - lastFetchRef.current < 5000) return;
      lastFetchRef.current = now;
      fetchProjects();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchProjects]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.closest('[contenteditable]')) return;

      if (e.key === '1') navigate('hoy');
      else if (e.key === '2') navigate('tareas');
      else if (e.key === '3') navigate('stats');
      else if (e.key === 'n') {
        if (route.tab === 'hoy') todayRef.current?.focusInput();
        else if (route.tab === 'tareas') tasksRef.current?.focusInput();
      } else if (e.key === '?') {
        setShowCheatsheet((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, route.tab]);

  function handleTabChange(tab: Tab) {
    const params = tab === 'tareas' && selectedProjectId ? { projectId: selectedProjectId } : undefined;
    navigate(tab, params);
  }

  const currentProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId) ?? null
    : null;

  return (
    <>
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>
      <Shell
        sidebar={
          <Sidebar
            tab={route.tab}
            projects={projects}
            selectedProjectId={selectedProjectId}
            tick={tick}
            onNavigate={navigate}
            onSelectProject={setSelectedProject}
            onCreateProject={() => setShowCreateProject(true)}
          />
        }
        topbar={
          <Topbar tab={route.tab} onTabChange={handleTabChange} />
        }
        main={
          <div className="dashboard-view">
            {route.tab === 'hoy' && <TodayView ref={todayRef} />}
            {route.tab === 'tareas' && (
              <TasksView
                ref={tasksRef}
                project={currentProject}
                tick={tick}
              />
            )}
            {route.tab === 'stats' && <StatsView />}
            {route.tab === 'settings' && <SettingsView />}
          </div>
        }
      />
      {showCheatsheet && (
        <div className="cheatsheet-overlay" onClick={() => setShowCheatsheet(false)}>
          <div className="cheatsheet" onClick={(e) => e.stopPropagation()}>
            <h2>Atajos de teclado</h2>
            <dl className="cheatsheet__list">
              <dt><kbd>1</kbd></dt><dd>Ir a Hoy</dd>
              <dt><kbd>2</kbd></dt><dd>Ir a Tareas</dd>
              <dt><kbd>3</kbd></dt><dd>Ir a Stats</dd>
              <dt><kbd>n</kbd></dt><dd>Enfocar entrada principal</dd>
              <dt><kbd>?</kbd></dt><dd>Mostrar/ocultar esta ayuda</dd>
            </dl>
            <button className="cheatsheet__close" onClick={() => setShowCheatsheet(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
      <ProjectCreateModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={(project) => {
          setShowCreateProject(false);
          fetchProjects();
          setSelectedProject(project.id);
          navigate('tareas', { projectId: project.id });
        }}
      />
    </>
  );
}
