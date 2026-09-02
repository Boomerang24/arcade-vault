# 23 — Gestos táctiles (swipe) como alternativa al D-pad

**Estado:** Approved
**Depende de:** SPEC 07, SPEC 09, SPEC 12, SPEC 21
**Fecha:** 2026-09-01

**Objetivo:** Añadir un modo de control táctil por gestos (swipe direccional sobre el canvas) seleccionable con un toggle en `MobileFooter` y recordado por juego en `localStorage`, para los cuatro juegos cuyo control mapea limpio a las cuatro flechas (`2048`, `snake`, `frogger`, `tetris`), reutilizando el mecanismo de `KeyboardEvent` sintético de la spec 12 sin tocar ningún motor ni el tipo `EngineStats`.

## Por qué existe esta spec

La spec 12 dio a los ocho juegos un D-pad en pantalla. Funciona, pero en juegos de dirección discreta (`2048`, `snake`, `frogger`) y en el movimiento lateral de `tetris`, un swipe sobre el propio tablero es el gesto natural del género en móvil y evita que el pulgar tape parte de la pantalla apuntando a un botón pequeño. Esta spec no reemplaza el D-pad: lo deja como una de dos opciones que el jugador elige y la plataforma recuerda.

## Alcance

**Incluye:**

- Un componente compartido nuevo `components/games/touch-gestures.tsx`: un overlay `<div>` transparente posicionado en `absolute; inset: 0` **dentro de `.crt-screen`**, por encima del `<canvas>` (`z-index: 4`, debajo del overlay de pausa que ya usa `z-index: 5`), que captura `touchstart`/`touchmove`/`touchend`/`touchcancel` y clasifica el gesto. Solo visible bajo `@media (pointer: coarse)` (`display: none` en el resto). No toca ningún `*-canvas.tsx` ni ningún `engine.ts`.
- **Clasificación del gesto** al terminar el toque (`touchend`), usando el primer toque activo (multi-touch se ignora):
  - Se calcula `Δx = xFin − xInicio`, `Δy = yFin − yInicio` en píxeles CSS relativos al overlay.
  - **Tap:** `max(|Δx|, |Δy|) < 10px` → emite el `code` de `map.tap` si el juego lo define; si no, no hace nada.
  - **Swipe:** eje dominante = el de mayor valor absoluto. Si `|dominante| ≥ 24px` y el juego define un `code` para esa dirección (`left`/`right` si el eje dominante es X según el signo de `Δx`; `up`/`down` si es Y según el signo de `Δy`), se emite ese `code`.
  - **Zona muerta:** `10px ≤ max(|Δx|, |Δy|) < 24px` → no se emite nada (evita que un tap descuidado dispare un swipe).
- **Emisión de input:** por cada gesto reconocido, el overlay hace `window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }))` e inmediatamente después (mismo tick) el `keyup` correspondiente — misma función `dispatchKey` y mismo contrato que `TouchControls` (spec 12). Un gesto = un par `keydown`/`keyup`. **No hay auto-repeat**: mantener el dedo quieto tras un swipe no repite la acción; para mover dos veces se hace swipe dos veces.
- **Sin feedback visual del gesto:** el overlay es completamente transparente y no dibuja nada (ni línea, ni flecha, ni rastro). El feedback lo da la propia reacción del juego al `code` emitido, igual que con el teclado físico. (Decisión del usuario durante la implementación; ver "Decisiones tomadas y descartadas".)
- **`touch-action: none`** en el overlay y `preventDefault()` en `touchmove`, para que arrastrar sobre el canvas no haga scroll de la página, zoom ni pull-to-refresh mientras se está en modo gestos.
- **Config por juego, local en `components/jugar-client.tsx`** (constante `GESTURE_CONFIG`, mismo patrón que `TOUCH_DIRECTIONS` de la spec 12 — no se toca `lib/games/registry.ts`):
  - `2048`, `snake`, `frogger`: `{ up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }` (sin `tap`).
  - `tetris`: `{ left: "ArrowLeft", right: "ArrowRight", down: "Space", tap: "ArrowUp" }` — swipe ←/→ mueve la pieza, swipe ↓ es hard drop (`Space`), tap rota (`ArrowUp`), swipe ↑ no hace nada.
  - Cualquier juego ausente de `GESTURE_CONFIG` (`asteroides`, `arkanoid`, `sinapsis`, `sifon`) no tiene modo gestos: se comporta exactamente como hoy (solo D-pad), sin toggle.
- **Toggle Gamepad/Gestos en `MobileFooter`.** `MobileFooterProps` gana tres campos opcionales: `touchMode?: "gamepad" | "gestures"`, `onToggleTouchMode?: () => void`, `gesturesAvailable?: boolean`. Cuando `gesturesAvailable` es `true`, se renderiza un botón entre PAUSA y el selector de skin cuyo texto es `GESTOS` o `GAMEPAD` según el modo activo; al pulsarlo alterna el modo. Cuando es `false` (juegos sin `GESTURE_CONFIG`), el botón no se renderiza y `MobileFooter` se ve igual que hoy.
- **Persistencia por juego.** `jugar-client.tsx` guarda el modo en `localStorage` con la clave `av_touch_mode_${game.id}` (valores `"gamepad"` / `"gestures"`), leída **solo dentro de un `useEffect` post-hidratación** (mismo patrón que `av_skin_${id}` en `jugar-client.tsx:52-63` y que `auth-provider.tsx`), para no romper la igualdad de markup server/cliente.
- **Modo por defecto (sin preferencia guardada):** `"gestures"` para los cuatro juegos de `GESTURE_CONFIG`. El jugador cambia a `GAMEPAD` con el toggle y esa elección se recuerda para ese juego.
- **Renderizado condicional en `jugar-client.tsx`:**
  - `gestureMap = GESTURE_CONFIG[game.id]`; `gesturesActive = !!gestureMap && touchMode === "gestures"`.
  - Si `registered && gesturesActive`: se renderiza `<TouchGestures map={gestureMap} disabled={paused || over} />` dentro de `.crt-screen`, después del `<registered.Canvas>`, y **no** se renderiza `<TouchControls>`.
  - Si `registered && !gesturesActive`: se renderiza `<TouchControls>` como hoy (juegos sin gestos, y juegos con gestos en modo `GAMEPAD`), y **no** `<TouchGestures>`.
  - `<MobileFooter>` recibe `gesturesAvailable={!!gestureMap}`, `touchMode` y `onToggleTouchMode`.
- **`disabled` en `TouchGestures`** (`paused || over`): añade la clase `is-disabled` (`pointer-events: none`) y el overlay ignora todos los eventos táctiles mientras el juego está en pausa o en el modal de fin de partida.
- **Cambiar de modo durante la partida** solo intercambia los controles en vivo: no pausa, no reinicia el motor, no toca el score ni el `engineRef`.

**No incluye (fuera de alcance):**

- **`arkanoid` y su "arrastre de pala" (la pala sigue el dedo).** Requiere un método nuevo en `ArkanoidEngine` / `GameEngineHandle` para posicionar la pala por X absoluta (el swipe direccional no aporta nada frente al D-pad en ese juego). Queda para una spec futura dedicada a ese patrón (`paddle-drag`).
- Gestos para `asteroides`, `sinapsis`, `sifon` — su control (empuje/rotación continua, cursor de rejilla, rotación continua) no mapea limpio a cuatro swipes discretos.
- Auto-repeat de gestos (mantener el dedo para repetir la acción), joystick virtual arrastrable, gestos multi-dedo (pellizco, dos dedos).
- Soft drop continuo en `tetris` por gesto: el swipe ↓ es hard drop; el soft drop (`ArrowDown` sostenido) solo está disponible en modo `GAMEPAD`.
- Vibración háptica al reconocer un gesto (`navigator.vibrate`).
- Cualquier cambio a `EngineStats`, `EngineCallbacks`, `GameCanvasProps`, `RegisteredGame`, a `lib/games/registry.ts`, a los `*-canvas.tsx`, a los `engine.ts`, o a la tabla `games`/`scores`.
- Cambios en desktop (sin `pointer: coarse`): nada cambia, ni el `player-hud`, ni el teclado físico, ni el render.
- Rutas fuera de `/juego/[id]/jugar`.

## Modelo de datos

No se introduce ninguna tabla, fila ni tipo en Supabase, ni se modifica el contrato de `lib/games/registry.ts`. Toda la configuración nueva es local a la capa de presentación.

```tsx
// components/jugar-client.tsx
type GestureCode =
  "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Space";
type GestureMap = Partial<
  Record<"up" | "down" | "left" | "right" | "tap", GestureCode>
>;
const GESTURE_CONFIG: Record<string, GestureMap> = {
  "2048": {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  },
  snake: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  },
  frogger: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  },
  tetris: {
    left: "ArrowLeft",
    right: "ArrowRight",
    down: "Space",
    tap: "ArrowUp",
  },
};
type TouchMode = "gamepad" | "gestures";
// clave localStorage: `av_touch_mode_${game.id}`
```

```tsx
// components/games/touch-gestures.tsx
"use client";
export type TouchGesturesProps = {
  map: GestureMap; // desde GESTURE_CONFIG[game.id]
  disabled?: boolean; // paused || over → ignora eventos
};
export function TouchGestures({ map, disabled }: TouchGesturesProps) {
  // overlay absolute inset:0 dentro de .crt-screen, transparente, sin render
  // touchstart → guarda { x0, y0, id }
  // touchmove  → preventDefault (evita scroll/zoom/pull-to-refresh)
  // touchend   → clasifica (tap / swipe / zona muerta) y dispara
  //              dispatchKey("keydown", code) + dispatchKey("keyup", code)
  //              sobre window (misma fn que touch-controls.tsx)
}
```

Constantes del componente: `TAP_MAX_PX = 10`, `SWIPE_MIN_PX = 24`.

```tsx
// components/games/mobile-footer.tsx — campos añadidos a MobileFooterProps
export type MobileFooterProps = {
  paused: boolean;
  onTogglePause: () => void;
  skins?: { id: string; label: string }[];
  skin?: string;
  onSkinChange?: (id: string) => void;
  onExit: () => void;
  touchMode?: "gamepad" | "gestures"; // nuevo
  onToggleTouchMode?: () => void; // nuevo
  gesturesAvailable?: boolean; // nuevo; si false, el botón no se renderiza
};
```

No se añade ningún campo a `EngineStats` ni a `GameEngineHandle`: los motores siguen recibiendo únicamente `KeyboardEvent`, indistinguibles de una pulsación física, igual que en la spec 12.

## Plan de implementación

1. **Componente `TouchGestures` — captura y clasificación, sin rastro.** Crear `components/games/touch-gestures.tsx` con el overlay `absolute; inset: 0`, `touch-action: none`, listeners `touchstart`/`touchmove`/`touchend`/`touchcancel`, y la lógica tap / swipe / zona muerta descrita en Alcance (umbrales `TAP_MAX_PX` / `SWIPE_MIN_PX`, eje dominante por `|Δ|` mayor). Emite `keydown`+`keyup` sobre `window` reutilizando una `dispatchKey` idéntica a la de `touch-controls.tsx`. Respeta `disabled`. Verificación: en una página de prueba temporal o vía Playwright, simular un `touchstart` en (100,100) y `touchend` en (100,160) y confirmar que `window` recibe `keydown` + `keyup` con `code: "ArrowDown"`; un `touchend` en (100,105) (tap) no emite nada para `2048` y emite `ArrowUp` para el `map` de `tetris`.
2. **Sin feedback visual.** ~~Rastro visual SVG.~~ Descartado por decisión del usuario durante la implementación: el overlay no dibuja nada. El feedback lo da la reacción del juego al `code` emitido, igual que con el teclado. No hay `<svg>`, ni `TRAIL_FADE_MS`, ni regla `.touch-gestures-trail`.
3. **CSS del overlay.** En `app/globals.css`: `.touch-gestures { position: absolute; inset: 0; z-index: 4; display: none; touch-action: none; }`, `.touch-gestures.is-disabled { pointer-events: none; }`, y dentro del bloque `@media (pointer: coarse)` existente (`app/globals.css:1419`): `.touch-gestures { display: block; }`. Verificación: en desktop el overlay nunca se muestra ni intercepta clics; en viewport táctil ocupa exactamente el área de `.crt-screen`.
4. **Toggle en `MobileFooter`.** Añadir los tres campos opcionales a `MobileFooterProps` y renderizar, solo si `gesturesAvailable`, un `<button className="btn">` entre PAUSA y el `<select>` de skin con texto `GESTOS`/`GAMEPAD` según `touchMode`, que llama `onToggleTouchMode`. Verificación: `MobileFooter` de un juego sin gestos (`asteroides`) se ve igual que hoy; el de `snake` muestra el botón y su texto cambia al pulsarlo.
5. **Estado y persistencia en `jugar-client.tsx`.** Añadir `GestureCode`/`GestureMap`/`GESTURE_CONFIG`/`TouchMode`, un `useState<TouchMode>` inicializado a `"gestures"`, un `useEffect` post-hidratación que lee `localStorage.getItem(\`av_touch_mode_${game.id}\`)`y aplica el valor si es válido (mismo patrón que el`useEffect`de skin en las líneas 52-63), y un`handleToggleTouchMode`que alterna el estado y hace`localStorage.setItem`. Verificación: elegir `GAMEPAD`en`/juego/snake/jugar`, recargar, y comprobar que sigue en `GAMEPAD`; `/juego/tetris/jugar`arranca en`GESTOS` la primera vez.
6. **Cableado condicional en `jugar-client.tsx`.** Calcular `gestureMap` y `gesturesActive`; renderizar `<TouchGestures map={gestureMap} disabled={paused || over} />` dentro de `.crt-screen` tras el `<registered.Canvas>` cuando `registered && gesturesActive`; renderizar `<TouchControls>` (como hoy) cuando `registered && !gesturesActive`; pasar `gesturesAvailable`, `touchMode`, `onToggleTouchMode` a `<MobileFooter>`. Verificación: en viewport táctil, `snake` en modo gestos no muestra D-pad y sí el overlay; al pulsar `GAMEPAD` aparece el D-pad y el overlay desaparece, sin reiniciar la partida ni el score.
7. **Verificación en navegador (los 4 juegos + regresión).** Con DevTools en touch-simulation (o dispositivo real), viewport ~375×667: para `2048`, `snake`, `frogger`, `tetris` — cada swipe direccional produce el mismo efecto que la flecha física correspondiente; en `tetris` el tap rota y el swipe ↓ hace hard drop; arrastrar sobre el canvas no hace scroll de la página; el toggle alterna y persiste por juego; en pausa y en el modal de fin de partida el overlay no responde; GUARDAR PUNTUACIÓN sigue funcionando. Para `asteroides`, `arkanoid`, `sinapsis`, `sifon` — sin toggle, sin overlay, D-pad igual que antes. En desktop (sin `pointer: coarse`) los ocho juegos se ven y se controlan exactamente como antes de esta spec. Confirmar `npm run build` sin errores.

## Criterios de aceptación

- [ ] En viewport táctil (`pointer: coarse`), `/juego/2048/jugar`, `/juego/snake/jugar`, `/juego/frogger/jugar` y `/juego/tetris/jugar` arrancan (sin preferencia guardada) en modo **gestos**: overlay activo, D-pad oculto.
- [ ] Un swipe de ≥24px en una dirección con `code` definido para ese juego dispara un `keydown`+`keyup` con ese `code` sobre `window`, y el motor reacciona igual que a la flecha física.
- [ ] Un desplazamiento de entre 10px y 24px no dispara ninguna acción.
- [ ] En `tetris`, un tap (<10px de desplazamiento) rota la pieza (`ArrowUp`) y un swipe hacia abajo hace hard drop (`Space`); en `2048`/`snake`/`frogger` un tap no hace nada.
- [ ] El overlay no dibuja ningún feedback visual (ni línea, ni flecha, ni rastro) al hacer un gesto.
- [ ] Arrastrar sobre el canvas en modo gestos no produce scroll de la página, zoom ni pull-to-refresh.
- [ ] El botón `GESTOS`/`GAMEPAD` aparece en `MobileFooter` solo para los cuatro juegos con `GESTURE_CONFIG`, y su texto refleja el modo activo.
- [ ] Al pulsar el toggle, los controles cambian en vivo (overlay ↔ D-pad) sin pausar ni reiniciar la partida ni alterar el score.
- [ ] El modo elegido se guarda en `localStorage` con clave `av_touch_mode_${id}` y se restaura al recargar, de forma independiente por juego.
- [ ] En pausa y en el modal de fin de partida, el overlay de gestos no responde a toques.
- [ ] `asteroides`, `arkanoid`, `sinapsis` y `sifon` no muestran toggle ni overlay y se controlan con el D-pad igual que antes de esta spec.
- [ ] En desktop (sin `pointer: coarse`), ningún juego cambia: sin overlay, sin toggle visible en efecto, `player-hud` y teclado físico intactos.
- [ ] No se modificó `lib/games/registry.ts`, ningún `*-canvas.tsx`, ningún `engine.ts`, ni `EngineStats`/`GameEngineHandle`.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Gestos como segundo modo con toggle, no como reemplazo del D-pad.** Decisión explícita del usuario. Algunos jugadores prefieren botones fijos; el toggle en `MobileFooter` con memoria por juego (`av_touch_mode_${id}`) da ambas opciones sin obligar a ninguna. Se descartó "el juego declara su único modo" (quitaba la opción de volver al D-pad) y "ambos activos a la vez sobre el canvas" (un swipe accidental mientras se apunta al D-pad dispararía acciones no deseadas).
- **Modo gestos por defecto en los cuatro juegos.** Decisión explícita del usuario. En `2048`/`snake`/`frogger`/`tetris` el swipe sobre el tablero es el control canónico del género en móvil; se apuesta por el mejor control de fábrica y se deja el D-pad a un toque.
- **Config por juego en una constante local de `jugar-client.tsx` (`GESTURE_CONFIG`), no en `lib/games/registry.ts`.** Decisión explícita del usuario. Es coherente con cómo la spec 12 puso `TOUCH_DIRECTIONS` (también local a `jugar-client.tsx`) y mantiene `RegisteredGame` cerrado. Contra: la config de un juego queda repartida entre el registro y `jugar-client.tsx` — se acepta por consistencia con el precedente de la spec 12.
- **Input por `KeyboardEvent` sintético sobre `window`, igual que la spec 12.** Los cuatro motores ya escuchan `keydown`/`keyup` a nivel `window`; un evento sintético con el mismo `code` es indistinguible de una tecla física. Cero cambios de motor, cero extensión del contrato. Se descartó exponer métodos de gesto en `GameEngineHandle` (obligaría a tocar los motores para un beneficio equivalente).
- **`arkanoid` fuera de esta spec.** Decisión explícita del usuario. El valor real del gesto en `arkanoid` es "la pala sigue el dedo" (posición X absoluta), que **no** se puede expresar como pulsación de flecha y exigiría un método nuevo en `ArkanoidEngine` y en `GameEngineHandle`. Reducir `arkanoid` a swipe ←/→ discreto no mejoraría nada frente al D-pad. Se difiere a una spec dedicada al patrón `paddle-drag`, que probablemente cubra también otros juegos de posicionamiento absoluto.
- **`tetris` dentro, con tap = rotar y swipe ↓ = hard drop.** Decisión explícita del usuario. Es el mapeo más ambiguo (hay que calibrar tap vs. swipe), pero cubre todo el control sin botones. La zona muerta de 10–24px reduce los falsos positivos entre tap y swipe corto. El soft drop sostenido no se mapea a gesto (queda en modo `GAMEPAD`); el hard drop lo cubre en la práctica.
- **Umbrales fijos (`TAP_MAX_PX = 10`, `SWIPE_MIN_PX = 24`) en píxeles CSS, no proporcionales al canvas.** Son distancias de dedo, no de juego; escalar con el canvas las haría inconsistentes entre dispositivos. Valores alineados con los defaults típicos de detección de swipe en librerías móviles.
- **Sin auto-repeat de gestos.** El D-pad simula auto-repeat con `setInterval` porque un botón sostenido debe comportarse como tecla sostenida. Un swipe es intrínsecamente discreto: mantener el dedo quieto tras el swipe no es una intención de "repetir". Para `snake`/`2048`/`frogger` un gesto = un paso es exactamente lo esperado; para el movimiento lateral de `tetris` también.
- **Overlay `<div>` propio, no listeners en el `<canvas>`.** Decisión explícita del usuario. Un overlay dedicado no compite con los listeners del motor, no obliga a editar los ocho `*-canvas.tsx`, y concentra todo el código de gestos en un componente.
- **Sin feedback visual del gesto (rastro descartado).** La spec original incluía un rastro SVG (línea inicio→dedo + flecha, `--cyan`, fade 200 ms). Descartado por el usuario durante la implementación: el overlay queda totalmente transparente. Razón: la reacción inmediata del juego al `code` emitido (ficha que se desliza, pieza que cae/rota, rana que salta) ya es feedback suficiente, y el rastro añadía ruido visual sobre el tablero. Se elimina el `<svg>` interno, la constante `TRAIL_FADE_MS` y la regla CSS `.touch-gestures-trail`.
- **`z-index: 4` para el overlay.** Por encima del `<canvas>` para capturar toques, por debajo del overlay de pausa (`z-index: 5`, `jugar-client.tsx:175`) para que "EN PAUSA" siga tapando el área y el overlay quede además inerte por `disabled`.
- **Persistencia leída solo en `useEffect` post-hidratación.** Mismo patrón que `av_skin_${id}` y `auth-provider.tsx`: leer `localStorage` en el render rompería la igualdad de markup server/cliente de Next.
- **Numeración 23, saltando la 22.** `specs/` llega hasta la 21; la 20 está tomada por el draft `specs/game-jam/sifon/20-sifon-mecanicas.md` y la spec 21 (Approved) reserva explícitamente "la spec 22" para las mecánicas avanzadas de `2048`. Se continúa desde la 23 para no colisionar con esa reserva, igual que la spec 21 saltó la 20.

## Riesgos identificados

| Riesgo                                                                                                                                                     | Mitigación                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin `preventDefault()` en `touchmove` + `touch-action: none`, arrastrar sobre el canvas hace scroll de la página o dispara pull-to-refresh.                | Ambos se aplican en el paso 1/3 y se verifican explícitamente en el paso 7.                                                                                                                                         |
| Un tap descuidado con micro-movimiento se clasifica como swipe corto y dispara una dirección no deseada (sobre todo en `tetris`, donde el tap es "rotar"). | Zona muerta 10–24px: nada se emite en ese rango.                                                                                                                                                                    |
| Swipes rápidos opuestos en `snake` (↑ e inmediatamente ↓) provocan muerte instantánea.                                                                     | Comportamiento idéntico al del teclado físico; no es un caso nuevo introducido por esta spec.                                                                                                                       |
| `2048` bufferea una sola pulsación durante la animación de ~200ms; swipes encadenados rápidos podrían "perderse".                                          | Idéntico al comportamiento con teclado físico y con el D-pad (spec 12); documentado, sin cambio.                                                                                                                    |
| El overlay tapa el `<canvas>` y podría interceptar toques destinados a un futuro control in-canvas.                                                        | El overlay solo existe cuando `gesturesActive`; en modo `GAMEPAD` o en juegos sin `GESTURE_CONFIG` no se renderiza.                                                                                                 |
| `@media (pointer: coarse)` no cubre el 100% de híbridos táctil+mouse (algunos reportan `pointer: fine`).                                                   | Límite conocido y heredado de la spec 12; sin lógica de fallback adicional. En el peor caso el jugador con teclado no ve el overlay y usa las teclas, que siguen funcionando.                                       |
| `localStorage` deshabilitado (modo privado) hace fallar la lectura/escritura del modo.                                                                     | La lectura va en `try` implícito del patrón existente; si falla, el modo queda en el default (`"gestures"`) y el juego funciona igual, solo no recuerda la preferencia.                                             |
| Coordenadas del gesto mal calculadas si `.crt-screen` está escalado por CSS (el canvas usa `max-width: 100%`).                                             | Los umbrales se comparan en píxeles CSS del overlay (`getBoundingClientRect` / coordenadas de `Touch` en el mismo espacio), no en píxeles lógicos del canvas; el gesto no necesita mapearse a coordenadas de juego. |

## Lo que **no** entra en esta spec

- Arrastre de pala ("la pala sigue el dedo") en `arkanoid` — spec futura de `paddle-drag`.
- Gestos para `asteroides`, `sinapsis`, `sifon`.
- Auto-repeat de gestos, joystick virtual, gestos multi-dedo, vibración háptica.
- Soft drop continuo por gesto en `tetris`.
- Cualquier cambio a los motores, a los `*-canvas.tsx`, al contrato de `registry.ts` o a `EngineStats`.
