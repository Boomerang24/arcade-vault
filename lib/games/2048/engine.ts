// Motor de 2048 escrito desde cero (no hay game.js de referencia). El juego
// avanza por turnos: el estado solo cambia al pulsar una flecha. Este archivo
// arranca con la lógica pura del tablero (paso 1 de la spec 21); el canvas,
// los listeners y el ciclo de vida se añaden en pasos posteriores.
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
export const SIZE = 4;
export type Direction = "up" | "down" | "left" | "right";
export type Cell = { row: number; col: number };
// `id` estable por ficha: permite animar cada una desde su celda previa a la
// nueva sin heurísticas de emparejamiento, incluso en fusiones (2 orígenes).
export type Tile = { id: number; value: number; row: number; col: number };
// Tablero como arreglo denso de 16 celdas (fila * SIZE + col), cada una `null`
// o con una ficha, tal como describe la sección Modelo de datos de la spec.
export type Board = (Tile | null)[];
export type SlideResult = {
  board: Board; // tablero resultante (fichas supervivientes ya en su celda destino)
  moved: boolean; // hubo desplazamiento o fusión -> turno válido
  gainedScore: number; // suma del valor de todas las fichas resultantes de fusión
  mergedIds: number[]; // ids de fichas supervivientes que absorbieron a otra (para el "pop")
  from: Map<number, Cell>; // id -> celda previa, para toda ficha existente antes del turno
  absorbed: { id: number; value: number; to: Cell }[]; // fichas eliminadas por fusión: valor previo + celda destino de viaje
};
export const idx = (row: number, col: number) => row * SIZE + col;
export function createEmptyBoard(): Board {
  return new Array(SIZE * SIZE).fill(null);
}
export function tilesOf(board: Board): Tile[] {
  return board.filter((t): t is Tile => t !== null);
}
export function maxTileValue(board: Board): number {
  let max = 0;
  for (const t of board) if (t && t.value > max) max = t.value;
  return max;
}
// 2 -> nivel 1, 4 -> 2, 8 -> 3, ... 2048 -> 11, y sigue subiendo. Nunca baja
// (la ficha máxima solo puede crecer). Con tablero vacío devuelve 1.
export function levelFromMaxTile(maxTile: number): number {
  if (maxTile < 2) return 1;
  return Math.log2(maxTile) - 1;
}
// Cada línea (fila o columna) devuelta en orden desde el borde de destino
// hacia el opuesto, que es como debe resolverse el deslizamiento.
function traversalLines(dir: Direction): Cell[][] {
  const lines: Cell[][] = [];
  for (let a = 0; a < SIZE; a++) {
    const line: Cell[] = [];
    for (let b = 0; b < SIZE; b++) {
      let row: number;
      let col: number;
      if (dir === "left") {
        row = a;
        col = b;
      } else if (dir === "right") {
        row = a;
        col = SIZE - 1 - b;
      } else if (dir === "up") {
        row = b;
        col = a;
      } else {
        row = SIZE - 1 - b;
        col = a;
      }
      line.push({ row, col });
    }
    lines.push(line);
  }
  return lines;
}
// Desliza todas las fichas hacia `dir`. No muta `board` ni sus fichas.
// Regla clásica: una ficha resultante de fusión no vuelve a fusionarse en el
// mismo turno (`4 4 4 4` -> `8 8 _ _`, nunca `16 _ _ _`).
export function slide(board: Board, dir: Direction): SlideResult {
  const from = new Map<number, Cell>();
  for (const t of board) if (t) from.set(t.id, { row: t.row, col: t.col });
  const next: Board = createEmptyBoard();
  const mergedIds: number[] = [];
  const absorbed: { id: number; value: number; to: Cell }[] = [];
  let gainedScore = 0;
  let moved = false;
  for (const line of traversalLines(dir)) {
    const existing: Tile[] = [];
    for (const cell of line) {
      const t = board[idx(cell.row, cell.col)];
      if (t) existing.push(t);
    }
    let slot = 0;
    let lastPlaced: Tile | null = null;
    let lastPlacedMerged = false;
    for (const tile of existing) {
      if (lastPlaced && !lastPlacedMerged && lastPlaced.value === tile.value) {
        const target = line[slot - 1];
        lastPlaced.value *= 2;
        lastPlaced.row = target.row;
        lastPlaced.col = target.col;
        lastPlacedMerged = true;
        mergedIds.push(lastPlaced.id);
        gainedScore += lastPlaced.value;
        absorbed.push({
          id: tile.id,
          value: tile.value,
          to: { row: target.row, col: target.col },
        });
        moved = true;
        continue;
      }
      const dest = line[slot];
      const placed: Tile = {
        id: tile.id,
        value: tile.value,
        row: dest.row,
        col: dest.col,
      };
      next[idx(dest.row, dest.col)] = placed;
      const origin = from.get(tile.id);
      if (origin && (origin.row !== dest.row || origin.col !== dest.col)) {
        moved = true;
      }
      lastPlaced = placed;
      lastPlacedMerged = false;
      slot += 1;
    }
  }
  return { board: next, moved, gainedScore, mergedIds, from, absorbed };
}
// Coloca una ficha nueva (`2` al 90%, `4` al 10%) en una celda vacía al azar.
// `id` lo provee quien llama (el motor mantiene el contador). Devuelve la
// ficha creada o `null` si no había hueco. No muta `board`.
export function spawnTile(
  board: Board,
  id: number,
): { board: Board; tile: Tile | null } {
  const empties: number[] = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) empties.push(i);
  if (empties.length === 0) return { board, tile: null };
  const cellIndex = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile: Tile = {
    id,
    value,
    row: Math.floor(cellIndex / SIZE),
    col: cellIndex % SIZE,
  };
  const nextBoard = board.slice();
  nextBoard[cellIndex] = tile;
  return { board: nextBoard, tile };
}
// El tablero está bloqueado cuando no queda ninguna celda vacía Y no existe
// ningún par ortogonalmente adyacente con el mismo valor.
export function isBlocked(board: Board): boolean {
  for (const t of board) if (!t) return false;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const v = board[idx(row, col)]!.value;
      if (col + 1 < SIZE && board[idx(row, col + 1)]!.value === v) return false;
      if (row + 1 < SIZE && board[idx(row + 1, col)]!.value === v) return false;
    }
  }
  return true;
}
// Tablero inicial: 2 fichas en celdas distintas, con la regla de aparición
// normal. Devuelve el tablero y el siguiente id libre.
export function createInitialBoard(startId = 1): {
  board: Board;
  nextId: number;
} {
  let board = createEmptyBoard();
  let nextId = startId;
  for (let i = 0; i < 2; i++) {
    const { board: b, tile } = spawnTile(board, nextId);
    board = b;
    if (tile) nextId += 1;
  }
  return { board, nextId };
}
// ---------------------------------------------------------------------------
// Render (paso 2): dibujo 100% procedural sobre un canvas de 800x600, mismo
// tamaño que Asteroides/Arkanoid/Snake/Sifon. La animacion de deslizamiento,
// la entrada de teclado y el ciclo de vida completo llegan en pasos 3 y 4.
// ---------------------------------------------------------------------------
const W = 800;
const H = 600;
const PANEL_X = 0;
const BOARD_X = 236;
const BOARD_Y = 36;
const BOARD_SIZE = 528;
const BOARD_PAD = 16;
const CELL_GAP = 16;
const CELL = 112; // 16 + 4*112 + 3*16 + 16 = 528
const COL_BG = "#0a0a0f";
const COL_PANEL_LABEL = "#8a8fb5";
const COL_PANEL_VALUE = "#00f5ff";
const COL_BOARD_FRAME = "#0f0f18";
const COL_BOARD_BORDER = "#00f5ff";
const COL_EMPTY_CELL = "#15151f";
const COL_LEGEND = "#4a4f70";
// Rampa de color por exponente (indice = log2(value)): cyan -> green ->
// yellow -> magenta, subiendo en luminosidad con el valor.
const TILE_COLORS = [
  "#0a0a0f",
  "#00c8d0",
  "#00f5ff",
  "#00e0a8",
  "#00ff88",
  "#9bf53a",
  "#f5ff00",
  "#ffc400",
  "#ff8a3d",
  "#ff5da0",
  "#ff2f96",
  "#ff006e",
  "#ff4fb0",
  "#ff7dc8",
];
function tileExponent(value: number): number {
  return Math.max(1, Math.round(Math.log2(value)));
}
function tileColor(value: number): string {
  return TILE_COLORS[Math.min(tileExponent(value), TILE_COLORS.length - 1)];
}
function tileShadowBlur(value: number): number {
  return Math.min(4 + tileExponent(value) * 2, 30);
}
function tileTextColor(value: number): string {
  return tileExponent(value) <= 6 ? "#0a0a0f" : "#ffffff";
}
// Tamano de fuente por tramos de digitos: 1-2, 3, 4, 5+.
function tileFontSize(value: number): number {
  if (value < 100) return 30;
  if (value < 1000) return 24;
  if (value < 10000) return 19;
  return 15;
}
function cellOrigin(row: number, col: number): { x: number; y: number } {
  return {
    x: BOARD_X + BOARD_PAD + col * (CELL + CELL_GAP),
    y: BOARD_Y + BOARD_PAD + row * (CELL + CELL_GAP),
  };
}
// Interpola en pixeles entre dos celdas.
function lerpCell(from: Cell, to: Cell, p: number): { x: number; y: number } {
  const a = cellOrigin(from.row, from.col);
  const b = cellOrigin(to.row, to.col);
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
// Duracion del deslizamiento (~110 ms) y del "asentamiento" posterior (pop de
// fusion + aparicion de la ficha nueva). La entrada se desbloquea al terminar
// ambos tramos.
const SLIDE_MS = 110;
const SETTLE_MS = 90;
const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
// Datos de la animacion del turno en curso.
type AnimState = {
  from: Map<number, Cell>; // id -> celda previa (fichas supervivientes)
  absorbed: { id: number; value: number; to: Cell }[];
  mergedIds: Set<number>; // supervivientes que absorbieron a otra
  spawnedId: number | null; // id de la ficha nueva, o null si no cabia
  spawnResolved: boolean; // ya se intento generar la ficha nueva
  t: number; // ms transcurridos
};
export class Game2048Engine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private board: Board;
  private nextId: number;
  private score = 0;
  private moves = 0;
  private maxTile = 0;
  private phase: "playing" | "gameover" = "playing";
  private paused = false;
  private anim: AnimState | null = null;
  // Buffer de UNA sola pulsacion durante la animacion: se guarda la primera y
  // se descartan las siguientes.
  private bufferedDir: Direction | null = null;
  private rafId: number | null = null;
  private lastFrame = 0;
  private pixelFamily = '"Press Start 2P", monospace';
  private monoFamily = '"Courier New", monospace';
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    this.callbacks = callbacks;
    const cs = getComputedStyle(canvas);
    const pixel = cs.getPropertyValue("--font-pixel").trim();
    const mono = cs.getPropertyValue("--font-courier-prime").trim();
    if (pixel) this.pixelFamily = `${pixel}, "Press Start 2P", monospace`;
    if (mono) this.monoFamily = `${mono}, "Courier New", monospace`;
    const init = createInitialBoard();
    this.board = init.board;
    this.nextId = init.nextId;
    this.maxTile = maxTileValue(this.board);
    window.addEventListener("keydown", this.handleKeyDown);
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }
  private handleKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    if (this.paused || this.phase !== "playing") return;
    if (this.anim) {
      if (this.bufferedDir === null) this.bufferedDir = dir;
      return;
    }
    this.applyMove(dir);
  };
  // Resuelve un turno. Un movimiento invalido (ni desplazamiento ni fusion) no
  // genera ficha, no anima y no consume turno.
  private applyMove(dir: Direction) {
    const res = slide(this.board, dir);
    if (!res.moved) return;
    this.board = res.board;
    this.score += res.gainedScore;
    this.moves += 1;
    this.maxTile = Math.max(this.maxTile, maxTileValue(this.board));
    this.anim = {
      from: res.from,
      absorbed: res.absorbed,
      mergedIds: new Set(res.mergedIds),
      spawnedId: null,
      spawnResolved: false,
      t: 0,
    };
  }
  // Orden fijo (ver Riesgos de la spec): resolver turno -> animar deslizamiento
  // -> generar ficha nueva. La comprobacion de bloqueo llega en el paso 4.
  private resolveSpawn() {
    if (!this.anim || this.anim.spawnResolved) return;
    this.anim.spawnResolved = true;
    const { board, tile } = spawnTile(this.board, this.nextId);
    this.board = board;
    if (tile) {
      this.anim.spawnedId = tile.id;
      this.nextId += 1;
    }
  }
  private flushBuffer() {
    const dir = this.bufferedDir;
    this.bufferedDir = null;
    if (dir) this.applyMove(dir);
  }
  private loop = (now: number) => {
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    if (!this.paused && this.anim) {
      this.anim.t += dt;
      if (this.anim.t >= SLIDE_MS) this.resolveSpawn();
      if (this.anim.t >= SLIDE_MS + SETTLE_MS) {
        this.anim = null;
        this.flushBuffer();
      }
    }
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };
  private get level(): number {
    return levelFromMaxTile(this.maxTile);
  }
  private get lives(): number {
    return this.phase === "gameover" ? 0 : 1;
  }
  private drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, W, H);
  }
  private drawPanel() {
    const ctx = this.ctx;
    const x = PANEL_X + 20;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = COL_PANEL_VALUE;
    ctx.font = `16px ${this.pixelFamily}`;
    ctx.fillText("2048", x, 52);
    const rows: [string, string][] = [
      ["PUNTOS", String(this.score)],
      ["MEJOR FICHA", String(this.maxTile)],
      ["NIVEL", String(this.level)],
      ["VIDAS", String(this.lives)],
      ["MOVIMIENTOS", String(this.moves)],
    ];
    let y = 110;
    for (const [label, value] of rows) {
      ctx.fillStyle = COL_PANEL_LABEL;
      ctx.font = `12px ${this.monoFamily}`;
      ctx.fillText(label, x, y);
      ctx.fillStyle = COL_PANEL_VALUE;
      ctx.font = `20px ${this.monoFamily}`;
      ctx.fillText(value, x, y + 24);
      y += 66;
    }
    ctx.fillStyle = COL_LEGEND;
    ctx.font = `9px ${this.pixelFamily}`;
    ctx.fillText("FLECHAS", x, H - 54);
    ctx.fillText("MOVER", x, H - 36);
  }
  private drawBoardFrame() {
    const ctx = this.ctx;
    ctx.fillStyle = COL_BOARD_FRAME;
    ctx.beginPath();
    ctx.roundRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE, 12);
    ctx.fill();
    ctx.strokeStyle = COL_BOARD_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = COL_EMPTY_CELL;
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const { x, y } = cellOrigin(row, col);
        ctx.beginPath();
        ctx.roundRect(x, y, CELL, CELL, 10);
        ctx.fill();
      }
    }
  }
  // `scale` (pop de fusion) y `alpha` (aparicion) los usa la animacion del
  // paso 3; aqui todo se dibuja a escala 1 y opacidad 1.
  private drawTile(value: number, x: number, y: number, scale = 1, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = tileColor(value);
    ctx.shadowBlur = tileShadowBlur(value);
    ctx.fillStyle = tileColor(value);
    ctx.beginPath();
    ctx.roundRect(x, y, CELL, CELL, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = tileTextColor(value);
    ctx.font = `${tileFontSize(value)}px ${this.pixelFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), cx, cy + 1);
    ctx.restore();
  }
  private drawTiles() {
    if (this.anim) {
      this.drawTilesAnimating(this.anim);
      return;
    }
    for (const tile of tilesOf(this.board)) {
      const { x, y } = cellOrigin(tile.row, tile.col);
      this.drawTile(tile.value, x, y);
    }
  }
  private drawTilesAnimating(a: AnimState) {
    const slideDone = a.t >= SLIDE_MS;
    const slideP = easeOutCubic(Math.min(a.t / SLIDE_MS, 1));
    const settleU = slideDone ? Math.min((a.t - SLIDE_MS) / SETTLE_MS, 1) : 0;
    // Fichas absorbidas: viajan al destino y desaparecen al terminar el slide.
    if (!slideDone) {
      for (const ab of a.absorbed) {
        const origin = a.from.get(ab.id);
        if (!origin) continue;
        const { x, y } = lerpCell(origin, ab.to, slideP);
        this.drawTile(ab.value, x, y);
      }
    }
    for (const tile of tilesOf(this.board)) {
      const cell = { row: tile.row, col: tile.col };
      if (tile.id === a.spawnedId) {
        const { x, y } = cellOrigin(tile.row, tile.col);
        this.drawTile(tile.value, x, y, 0.3 + 0.7 * settleU, settleU);
        continue;
      }
      const origin = a.from.get(tile.id) ?? cell;
      const { x, y } = lerpCell(origin, cell, slideP);
      const merged = a.mergedIds.has(tile.id);
      if (merged && !slideDone) {
        // Durante el slide la superviviente aun muestra su valor previo.
        this.drawTile(tile.value / 2, x, y);
      } else if (merged && slideDone) {
        const pop = 1 + 0.18 * Math.sin(Math.PI * settleU);
        this.drawTile(tile.value, x, y, pop);
      } else {
        this.drawTile(tile.value, x, y);
      }
    }
  }
  private draw() {
    this.drawBackground();
    this.drawPanel();
    this.drawBoardFrame();
    this.drawTiles();
  }
}
