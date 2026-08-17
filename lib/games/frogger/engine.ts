// Motor de Frogger escrito desde cero (no hay game.js de referencia para
// este juego). Todo se dibuja con primitivas canvas, sin sprites bitmap.
export type EngineStats = {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
};
export type EngineCallbacks = {
  onStats: (stats: EngineStats) => void;
  onGameOver: (finalScore: number) => void;
};
const W = 640; // CANVAS_W = COLS * CELL
const H = 560; // CANVAS_H = ROWS * CELL
const COLS = 16;
const ROWS = 14;
const CELL = 40;
// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;
type Direction = "up" | "down" | "left" | "right";
interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}
interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
}
interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}
