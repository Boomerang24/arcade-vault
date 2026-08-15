# Juegos con skins

Memoria de `@skin-designer`. Solo ese agente escribe aquí.
Skins obligatorias: `classic` (default, look original), `neon`, `retro`.
El agente trabaja **un juego por corrida** — nunca recorre el catálogo completo.

## Estado del catálogo

| Juego      | classic | neon | retro | Extras           | Actualizado |
| ---------- | ------- | ---- | ----- | ---------------- | ----------- |
| tetris     | ✅      | ✅   | ✅    | pastel, pixelart | 2026-08-15  |
| asteroides | ✅      | ✅   | ✅    | —                | 2026-08-15  |
| arkanoid   | ❌      | ❌   | ❌    | —                | —           |
| snake      | ❌      | ❌   | ❌    | —                | —           |

## asteroides

**Técnica:** paleta por rol semántico (`SKIN_PALETTES: Record<SkinName, Palette>`) en `lib/games/asteroides/engine.ts`. Cada clase de dibujo (`Bullet`, `Asteroid`, `Ship`, `Particle`) recibe `(ctx, palette, skin)`; el motor expone `private currentSkin` + getter `palette` y `setSkin()` redibuja sincrónicamente (funciona en pausa). El glow por skin se centraliza en el helper `applySkinGlow` y los colores con alpha (partículas, llama del propulsor, subtítulo del overlay) se derivan del hex de la paleta con `withAlpha`. Juego 100% procedural: no hay sprites, no se añadió ningún asset. Selector compartido vía `GAME_REGISTRY.asteroides.skins`.

| Rol           | classic   | neon      | retro     |
| ------------- | --------- | --------- | --------- |
| background    | `#000000` | `#06000f` | `#0a0600` |
| ship          | `#ffffff` | `#00f5ff` | `#ffb000` |
| thruster      | `#ff8200` | `#00ff88` | `#ff7b00` |
| bullet        | `#ffffff` | `#f5ff00` | `#ffd280` |
| asteroid      | `#ffffff` | `#ff006e` | `#cc8c00` |
| particle      | `#ffffff` | `#f5ff00` | `#ffb000` |
| hud           | `#ffffff` | `#00f5ff` | `#ffb000` |
| overlay title | `#ffffff` | `#ff006e` | `#ffb000` |
| overlay sub   | `#ffffff` | `#00f5ff` | `#ffb000` |

**Estilo por skin:**

- `classic`: reproduce literal por literal el port original (blanco sobre negro, propulsor `rgba(255,130,0,0.85)`, subtítulo al 65%). Sin glow ni relleno de asteroides.
- `neon`: `shadowBlur`/`shadowColor` en nave, balas, asteroides, partículas, HUD y overlay; asteroides con relleno magenta al 12%. Colores alineados con los tokens del sitio (`--cyan`, `--magenta`, `--yellow`, `--green`).
- `retro`: monocromo ámbar CRT (`#ffb000`) sobre negro cálido, sin glow, relleno de asteroide al 10% y scanlines horizontales (`rgba(0,0,0,0.22)` cada 3px) dibujadas sobre el campo de juego pero **debajo** del HUD, para que puntaje/nivel/vidas sigan legibles.

**Notas:** se eligió ámbar (no verde fósforo) para `retro` porque `neon` ya usa `#00ff88` en el propulsor. Cero cambios de mecánica: radios, velocidades, colisiones y `lineWidth` quedaron idénticos — ninguna hitbox visual cambió.

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
