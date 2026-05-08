import { openDB } from '@/shared/database';
import type { MessageRouter } from '@/shared/message';
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

const ports = new Set<browser.runtime.Port>();
const TICK_INTERVAL = 1000;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let pomodoroSvc: PomodoroService;

function broadcast(type: string, data?: unknown) {
  for (const port of ports) {
    try {
      port.postMessage({ type, data });
    } catch {
      ports.delete(port);
    }
  }
}

async function tick() {
  try {
    const active = await pomodoroSvc.getActive();
    broadcast('tick', {
      now: Date.now(),
      active: active
        ? {
            id: active.id,
            kind: active.kind,
            startedAt: active.startedAt,
            plannedDurationMs: active.plannedDurationMs,
            distractionCount: active.distractionCount,
            taskId: active.taskId,
            projectId: active.projectId,
          }
        : null,
    });
  } catch {
    broadcast('tick', { now: Date.now(), active: null });
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
  pomodoroSvc = createPomodoroService(db, taskSvc, noteSvc);

  const handlers: MessageRouter = {
    ...createSettingsHandlers(settingsSvc),
    ...createMetaHandlers(metaSvc),
    ...createNoteHandlers(noteSvc),
    ...createDistractionHandlers(distractionSvc),
    ...createTaskHandlers(taskSvc),
    ...createProjectHandlers(projectSvc),
    ...createPomodoroHandlers(pomodoroSvc),
  };

  browser.runtime.onMessage.addListener((msg) => {
    const fn = handlers[msg.type];
    if (!fn) return;
    return fn(msg.payload);
  });

  browser.runtime.onConnect.addListener((port) => {
    ports.add(port);
    port.onDisconnect.addListener(() => {
      ports.delete(port);
      if (ports.size === 0) stopTick();
    });
    if (ports.size === 1) startTick();
  });
}

init();
