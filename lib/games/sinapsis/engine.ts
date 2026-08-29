// Motor de SINAPSIS escrito desde cero (juego original de game-jam, sin
// game.js de referencia ni assets binarios — ver
// specs/game-jam/sinapsis/15-sinapsis-base.md). Modo clásico: rejilla de
// nodos de memoria/concentración navegada por teclado, con reloj por ronda.
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
const W = 800;
const H = 600;
const HUD_H = 64;
const GRID_AREA_Y = HUD_H;
const GRID_AREA_H = H - HUD_H;
const GAP = 16;
const MARGIN = 24;
const BACKGROUND = "#050510";
const NODE_BACK = "#12122a";
const NODE_BORDER = "#3a3a6a";
const CURSOR_BORDER = "#00f5ff";
type NodeState = "hidden" | "revealed" | "matched";
type Node = { glyph: number; state: NodeState; col: number; row: number };
type Cursor = { col: number; row: number };
type Layout = {
  cellSize: number;
  gridW: number;
  gridH: number;
  offsetX: number;
  offsetY: number;
};
type Direction = "up" | "down" | "left" | "right";
const DIRECTION_DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
// Dimensiones de la rejilla por nivel (tope 6x4 en nivel 4+, ver spec).
function gridDimsForLevel(level: number): { cols: number; rows: number } {
  if (level <= 1) return { cols: 4, rows: 3 };
  if (level === 2) return { cols: 4, rows: 4 };
  if (level === 3) return { cols: 6, rows: 3 };
  return { cols: 6, rows: 4 };
}
// Calcula el tamaño de carta que hace caber una rejilla cols x rows,
// centrada en el área bajo el HUD, con gap fijo y margen mínimo de 24px.
function computeLayout(cols: number, rows: number): Layout {
  const availW = W - 2 * MARGIN;
  const availH = GRID_AREA_H - 2 * MARGIN;
  const cellW = (availW - (cols - 1) * GAP) / cols;
  const cellH = (availH - (rows - 1) * GAP) / rows;
  const cellSize = Math.floor(Math.min(cellW, cellH));
  const gridW = cols * cellSize + (cols - 1) * GAP;
  const gridH = rows * cellSize + (rows - 1) * GAP;
  const offsetX = (W - gridW) / 2;
  const offsetY = GRID_AREA_Y + (GRID_AREA_H - gridH) / 2;
  return { cellSize, gridW, gridH, offsetX, offsetY };
}
function cellRect(node: { col: number; row: number }, layout: Layout) {
  return {
    x: layout.offsetX + node.col * (layout.cellSize + GAP),
    y: layout.offsetY + node.row * (layout.cellSize + GAP),
    size: layout.cellSize,
  };
}
export class SinapsisEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private level = 1;
  private cols = 4;
  private rows = 3;
  private board: Node[] = [];
  private layout: Layout = computeLayout(4, 3);
  private cursor: Cursor = { col: 0, row: 0 };
  private score = 0;
  private lives = 5;
  private phase: "playing" | "dead" | "gameover" = "playing";
  private gameOverNotified = false;
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
    this.level = 1;
    this.score = 0;
    this.lives = 5;
    this.phase = "playing";
    this.gameOverNotified = false;
    this.setupGrid(this.level);
  }
  private setupGrid(level: number) {
    const { cols, rows } = gridDimsForLevel(level);
    this.cols = cols;
    this.rows = rows;
    this.layout = computeLayout(cols, rows);
    this.board = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.board.push({ glyph: 0, state: "hidden", col, row });
      }
    }
    this.cursor = { col: 0, row: 0 };
  }
  private handleKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIRECTION[e.code];
    if (!dir) return;
    e.preventDefault();
    if (this.paused || this.phase === "gameover") return;
    const delta = DIRECTION_DELTA[dir];
    const nextCol = this.cursor.col + delta.dc;
    const nextRow = this.cursor.row + delta.dr;
    if (
      nextCol < 0 ||
      nextCol >= this.cols ||
      nextRow < 0 ||
      nextRow >= this.rows
    )
      return;
    this.cursor = { col: nextCol, row: nextRow };
  };
  private update(_dt: number) {
    // La lógica de sondeo, puntuación y reloj llega en pasos posteriores.
  }
  private drawBoard() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = NODE_BORDER;
    ctx.lineWidth = 2;
    ctx.fillStyle = NODE_BACK;
    ctx.beginPath();
    for (const node of this.board) {
      const { x, y, size } = cellRect(node, this.layout);
      ctx.roundRect(x, y, size, size, 8);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const cursorNode = this.board.find(
      (n) => n.col === this.cursor.col && n.row === this.cursor.row,
    );
    if (cursorNode) {
      const { x, y, size } = cellRect(cursorNode, this.layout);
      ctx.save();
      ctx.strokeStyle = CURSOR_BORDER;
      ctx.lineWidth = 3;
      ctx.shadowColor = CURSOR_BORDER;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, 8);
      ctx.stroke();
      ctx.restore();
    }
  }
  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, W, H);
    this.drawBoard();
  }
  private triggerGameOver() {
    if (this.gameOverNotified) return;
    this.gameOverNotified = true;
    this.callbacks.onGameOver(this.score);
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
      state: this.phase,
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
    this.triggerGameOver();
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: "gameover",
    });
  }
  destroy(): void {
    this.destroyed = true;
    this.pause();
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
