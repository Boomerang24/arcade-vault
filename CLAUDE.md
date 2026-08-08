# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos" — an online arcade platform where users play and compete for points). Currently a freshly scaffolded `create-next-app` project with no application code yet beyond the default template (`app/page.tsx`, `app/layout.tsx`).

This project follows **Spec Driven Design** via the `/spec` and `/spec-impl` skills from the `Klerith/fernando-skills` skill pack (see README.md). Install with:

```bash
npx skills@latest add Klerith/fernando-skills
```

When implementing features, check whether `/spec` and `/spec-impl` skills are available and use them rather than jumping straight to code.

There is no test runner configured yet.

## Skills
Use siempre /frontend-design para diseñar la interfaz de usuario.

## Architecture

- Next.js 16 App Router (`app/` directory), React 19, TypeScript, Tailwind CSS v4.
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- Tailwind v4 is configured CSS-first in `app/globals.css` via `@import "tailwindcss"` and `@theme inline` — there is no `tailwind.config.js`. Color tokens (`--background`, `--foreground`) are defined as CSS variables with a `prefers-color-scheme: dark` override.
- `next.config.ts` is currently empty/default.

## Important: this is Next.js 16, not the version in your training data

Next.js 16 has breaking changes from earlier versions you may have trained on. **Before writing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/`** (subdirectories: `01-app`, `02-pages`, `03-architecture`, `04-community`). Pay attention to deprecation notices. Do not assume APIs or conventions from older Next.js versions still apply.
