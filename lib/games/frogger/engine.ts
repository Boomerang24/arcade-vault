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
const MAX_GAP_BONUS = 3; // huecos extra en el nivel 1, para arrancar menos denso
// El nivel 1 suma MAX_GAP_BONUS al hueco base entre entidades; ese extra baja
// 1 por nivel hasta desaparecer, así la densidad sube de forma progresiva.
function levelGapBonus(level: number): number {
  return Math.max(0, MAX_GAP_BONUS - (level - 1));
}
const MIN_SPEED_MULT = 0.55; // velocidad al nivel 1: 55% de la base
const SPEED_RAMP_LEVELS = 4; // niveles que tarda en llegar al 100%
// El nivel 1 arranca a MIN_SPEED_MULT de la velocidad base y sube en línea
// recta hasta 1 en SPEED_RAMP_LEVELS; de ahí en más el multiplicador es 1 y
// el nivel escala normalmente vía LEVEL_SPEED_STEP.
function levelSpeedRampMult(level: number): number {
  if (level >= SPEED_RAMP_LEVELS) return 1;
  return (
    MIN_SPEED_MULT +
    ((1 - MIN_SPEED_MULT) * (level - 1)) / (SPEED_RAMP_LEVELS - 1)
  );
}
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const ROUND_TIME_MS = 15000;
const LEVEL_TIME_STEP_MS = 800; // ms de ronda que se restan por nivel
const MIN_ROUND_TIME_MS = 6000;
const JUMP_MS = 120;
const GOAL_SCORE = 50;
const ROUND_SCORE = 200;
const CELL_SCORE = 10;
// ---- skins ----
export type SkinName = "classic" | "neon" | "retro";
type Palette = {
  zoneGoals: string;
  zoneRiver: string;
  zoneSafe: string;
  zoneRoad: string;
  goalBorder: string;
  goalFilled: string;
  car: string;
  truck: string;
  truckCab: string;
  wheel: string;
  log: string;
  logGrain: string;
  turtle: string;
  frog: string;
  frogEye: string;
  frogPupil: string;
  hud: string;
  timerHigh: string;
  timerMid: string;
  timerLow: string;
  overlayBackdrop: string;
  overlayTitle: string;
  overlaySub: string;
};
const SKIN_PALETTES: Record<SkinName, Palette> = {
  // `classic` reproduce exactamente los literales originales del motor.
  classic: {
    zoneGoals: "#123a12",
    zoneRiver: "#001b33",
    zoneSafe: "#0a2e0a",
    zoneRoad: "#000000",
    goalBorder: "#d4af00",
    goalFilled: "#4ade80",
    car: "#ef4444",
    truck: "#6b7280",
    truckCab: "#374151",
    wheel: "#111827",
    log: "#8b5a2b",
    logGrain: "#5c3a1a",
    turtle: "#16a34a",
    frog: "#22c55e",
    frogEye: "#ffffff",
    frogPupil: "#000000",
    hud: "#f0f0f0",
    timerHigh: "#4ade80",
    timerMid: "#facc15",
    timerLow: "#ef4444",
    overlayBackdrop: "rgba(0, 0, 0, 0.6)",
    overlayTitle: "#f0f0f0",
    overlaySub: "#f0f0f0",
  },
  neon: {
    zoneGoals: "#12002b",
    zoneRiver: "#00121f",
    zoneSafe: "#0b0026",
    zoneRoad: "#06000f",
    goalBorder: "#f5ff00",
    goalFilled: "#00ff88",
    car: "#ff006e",
    truck: "#c800ff",
    truckCab: "#7a00b0",
    wheel: "#06000f",
    log: "#f5ff00",
    logGrain: "#b0b800",
    turtle: "#00f5ff",
    frog: "#00ff88",
    frogEye: "#f5ff00",
    frogPupil: "#06000f",
    hud: "#00f5ff",
    timerHigh: "#00ff88",
    timerMid: "#f5ff00",
    timerLow: "#ff006e",
    overlayBackdrop: "rgba(6, 0, 15, 0.68)",
    overlayTitle: "#ff006e",
    overlaySub: "#00f5ff",
  },
  retro: {
    zoneGoals: "#3d2900",
    zoneRiver: "#1f1400",
    zoneSafe: "#2b1d00",
    zoneRoad: "#0a0600",
    goalBorder: "#ffb000",
    goalFilled: "#ffb000",
    car: "#ffb000",
    truck: "#cc7a00",
    truckCab: "#8a5200",
    wheel: "#0a0600",
    log: "#cc7a00",
    logGrain: "#0a0600",
    turtle: "#ffb000",
    frog: "#ffb000",
    frogEye: "#0a0600",
    frogPupil: "#ffb000",
    hud: "#ffb000",
    timerHigh: "#ffb000",
    timerMid: "#cc7a00",
    timerLow: "#8a5200",
    overlayBackdrop: "rgba(10, 6, 0, 0.68)",
    overlayTitle: "#ffb000",
    overlaySub: "#ffb000",
  },
};
// Glow por skin: se aplica dentro de cada primitiva de dibujo.
function applySkinGlow(
  ctx: CanvasRenderingContext2D,
  skin: SkinName,
  color: string,
  blur = 12,
) {
  if (skin === "neon") {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  } else {
    ctx.shadowBlur = 0;
  }
}
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
  const baseSpeed = 1.5 + (index % 3) * 1.25; // 1.5 - 4 px/frame base
  const speed =
    baseSpeed *
    (1 + (level - 1) * LEVEL_SPEED_STEP) *
    levelSpeedRampMult(level);
  const vehicleType: "car" | "truck" = index % 2 === 0 ? "car" : "truck";
  const width = vehicleType === "truck" ? 3 : 1 + (index % 2);
  const gap = 6 + levelGapBonus(level);
  const entities: Entity[] = [];
  for (let col = -width; col < COLS + width; col += width + gap) {
    entities.push({ col, width, type: vehicleType });
  }
  return { row, speed, dir, entities };
}
// Genera un carril de río con troncos o tortugas, con huecos transitables.
function buildRiverLane(row: number, index: number, level: number): Lane {
  const dir: 1 | -1 = index % 2 === 0 ? 1 : -1;
  const baseSpeed = 1 + (index % 3) * 1; // 1 - 3 px/frame base
  const speed =
    baseSpeed *
    (1 + (level - 1) * LEVEL_SPEED_STEP) *
    levelSpeedRampMult(level);
  const isTurtleLane = index % 2 === 1;
  const entities: Entity[] = [];
  if (isTurtleLane) {
    const groupSize = 2 + (index % 2); // 2-3 tortugas por grupo
    const gap = 4 + levelGapBonus(level);
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
    const gap = 3 + levelGapBonus(level);
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
  private currentSkin: SkinName = "classic";
  private get palette(): Palette {
    return SKIN_PALETTES[this.currentSkin];
  }
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
  // Solapa el intervalo continuo [entity.col, entity.col+width) de la entidad
  // con la celda entera [frog.col, frog.col+1) de la rana.
  private overlapsFrog(frog: Frog, entity: Entity): boolean {
    return frog.col < entity.col + entity.width && frog.col + 1 > entity.col;
  }
  private checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
    return lanes.some(
      (lane) =>
        lane.row === frog.row &&
        ROAD_ROWS.includes(lane.row) &&
        lane.entities.some((entity) => this.overlapsFrog(frog, entity)),
    );
  }
  private getSupport(frog: Frog, lanes: Lane[]): Entity | null {
    const lane = lanes.find(
      (l) => l.row === frog.row && RIVER_ROWS.includes(l.row),
    );
    if (!lane) return null;
    const entity = lane.entities.find((e) => this.overlapsFrog(frog, e));
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
        entity.col += (lane.speed * lane.dir * dt) / 16 / CELL;
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
        const drift = (lane.speed * lane.dir * dt) / 16 / CELL;
        frog.col += drift;
        frog.targetCol = frog.col;
        if (frog.col < 0 || frog.col >= COLS) {
          this.killFrog();
        }
      }
      return;
    }
    if (
      ROAD_ROWS.includes(frog.row) &&
      this.checkRoadCollision(frog, this.lanes)
    ) {
      this.killFrog();
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
    const p = this.palette;
    if (row === ROW_GOALS) return p.zoneGoals;
    if (RIVER_ROWS.includes(row)) return p.zoneRiver;
    if (row === ROW_SAFE_MID || row === ROW_START) return p.zoneSafe;
    return p.zoneRoad;
  }
  // Buffer offscreen con las scanlines pre-renderizadas: se dibuja una
  // sola vez y luego cada frame solo hace drawImage() del buffer, en vez
  // de repetir ~190 fillRect por frame. No depende de la skin (siempre el
  // mismo patrón), así que se cachea para toda la vida del engine.
  private scanlinesBuffer: HTMLCanvasElement | null = null;
  private getScanlinesBuffer(): HTMLCanvasElement {
    if (this.scanlinesBuffer) return this.scanlinesBuffer;
    const buffer = document.createElement("canvas");
    buffer.width = W;
    buffer.height = H;
    const bctx = buffer.getContext("2d");
    if (bctx) {
      bctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      for (let y = 0; y < H; y += 3) {
        bctx.fillRect(0, y, W, 1);
      }
    }
    this.scanlinesBuffer = buffer;
    return buffer;
  }
  // Textura CRT de la skin `retro`: scanlines horizontales sutiles.
  private drawScanlines() {
    this.ctx.drawImage(this.getScanlinesBuffer(), 0, 0);
  }
  private drawZones() {
    const ctx = this.ctx;
    for (let row = 0; row < ROWS; row++) {
      ctx.fillStyle = this.zoneColor(row);
      ctx.fillRect(0, row * CELL, W, CELL);
    }
  }
  // Bordes de las 5 metas en un solo stroke(); rellenos de las metas
  // alcanzadas en un solo fill() — antes cada meta tenía su propio
  // shadowBlur + strokeRect/ellipse.
  private drawGoals() {
    const ctx = this.ctx;
    const p = this.palette;
    const skin = this.currentSkin;
    const y = ROW_GOALS * CELL;
    ctx.save();
    applySkinGlow(ctx, skin, p.goalBorder, 10);
    ctx.strokeStyle = p.goalBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    GOAL_COLS.forEach(([start, end]) => {
      const x = start * CELL;
      const w = (end - start + 1) * CELL;
      ctx.rect(x + 2, y + 2, w - 4, CELL - 4);
    });
    ctx.stroke();
    const filled = GOAL_COLS.filter((_, i) => this.goals[i]);
    if (filled.length > 0) {
      applySkinGlow(ctx, skin, p.goalFilled, 14);
      ctx.fillStyle = p.goalFilled;
      ctx.beginPath();
      filled.forEach(([start, end]) => {
        const x = start * CELL;
        const w = (end - start + 1) * CELL;
        const cx = x + w / 2;
        const cy = y + CELL / 2;
        const rx = w / 3;
        const ry = CELL / 3;
        ctx.moveTo(cx + rx, cy);
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      });
      ctx.fill();
    }
    ctx.restore();
  }
  // Dibuja autos/camiones de un lote en un solo save/shadowBlur/restore en
  // vez de uno por entidad: cuerpo -> cabina (solo camión) -> ruedas.
  private drawVehicleBatch(
    entries: { entity: Entity; row: number }[],
    type: "car" | "truck",
  ) {
    if (entries.length === 0) return;
    const ctx = this.ctx;
    const p = this.palette;
    const body = type === "truck" ? p.truck : p.car;
    ctx.save();
    applySkinGlow(ctx, this.currentSkin, body, 12);
    ctx.fillStyle = body;
    for (const { entity, row } of entries) {
      const x = entity.col * CELL;
      const y = row * CELL;
      const w = entity.width * CELL;
      ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
    }
    if (type === "truck") {
      ctx.fillStyle = p.truckCab;
      for (const { entity, row } of entries) {
        const x = entity.col * CELL;
        const y = row * CELL;
        const w = entity.width * CELL;
        ctx.fillRect(x + w - CELL + 4, y + 4, CELL - 8, CELL - 8);
      }
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.wheel;
    ctx.beginPath();
    for (const { entity, row } of entries) {
      const x = entity.col * CELL;
      const y = row * CELL;
      const w = entity.width * CELL;
      const wheelY = y + CELL - 8;
      ctx.moveTo(x + 12, wheelY);
      ctx.arc(x + 8, wheelY, 4, 0, Math.PI * 2);
      ctx.moveTo(x + w - 4, wheelY);
      ctx.arc(x + w - 8, wheelY, 4, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
  // Dibuja troncos de un lote en un solo save/shadowBlur/restore; las
  // líneas de veta de todos los troncos se agrupan en un solo stroke().
  private drawLogBatch(entries: { entity: Entity; row: number }[]) {
    if (entries.length === 0) return;
    const ctx = this.ctx;
    const p = this.palette;
    ctx.save();
    applySkinGlow(ctx, this.currentSkin, p.log, 10);
    ctx.fillStyle = p.log;
    for (const { entity, row } of entries) {
      const x = entity.col * CELL;
      const y = row * CELL;
      const w = entity.width * CELL;
      ctx.fillRect(x + 2, y + 8, w - 4, CELL - 16);
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = p.logGrain;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const { entity, row } of entries) {
      const x = entity.col * CELL;
      const y = row * CELL;
      const w = entity.width * CELL;
      for (let lx = x + 6; lx < x + w - 4; lx += 10) {
        ctx.moveTo(lx, y + 8);
        ctx.lineTo(lx, y + CELL - 8);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  // Dibuja tortugas de un lote en un solo save/shadowBlur/restore; se
  // separan en dos fill() (visibles / sumergidas) por el globalAlpha.
  private drawTurtleBatch(entries: { entity: Entity; row: number }[]) {
    if (entries.length === 0) return;
    const ctx = this.ctx;
    const p = this.palette;
    ctx.save();
    applySkinGlow(ctx, this.currentSkin, p.turtle, 12);
    ctx.fillStyle = p.turtle;
    const fillGroup = (group: { entity: Entity; row: number }[]) => {
      if (group.length === 0) return;
      ctx.beginPath();
      for (const { entity, row } of group) {
        const x = entity.col * CELL;
        const y = row * CELL;
        for (let i = 0; i < entity.width; i++) {
          const cx = x + i * CELL + CELL / 2;
          const cy = y + CELL / 2;
          const r = CELL / 2 - 4;
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    };
    ctx.globalAlpha = 1;
    fillGroup(entries.filter(({ entity }) => !entity.submerged));
    ctx.globalAlpha = 0.25;
    fillGroup(entries.filter(({ entity }) => entity.submerged));
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  private drawLaneEntities() {
    const cars: { entity: Entity; row: number }[] = [];
    const trucks: { entity: Entity; row: number }[] = [];
    const logs: { entity: Entity; row: number }[] = [];
    const turtles: { entity: Entity; row: number }[] = [];
    for (const lane of this.lanes) {
      for (const entity of lane.entities) {
        const item = { entity, row: lane.row };
        if (entity.type === "car") cars.push(item);
        else if (entity.type === "truck") trucks.push(item);
        else if (entity.type === "log") logs.push(item);
        else turtles.push(item);
      }
    }
    this.drawVehicleBatch(cars, "car");
    this.drawVehicleBatch(trucks, "truck");
    this.drawLogBatch(logs);
    this.drawTurtleBatch(turtles);
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
    const p = this.palette;
    ctx.save();
    applySkinGlow(ctx, this.currentSkin, p.frog, 16);
    ctx.fillStyle = p.frog;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.frogEye;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 8, 3, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.frogPupil;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 8, 1.4, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 8, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  private drawHUD() {
    const ctx = this.ctx;
    const p = this.palette;
    ctx.save();
    applySkinGlow(ctx, this.currentSkin, p.hud, 8);
    ctx.fillStyle = p.hud;
    ctx.font = '15px "Courier New", monospace';
    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${this.score}`, 14, 26);
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, W / 2, 26);
    ctx.textAlign = "right";
    ctx.fillText("♥".repeat(Math.max(0, this.lives)), W - 14, 26);
    ctx.restore();
    const ratio = Math.max(0, this.roundTimer / roundTimeForLevel(this.level));
    const timerColor =
      ratio > 0.5 ? p.timerHigh : ratio > 0.2 ? p.timerMid : p.timerLow;
    ctx.save();
    applySkinGlow(ctx, this.currentSkin, timerColor, 10);
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, W * ratio, 5);
    ctx.restore();
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx;
    const p = this.palette;
    ctx.save();
    ctx.fillStyle = p.overlayBackdrop;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    applySkinGlow(ctx, this.currentSkin, p.overlayTitle, 18);
    ctx.fillStyle = p.overlayTitle;
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText(title, W / 2, H / 2 - 16);
    applySkinGlow(ctx, this.currentSkin, p.overlaySub, 10);
    ctx.fillStyle = p.overlaySub;
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(sub, W / 2, H / 2 + 24);
    ctx.restore();
  }
  private draw() {
    this.drawZones();
    this.drawGoals();
    this.drawLaneEntities();
    this.drawFrog();
    // Las scanlines van sobre el campo pero debajo del HUD/overlay.
    if (this.currentSkin === "retro") this.drawScanlines();
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
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }
  reset(): void {
    this.initState();
    if (this.paused) {
      this.paused = false;
    }
    this.lastFrameTime = performance.now();
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }
  forceGameOver(): void {
    if (this.phase === "gameover") return;
    this.phase = "gameover";
    this.lives = 0;
    this.triggerGameOver();
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: 0,
      level: this.level,
      state: "gameover",
    });
  }
  // Redibuja sincrónicamente para que el cambio se vea también en pausa.
  setSkin(skin: SkinName): void {
    this.currentSkin = skin;
    this.draw();
  }
  destroy(): void {
    this.destroyed = true;
    this.pause();
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
