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
const ROAD_ROWS = [
  ROW_ROAD_TOP,
  ROW_ROAD_TOP + 1,
  ROW_ROAD_TOP + 2,
  ROW_ROAD_TOP + 3,
  ROW_ROAD_BOT,
];
const RIVER_ROWS = [
  ROW_RIVER_TOP,
  ROW_RIVER_TOP + 1,
  ROW_RIVER_TOP + 2,
  ROW_RIVER_TOP + 3,
  ROW_RIVER_TOP + 4,
  ROW_RIVER_BOT,
];
const LEVEL_SPEED_STEP = 0.15; // +15% de velocidad por nivel
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const ROUND_TIME_MS = 15000;
const LEVEL_TIME_STEP_MS = 800; // ms de ronda que se restan por nivel
const MIN_ROUND_TIME_MS = 6000;
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
// Genera un carril de carretera con vehículos de 1-3 celdas separados por
// huecos transitables de al menos 1 celda.
function buildRoadLane(row: number, index: number, level: number): Lane {
  const dir: 1 | -1 = index % 2 === 0 ? -1 : 1;
  const baseSpeed = 0.6 + (index % 3) * 0.35; // 0.6 - 1.3 px/frame base
  const speed = baseSpeed * (1 + (level - 1) * LEVEL_SPEED_STEP);
  const vehicleType: "car" | "truck" = index % 2 === 0 ? "car" : "truck";
  const width = vehicleType === "truck" ? 3 : 1 + (index % 2);
  const gap = 4;
  const entities: Entity[] = [];
  for (let col = -width; col < COLS + width; col += width + gap) {
    entities.push({ col, width, type: vehicleType });
  }
  return { row, speed, dir, entities };
}
// Genera un carril de río con troncos o tortugas, con huecos transitables.
function buildRiverLane(row: number, index: number, level: number): Lane {
  const dir: 1 | -1 = index % 2 === 0 ? 1 : -1;
  const baseSpeed = 0.4 + (index % 3) * 0.3; // 0.4 - 1.0 px/frame base
  const speed = baseSpeed * (1 + (level - 1) * LEVEL_SPEED_STEP);
  const isTurtleLane = index % 2 === 1;
  const entities: Entity[] = [];
  if (isTurtleLane) {
    const groupSize = 2 + (index % 2); // 2-3 tortugas por grupo
    const gap = 4;
    for (let col = -groupSize; col < COLS + groupSize; col += groupSize + gap) {
      entities.push({
        col,
        width: groupSize,
        type: "turtle",
        submerged: false,
      });
    }
  } else {
    const width = 2 + (index % 3); // 2-4 celdas
    const gap = 3;
    for (let col = -width; col < COLS + width; col += width + gap) {
      entities.push({ col, width, type: "log" });
    }
  }
  return { row, speed, dir, entities };
}
function frogStart(): Frog {
  return {
    col: Math.floor(COLS / 2),
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: Math.floor(COLS / 2),
    targetRow: ROW_START,
  };
}
function roundTimeForLevel(level: number): number {
  return Math.max(
    MIN_ROUND_TIME_MS,
    ROUND_TIME_MS - (level - 1) * LEVEL_TIME_STEP_MS,
  );
}
export class FroggerEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private frog: Frog = frogStart();
  private lanes: Lane[] = [];
  private goals: boolean[] = [false, false, false, false, false];
  private visitedRows = new Set<number>();
  private score = 0;
  private level = 1;
  private lives = 3;
  private roundTimer = ROUND_TIME_MS;
  private phase: "playing" | "gameover" = "playing";
  private gameOverNotified = false;
  private pendingDir: Direction | null = null;
  private rafId: number | null = null;
  private paused = false;
  private destroyed = false;
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    this.callbacks = callbacks;
    window.addEventListener("keydown", this.handleKeyDown);
    this.initState();
  }
  private initState() {
    this.frog = frogStart();
    this.goals = [false, false, false, false, false];
    this.visitedRows = new Set([ROW_START]);
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.roundTimer = roundTimeForLevel(this.level);
    this.phase = "playing";
    this.gameOverNotified = false;
    this.pendingDir = null;
    this.lanes = this.buildLanes(this.level);
  }
  private buildLanes(level: number): Lane[] {
    const road = ROAD_ROWS.map((row, i) => buildRoadLane(row, i, level));
    const river = RIVER_ROWS.map((row, i) => buildRiverLane(row, i, level));
    return [...road, ...river];
  }
  private handleKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIRECTION[e.code];
    if (!dir) return;
    e.preventDefault();
    if (this.paused || this.phase !== "playing" || this.frog.animating) return;
    this.pendingDir = dir;
  };
}
