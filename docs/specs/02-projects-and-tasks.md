---
title: Projects and Tasks
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# Projects and Tasks

CRUD logic for projects (containers) and tasks (the unit a Pomodoro is tied to). This spec covers the background-side service. UI lives in spec 09 (dashboard) and spec 08 (popup selector).

## Depends on

- `01-data-model` for the `Project` and `Task` types and DB layer.

## Used by

- `03-pomodoro-engine` (reads task on start, increments `completedPomodoros` on completion).
- `08-ui-popup` (task picker).
- `09-ui-dashboard` (full CRUD UI).
- `07-stats` (groups pomodoros by `projectId`).

## Service API (background)

Wraps the DB layer with validation and event emission.

```ts
// src/background/services/projects.ts
class ProjectsService {
  async list(opts?: { includeArchived?: boolean }): Promise<Project[]>;
  async create(input: { name: string; color: ProjectColor }): Promise<Project>;
  async rename(id: string, name: string): Promise<Project>;
  async recolor(id: string, color: ProjectColor): Promise<Project>;
  async archive(id: string): Promise<void>;
  async unarchive(id: string): Promise<void>;
}

// src/background/services/tasks.ts
class TasksService {
  async list(projectId: string, opts?: { includeDone?: boolean }): Promise<Task[]>;
  async create(input: { projectId: string; title: string; estimatedPomodoros?: number }): Promise<Task>;
  async rename(id: string, title: string): Promise<Task>;
  async setEstimate(id: string, estimatedPomodoros: number | null): Promise<Task>;
  async setStatus(id: string, status: Task['status']): Promise<Task>;
  async toggleDone(id: string): Promise<Task>;
  async delete(id: string): Promise<void>;
}
```

## Validation rules

| Field | Rule |
|---|---|
| `Project.name` | Trimmed length 1..80. Reject empty after trim. |
| `Project.color` | Must be one of the 6 palette values. |
| `Task.title` | Trimmed length 1..200. |
| `Task.estimatedPomodoros` | Integer 1..20 or null. Reject 0 and negatives. |
| `Task.status` | Must be `todo` \| `doing` \| `done`. |

Validation errors return a typed error response from the message router, never throw across the message bus.

## Status transitions

```
todo -> doing -> done
       \-> done
done -> todo (reopen)
```

- Starting a Pomodoro on a task: if `status === 'todo'`, auto-transition to `doing`.
- Marking done: sets `doneAt = Date.now()`. Reopening clears `doneAt`.

## Counter behavior

`Task.completedPomodoros` is incremented atomically by `03-pomodoro-engine` when a work pomodoro ends with `completedFully: true`. Cancelled pomodoros do NOT increment.

The DB layer exposes `incrementCompletedPomodoros(taskId)` which uses an `IDBObjectStore` cursor + `put` inside a single readwrite transaction to avoid races (see 01-data-model).

## Archiving vs deletion

- **Archive a project**: sets `archived: true`. Tasks remain. Project hidden from default lists. Reversible. Pomodoros still attribute to it in stats.
- **Delete a task**: hard delete. Pomodoros that referenced it remain (orphan) but their `taskId` still points to the deleted ID. Stats UI shows them as "deleted task" if the lookup fails. No cascade.
- Project deletion is NOT exposed in MVP. Only archive.

## Messages handled

```ts
type ProjectsAndTasksRequest =
  | { kind: 'projects.list'; includeArchived?: boolean }
  | { kind: 'projects.create'; name: string; color: ProjectColor }
  | { kind: 'projects.rename'; id: string; name: string }
  | { kind: 'projects.recolor'; id: string; color: ProjectColor }
  | { kind: 'projects.archive'; id: string }
  | { kind: 'projects.unarchive'; id: string }
  | { kind: 'tasks.list'; projectId: string; includeDone?: boolean }
  | { kind: 'tasks.create'; projectId: string; title: string; estimatedPomodoros?: number }
  | { kind: 'tasks.rename'; id: string; title: string }
  | { kind: 'tasks.setEstimate'; id: string; estimatedPomodoros: number | null }
  | { kind: 'tasks.setStatus'; id: string; status: Task['status'] }
  | { kind: 'tasks.toggleDone'; id: string }
  | { kind: 'tasks.delete'; id: string };
```

## Events emitted

After any successful mutation, broadcast a `data-changed` message so open UIs can re-fetch:

```ts
type DataChangedEvent =
  | { kind: 'projects.changed' }
  | { kind: 'tasks.changed'; projectId: string };
```

Open UIs subscribe via `browser.runtime.onMessage`.

## Acceptance

- Creating a project with empty name fails with a validation error response.
- Creating a task on a non-existent project fails with `not_found`.
- Toggling a task to `done` and back updates `doneAt` correctly.
- Starting a pomodoro on a `todo` task transitions it to `doing` (verified via integration test with the engine).
- Archived projects do not appear in `projects.list` unless `includeArchived: true`.
- All service methods covered by Vitest tests against `fake-indexeddb`.

## Out of scope

- Sub-tasks / nesting beyond project -> task.
- Tags, due dates, priority.
- Drag-and-drop reorder (tasks ordered by `createdAt` ascending in MVP).
- Bulk operations.
- Project deletion (only archive).
