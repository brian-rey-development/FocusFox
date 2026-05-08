import { openDB } from '@/shared/database';
import type { MessageRouter, HandlerFn } from '@/shared/message';
import type { PomodoroService } from '@/modules/pomodoro/application/service';

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

import { createPomodoroEngine } from '@/background/engine';
import { createBrowserAlarmManager } from '@/background/engine/alarms';
import type { PomodoroEvent } from '@/background/engine/types';

const ports = new Set<browser.runtime.Port>();
const TICK_INTERVAL = 1000;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let pomodoroSvc: PomodoroService;
let engine: ReturnType<typeof createPomodoroEngine>;

function broadcast(type: string, data?: unknown) {
  for (const port of ports) {
    try {
      port.postMessage({ type, data });
    } catch {
      ports.delete(port);
    }
  }
}

function broadcastEvent(event: PomodoroEvent) {
  broadcast('event', event);
  browser.runtime.sendMessage(event).catch(() => {});
}

function wrapHandler(handlers: Record<string, HandlerFn>, after: Record<string, () => void>): Record<string, HandlerFn> {
  const wrapped: Record<string, HandlerFn> = {};
  for (const [key, fn] of Object.entries(handlers)) {
    wrapped[key] = async (payload) => {
      const result = await fn(payload);
      if (after[key]) after[key]();
      return result;
    };
  }
  return wrapped;
}

async function tick() {
  try {
    const tickData = await engine.getTick();
    broadcast('tick', tickData);
  } catch {
    broadcast('tick', { phase: 'idle', remainingMs: 0, pomodoroId: null, plannedDurationMs: 0, task: null, cycleIndex: 1, distractionCountSession: 0 });
  }
}

function startTick() {
  if (tickTimer) return;
  tickTimer = setInterval(tick, TICK_INTERVAL);
}

function stopTick() {
  if (!tickTimer) return;
  clearInterval(tickTimer);
  tickTimer = null;
}

async function init() {
  const db = await openDB();

  const settingsSvc = createSettingsService(db);
  const metaSvc = createMetaService(db);
  const noteSvc = createNoteService(db);
  const distractionSvc = createDistractionService(db);
  const taskSvc = createTaskService(db);

  const projectSvc = createProjectService(db, taskSvc);
  pomodoroSvc = createPomodoroService(db, taskSvc);

  engine = createPomodoroEngine({
    db,
    pomodoroSvc,
    taskSvc,
    noteSvc,
    settingsSvc,
    alarmManager: createBrowserAlarmManager(),
    fastStorage: {
      get: async (key: string) => (await browser.storage.local.get(key))[key],
      set: async (key: string, value: unknown) => browser.storage.local.set({ [key]: value }),
    },
    eventEmitter: { broadcast: broadcastEvent },
  });

  await engine.hydrate();
  await engine.recover();

  const settingsHandlers = wrapHandler(createSettingsHandlers(settingsSvc), {
    'settings:update': () => engine.invalidateSettings(),
  });

  const handlers: MessageRouter = {
    ...settingsHandlers,
    ...createMetaHandlers(metaSvc),
    ...createNoteHandlers(noteSvc),
    ...createDistractionHandlers(distractionSvc),
    ...createTaskHandlers(taskSvc),
    ...createProjectHandlers(projectSvc),
    ...createPomodoroHandlers(engine, pomodoroSvc),
  };

  browser.runtime.onMessage.addListener((msg, sender) => {
    if (!sender || sender.id !== browser.runtime.id) return;
    const fn = handlers[msg.type];
    if (!fn) return;
    return fn(msg.payload);
  });

  browser.runtime.onMessage.addListener((msg, sender) => {
    if (!sender || sender.id !== browser.runtime.id) return;
    if (msg.type === 'distraction:record') {
      const payload = msg.payload as { pomodoroId?: string };
      if (payload?.pomodoroId) {
        engine.recordDistraction(payload.pomodoroId);
      }
    }
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomodoro_transition') {
      engine.handleCompletion().catch((e) => console.error('[FocusFox] completion failed:', e));
    } else if (alarm.name === 'daily_reset') {
      engine.handleDailyReset().catch((e) => console.error('[FocusFox] daily reset failed:', e));
      scheduleDailyResetAlarm();
    }
  });

  function scheduleDailyResetAlarm() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    browser.alarms.create('daily_reset', { when: tomorrow.getTime() });
  }
  scheduleDailyResetAlarm();

  browser.runtime.onConnect.addListener((port) => {
    if (port.sender && port.sender.id !== browser.runtime.id) return;
    ports.add(port);
    port.onDisconnect.addListener(() => {
      ports.delete(port);
      if (ports.size === 0) stopTick();
    });
    if (ports.size === 1) startTick();
    tick();
  });
}

init().catch((e) => console.error('[FocusFox] init failed:', e));
