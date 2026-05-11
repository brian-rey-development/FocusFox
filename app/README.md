# FocusFox

Pomodoro timer + task manager + hard focus blocker. Una extension de Firefox para mantener el enfoque.

## Features

- **Pomodoro timer** con duraciones configurables de trabajo y descanso
- **Gestion de tareas** con organizacion por proyectos y estimaciones
- **Bloqueo duro de sitios** durante sesiones de enfoque (dominios bloqueados)
- **Dashboard de estadisticas** con vistas diarias, semanales y por rango, rachas incluidas
- **Exportacion e importacion** de datos

## Screenshots

(en camino)

## Installation

**Requirements:** Firefox 115+, pnpm

```bash
git clone <repo-url>
cd focusfox
pnpm install
pnpm build
```

1. Open Firefox and go to `about:debugging`
2. Click "This Firefox" -> "Load Temporary Add-on..."
3. Select `manifest.json` from the project root

## Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Watch mode with hot reload |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm test` | Run 280+ tests |
| `pnpm build` | Production build |

## Architecture

Hexagonal architecture (domain -> application -> infrastructure) per module.

Built with React 19, TypeScript strict, Zustand 5 for state management, and IndexedDB via the `idb` wrapper for persistence. The Firefox MV3 service worker handles background logic (blocking, alarms, messaging).

Three entry points:
- **Popup** - main timer + task controls (`src/popup/`)
- **Blocked page** - shown when navigating to a blocked domain (`src/blocked/`)
- **Dashboard** - stats and history (`src/dashboard/`)

### Project structure

```
src/
  background/        MV3 service worker
  blocked/           Blocked page
  dashboard/         Stats dashboard
  popup/             Main popup UI
  modules/
    pomodoro/        domain/ application/ infrastructure/
    task/            domain/ application/ infrastructure/
    project/         domain/ application/ infrastructure/
    distraction/     domain/ application/ infrastructure/
    stats/           domain/ application/ infrastructure/
    note/            domain/ application/ infrastructure/
    meta/            domain/ application/ infrastructure/
    settings/        domain/ application/ infrastructure/
    data/            domain/ application/ infrastructure/
  shared/            Components, types, utilities
tests/               Test suite
```

## License

Apache 2.0. See [LICENSE](LICENSE).
