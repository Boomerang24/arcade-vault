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
// Cada boca ocupa 2 columnas; entre bocas queda 1 columna de "muro" letal.
const GOAL_COLS: [number, number][] = [
  [1, 2],
  [4, 5],
  [7, 8],
  [10, 11],
  [13, 14],
];
const LEVEL_SPEED_STEP = 0.15; // +15% de velocidad por nivel
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const ROUND_TIME_MS = 15000;
const LEVEL_TIME_STEP_MS = 800; // ms de ronda que se restan por nivel
const MIN_ROUND_TIME_MS = 6000;
const JUMP_MS = 120;
const GOAL_SCORE = 50;
const ROUND_SCORE = 200;
const CELL_SCORE = 10;
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
const DIRECTION_DELTA: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
// Genera un carril de carretera con vehículos de 1-3 celdas separados por
// huecos transitables de al menos 1 celda.
function buildRoadLane(row: number, index: number, level: number): Lane {
  const dir: 1 | -1 = index % 2 === 0 ? -1 : 1;
  const baseSpeed = 0.6 + (index % 3) * 0.35; // 0.6 - 1.3 celdas/frame base
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
  const baseSpeed = 0.4 + (index % 3) * 0.3; // 0.4 - 1.0 celdas/frame base
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
  private minRowReached = ROW_START;
  private score = 0;
  private level = 1;
  private lives = 3;
  private roundTimer = ROUND_TIME_MS;
  private turtleCycleT = 0;
  private phase: "playing" | "gameover" = "playing";
  private gameOverNotified = false;
  private pendingDir: Direction | null = null;
  private rafId: number | null = null;
  private paused = false;
  private destroyed = false;
  private lastFrameTime = 0;
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    this.callbacks = callbacks;
    window.addEventListener("keydown", this.handleKeyDown);
    this.initState();
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }
  private initState() {
    this.frog = frogStart();
    this.goals = [false, false, false, false, false];
    this.minRowReached = ROW_START;
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.roundTimer = roundTimeForLevel(this.level);
    this.turtleCycleT = 0;
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
  // ---- lógica de colisión y soporte ----
  private checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
    return lanes.some(
      (lane) =>
        lane.row === frog.row &&
        ROAD_ROWS.includes(lane.row) &&
        lane.entities.some(
          (entity) =>
            frog.col >= entity.col && frog.col < entity.col + entity.width,
        ),
    );
  }
  private getSupport(frog: Frog, lanes: Lane[]): Entity | null {
    const lane = lanes.find(
      (l) => l.row === frog.row && RIVER_ROWS.includes(l.row),
    );
    if (!lane) return null;
    const entity = lane.entities.find(
      (e) => frog.col >= e.col && frog.col < e.col + e.width,
    );
    if (!entity) return null;
    if (entity.type === "turtle" && entity.submerged) return null;
    return entity;
  }
  private supportLane(entity: Entity): Lane | undefined {
    return this.lanes.find((l) => l.entities.includes(entity));
  }
  private checkGoal() {
    const frog = this.frog;
    const idx = GOAL_COLS.findIndex(
      ([start, end]) => frog.col >= start && frog.col <= end,
    );
    if (idx === -1 || this.goals[idx]) {
      this.killFrog();
      return;
    }
    this.goals[idx] = true;
    const bonus = Math.floor(this.roundTimer / 1000) * 10;
    this.score += GOAL_SCORE + bonus;
    if (this.goals.every(Boolean)) {
      this.score += ROUND_SCORE;
      this.completeRound();
    } else {
      this.frog = frogStart();
      this.minRowReached = ROW_START;
      this.roundTimer = roundTimeForLevel(this.level);
    }
  }
  private completeRound() {
    this.frog = frogStart();
    this.goals = [false, false, false, false, false];
    this.minRowReached = ROW_START;
    this.level += 1;
    this.lanes = this.buildLanes(this.level);
    this.roundTimer = roundTimeForLevel(this.level);
  }
  private killFrog() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = "gameover";
      this.triggerGameOver();
      return;
    }
    this.frog = frogStart();
    this.minRowReached = ROW_START;
    this.roundTimer = roundTimeForLevel(this.level);
  }
  private triggerGameOver() {
    if (this.gameOverNotified) return;
    this.gameOverNotified = true;
    this.callbacks.onGameOver(this.score);
  }
  private resolveFrogCell() {
    const frog = this.frog;
    if (frog.row < this.minRowReached) {
      this.score += CELL_SCORE;
      this.minRowReached = frog.row;
    }
    if (ROAD_ROWS.includes(frog.row)) {
      if (this.checkRoadCollision(frog, this.lanes)) this.killFrog();
      return;
    }
    if (RIVER_ROWS.includes(frog.row)) {
      if (!this.getSupport(frog, this.lanes)) this.killFrog();
      return;
    }
    if (frog.row === ROW_GOALS) {
      this.checkGoal();
    }
  }
  // ---- game loop ----
  private updateEntities(dt: number) {
    this.turtleCycleT += dt;
    const cycle = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
    for (const lane of this.lanes) {
      lane.entities.forEach((entity, i) => {
        entity.col += (lane.speed * lane.dir * dt) / 16;
        if (lane.dir === 1 && entity.col > COLS) {
          entity.col = -entity.width;
        } else if (lane.dir === -1 && entity.col + entity.width < 0) {
          entity.col = COLS;
        }
        if (entity.type === "turtle") {
          const offset = (i * 700) % cycle;
          const t = (this.turtleCycleT + offset) % cycle;
          entity.submerged = t >= TURTLE_VISIBLE_MS;
        }
      });
    }
  }
  private updateFrog(dt: number) {
    const frog = this.frog;
    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) {
        frog.animating = false;
        frog.animT = 0;
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        this.resolveFrogCell();
      }
      return;
    }
    if (this.pendingDir) {
      const dir = this.pendingDir;
      this.pendingDir = null;
      const delta = DIRECTION_DELTA[dir];
      const targetCol = frog.col + delta.x;
      const targetRow = frog.row + delta.y;
      if (
        targetCol < 0 ||
        targetCol >= COLS ||
        targetRow < 0 ||
        targetRow > ROW_START
      ) {
        return;
      }
      frog.animating = true;
      frog.animT = 0;
      frog.targetCol = targetCol;
      frog.targetRow = targetRow;
      return;
    }
    if (RIVER_ROWS.includes(frog.row)) {
      const support = this.getSupport(frog, this.lanes);
      if (!support) {
        this.killFrog();
        return;
      }
      const lane = this.supportLane(support);
      if (lane) {
        const drift = (lane.speed * lane.dir * dt) / 16;
        frog.col += drift;
        frog.targetCol = frog.col;
        if (frog.col < 0 || frog.col >= COLS) {
          this.killFrog();
        }
      }
    }
  }
  private updateRoundTimer(dt: number) {
    if (this.frog.animating) return;
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.killFrog();
    }
  }
  private update(dt: number) {
    if (this.phase !== "playing") return;
    this.updateEntities(dt);
    this.updateFrog(dt);
    if (this.phase === "playing") this.updateRoundTimer(dt);
  }
  // ---- render ----
  private zoneColor(row: number): string {
    if (row === ROW_GOALS) return "#123a12";
    if (RIVER_ROWS.includes(row)) return "#001b33";
    if (row === ROW_SAFE_MID || row === ROW_START) return "#0a2e0a";
    return "#000000";
  }
  private drawZones() {
    const ctx = this.ctx;
    for (let row = 0; row < ROWS; row++) {
      ctx.fillStyle = this.zoneColor(row);
      ctx.fillRect(0, row * CELL, W, CELL);
    }
  }
  private drawGoals() {
    const ctx = this.ctx;
    const y = ROW_GOALS * CELL;
    GOAL_COLS.forEach(([start, end], i) => {
      const x = start * CELL;
      const w = (end - start + 1) * CELL;
      ctx.strokeStyle = "#d4af00";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
      if (this.goals[i]) {
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.ellipse(
          x + w / 2,
          y + CELL / 2,
          w / 3,
          CELL / 3,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    });
  }
  private drawEntity(entity: Entity, row: number) {
    const ctx = this.ctx;
    const x = entity.col * CELL;
    const y = row * CELL;
    const w = entity.width * CELL;
    if (entity.type === "car" || entity.type === "truck") {
      ctx.fillStyle = entity.type === "truck" ? "#6b7280" : "#ef4444";
      ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
      if (entity.type === "truck") {
        ctx.fillStyle = "#374151";
        ctx.fillRect(x + w - CELL + 4, y + 4, CELL - 8, CELL - 8);
      }
      ctx.fillStyle = "#111827";
      const wheelY = y + CELL - 8;
      ctx.beginPath();
      ctx.arc(x + 8, wheelY, 4, 0, Math.PI * 2);
      ctx.arc(x + w - 8, wheelY, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (entity.type === "log") {
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(x + 2, y + 8, w - 4, CELL - 16);
      ctx.strokeStyle = "#5c3a1a";
      ctx.lineWidth = 1;
      for (let lx = x + 6; lx < x + w - 4; lx += 10) {
        ctx.beginPath();
        ctx.moveTo(lx, y + 8);
        ctx.lineTo(lx, y + CELL - 8);
        ctx.stroke();
      }
    } else {
      // turtle
      ctx.globalAlpha = entity.submerged ? 0.25 : 1;
      ctx.fillStyle = "#16a34a";
      for (let i = 0; i < entity.width; i++) {
        ctx.beginPath();
        ctx.arc(
          x + i * CELL + CELL / 2,
          y + CELL / 2,
          CELL / 2 - 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  private drawLaneEntities() {
    for (const lane of this.lanes) {
      for (const entity of lane.entities) {
        this.drawEntity(entity, lane.row);
      }
    }
  }
  private drawFrog() {
    const ctx = this.ctx;
    const frog = this.frog;
    let px = frog.col;
    let py = frog.row;
    if (frog.animating) {
      const t = Math.min(1, frog.animT / JUMP_MS);
      px = frog.col + (frog.targetCol - frog.col) * t;
      py = frog.row + (frog.targetRow - frog.row) * t;
    }
    const cx = px * CELL + CELL / 2;
    const cy = py * CELL + CELL / 2;
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 8, 3, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 8, 1.4, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 8, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  private drawHUD() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#f0f0f0";
    ctx.font = '15px "Courier New", monospace';
    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${this.score}`, 14, 26);
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, W / 2, 26);
    ctx.textAlign = "right";
    ctx.fillText("♥".repeat(Math.max(0, this.lives)), W - 14, 26);
    ctx.restore();
    const ratio = Math.max(0, this.roundTimer / roundTimeForLevel(this.level));
    ctx.fillStyle =
      ratio > 0.5 ? "#4ade80" : ratio > 0.2 ? "#facc15" : "#ef4444";
    ctx.fillRect(0, 0, W * ratio, 5);
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0f0f0";
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText(title, W / 2, H / 2 - 16);
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(sub, W / 2, H / 2 + 24);
  }
  private draw() {
    this.drawZones();
    this.drawGoals();
    this.drawLaneEntities();
    this.drawFrog();
    this.drawHUD();
    if (this.phase === "gameover") {
      this.drawOverlay("GAME OVER", `Score final: ${this.score}`);
    }
  }
  private loop = (now: number) => {
    const dt = this.lastFrameTime ? now - this.lastFrameTime : 16;
    this.lastFrameTime = now;
    this.update(dt);
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: this.phase === "gameover" ? "gameover" : "playing",
    });
    if (!this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };
}
