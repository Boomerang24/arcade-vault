# 11 — Infraestructura: Selector de skins compartido

**Estado:** Implemented
**Depende de:** SPEC 06, SPEC 07
**Fecha:** 2026-08-15

**Objetivo:** Extender el contrato de motores (`lib/games/registry.ts`) para que cualquier juego pueda declarar skins visuales opcionales, mover el selector de Tetris (hasta ahora local a su propio canvas) a un control compartido en `jugar-client.tsx` con persistencia en `localStorage`, y migrar Tetris a la nomenclatura estándar `classic`/`neon`/`retro`, como base para que el subagente `@skin-designer` pueda dotar de skins a los demás juegos uno a la vez.

## Alcance

**Incluye:**

- `SkinOption`, `REQUIRED_SKINS` y los campos opcionales `GameEngineHandle.setSkin?` / `RegisteredGame.skins?` en `lib/games/registry.ts`, sin tocar `EngineStats`, `GameCanvasProps` ni los campos ya obligatorios del handle.
- Selector `<select>` en el `player-hud` de `components/jugar-client.tsx`, renderizado solo cuando `registered.skins` existe — ningún otro juego se ve afectado en su ausencia.
- Persistencia por juego en `localStorage` (`av_skin_<gameId>`), leída únicamente dentro de un `useEffect` post-hidratación (mismo patrón que `av_user` en `components/auth-provider.tsx`) para no romper el markup server/client.
- Migración de Tetris: su skin `retro` original (que era literalmente la paleta base del juego) se renombra a `classic`; se añade un `retro` nuevo con estética CRT fósforo ámbar. `pastel`/`pixelart` se mantienen como extras propios de Tetris, no como parte del contrato genérico.
- Eliminación del `<select id="tetris-skin">` local de `components/games/tetris-canvas.tsx`; `setSkin` pasa a exponerse vía `useImperativeHandle` para que lo invoque el selector compartido.
- Anotación de la reversión de decisión en `specs/07-tetris.md` (líneas donde esa spec fijaba el selector como interno al canvas).

**No incluye (fuera de alcance):**

- Añadir skins a `asteroides`, `arkanoid` o `snake` — eso es tarea de `@skin-designer <juego>`, invocado por separado, uno a la vez.
- Cualquier cambio de mecánica, física, balance o puntuación en Tetris.
- Tocar `EngineStats`, `GameCanvasProps` o los campos ya existentes de `GameEngineHandle`.

## Modelo de datos

`lib/games/registry.ts` — extensión del contrato compartido:

```ts
export type SkinOption = { id: string; label: string };
// Todo juego que declare `skins` debe ofrecer al menos estas 3
// (el primero del array es el default). Convención, no forzado por el tipo,
// para no romper juegos que aún no tienen skins.
export const REQUIRED_SKINS = ["classic", "neon", "retro"] as const;

export type GameEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  setSkin?: (skin: string) => void; // opcional: juegos aún sin skins
};

export type RegisteredGame = {
  Canvas: ForwardRefExoticComponent<
    GameCanvasProps & RefAttributes<GameEngineHandle>
  >;
  skins?: SkinOption[]; // el primero es el default
};
```

`GAME_REGISTRY.tetris.skins` declara las 5 skins reales (`classic`, `neon`, `retro`, `pastel`, `pixelart`).

`components/jugar-client.tsx` añade estado local `skin` inicializado a `registered?.skins?.[0]?.id ?? ""`, un efecto de restauración desde `localStorage` (valida el valor guardado contra `registered.skins` antes de aplicarlo) y `handleSkinChange` que actualiza estado + motor + `localStorage` en el mismo gesto.

`lib/games/tetris/engine.ts`: `COLORS` renombrado a `CLASSIC_COLORS`; nueva `RETRO_COLORS` (monocromo `#ffb000`); `SKIN_PALETTES.classic = CLASSIC_COLORS`, `SKIN_PALETTES.retro = RETRO_COLORS`, `SKIN_PALETTES.pixelart` sigue apuntando a `CLASSIC_COLORS`; `currentSkin` por defecto `"classic"`; nueva rama `retro` en `drawBlock` (relleno plano + contorno oscuro + scanlines horizontales, sin `shadowBlur`, a diferencia de `neon`).

## Plan de implementación

1. **Contrato compartido.** Extender `lib/games/registry.ts` con `SkinOption`/`REQUIRED_SKINS`/`setSkin?`/`skins?` y declarar las skins de Tetris en `GAME_REGISTRY`. Verificación: `npm run build` tipa sin errores con el nuevo campo opcional.
2. **Selector y persistencia en `jugar-client.tsx`.** Añadir el `<select>` condicional al `hud-actions`, el efecto de restauración post-hidratación y `handleSkinChange`. Verificación manual: en un juego sin `skins` (p. ej. Asteroides) el HUD no muestra el selector y no hay error de consola.
3. **Migración de Tetris.** Renombrar `COLORS`→`CLASSIC_COLORS`, añadir `RETRO_COLORS` y su rama en `drawBlock`, cambiar el default de `currentSkin`, eliminar el `<select>` local y exponer `setSkin` en `useImperativeHandle` de `components/games/tetris-canvas.tsx`. Verificación: `grep -n "COLORS\b"` no deja referencias colgantes (se detectó y corrigió un uso residual en `applyPowerUp`/tint que apuntaba al nombre viejo).
4. **Anotar `specs/07-tetris.md`.** Dejar constancia de la reversión de la decisión "selector dentro del canvas" sin reescribir la spec original.
5. **Verificación en navegador.** `npm run build` (producción) + `npm run start`; recorrer `/juego/tetris/jugar`: cambiar entre `classic`/`neon`/`retro` sin recargar (el render cambia al instante, también en pausa), recargar la página y confirmar que la skin elegida persiste, verificar que pausa/reanudar y el resto del HUD siguen intactos. Confirmado: en `npm run dev` se observó un desfase transitorio de la skin tras recargar por el doble-efecto de React StrictMode (crea y destruye el motor dos veces); en `npm run start` (build de producción, sin StrictMode duplicando efectos) la persistencia funciona correctamente frame a frame — no es un bug del código, es un artefacto exclusivo del modo desarrollo.

## Criterios de aceptación

- [ ] `lib/games/registry.ts` expone `SkinOption`, `REQUIRED_SKINS`, `GameEngineHandle.setSkin?` y `RegisteredGame.skins?` sin romper la firma de `EngineStats`/`GameCanvasProps` ni de los juegos que no declaran skins.
- [ ] El selector de skin en `jugar-client.tsx` solo aparece cuando `registered.skins` existe; en Asteroides/Arkanoid/Snake el HUD se ve igual que antes de esta spec.
- [ ] En `/juego/tetris/jugar`, cambiar de skin en el selector cambia el render del tablero y del panel `NEXT` sin recargar la página, incluso con el juego en pausa.
- [ ] La skin elegida persiste tras recargar la página (`localStorage`, clave `av_skin_tetris`).
- [ ] `classic` en Tetris se ve pixel-idéntico al `retro` que existía antes de esta spec (es un rename, no un rediseño).
- [ ] El nuevo `retro` (CRT ámbar) no reutiliza clases CSS ni tokens de color del sitio reservados para otro propósito.
- [ ] `components/games/tetris-canvas.tsx` ya no tiene un `<select>` propio ni estado `skin` local; `setSkin` se expone solo vía `useImperativeHandle`.
- [ ] `npm run build` sin errores de tipos ni de lint.
- [ ] El resto del catálogo (Asteroides, Arkanoid, Snake) queda intacto: `git diff --stat` fuera de los archivos listados en "Modelo de datos" no muestra cambios.

## Decisiones tomadas y descartadas

- **Selector movido de "dentro del canvas de Tetris" a "compartido en `jugar-client.tsx`"**, revirtiendo la decisión original de SPEC 07 (que lo mantenía interno al motor para no tocar el contrato). Decisión explícita del usuario: al introducir `@skin-designer` para dotar de skins a otros juegos, mantener un selector por canvas habría duplicado la misma UI en cada wrapper. Se preserva la restricción original en espíritu (`EngineStats`/`GameCanvasProps` no se tocan) extendiendo solo `GameEngineHandle` con un método **opcional**.
- **`retro`→`classic` en vez de coexistir con un nuevo `retro`.** Se decidió renombrar en vez de agregar `classic` como una skin más, para que el nombre `retro` en todo el catálogo signifique siempre "estética CRT fósforo" y no quede sobrecargado con dos sentidos distintos entre Tetris y el resto de juegos.
- **`pastel`/`pixelart` se mantienen como extras de Tetris**, fuera de `REQUIRED_SKINS`, en vez de generalizarse al resto del catálogo — no hay evidencia de que el resto de juegos las necesite y `@skin-designer` solo garantiza las 3 obligatorias.
- **`REQUIRED_SKINS` es una convención documentada, no un tipo forzado** (`skins?` sigue siendo `SkinOption[]` genérico): forzarlo por tipos habría roto la opcionalidad para juegos sin skins todavía, y la validación real de "al menos 3" vive en el flujo del agente `@skin-designer`, no en el compilador.
- **Persistencia con el mismo patrón que `av_user`** (lectura solo en `useEffect` post-hidratación) en vez de leer `localStorage` durante el render: evita el mismatch de hidratación ya documentado en `components/auth-provider.tsx`.

## Riesgos identificados

| Riesgo                                                                                                                                                              | Mitigación                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El desfase de skin observado en `npm run dev` (React StrictMode duplica el ciclo mount→cleanup→mount del motor) podría confundirse con un bug real de persistencia. | Verificado explícitamente contra `npm run build && npm run start`: el comportamiento en producción es correcto. Documentado aquí para que futuras sesiones no reabran esto como bug.                       |
| Extender `GameEngineHandle` con un campo opcional podría tentar a añadir más campos por-feature con el tiempo, erosionando el contrato compartido.                  | `setSkin?` es el único campo agregado y su uso está acotado a `@skin-designer`; cualquier campo adicional debe justificarse en una spec propia, igual que este.                                            |
| Un juego futuro podría declarar `skins` con menos de 3 opciones o sin `classic` como primero, rompiendo la convención sin que el compilador lo detecte.             | Documentado como responsabilidad del flujo de `@skin-designer` (Fase 1/6 de su definición en `.claude/agents/skin-designer.md`), que audita y registra el estado real en `references/game-with-themes.md`. |
