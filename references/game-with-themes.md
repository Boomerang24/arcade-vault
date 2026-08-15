# Juegos con skins

Memoria de `@skin-designer`. Solo ese agente escribe aquí.
Skins obligatorias: `classic` (default, look original), `neon`, `retro`.
El agente trabaja **un juego por corrida** — nunca recorre el catálogo completo.

## Estado del catálogo

| Juego      | classic | neon | retro | Extras           | Actualizado |
| ---------- | ------- | ---- | ----- | ---------------- | ----------- |
| tetris     | ✅      | ✅   | ✅    | pastel, pixelart | 2026-08-15  |
| asteroides | ❌      | ❌   | ❌    | —                | —           |
| arkanoid   | ❌      | ❌   | ❌    | —                | —           |
| snake      | ❌      | ❌   | ❌    | —                | —           |

## tetris

**Técnica:** paleta por índice de pieza (`SKIN_PALETTES: Record<SkinName, Array<string|null>>`) + rama por skin dentro de `drawBlock` (`lib/games/tetris/engine.ts`). Selector compartido en `jugar-client.tsx` vía `GAME_REGISTRY.tetris.skins`.

| Rol     | classic   | neon      | retro     |
| ------- | --------- | --------- | --------- |
| pieza I | `#4dd0e1` | `#00fff2` | `#ffb000` |
| pieza O | `#ffd54f` | `#faff00` | `#ffb000` |
| pieza T | `#ba68c8` | `#ff2df5` | `#ffb000` |
| pieza S | `#81c784` | `#39ff6a` | `#ffb000` |
| pieza Z | `#e57373` | `#ff3b3b` | `#ffb000` |
| pieza J | `#64b5f6` | `#3d9dff` | `#ffb000` |
| pieza L | `#ffb74d` | `#ff9d1f` | `#ffb000` |

**Estilo por skin:**

- `classic`: relleno plano + franja superior blanca translúcida (highlight).
- `neon`: `shadowBlur`/`shadowColor` + contorno del mismo color.
- `retro`: monocromo ámbar CRT, sin glow, con scanlines horizontales sutiles (`rgba(0,0,0,0.22)` cada 3px) y contorno oscuro.
- `pastel` (extra): esquinas redondeadas, paleta suave propia.
- `pixelart` (extra): reutiliza la paleta `classic`, solo cambia el estilo de trazo (textura de cuadrícula 4×4).
