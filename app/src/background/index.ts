import { openDB } from '@/shared/database';
import type { MessageRouter } from '@/shared/message';

import { createSettingsService } from '@/modules/settings/service';
import { createSettingsHandlers } from '@/modules/settings/handler';
import { createMetaService } from '@/modules/meta/service';
import { createMetaHandlers } from '@/modules/meta/handler';
import { createNoteService } from '@/modules/note/service';
import { createNoteHandlers } from '@/modules/note/handler';
import { createDistractionService } from '@/modules/distraction/service';
import { createDistractionHandlers } from '@/modules/distraction/handler';
import { createTaskService } from '@/modules/task/service';
import { createTaskHandlers } from '@/modules/task/handler';
import { createProjectService } from '@/modules/project/service';
import { createProjectHandlers } from '@/modules/project/handler';
import { createPomodoroService } from '@/modules/pomodoro/service';
import { createPomodoroHandlers } from '@/modules/pomodoro/handler';

async function init() {
  const db = await openDB();

  const settingsSvc = createSettingsService(db);
  const metaSvc = createMetaService(db);
  const noteSvc = createNoteService(db);
  const distractionSvc = createDistractionService(db);
  const taskSvc = createTaskService(db);

  const projectSvc = createProjectService(db, taskSvc);
  const pomodoroSvc = createPomodoroService(db, taskSvc, noteSvc);

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
}

init();
