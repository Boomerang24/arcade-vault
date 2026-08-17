import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  AsteroidesCanvas,
  type AsteroidesCanvasHandle,
} from "@/components/games/asteroides-canvas";
import {
  TetrisCanvas,
  type TetrisCanvasHandle,
} from "@/components/games/tetris-canvas";
import {
  ArkanoidCanvas,
  type ArkanoidCanvasHandle,
} from "@/components/games/arkanoid-canvas";
import {
  SnakeCanvas,
  type SnakeCanvasHandle,
} from "@/components/games/snake-canvas";
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
  setSkin?: (skin: string) => void;
};
export type GameCanvasProps = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
export type SkinOption = { id: string; label: string };
// Todo juego que declare `skins` debe ofrecer al menos estas 3 (el primero
// del array es el default). Impuesto por convención, no por el tipo, para
// no romper juegos que aún no tienen skins.
export const REQUIRED_SKINS = ["classic", "neon", "retro"] as const;
export type TouchAction = {
  code: "Space"; // por ahora el único code de acción usado en el catálogo
  label: string; // texto corto del botón, p.ej. "DISPARAR", "CAER"
};
export type RegisteredGame = {
  Canvas: ForwardRefExoticComponent<
    GameCanvasProps & RefAttributes<GameEngineHandle>
  >;
  skins?: SkinOption[];
  touchActions?: TouchAction[]; // 0, 1 o 2 botones de acción; ausente/[] = solo D-pad
};
export const GAME_REGISTRY: Record<string, RegisteredGame> = {
  asteroides: {
    Canvas: AsteroidesCanvas,
    skins: [
      { id: "classic", label: "Classic" },
      { id: "neon", label: "Neon" },
      { id: "retro", label: "Retro" },
    ],
    touchActions: [{ code: "Space", label: "DISPARAR" }],
  },
  tetris: {
    Canvas: TetrisCanvas,
    skins: [
      { id: "classic", label: "Classic" },
      { id: "neon", label: "Neon" },
      { id: "retro", label: "Retro" },
      { id: "pastel", label: "Pastel" },
      { id: "pixelart", label: "Pixel Art" },
    ],
    touchActions: [{ code: "Space", label: "CAER" }],
  },
  arkanoid: {
    Canvas: ArkanoidCanvas,
    skins: [
      { id: "classic", label: "Classic" },
      { id: "neon", label: "Neon" },
      { id: "retro", label: "Retro" },
    ],
  },
  snake: {
    Canvas: SnakeCanvas,
    skins: [
      { id: "classic", label: "Classic" },
      { id: "neon", label: "Neon" },
      { id: "retro", label: "Retro" },
    ],
  },
};
export function getRegisteredGame(id: string): RegisteredGame | undefined {
  return GAME_REGISTRY[id];
}
// Reexports para que los tipos de handle de cada juego sigan disponibles
// sin que jugar-client.tsx tenga que importarlos directo de cada juego.
export type {
  AsteroidesCanvasHandle,
  TetrisCanvasHandle,
  ArkanoidCanvasHandle,
  SnakeCanvasHandle,
};
