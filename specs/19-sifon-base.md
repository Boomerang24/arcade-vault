# 19 — Juego: SIFÓN

**Estado:** Approved
**Depende de:** SPEC 05, SPEC 06, SPEC 07
**Fecha:** 2026-08-30

**Objetivo:** Crear un juego original y jugable "SIFÓN" en `/juego/sifon/jugar` — un sifón presurizado en la base de un tanque de refresco que dispara burbujas de colores hacia arriba para formar racimos de 3 o más y vaciar el tanque antes de que la prensa del techo aplaste la línea de peligro — con motor de disparo continuo + rejilla hexagonal en un solo canvas registrado vía `GAME_REGISTRY` e integrado con el leaderboard real de Supabase.

## Alcance

**Incluye:**

- Nueva entrada `sifon` en la tabla `games` de Supabase: `title: "SIFÓN"`, `cat: "PUZZLE"`, `color: "yellow"`, `cover: "cover-glot"` (clase CSS ya existente en `app/globals.css`, sin uso en ninguna fila de `games` — se reutiliza tal cual, sin crear CSS nuevo). `short`/`long` se redactan durante `/spec-impl`, mismo tono arcade retro que el resto del catálogo (igual criterio que specs 05, 07, 08 y 09). `best: 0`, `plays: "0"` — juego recién estrenado, sin datos mock inflados.
- Motor de SIFÓN escrito **desde cero** en TypeScript (`lib/games/sifon/engine.ts`). No hay `game.js` de origen en `references/started-games/` ni assets externos: todo se dibuja con primitivas de canvas (círculos con gradiente radial, líneas, `shadowBlur` para el glow neón), mismo criterio que Asteroides, Tetris y Voltio.
- **Tema y ficción del juego:** una planta embotelladora subterránea. El jugador maneja el **sifón**, una boquilla presurizada anclada en la base de un tanque de refresco, y dispara burbujas de sirope de colores contra la masa pegada al techo. El "techo que baja" del género es la **prensa** del tanque, que desciende un escalón cada vez que el **manómetro** se llena de presión acumulada por los disparos. La derrota es que la masa de burbujas cruce la **línea de peligro** marcada sobre la boquilla.
- **Tablero.** Canvas 800×600, mismas dimensiones que `AsteroidesCanvas`/`ArkanoidCanvas`/`SnakeCanvas`/`VoltioCanvas`. El área jugable no ocupa el canvas entero: es un **pozo vertical central** flanqueado por dos paneles de HUD dibujados dentro del propio canvas.
  - Pozo jugable: `x ∈ [166, 634]` (468px de ancho), `y ∈ [60, 600]`.
  - Panel izquierdo (`x < 166`): puntuación, nivel y vidas (cargas de purga).
  - Panel derecho (`x > 634`): cola de las 2 próximas burbujas y manómetro de presión.
  - Franja superior (`y < 60`): rótulo del tanque y posición actual de la prensa.
  - **Línea de peligro** en `y = 500`, dibujada como banda de aviso a rayas.
  - Boquilla del sifón fija en `(400, 545)`.
- **Rejilla hexagonal.** Burbujas de diámetro `D = 36` (radio 18). Filas alternadas: las de offset 0 tienen 13 celdas con centro en `x = 184 + 36·c` (`c = 0..12`); las de offset `D/2` tienen 12 celdas con centro en `x = 202 + 36·c` (`c = 0..11`). Separación vertical entre filas `36·sin(60°) ≈ 31px`; la fila `r` tiene centro en `y = techoY + 18 + 31·r`, donde `techoY` es el borde inferior de la prensa (arranca en 60). Vecindario hexagonal de 6 celdas, con la lista de offsets dependiente de la paridad de la fila.
- **Disparo y física del proyectil.** La boquilla apunta con un ángulo entre −75° y +75° respecto de la vertical. Al disparar, la burbuja viaja en línea recta a ~620 px/s con integración por delta-time, **rebota elásticamente** contra las paredes laterales del pozo (`x = 166` y `x = 634`, reflejando la componente horizontal) y se detiene al primer contacto: colisión círculo-círculo (distancia entre centros `< D`) contra cualquier burbuja de la masa, o contacto con el borde inferior de la prensa.
- **Snap a la rejilla.** Al detenerse, la posición del proyectil se convierte a coordenadas de rejilla (`r = round((y − techoY − 18) / 31)`, `c` según la paridad de esa fila) y se ocupa esa celda si está libre; si está ocupada, se ocupa la **celda hexagonal vacía más cercana al centro del proyectil** entre las vecinas de la burbuja golpeada. Nunca puede quedar una burbuja fuera del pozo ni superpuesta a otra.
- **Racimos y desprendimiento.** Tras el snap: flood-fill del mismo color desde la celda recién ocupada por vecindario hexagonal. Si el racimo tiene **3 o más** burbujas, todas revientan. Después de cada reventón, segundo flood-fill de _conectividad_ desde todas las burbujas que tocan la prensa: cualquier burbuja no alcanzada queda **flotando** y cae (se elimina con animación de caída con gravedad, sin colisionar con nada). Si el racimo es de 2 o menos, no pasa nada y la burbuja se queda pegada.
- **Colores.** 4 colores base tomados del sistema visual del sitio: cian, magenta, amarillo y verde. La burbuja cargada y las 2 siguientes se eligen **solo entre colores presentes en el tanque** (si un color ya no existe en la masa, deja de salir) — regla anti-frustración clásica del género.
- **Manómetro y descenso de la prensa.** Cada disparo suma 1 de presión. Al alcanzar el umbral del nivel (8 disparos en nivel 1, bajando 1 por nivel hasta un piso de 4), la prensa desciende **una fila** (`techoY += 31`), la paridad de offset de todas las filas se invierte respecto de la prensa, la masa entera baja con ella y la presión vuelve a 0. Reventar burbujas **no** reduce la presión: solo la aleja del desastre limpiando la masa.
- **Vidas reales y purga.** 3 vidas. Si tras el descenso de la prensa o tras un snap alguna burbuja tiene su centro por debajo de la línea de peligro (`y ≥ 500`), se pierde una vida: `state` pasa a `"dead"` durante ~1.2s con animación de purga (destello y vaciado), se **eliminan las 3 filas inferiores** de la masa, la prensa **sube 3 filas** (`techoY −= 93`, nunca por encima de 60), la presión se pone a 0 y se vuelve a `"playing"`. Con 0 vidas restantes, `state` pasa a `"gameover"` y se invoca `onGameOver(score)` una sola vez.
- **Puntuación.** +10 por cada burbuja reventada en un racimo, +20 por cada burbuja desprendida que cae (las caídas valen el doble, para premiar los cortes por debajo), y +1000 al vaciar el tanque por completo.
- **Progresión de nivel.** `level` empieza en 1 y sube 1 al **vaciar el tanque** (masa sin burbujas). Al subir: la prensa vuelve a `techoY = 60`, se genera una masa nueva (5 filas en nivel 1, +1 fila por nivel hasta un tope de 8), baja el umbral del manómetro (−1 por nivel, piso 4) y se conservan las vidas restantes. La distribución de colores del tanque nuevo es determinista por nivel (tabla de patrones), no aleatoria pura.
- **Controles.** Solo teclado, capturados a nivel `window` con `preventDefault`, mismo patrón que `AsteroidesEngine`/`ArkanoidEngine`/`SnakeEngine`:
  - `←` / `→`: rotar la boquilla de forma continua mientras la tecla está presionada (~110°/s), con tope duro en ±75°.
  - `Espacio` o `↑`: disparar. Ignorado mientras ya hay un proyectil en vuelo.
  - `↓`: intercambiar la burbuja cargada con la siguiente de la cola (swap clásico del género), sin coste de presión y sin límite de uso.
- **Guía de puntería simple.** Un rayo punteado corto desde la boquilla en la dirección actual, **sin** predicción de rebotes. La trayectoria completa con rebotes se difiere a la spec 20.
- **HUD interno en canvas.** Panel izquierdo (puntuación, nivel, vidas), panel derecho (cola de 2 burbujas + manómetro vertical que se llena), franja superior (posición de la prensa). Overlays internos de PAUSA y GAME OVER, mismo criterio que el resto de motores del catálogo.
- **Motor de un solo canvas (caso estándar):** constructor `(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)`, métodos `pause/resume/reset/forceGameOver/destroy`.
- **Integración vía el registry ya existente** (`lib/games/registry.ts`, desde spec 07): se agrega `sifon: { Canvas: SifonCanvas }` a `GAME_REGISTRY`. **`components/jugar-client.tsx` no se toca** — el guard `registered = getRegisteredGame(game.id)` ya cubre cualquier id presente en el registry.
- Integración con el leaderboard real ya existente (patrón spec 06): guardar puntuación inserta en `scores` con `game_id: "sifon"` y aparece en `/juego/sifon` y `/salon-de-la-fama` sin código nuevo.

**No incluye (fuera de alcance):**

- Burbujas especiales (bomba, comodín, plomo), guía de trayectoria con rebotes, combos/multiplicadores, audio y partículas — todo eso vive en la spec 20 (mecánicas). Esta spec entrega el juego completo y jugable de punta a punta sin ellos.
- Un quinto color de burbuja: en la base son siempre 4. El color extra por nivel alto se evalúa en la spec 20.
- Cambios a `EngineStats`, `EngineCallbacks`, `GameEngineHandle`, `GameCanvasProps` o a la forma de `RegisteredGame`.
- Ramas específicas de `sifon` en `components/jugar-client.tsx` o en cualquier componente compartido.
- CSS nuevo: `cover-glot` ya existe y se reutiliza sin modificarla.
- Assets binarios (`public/games/sifon/` no se crea): todo el arte es procedural en canvas.
- `skins` y `touchActions` en la entrada del registry: los añaden después `@skin-designer` y `@mobile-porter` (o `/spec-impl-game`, que los encadena). El juego nace sin ellos, igual que el resto del catálogo.
- Modo contrarreloj, modo puzzle con tableros fijos autorales, o modo versus a dos jugadores.
- Cambios a `asteroides`, `tetris`, `arkanoid`, `snake`, `frogger` o `sinapsis`.

## Modelo de datos

Se agrega una fila a la tabla `games` de Supabase (esquema sin cambios desde spec 06: `id, title, short, long, cat, cover, color, best, plays`); no se introduce ningún tipo nuevo en `lib/games.ts`.

| Campo   | Valor                                                                    |
| ------- | ------------------------------------------------------------------------ |
| `id`    | `sifon`                                                                  |
| `title` | `SIFÓN`                                                                  |
| `short` | Redactado en `/spec-impl`, tono arcade retro, una línea                  |
| `long`  | Redactado en `/spec-impl`, 2–3 frases con la ficción de la embotelladora |
| `cat`   | `PUZZLE`                                                                 |
| `cover` | `cover-glot`                                                             |
| `color` | `yellow`                                                                 |
| `best`  | `0`                                                                      |
| `plays` | `"0"`                                                                    |

Se introduce un módulo de motor de juego, ajeno a React, con el **caso estándar** del contrato (un solo canvas, loop por frame con física continua del proyectil y estado discreto de la rejilla — igual forma externa que `AsteroidesEngine`/`ArkanoidEngine`/`SnakeEngine`):

```ts
// lib/games/sifon/engine.ts
export type EngineStats = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
};

export type EngineCallbacks = {
  onStats: (stats: EngineStats) => void; // se invoca en cada frame
  onGameOver: (finalScore: number) => void; // se invoca una sola vez al entrar en "gameover"
};

export class SifonEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  pause(): void;
  resume(): void;
  reset(): void; // vuelve a "playing" con score 0, 3 vidas, nivel 1, prensa arriba, tanque del nivel 1
  forceGameOver(): void; // termina la partida ya (botón FIN)
  destroy(): void; // cancela el loop y remueve listeners de teclado
}
```

```tsx
// components/games/sifon-canvas.tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { SifonEngine, type EngineStats } from "@/lib/games/sifon/engine";

export type SifonCanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};

type Props = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};

export const SifonCanvas = forwardRef<SifonCanvasHandle, Props>(
  function SifonCanvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<SifonEngine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new SifonEngine(canvasRef.current, {
        onStats: (s) => onStatsRef.current(s),
        onGameOver: (s) => onGameOverRef.current(s),
      });
      engineRef.current = engine;
      return () => engine.destroy();
    }, []);

    useImperativeHandle(ref, () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      reset: () => engineRef.current?.reset(),
      forceGameOver: () => engineRef.current?.forceGameOver(),
    }));

    return <canvas ref={canvasRef} width={800} height={600} />;
  },
);
```

**Mapeo de `EngineStats`:**

- `score`: puntuación acumulada (+10 por burbuja reventada, +20 por burbuja desprendida, +1000 por vaciar el tanque). Sin desviación del contrato.
- `lives`: cargas de purga restantes, de 3 a 0. **Sin mapeo forzado** — se decidió dar al juego vidas reales con respawn (purga de las 3 filas inferiores + prensa arriba) precisamente para no forzar el campo, a diferencia de Tetris (spec 07) y Snake (spec 09), que lo fijaron en 1/0. Ver Decisiones: la alternativa que sugería el TODO (`lives` = disparos restantes antes del descenso) se descartó por mentir en el HUD externo.
- `level`: nivel actual, empieza en 1 y sube 1 al vaciar el tanque; gobierna filas iniciales de la masa, umbral del manómetro y patrón de colores — mismo criterio que Tetris mapea nivel a velocidad de caída y Snake a intervalo de tick.
- `state`: `"playing"` durante la partida; `"dead"` durante la purga de ~1.2s tras cruzar la línea de peligro quedando vidas; `"gameover"` al agotar la tercera vida o al pulsar FIN.

La **presión del manómetro no viaja en `EngineStats`**: es estado interno del motor, se dibuja únicamente en el panel derecho del canvas y su consecuencia (el descenso de la prensa y, en última instancia, la pérdida de una vida) sí llega al HUD externo a través de `lives`. Mismo criterio que la barra de carga de VOLTIO.

Se agrega `sifon: { Canvas: SifonCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`, con el reexport de `SifonCanvasHandle` junto a los existentes. No se modifica la forma de `RegisteredGame`, `GameEngineHandle` ni `GameCanvasProps`.

## Plan de implementación

1. **Geometría de la rejilla hexagonal y render estático.** Crear `lib/games/sifon/engine.ts` con el loop de `requestAnimationFrame` basado en delta-time, las constantes del pozo (`x ∈ [166, 634]`, `D = 36`, paso vertical 31, línea de peligro en `y = 500`), y las funciones puras de conversión `celda → píxel` y `píxel → celda` con paridad de fila, más la lista de 6 vecinos por paridad. Dibujar el tanque vacío: paredes del pozo, prensa, banda de peligro, boquilla y los dos paneles laterales de HUD. Verificación: montando el motor sobre un canvas suelto se ve el tanque completo y estable; pintar temporalmente una rejilla de depuración confirma que `pixelDeCelda(celdaDePixel(p)) ≈ p` para puntos de prueba en ambas paridades.
2. **Masa inicial y dibujo de burbujas.** Añadir la estructura de la masa (matriz dispersa de celdas ocupadas con su color), el generador determinista del tanque por nivel (5 filas en nivel 1, patrón de colores de tabla) y el dibujo de cada burbuja como círculo con gradiente radial y brillo especular, con `shadowBlur` aplicado por lotes de color (no un `save`/`restore` por burbuja). Verificación: el tanque del nivel 1 aparece con 5 filas bien encajadas, sin huecos ni solapes en las juntas entre filas pares e impares.
3. **Boquilla, cola de burbujas y disparo.** Estado del cañón (ángulo con tope ±75°), cola de 2 burbujas siguientes, burbuja cargada, listener de teclado a nivel `window` con `preventDefault`: `←`/`→` rotan de forma continua mientras la tecla siga presionada, `Espacio`/`↑` disparan (ignorado si ya hay proyectil en vuelo), `↓` intercambia cargada y siguiente. Física del proyectil por delta-time con rebote elástico en las paredes laterales. Guía punteada corta en la dirección actual. Verificación: la boquilla rota suave y no pasa de ±75°, el proyectil sube y rebota en ambas paredes sin atravesarlas, y el swap con `↓` intercambia los colores visibles al instante.
4. **Colisión y snap.** Detección círculo-círculo (`dist < D`) del proyectil contra la masa, evaluada con submuestreo del desplazamiento del frame (ver Riesgos), más colisión con el borde inferior de la prensa. Al detenerse, resolver la celda destino: la celda de rejilla del punto de parada si está libre, o la vecina hexagonal vacía más cercana al centro del proyectil. Insertar la burbuja y limpiar el proyectil. Verificación: disparos a velocidad máxima nunca atraviesan la masa, ninguna burbuja queda solapada ni fuera del pozo, y los disparos rasantes a los bordes de la masa se pegan al lado correcto.
5. **Racimos, desprendimiento y puntuación.** Flood-fill de color desde la celda recién insertada; si el racimo es ≥3, reventar todo el racimo (+10 por burbuja). Después, flood-fill de conectividad desde las celdas de la fila pegada a la prensa; las burbujas no alcanzadas se marcan como flotantes, se animan cayendo con gravedad y suman +20 cada una. Verificación: un racimo de 3 revienta y uno de 2 no; cortar la base de una columna colgante hace caer todo el bloque de arriba y suma el doble por burbuja.
6. **Manómetro, descenso de la prensa y vaciado del tanque.** Sumar 1 de presión por disparo, y al alcanzar el umbral del nivel bajar la prensa una fila (`techoY += 31`), invertir la paridad de offset de la masa, mover todas las burbujas con ella y resetear la presión. Detectar tanque vacío: +1000, `level++`, prensa a `techoY = 60`, masa nueva del nivel siguiente, umbral −1 (piso 4), vidas intactas. Verificación: tras el número exacto de disparos del nivel la prensa baja un escalón visible y la masa entera lo acompaña; vaciar el tanque sube el nivel y regenera una masa más alta.
7. **Línea de peligro, vidas y purga.** Tras cada snap y tras cada descenso, comprobar si alguna burbuja tiene su centro en `y ≥ 500`: si sí, restar una vida, entrar en `"dead"` ~1.2s con animación de purga, eliminar las 3 filas inferiores de la masa, subir la prensa 3 filas (sin pasar de `y = 60`), resetear la presión y volver a `"playing"`. Con 0 vidas, `"gameover"` + `onGameOver(score)` una sola vez. Verificación: dejar que la prensa baje sin reventar nada cuesta exactamente una vida, tras la purga el tanque queda jugable y no se vuelve a disparar la condición de derrota en el mismo frame.
8. **HUD interno, pausa y control externo.** Dibujar el panel izquierdo (puntuación, nivel, vidas), el derecho (cola de 2 burbujas + manómetro vertical) y la franja superior, más los overlays internos de PAUSA y GAME OVER. Cablear `onStats` en cada frame con el mapeo de la sección Modelo de datos y los métodos `pause()/resume()/reset()/forceGameOver()/destroy()` con el mismo comportamiento que `AsteroidesEngine`. Verificación: `pause()` congela el proyectil en vuelo, la animación de caída y el reloj de delta-time (no solo el render); `reset()` deja score 0, 3 vidas, nivel 1, prensa arriba y tanque del nivel 1; `destroy()` cancela el loop y remueve los listeners.
9. **Canvas wrapper.** Crear `components/games/sifon-canvas.tsx` con la forma `forwardRef` exacta de la sección Modelo de datos. Verificación: el componente monta y desmonta sin errores de consola y sin loops huérfanos tras desmontar.
10. **Registry.** Agregar el import de `SifonCanvas` y la línea `sifon: { Canvas: SifonCanvas }` a `GAME_REGISTRY` en `lib/games/registry.ts`, más el reexport de `SifonCanvasHandle`. `jugar-client.tsx` no se toca. Verificación: `getRegisteredGame("sifon")` devuelve el `Canvas` correcto y los otros seis juegos siguen resolviendo.
11. **Fila `games`.** Insertar la fila `sifon` en Supabase vía `mcp__supabase__apply_migration` (migración `add_game_sifon`) con los valores de la tabla de Modelo de datos; `short`/`long` se redactan en este paso. Verificación: `select * from games where id = 'sifon';` devuelve la fila y la tarjeta aparece en `/` y `/biblioteca`.
12. **Verificación en navegador y build.** Recorrer `/` → tarjeta "SIFÓN" → `/juego/sifon` (detalle) → "Jugar ahora" → `/juego/sifon/jugar`. Verificar: la boquilla rota con `←`/`→`, `Espacio` dispara, `↓` intercambia burbujas, el proyectil rebota en las paredes y se pega a la rejilla sin solapes, un racimo de 3 revienta y suma +10 por burbuja, las burbujas desprendidas caen y suman +20, el manómetro se llena y la prensa baja un escalón, cruzar la línea de peligro cuesta una vida y purga las filas inferiores, vaciar el tanque suma +1000 y sube de nivel, el HUD interno y el `player-hud` externo (Puntuación/Vidas/Nivel) están sincronizados en cada frame, PAUSA congela el juego de verdad, FIN y game over muestran overlay interno + modal externo con la misma puntuación, GUARDAR PUNTUACIÓN llama `saveScore({ game: "sifon", score, name })` y la entrada aparece en `/juego/sifon` y `/salon-de-la-fama`, JUGAR DE NUEVO reinicia el motor, SALIR detiene el loop y remueve listeners sin errores de consola. Confirmar que Asteroides, Tetris, Arkanoid, Snake, Frogger y Sinapsis siguen intactos. Correr `npm run build` sin errores.

## Criterios de aceptación

- [ ] `sifon` aparece en `/` y `/biblioteca` con portada `cover-glot`, categoría PUZZLE y color yellow.
- [ ] `/juego/sifon` muestra el detalle con los textos `short`/`long` redactados en `/spec-impl`.
- [ ] `/juego/sifon/jugar` renderiza `SifonCanvas` (no el bloque decorativo `.game-arena`).
- [ ] `←`/`→` rotan la boquilla de forma continua y el ángulo nunca supera ±75° respecto de la vertical.
- [ ] `Espacio` y `↑` disparan; una segunda pulsación con un proyectil en vuelo se ignora.
- [ ] `↓` intercambia la burbuja cargada con la siguiente sin coste de presión.
- [ ] El proyectil rebota en las paredes laterales del pozo y nunca sale del área `x ∈ [166, 634]`.
- [ ] Toda burbuja disparada queda alineada a una celda hexagonal libre, sin solaparse con otra ni salirse del pozo.
- [ ] Un racimo de 3 o más del mismo color revienta y suma +10 por burbuja; uno de 2 no revienta.
- [ ] Las burbujas que quedan sin conexión con la prensa caen y suman +20 cada una.
- [ ] La burbuja cargada y las de la cola solo son de colores presentes en el tanque.
- [ ] Cada disparo suma 1 al manómetro y, al llegar al umbral del nivel, la prensa baja exactamente una fila arrastrando toda la masa y la presión vuelve a 0.
- [ ] Que una burbuja cruce la línea de peligro (`y ≥ 500`) resta exactamente una vida, purga las 3 filas inferiores y sube la prensa 3 filas.
- [ ] Vaciar el tanque suma +1000, incrementa `level`, regenera una masa con una fila más y baja el umbral del manómetro, conservando las vidas restantes.
- [ ] `lives` refleja vidas reales (3 → 0) y `state` pasa por `"dead"` durante la purga antes de volver a `"playing"`.
- [ ] `onGameOver` se invoca exactamente una vez por partida, con la puntuación final.
- [ ] El HUD interno del canvas y el `player-hud` HTML externo muestran siempre valores consistentes.
- [ ] PAUSA/REANUDAR congelan y reanudan realmente el proyectil en vuelo y las animaciones de caída (no solo el render).
- [ ] Guardar la puntuación inserta en `scores` y aparece en `/juego/sifon` y `/salon-de-la-fama`.
- [ ] `GAME_REGISTRY` incluye `sifon` y los seis juegos previos siguen funcionando sin regresión.
- [ ] `components/jugar-client.tsx` no tiene ni una línea nueva específica de `sifon`.
- [ ] `npm run build` pasa sin errores de tipos ni de build.

## Decisiones tomadas y descartadas

- **Juego original inspirado en el género "bubble shooter", no un port de Puzzle Bobble.** El tema recibido era "BURBUJAS: disparar burbujas para agrupar y reventar racimos, con un techo que baja". Se descartó reproducir dinosaurios y globos de feria: la reinterpretación como planta embotelladora (sifón presurizado, tanque, prensa, manómetro, purga) da una ficción propia que justifica cada mecánica con una pieza de maquinaria, y encaja con el sistema visual neón del sitio sin necesitar assets.
- **`id: "sifon"` / `title: "SIFÓN"`.** El id va sin tilde para mantener el slug limpio en la URL `/juego/sifon`; el título sí la lleva. Una sola palabra en mayúsculas, coherente con `TETRIS`/`SNAKE`/`ARKANOID`/`VOLTIO`/`SINAPSIS`. Libre frente a `lib/games/registry.ts` y frente a `select id from games`. Se descartaron `burbujas` y `bobble` por literales, y `espuma` por sonar a menos maquinaria.
- **`cat: "PUZZLE"` pese a que `VERSUS` está sin representar y `SHOOTER` tiene solo un juego.** El criterio de diversidad cede aquí: el género es de razonamiento espacial y planificación de cortes, no de reflejos ni de puntería nerviosa, y el proyectil es una herramienta de colocación, no un arma. Etiquetarlo `SHOOTER` lo pondría junto a Asteroides y mentiría sobre la experiencia; `VERSUS` directamente no aplica (es un solo jugador). Queda `PUZZLE`, que comparte con `tetris` y `sinapsis`, y a cambio ofrece el mejor contraste posible dentro de esa categoría: apuntado lateral con rebotes contra caída vertical (Tetris) y contra trazado de rutas (Sinapsis).
- **`color: "yellow"`.** Los cuatro colores del sistema ya están en uso, así que la elección es de coherencia y de legibilidad en la cuadrícula: `cyan` es de `tetris` y `magenta` de `sinapsis`, los otros dos PUZZLE — repetir uno de esos haría confundibles tres tarjetas de la misma categoría. `green` está doblemente usado (`snake`, `frogger`). `yellow` solo lo tiene `asteroides` (SHOOTER, portada gris de rocas), no hay colisión visual, y encaja con el ámbar del sirope.
- **`cover: "cover-glot"`.** La entrada del TODO afirmaba que no quedaba ninguna portada libre, pero `select cover from games` muestra que `cover-glot` y `cover-duelo` no las usa nadie: **no hace falta crear CSS nuevo** y no se crea. Entre las dos, `cover-glot` gana por composición: fondo radial oscuro con círculos brillantes en amarillo, magenta y cian: leen directamente como burbujas de colores, y su glow amarillo casa con el `color: "yellow"` elegido. Se descartó `cover-duelo` (dos palas y una pelota, evoca un versus de Pong).
- **`lives` con semántica real (3 cargas de purga), no "disparos antes del descenso".** El TODO proponía mapear `lives` a los disparos restantes antes de que baje el techo. Se descarta: el HUD externo compartido rotula ese campo como "Vidas", y ver "Vidas: 8" bajando a 1 y volviendo a 8 cada pocos segundos sería ruido incomprensible para el jugador. En su lugar, los disparos restantes viven en el **manómetro** dibujado dentro del canvas (mismo tratamiento que la barra de carga de VOLTIO) y `lives` se usa con su significado natural gracias a la mecánica de purga, que además da al juego un colchón de recuperación en vez de una muerte súbita.
- **Purga de 3 filas en vez de reinicio del tanque al perder una vida.** Vaciar el tanque entero al morir regalaría la limpieza que el jugador no supo hacer; dejarlo intacto haría que la vida siguiente se perdiera en el disparo inmediato. Quitar las 3 filas inferiores y subir la prensa 3 escalones devuelve exactamente el margen perdido, ni más ni menos.
- **La presión no entra en `EngineStats`.** Sería el candidato natural a un campo nuevo y se descarta explícitamente: el contrato del catálogo es cerrado por diseño (`CLAUDE.md`: "Never extend `EngineStats`"). Añadir un campo obligaría a tocar `jugar-client.tsx` y rompería el "una línea en `GAME_REGISTRY`" para el juego N+1.
- **Rejilla hexagonal con offset de filas, no rejilla cuadrada.** Una rejilla cuadrada simplificaría el snap y el vecindario a 4 u 8 celdas, pero destruye la identidad del género: con 6 vecinos los racimos son mucho más difíciles de leer de un vistazo y los cortes por desprendimiento se vuelven interesantes. La complejidad extra se concentra en dos funciones puras de conversión, que son lo primero que se implementa y se verifica (paso 1).
- **Colores restringidos a los presentes en el tanque.** Sin esta regla, el final de cada nivel degenera en disparar burbujas de colores que ya no existen y que solo empeoran la situación. Es la convención del género y se adopta en la base, no como mejora posterior.
- **Solo 4 colores en la base.** Cinco colores con un pozo de 13 celdas de ancho vuelve el nivel 1 caótico. El quinto color queda como palanca de dificultad para la spec 20, si hace falta.
- **Pozo central de 468px con paneles de HUD laterales dentro del mismo canvas 800×600.** Se descartó ensanchar el pozo a los 800px completos (haría los rebotes irrelevantes y la masa demasiado ancha para leerla) y se descartó reducir el canvas (rompería la consistencia de tamaño con el resto del catálogo dentro de `/juego/[id]/jugar`). El espacio sobrante se aprovecha para la cola de burbujas y el manómetro, que en este juego son información crítica.
- **Guía de puntería sin rebotes en la base.** Con rebote predicho el juego se vuelve notablemente más fácil; conviene decidir si se incluye jugando primero la versión honesta. Queda para la spec 20, donde puede evaluarse con el resto de ayudas.
- **Sin assets externos.** No se crea `public/games/sifon/`: burbujas, prensa, boquilla y tanque son círculos con gradiente y rectángulos con `shadowBlur`, en la línea de Asteroides y Tetris. Evita binarios y mantiene el bundle intacto.
- **Todo lo "jugoso" (burbujas especiales, combos, audio, partículas) se difiere a la spec 20.** Esta spec entrega un juego completo y guardable de punta a punta; la siguiente lo enriquece sin tocar el contrato. Así la primera puede implementarse, verificarse y mergearse sola.

## Riesgos identificados

- **Túnel del proyectil a 620 px/s.** A 60fps el proyectil avanza ~10px por frame, pero con un frame largo (pestaña recuperando foco, delta acumulado) puede saltar más de un diámetro y atravesar la masa hasta pegarse en el techo. Hay que submuestrear el desplazamiento del frame en pasos de como máximo `D/2` y evaluar la colisión en cada subpaso, además de acotar el delta máximo por frame.
- **Snap ambiguo en las juntas entre filas de distinta paridad.** El punto de parada del proyectil suele caer en la frontera entre dos celdas candidatas; si el redondeo de `celdaDePixel` no es idéntico al usado para dibujar, la burbuja aparecerá visiblemente desalineada o pisará a otra. Fijar una única función pura de conversión, usarla en render, snap y detección de vecinos, y verificar el ida y vuelta en el paso 1 antes de escribir nada de juego.
- **Inversión de paridad al bajar la prensa.** Cada descenso de una fila invierte qué filas llevan offset 0 y cuáles offset `D/2`. Si la masa se guarda en coordenadas de rejilla absolutas y solo se cambia `techoY`, todas las burbujas se desplazarán media celda respecto de lo esperado y los vecindarios dejarán de coincidir. Decidir explícitamente si la paridad se deriva de `techoY` o se almacena, y probarlo con dos descensos consecutivos.
- **Desprendimiento con burbujas aún cayendo.** Si un segundo disparo impacta mientras hay burbujas flotantes animándose, la comprobación de conectividad puede volver a contarlas o el proyectil puede colisionar con una burbuja que ya no pertenece a la masa. Las burbujas en caída deben salir de la estructura de la masa en el mismo frame en que se marcan, y vivir solo como partículas de render.
- **Bucle de derrota tras la purga.** Si tras purgar 3 filas y subir la prensa la comprobación de la línea de peligro se vuelve a ejecutar en el mismo frame con la masa aún sin reposicionar, se pueden consumir las 3 vidas de golpe. La comprobación debe hacerse una sola vez por evento (snap o descenso) y quedar inhibida durante el estado `"dead"`.
- **Nivel imposible por tanque generado sin salida.** Con patrones de color aleatorios puros se pueden generar tanques donde ningún color de la cola forma racimo en varias jugadas seguidas. La generación es determinista por nivel desde una tabla de patrones y debe comprobarse a mano que los niveles 1–4 admiten racimos de 3 desde el primer disparo.
- **Coste de render con la masa llena.** Un tanque de 13 columnas × 13 filas son ~160 círculos con gradiente radial y `shadowBlur` por frame, el escenario más caro del catálogo. Aplicar desde el paso 2 el batching por color (un `save`/`restore` por color, no por burbuja) y considerar cachear la masa en un canvas offscreen que solo se redibuje cuando cambie, siguiendo el patrón de la spec 14.
- **Ángulos casi horizontales.** Con el tope en ±75° un disparo puede encadenar muchos rebotes y tardar en detenerse; si además pasa rozando la pared, el rebote puede reevaluarse dos frames seguidos y quedar pegado a la pared oscilando. Reflejar la posición además de la velocidad al rebotar (empujando el centro al interior del pozo) en vez de solo invertir el signo de la velocidad.
