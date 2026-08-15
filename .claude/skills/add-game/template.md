# Contrato de referencia para nuevos juegos

Este archivo contiene el contrato de código exacto que `SKILL.md` debe copiar (adaptando nombres) al escribir la sección "Modelo de datos" de una spec generada por `/add-game`. No lo reinterpretes: cópialo y ajusta solo lo que la Fase 3 de `SKILL.md` indica que puede variar.

## Caso estándar — un solo canvas, loop por frame

Igual forma que `lib/games/asteroides/engine.ts` y `components/games/asteroides-canvas.tsx`.

```ts
// lib/games/<id>/engine.ts
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

export class <Nombre>Engine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  pause(): void;
  resume(): void;
  reset(): void; // vuelve a "playing" con score 0, vidas iniciales, nivel 1
  forceGameOver(): void; // termina la partida ya (botón FIN)
  destroy(): void; // cancela el loop y remueve listeners de teclado
}
```

```tsx
// components/games/<id>-canvas.tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { <Nombre>Engine, type EngineStats } from "@/lib/games/<id>/engine";

export type <Nombre>CanvasHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};

type Props = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};

export const <Nombre>Canvas = forwardRef<<Nombre>CanvasHandle, Props>(
  function <Nombre>Canvas({ onStats, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<<Nombre>Engine | null>(null);
    const onStatsRef = useRef(onStats);
    const onGameOverRef = useRef(onGameOver);
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new <Nombre>Engine(canvasRef.current, {
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

    return <canvas ref={canvasRef} width={<W>} height={<H>} />;
  },
);
```

## Caso multi-canvas (p. ej. tablero + hold + next, tipo Tetris)

El contrato externo (`EngineStats`, `EngineCallbacks`, `pause/resume/reset/forceGameOver/destroy`) **no cambia**. Solo varía el primer argumento del constructor:

```ts
// lib/games/<id>/engine.ts
export class <Nombre>Engine {
  constructor(
    canvases: { board: HTMLCanvasElement; hold: HTMLCanvasElement; next: HTMLCanvasElement },
    callbacks: EngineCallbacks,
  );
  pause(): void;
  resume(): void;
  reset(): void;
  forceGameOver(): void;
  destroy(): void;
}
```

El wrapper `*-canvas.tsx` renderiza los canvases adicionales necesarios y los pasa todos al constructor del motor; el resto del wrapper (`useImperativeHandle`, cleanup) es idéntico al caso estándar.

## Registry de juegos reales (`jugar-client.tsx`)

Solo se crea/edita la primera vez que un segundo juego real se integra (ver Fase 4 de `SKILL.md`). Forma exacta:

```ts
// lib/games/registry.ts
import type { ComponentType } from "react";

export type EngineStats = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
};

export type GameEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  setSkin?: (skin: string) => void; // opcional: solo si el juego tiene skins (ver @skin-designer)
};

export type GameCanvasProps = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};

export type SkinOption = { id: string; label: string };

export type RegisteredGame = {
  Canvas: React.ForwardRefExoticComponent<
    GameCanvasProps & React.RefAttributes<GameEngineHandle>
  >;
  skins?: SkinOption[]; // opcional: el primero es el default ("classic")
};

export const GAME_REGISTRY: Record<string, RegisteredGame> = {
  asteroides: { Canvas: AsteroidesCanvas },
  // <nuevo-id>: { Canvas: <NuevoId>Canvas },
};

export function getRegisteredGame(id: string): RegisteredGame | undefined {
  return GAME_REGISTRY[id];
}
```

Cambios mecánicos en `components/jugar-client.tsx` (cada sitio que hoy compara con `isAsteroides`):

- `const registered = getRegisteredGame(game.id);` reemplaza `const isAsteroides = game.id === "asteroides";`.
- `engineRef` pasa de `useRef<AsteroidesCanvasHandle>(null)` a `useRef<GameEngineHandle>(null)`.
- El guard del `setInterval` mock (`if (isAsteroides || over || paused) return;`) pasa a `if (registered || over || paused) return;`.
- `togglePause`/`endGame`/`restart`: mismo patrón `if (isAsteroides) engineRef.current?.X() else ...` pasa a `if (registered) engineRef.current?.X() else ...` — la estructura de la rama no cambia, solo la condición.
- JSX del canvas:
  ```tsx
  {
    registered ? (
      <registered.Canvas
        ref={engineRef}
        onStats={handleStats}
        onGameOver={handleGameOver}
      />
    ) : (
      <div className="game-arena">{/* fallback decorativo sin cambios */}</div>
    );
  }
  ```
- Los imports directos de `AsteroidesCanvas`/`AsteroidesCanvasHandle`/`EngineStats` se mueven a vivir solo dentro de `lib/games/registry.ts`; `jugar-client.tsx` importa `getRegisteredGame`/`GameEngineHandle`/`EngineStats` desde ahí.

No agregues campos nuevos a `EngineStats`, `GameCanvasProps` o `GameEngineHandle` para acomodar un juego específico. Si un juego no encaja, documenta el mapeo forzado como decisión explícita en su spec — el contrato se queda igual para que agregar el juego N+1 siga siendo una sola línea en `GAME_REGISTRY`.

Un juego nuevo nace **sin** `skins` ni `setSkin` — ambos son opcionales y no se implementan como parte de `/add-game`. Dotar a un juego (nuevo o existente) de al menos 3 skins (`classic`/`neon`/`retro`) es tarea del subagente `@skin-designer`, que se invoca por separado, uno a la vez, después de que el juego ya esté jugable.
