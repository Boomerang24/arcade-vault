# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos" — an online arcade platform where users play and compete for points). Users browse a game library, play real canvas games in the browser, save scores, and compete on per-game leaderboards and a global hall of fame.

The UI copy, specs, and skills are in **Spanish**. Match that language when writing user-facing text, specs, or commit-adjacent docs.

## Spec Driven Design

Features go through specs in `specs/NN-slug.md` (`Draft` → `Approved` → `Implemented`).

- `/spec` — write a new spec (`.claude/skills/spec` symlinks to `.agents/skills/spec`, sourced from `Klerith/fernando-skills`, see `skills-lock.json`).
- `/spec-impl NN-slug` — implement an approved spec (symlinked the same way). Creates branch `spec-NN-slug` automatically (`specs/.spec-config.yml`, `AutoCreateBranch: true`), then PR to `main`.
- `/add-game <ref-folder|descripción>` — project-local skill (`.claude/skills/add-game/`) that generates a spec for porting/creating a playable game with a real engine + Supabase leaderboard. It **never writes code**; implementation always goes through `/spec-impl-game`. Its code contract lives in `.claude/skills/add-game/template.md`.
- `/spec-impl-game NN-slug` — project-local skill (`.claude/skills/spec-impl-game/`) for specs that add a new game: runs `/spec-impl`, then automatically chains `@skin-designer` and `@mobile-porter` on that game so it ships with skins and touch support. Use this instead of plain `/spec-impl` whenever the spec's game is new to the catalog.

Do not jump straight to code for a feature — write or find the spec first. Specs 01–14 are implemented. `@game-jam` drafts live outside `specs/` in `specs/game-jam/<game-id>/` until reviewed, renumbered, and moved in — currently `voltio` and `sinapsis` are pending there.

### Subagents

| Agente                      | Qué hace                                                                                                                                                                                                                                                                        | Definición                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `@game-planner`             | Propone qué juego añadir a continuación, sopesando encaje con `EngineStats` y diversidad de categorías. No escribe código ni specs; alimenta a `/add-game`. Memoria: `references/game-suggestions-todo.md`.                                                                     | `.claude/agents/game-planner.md`             |
| `@game-jam`                 | Dado un tema, inventa un juego original desde cero y escribe 2+ specs (base + mecánicas) en `specs/game-jam/<game-id>/`, formato specs 07/08/09. Autónomo, sin preguntas. No escribe código, nunca marca `Approved`.                                                            | `.claude/agents/game-jam.md`                 |
| `@skin-designer`            | Dado **un** juego, garantiza ≥3 skins (`classic`/`neon`/`retro`) refactorizando sus colores a una tabla `SKIN_PALETTES` y cableando el selector compartido. Escribe código. Memoria: `references/game-with-themes.md`.                                                          | `.claude/agents/skin-designer.md`            |
| `@mobile-porter`            | Dado **un** juego, añade soporte táctil móvil (patrón spec 12: `touchActions` en `GAME_REGISTRY`, fila en `TOUCH_DIRECTIONS`, `drawHUD()` si falta). Escribe código, siempre en la play-page. Memoria: `references/mobile-ported-games.md`.                                     | `.claude/agents/mobile-porter.md`            |
| `@game-performance-booster` | Dado **un** juego, audita por análisis estático el costo de render y aplica las optimizaciones de la spec 14 (batching de `save`/`shadowBlur`, cacheo offscreen de geometría estática). Escribe código, sin memoria persistente (detecta estado leyendo el propio `engine.ts`). | `.claude/agents/game-performance-booster.md` |
| `@security-auditor`         | Audita seguridad de punta a punta: RLS/policies/funciones/grants en Supabase y la capa de app (headers, proxy, API routes, secrets, validación de input). No escribe código ni migraciones; solo reporta y propone `/spec`. Memoria: `references/security/security-audit.md`.   | `.claude/agents/security-auditor.md`         |

Reglas que no se deducen del nombre:

- `@skin-designer`, `@mobile-porter` y `@game-performance-booster` escriben código pero se saltan `/spec`/`/spec-impl` a propósito — son refactors acotados de una capa existente, no features de producto.
- Los cinco agentes de juegos actúan **un juego por corrida**; ninguno recorre el catálogo completo.
- Un juego nuevo no se considera terminado hasta pasar por `@skin-designer` y `@mobile-porter` (o usar `/spec-impl-game`, que los encadena automáticamente).
- `@security-auditor` es la excepción: audita el proyecto **completo** en cada corrida (no un juego a la vez) y es de solo lectura — todo hallazgo accionable sale como propuesta de `/spec`, nunca como código directo.

## Skills

- `/frontend-design` (skill **global**, `~/.claude/skills/frontend-design`, no vive en este repo) — usar siempre para diseñar interfaz de usuario.
- `/add-game` y `/spec-impl-game` — ver "Spec Driven Design" arriba. Considera invocar `@game-planner` antes de `/add-game` para decidir qué juego conviene.
- El resto de skills de arriba (`@game-jam`, `@skin-designer`, `@mobile-porter`, `@game-performance-booster`) están documentadas en la tabla de subagentes.

## Architecture

- Next.js 16 App Router (`app/`), React 19, TypeScript, Tailwind CSS v4. Path alias `@/*` → repo root.
- **Server Components fetch, Client Components render.** Each route's `page.tsx` is a Server Component that awaits data from `lib/` and passes it to a `*-client.tsx` component (`home-client`, `biblioteca-client`, `salon-client`, `jugar-client`).
- Routes: `/` (home), `/biblioteca`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon-de-la-fama`, `/about`, `/iniciar-sesion`.
- API routes: `app/api/contact/route.ts` (Resend email), `app/api/health/supabase/route.ts`.
- `app/layout.tsx` wires the three Google fonts (Press Start 2P / JetBrains Mono / Courier Prime as CSS vars), the `AuthProvider`, `Nav`, and the neon background layers.

### Styling

Tailwind v4 is CSS-first in `app/globals.css` (`@import "tailwindcss"`, no `tailwind.config.js`). Most of the visual system is **hand-written CSS with custom properties** in that file — the retro-arcade theme (`--bg`, `--cyan`, `--magenta`, `--yellow`, `--green`, `--pixel`, `--mono`), the perspective grid/scanline/noise background, `.av-*` layout classes, and the `.cover-*` game cover classes. Reuse existing tokens and `cover-*` classes rather than inventing new ones.

### Data (Supabase)

- Clients: `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server, `@supabase/ssr`). Env in `.env.local` (see `.env.template`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, plus `RESEND_API_KEY` / `CONTACT_TO_EMAIL`.
- Tables: `games` (`id, title, short, long, cat, cover, color, best, plays`) and `scores` (`id, game_id, name, score, created_at`).
- Accessors: `lib/games.ts` (`getGames`, `getGame`), `lib/scores.ts` (`getTopScores`, `getAllTopScores` — these map snake_case rows to camelCase), `lib/data.ts` (shared static/config data).
- **All development database changes — schema or data — go through `mcp__supabase__apply_migration`** (Supabase MCP server configured in `.mcp.json`), never ad-hoc `mcp__supabase__execute_sql`; reserve `execute_sql` for read-only queries/debugging. This applies any time the DB changes, not only during `/spec-impl`. Migrations must stay replayable so they can later be applied to production.
- Production is a **separate** Supabase project (ref `jtfxdgnutgzktrejvrjb`) with no MCP access (`.mcp.json` only points at dev). It is bootstrapped and maintained manually — see `docs/deploy-produccion.md` and `supabase/prod/001_bootstrap_prod.sql` (idempotent bootstrap script run by hand in the prod SQL Editor).
- Read-only SQL access to **prod** goes through the `readonly_pool` Postgres role (created by hand, `bypassrls`, `SELECT` on `public.*` only, no writes/DDL) — for BI/reporting/external integrations, not the app. Connection strings and details in `docs/deploy-produccion.md` §10. Its password is never committed here or in `.env*`.
- Auth is **not** Supabase Auth: `components/auth-provider.tsx` is a lightweight `localStorage` context (`av_user`) that also exposes `saveScore`. It reads storage only inside `useEffect` to keep server/client markup identical.

### Games

Every game follows the same contract; do not add per-game branches to shared components.

- `lib/games/<id>/engine.ts` — plain TS engine, decoupled from React. Constructor `(canvas, callbacks)`, methods `pause/resume/reset/forceGameOver/destroy`, reports through `EngineCallbacks` (`onStats`, `onGameOver`). Multi-canvas games (Tetris) may take an object of canvases as the first arg; nothing else changes.
- `components/games/<id>-canvas.tsx` — `forwardRef` wrapper exposing `GameEngineHandle`. Shared, cross-game presentation lives in `components/games/touch-controls.tsx` and `mobile-footer.tsx` — treat these as finished infrastructure, don't fork them per game.
- `lib/games/registry.ts` — `GAME_REGISTRY` / `getRegisteredGame(id)` maps game id → `{ Canvas, skins?, touchActions? }`. **Adding a game is one line here.** `components/jugar-client.tsx` reads only the registry.
- Shared types (`EngineStats`, `GameEngineHandle`, `GameCanvasProps`, `SkinOption`, `TouchAction`, `REQUIRED_SKINS`) live in the registry. **Never extend `EngineStats`** — force the mapping and document it in the spec instead.
- Current games: `asteroides`, `tetris`, `arkanoid`, `snake`, `frogger` (see `references/implemented-games.md` for the Supabase-backed catalog snapshot — check its date before trusting it, it isn't auto-updated).
- Game assets under `public/games/<id>/` — only for games with real sprites/spritesheets (`arkanoid`, `snake`); the rest render procedurally with no assets folder.

### Reference material

- `references/started-games/` — original vanilla-JS games being ported (the code is the source of truth, their READMEs are often aspirational).
- `references/templates/` — the original JSX/HTML mockups the UI was ported from.
- `references/gamepad-assets/`, `references/source-assets/` — art/asset sources for the touch gamepad and game sprites.
- `references/*.md` memory files, each owned by one subagent that's the only writer to it: `game-suggestions-todo.md` (`@game-planner`), `game-with-themes.md` (`@skin-designer`), `mobile-ported-games.md` (`@mobile-porter`), `implemented-games.md` (manual catalog snapshot, not agent-owned).
- `references/security/security-checklist.md` — original one-off dump of the Supabase security linter, read-only, never edited by any agent. `references/security/security-audit.md` — the live ledger (severity, evidence, open/closed state), owned and written only by `@security-auditor`.

## Tooling

- A `PostToolUse` hook (`.claude/hooks/format-on-write.sh`, wired in `.claude/settings.json`) runs Prettier + `eslint --fix` on every written file, and **strips blank lines from code files**. Don't fight it by re-adding blank lines to `.ts/.tsx/.css/.json`; Markdown keeps its formatting.
- Playwright MCP is used to verify features in the browser; screenshots go to `.playwright-screenshots/`.
- Commands: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`. There is no test runner — verification is `npm run build` plus a browser pass (card on `/` → detail → play → HUD → game over → score saved → visible in leaderboard and `/salon-de-la-fama`).

## Important: this is Next.js 16, not the version in your training data

Next.js 16 has breaking changes from earlier versions you may have trained on. **Before writing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/`** (subdirectories: `01-app`, `02-pages`, `03-architecture`, `04-community`). Pay attention to deprecation notices. Do not assume APIs or conventions from older Next.js versions still apply. Note this repo already uses v16-only types like `LayoutProps<"/">`.
