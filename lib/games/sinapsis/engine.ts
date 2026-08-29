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
// ---- glifos ----
// 12 formas dibujadas con primitivas de canvas, distinguibles por silueta
// (no solo por color) — requisito de legibilidad de la spec. Cada función es
// pura: recibe el contexto, el centro, un tamaño de referencia y su color.
type GlyphDrawer = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) => void;
function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();
}
function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.28;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
  ctx.stroke();
}
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const r = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.87, cy + r * 0.5);
  ctx.lineTo(cx - r * 0.87, cy + r * 0.5);
  ctx.closePath();
  ctx.fill();
}
function drawSquare(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const s = size * 0.78;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.15);
  ctx.fill();
}
function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const r = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}
function drawCross(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const arm = size * 0.62;
  const thick = size * 0.22;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.rect(cx - thick / 2, cy - arm / 2, thick, arm);
  ctx.rect(cx - arm / 2, cy - thick / 2, arm, thick);
  ctx.fill();
}
function drawSaltire(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const r = size * 0.42;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r);
  ctx.lineTo(cx + r, cy + r);
  ctx.moveTo(cx + r, cy - r);
  ctx.lineTo(cx - r, cy + r);
  ctx.stroke();
}
function drawHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const r = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function drawBolt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const pts: [number, number][] = [
    [0.1, -0.5],
    [-0.15, 0.05],
    [0.05, 0.05],
    [-0.1, 0.5],
    [0.25, -0.05],
    [0.05, -0.05],
  ];
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const x = cx + px * size;
    const y = cy + py * size;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}
function drawCrescent(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(cx - r, cy - r, size, size);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx + r * 0.45, cy - r * 0.15, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawStar4(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const outer = size / 2;
  const inner = size * 0.18;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function drawDoubleBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  const barW = size * 0.72;
  const barH = size * 0.18;
  const gap = size * 0.16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - barW / 2, cy - gap / 2 - barH, barW, barH, barH * 0.3);
  ctx.roundRect(cx - barW / 2, cy + gap / 2, barW, barH, barH * 0.3);
  ctx.fill();
}
// Orden fijo: círculo, anillo, triángulo, cuadrado, rombo, cruz, aspa,
// hexágono, rayo, media luna, estrella de 4 puntas, barra doble.
const GLYPH_DRAWERS: GlyphDrawer[] = [
  drawCircle,
  drawRing,
  drawTriangle,
  drawSquare,
  drawDiamond,
  drawCross,
  drawSaltire,
  drawHexagon,
  drawBolt,
  drawCrescent,
  drawStar4,
  drawDoubleBar,
];
// Colores derivados de la paleta del tema (--cyan, --magenta, --yellow,
// --green) más variantes, uno por glifo, en el mismo orden que GLYPH_DRAWERS.
const GLYPH_COLORS: string[] = [
  "#00f5ff", // cyan
  "#ff006e", // magenta
  "#f5ff00", // yellow
  "#00ff88", // green
  "#b026ff", // violeta (variante magenta)
  "#ffb000", // ámbar (variante yellow)
  "#00bfff", // azul cielo (variante cyan)
  "#ff4da6", // rosa (variante magenta)
  "#adff2f", // lima (variante yellow/green)
  "#40e0d0", // turquesa (variante cyan/green)
  "#ff5a3c", // rojo-naranja (variante magenta/yellow)
  "#c792ea", // lila (variante magenta)
];
function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// Genera el tablero de un nivel: toma los primeros N glifos (N = pares),
// los duplica y baraja con Fisher-Yates antes de repartirlos row-major.
function buildBoard(cols: number, rows: number): Node[] {
  const pairs = (cols * rows) / 2;
  const glyphIds = Array.from({ length: pairs }, (_, i) => i);
  const deck = shuffle([...glyphIds, ...glyphIds]);
  const board: Node[] = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      board.push({ glyph: deck[index], state: "hidden", col, row });
      index++;
    }
  }
  return board;
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
    this.board = buildBoard(cols, rows);
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
    for (const node of this.board) {
      if (node.state === "hidden") continue;
      const { x, y, size } = cellRect(node, this.layout);
      const glyphSize = size * 0.55;
      GLYPH_DRAWERS[node.glyph](
        ctx,
        x + size / 2,
        y + size / 2,
        glyphSize,
        GLYPH_COLORS[node.glyph],
      );
    }
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
