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
};
export type GameCanvasProps = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
export type RegisteredGame = {
  Canvas: ForwardRefExoticComponent<
    GameCanvasProps & RefAttributes<GameEngineHandle>
  >;
};
export const GAME_REGISTRY: Record<string, RegisteredGame> = {
  asteroides: { Canvas: AsteroidesCanvas },
  tetris: { Canvas: TetrisCanvas },
  arkanoid: { Canvas: ArkanoidCanvas },
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
};
