import { openDB } from '@/shared/database';
import type { DB } from '@/shared/database/types';
import type { MessageRouter, HandlerFn } from '@/shared/message';
import type { PomodoroService } from '@/modules/pomodoro/application/service';
import type { SettingsService } from '@/modules/settings/application/service';
import type { MetaService } from '@/modules/meta/application/service';
import type { NoteService } from '@/modules/note/application/service';
import type { DistractionService } from '@/modules/distraction/application/service';
import type { TaskService } from '@/modules/task/application/service';
import type { ProjectService } from '@/modules/project/application/service';
import type { StatsService } from '@/modules/stats/application/service';
import type { DataService } from '@/modules/data/application/service';

import { createSettingsService } from '@/modules/settings/application/service';
import { createSettingsHandlers } from '@/modules/settings/application/handler';
import { createMetaService } from '@/modules/meta/application/service';
import { createMetaHandlers } from '@/modules/meta/application/handler';
import { createNoteService } from '@/modules/note/application/service';
import { createNoteHandlers } from '@/modules/note/application/handler';
import { createDistractionService } from '@/modules/distraction/application/service';
import { createDistractionHandlers } from '@/modules/distraction/application/handler';
import { createTaskService } from '@/modules/task/application/service';
import { createTaskHandlers } from '@/modules/task/application/handler';
import { createProjectService } from '@/modules/project/application/service';
import { createProjectHandlers } from '@/modules/project/application/handler';
import { createPomodoroService } from '@/modules/pomodoro/application/service';
import { createPomodoroHandlers } from '@/modules/pomodoro/application/handler';
import { createStatsService } from '@/modules/stats/application/service';
import { createStatsHandlers } from '@/modules/stats/application/handler';
import { createDataService } from '@/modules/data/application/service';
import { createDataHandlers } from '@/modules/data/application/handler';

import { createPomodoroEngine } from '@/background/engine';
import { createBrowserAlarmManager } from '@/background/engine/alarms';
import type { PomodoroEvent } from '@/background/engine/types';
import { setAllowlist } from '@/background/blocker/allowlist-cache';
import { registerBlocker } from '@/background/blocker';

const ports = new Set<browser.runtime.Port>();
const TICK_INTERVAL = 1000;
let tickTimer: ReturnType<typeof setTimeout> | null = null;
let initFailed = false;

function logError(context: string, e: unknown) {
  console.error(`[FocusFox] ${context}:`, e);
}

function broadcast(type: string, data?: unknown) {
  for (const port of ports) {
    try {
      port.postMessage({ type, data });
    } catch (e) {
      logError('broadcast removing dead port', e);
      ports.delete(port);
    }
  }
}

function broadcastEvent(event: PomodoroEvent) {
  broadcast('event', event);
  browser.runtime.sendMessage(event).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('Could not establish connection') && !msg.includes('Receiving end does not exist')) {
      logError('broadcastEvent', e);
    }
  });
}

function wrapHandler(handlers: Record<string, HandlerFn>, after: Record<string, (() => void) | (() => Promise<void>)>): Record<string, HandlerFn> {
  const wrapped: Record<string, HandlerFn> = {};
  for (const [key, fn] of Object.entries(handlers)) {
    wrapped[key] = async (payload) => {
      const result = await fn(payload);
      const afterFn = after[key];
      if (afterFn) {
        try {
          await afterFn();
        } catch (e) {
          logError(`after-hook [${key}]`, e);
        }
      }
      return result;
    };
  }
  return wrapped;
}

// --- Tick loop (recursive setTimeout prevents overlap) ---

async function tick() {
  try {
    const tickData = await engine.getTick();
    broadcast('tick', tickData);
  } catch (e) {
    logError('tick', e);
    broadcast('tick', { phase: 'idle', remainingMs: 0, pomodoroId: null, plannedDurationMs: 0, task: null, cycleIndex: 1, distractionCountSession: 0 });
  }
}

function startTick() {
  if (tickTimer) return;
  const loop = () => { tick().finally(() => { tickTimer = setTimeout(loop, TICK_INTERVAL); }); };
  loop();
}

function stopTick() {
  if (!tickTimer) return;
  clearTimeout(tickTimer);
  tickTimer = null;
}

// --- Service factories ---

function setupServices(db: DB) {
  const settingsSvc = createSettingsService(db);
  const metaSvc = createMetaService(db);
  const noteSvc = createNoteService(db);
  const distractionSvc = createDistractionService(db);
  const taskSvc = createTaskService({
    db,
    getActivePomodoroTaskId: async () => {
      if (!engine) return null;
      const tick = await engine.getTick();
      return tick.task?.id ?? null;
    },
  });
  const projectSvc = createProjectService(db, taskSvc);
  const pomodoroSvc = createPomodoroService(db, taskSvc);
  const statsSvc = createStatsService(db);
  const dataSvc = createDataService(db);

  return { settingsSvc, metaSvc, noteSvc, distractionSvc, taskSvc, projectSvc, pomodoroSvc, statsSvc, dataSvc };
}

interface Services {
  settingsSvc: SettingsService;
  metaSvc: MetaService;
  noteSvc: NoteService;
  distractionSvc: DistractionService;
  taskSvc: TaskService;
  projectSvc: ProjectService;
  pomodoroSvc: PomodoroService;
  statsSvc: StatsService;
  dataSvc: DataService;
}

function setupEngine(db: DB, svc: Services) {
  return createPomodoroEngine({
    db,
    pomodoroSvc: svc.pomodoroSvc,
    taskSvc: svc.taskSvc,
    noteSvc: svc.noteSvc,
    settingsSvc: svc.settingsSvc,
    alarmManager: createBrowserAlarmManager(),
    fastStorage: {
      get: async (key: string) => (await browser.storage.local.get(key))[key],
      set: async (key: string, value: unknown) => browser.storage.local.set({ [key]: value }),
    },
    eventEmitter: { broadcast: broadcastEvent },
  });
}

function setupMessageRouter(db: DB, svc: Services) {
  const settingsHandlers = wrapHandler(createSettingsHandlers(svc.settingsSvc), {
    'settings:update': async () => {
      engine.invalidateSettings();
      const s = await svc.settingsSvc.get();
      setAllowlist(s.allowlist);
    },
  });

  const dataHandlers = wrapHandler(createDataHandlers(svc.dataSvc), {
    'data:export': () => { svc.metaSvc.set('lastExportAt', Date.now()).catch((e) => logError('data:export after-hook', e)); },
    'data:reset': async () => { await engine.cancel().catch(() => {}); },
    'data:import': async () => { await engine.cancel().catch(() => {}); },
  });

  const handlers: MessageRouter = {
    ...settingsHandlers,
    ...createMetaHandlers(svc.metaSvc),
    ...createNoteHandlers(svc.noteSvc),
    ...createDistractionHandlers(svc.distractionSvc),
    ...createTaskHandlers(svc.taskSvc),
    ...createProjectHandlers(svc.projectSvc),
    ...createPomodoroHandlers(engine, svc.pomodoroSvc),
    ...createStatsHandlers(svc.statsSvc),
    ...dataHandlers,
    'distraction:record': async (payload) => {
      const result = await svc.distractionSvc.record(payload);
      const { pomodoroId } = payload as { pomodoroId: string };
      engine.recordDistraction(pomodoroId).catch((e: unknown) => logError('distraction:record after-hook', e));
      return result;
    },
  };

  return handlers;
}

function setupMessageListener(handlers: MessageRouter) {
  browser.runtime.onMessage.addListener((msg, sender) => {
    if (!sender || sender.id !== browser.runtime.id) return;
    if (initFailed) return Promise.resolve({ error: 'init_failed' });

    const fn = handlers[msg.type];
    if (!fn) return;

    try {
      return fn(msg.payload);
    } catch (e) {
      logError(`handler [${msg.type}]`, e);
      throw e;
    }
  });
}

function setupAlarms() {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomodoro_transition') {
      engine.handleCompletion().catch((e) => logError('completion', e));
    } else if (alarm.name === 'daily_reset') {
      engine.handleDailyReset().catch((e) => logError('daily reset', e));
      scheduleDailyResetAlarm();
    }
  });
}

function scheduleDailyResetAlarm() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  browser.alarms.create('daily_reset', { when: tomorrow.getTime() });
}

function setupPorts() {
  browser.runtime.onConnect.addListener((port) => {
    if (port.sender && port.sender.id !== browser.runtime.id) return;
    if (initFailed) {
      port.postMessage({ type: 'error', data: { message: 'Extension init failed. Reload the extension.' } });
      port.disconnect();
      return;
    }
    ports.add(port);
    port.onDisconnect.addListener(() => {
      ports.delete(port);
      if (ports.size === 0) stopTick();
    });
    if (ports.size === 1) startTick();
    tick();
  });
}

let engine: ReturnType<typeof createPomodoroEngine>;

async function init() {
  const db = await openDB();
  const svc = setupServices(db);

  engine = setupEngine(db, svc);
  await engine.hydrate();
  await engine.recover();

  const blockerSettings = await svc.settingsSvc.get();
  setAllowlist(blockerSettings?.allowlist ?? []);
  registerBlocker(engine, svc.distractionSvc);

  const handlers = setupMessageRouter(db, svc);
  setupMessageListener(handlers);
  setupAlarms();
  scheduleDailyResetAlarm();
  setupPorts();
}

init().catch((e) => {
  logError('init', e);
  initFailed = true;
});
