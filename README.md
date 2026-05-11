# FocusFox

Pomodoro timer + task manager + hard focus blocker. Firefox extension.

Built with React 19, TypeScript strict, Zustand 5, IndexedDB (`idb`), Vite. Firefox MV3.

## Project structure

```
app/             Extension source code
  src/           TypeScript/React source
    background/  Service worker
    popup/       Main popup UI
    dashboard/   Stats and settings
    blocked/     Blocked domain page
    modules/     Hexagonal modules (pomodoro, task, project, stats, ...)
    shared/      Types, components, utilities
  tests/         280+ tests (vitest)
docs/            Design docs
LICENSE          Apache 2.0
```

## Quick start

```bash
cd app
pnpm install
pnpm build
```

1. Open Firefox → `about:debugging` → This Firefox → Load Temporary Add-on
2. Select `app/manifest.json`

## Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Watch mode |
| `pnpm typecheck` | TypeScript strict |
| `pnpm test` | Run tests |
| `pnpm build` | Production build |

## Architecture

Hexagonal architecture per module (`domain/` → `application/` → `infrastructure/`). Three entry points: popup (timer controls), blocked page (focus enforcement), dashboard (stats + settings). Service worker handles background logic, alarms, blocking, messaging.

## License

Apache 2.0. See [LICENSE](LICENSE).
