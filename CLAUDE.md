# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos" — an online arcade platform where users play and compete for points). Users browse a game library, play real canvas games in the browser, save scores, and compete on per-game leaderboards and a global hall of fame.

The UI copy, specs, and skills are in **Spanish**. Match that language when writing user-facing text, specs, or commit-adjacent docs.

## Spec Driven Design

Features go through specs in `specs/NN-slug.md` (`Draft` → `Approved` → `Implemented`).

- `/spec` — write a new spec (skill from `Klerith/fernando-skills`, installed in `.agents/skills/`, see `skills-lock.json`).
- `/spec-impl NN-slug` — implement an approved spec. Creates branch `spec-NN-slug` automatically (`specs/.spec-config.yml`, `AutoCreateBranch: true`), then PR to `main`.
- `/add-game <ref-folder|descripción>` — project-local skill (`.claude/skills/add-game/`) that generates a spec for porting/creating a playable game with a real engine + Supabase leaderboard. It **never writes code**; implementation always goes through `/spec-impl`. Its code contract lives in `.claude/skills/add-game/template.md`.

Do not jump straight to code for a feature — write or find the spec first. Specs 01–10 are implemented.

### `@game-planner` subagent

Before deciding _which_ game to add next, use the `@game-planner` subagent (`.claude/agents/game-planner.md`). It weighs technical fit against the engine contract (`EngineStats`) and category diversity across the catalog, and keeps a persistent, git-tracked memory of suggestions in `references/game-suggestions-todo.md` (Pendientes/Descartadas/Implementadas) so proposals aren't re-derived or repeated across sessions. It **never writes code or specs** — its recommendation feeds into `/add-game`.

### `@game-jam` subagent

Given a theme (a phrase, an aesthetic, a mood), the `@game-jam` subagent (`.claude/agents/game-jam.md`) invents one original game from scratch — no porting from `references/started-games/` — and writes it as **2+ complete specs** in `specs/game-jam/<game-id>/` (a base spec with the minimum playable engine + registry + Supabase row, and a mechanics spec layering power-ups/levels/audio on top), matching the format and depth of specs 07/08/09. It is fully autonomous: it never asks questions, deciding every choice (id/title/cat/color/cover/mechanics/`EngineStats` mapping) itself and recording the reasoning in each spec's "Decisiones tomadas y descartadas". It **never writes code**, never touches `apply_migration`, and never marks a spec `Approved`. Its specs live outside `specs/` until the user reviews them, renumbers if needed, moves them into `specs/`, and runs `/spec-impl` on each in dependency order.

## Skills

- Use siempre `/frontend-design` para diseñar la interfaz de usuario.
- `/add-game` para cualquier juego nuevo (ver arriba). Considera invocar `@game-planner` antes, para decidir qué juego conviene.
- `@game-jam` para prototipar rápido un juego nuevo a partir de un tema, sin preguntas — genera specs de borrador en `specs/game-jam/` para revisar. Úsalo en vez de `/add-game` cuando solo hay un tema y no una descripción concreta ya decidida.

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
- Accessors: `lib/games.ts` (`getGames`, `getGame`), `lib/scores.ts` (`getTopScores`, `getAllTopScores` — these map snake_case rows to camelCase).
- Schema changes go through `mcp__supabase__apply_migration` (Supabase MCP server configured in `.mcp.json`), during `/spec-impl` — not from a spec-writing skill.
- Auth is **not** Supabase Auth: `components/auth-provider.tsx` is a lightweight `localStorage` context (`av_user`) that also exposes `saveScore`. It reads storage only inside `useEffect` to keep server/client markup identical.

### Games

Every game follows the same contract; do not add per-game branches to shared components.

- `lib/games/<id>/engine.ts` — plain TS engine, decoupled from React. Constructor `(canvas, callbacks)`, methods `pause/resume/reset/forceGameOver/destroy`, reports through `EngineCallbacks` (`onStats`, `onGameOver`). Multi-canvas games (Tetris) may take an object of canvases as the first arg; nothing else changes.
- `components/games/<id>-canvas.tsx` — `forwardRef` wrapper exposing `GameEngineHandle`.
- `lib/games/registry.ts` — `GAME_REGISTRY` / `getRegisteredGame(id)` maps game id → canvas component. **Adding a game is one line here.** `components/jugar-client.tsx` reads only the registry.
- Shared types (`EngineStats`, `GameEngineHandle`, `GameCanvasProps`) live in the registry. **Never extend `EngineStats`** — force the mapping and document it in the spec instead.
- Current games: `asteroides`, `tetris`, `arkanoid`, `snake` and more...
  (see `references/implemented-games.md`) when you to check which games are implemented and how to implement new ones.
- Game assets under `public/games/<id>/`.

### Reference material

- `references/started-games/` — original vanilla-JS games being ported (the code is the source of truth, their READMEs are often aspirational).
- `references/templates/` — the original JSX/HTML mockups the UI was ported from.

## Tooling

- A `PostToolUse` hook (`.claude/hooks/format-on-write.sh`, wired in `.claude/settings.json`) runs Prettier + `eslint --fix` on every written file, and **strips blank lines from code files**. Don't fight it by re-adding blank lines to `.ts/.tsx/.css/.json`; Markdown keeps its formatting.
- Playwright MCP is used to verify features in the browser; screenshots go to `.playwright-screenshots/`.
- Commands: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`. There is no test runner — verification is `npm run build` plus a browser pass (card on `/` → detail → play → HUD → game over → score saved → visible in leaderboard and `/salon-de-la-fama`).

## Important: this is Next.js 16, not the version in your training data

Next.js 16 has breaking changes from earlier versions you may have trained on. **Before writing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/`** (subdirectories: `01-app`, `02-pages`, `03-architecture`, `04-community`). Pay attention to deprecation notices. Do not assume APIs or conventions from older Next.js versions still apply. Note this repo already uses v16-only types like `LayoutProps<"/">`.
