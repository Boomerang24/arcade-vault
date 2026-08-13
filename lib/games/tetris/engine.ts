// Port de references/started-games/03-tetris/game.js a TypeScript,
// sin localStorage propio, sin toggle de tema y sin captura interna de P/Escape
// (la pausa la controla solo el player-hud externo, igual que AsteroidesEngine).
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
export type TetrisCanvases = {
  board: HTMLCanvasElement;
  next: HTMLCanvasElement;
};
export type SkinName = "retro" | "neon" | "pastel" | "pixelart";
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = COLS * BLOCK;
const H = ROWS * BLOCK;
const COLORS: Array<string | null> = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#64b5f6", // J - pale blue
  "#ffb74d", // L - orange
  "#b0bec5", // N - nut (steel gray)
];
const PIECES: Array<number[][] | null> = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  // [
  //   [8, 8, 8],
  //   [8, 0, 8],
  //   [8, 8, 8],
  // ], // N - tuerca (deshabilitada por ahora, ver randomPiece)
];
const SKIN_PALETTES: Record<SkinName, Array<string | null>> = {
  retro: COLORS,
  neon: [
    null,
    "#00fff2",
    "#faff00",
    "#ff2df5",
    "#39ff6a",
    "#ff3b3b",
    "#3d9dff",
    "#ff9d1f",
    "#e8e8ff",
  ],
  pastel: [
    null,
    "#a8e6ea",
    "#fff2b3",
    "#e3c2ea",
    "#c3ecc0",
    "#f5c2c2",
    "#c2d9f5",
    "#ffd9b3",
    "#dbe0e6",
  ],
  pixelart: COLORS,
};
const LINE_SCORES = [0, 100, 300, 500, 800];
const PERFECT_CLEAR_BONUS = [0, 800, 1200, 1800, 2000];
type SpecialType = "tint" | "bomb" | "lightning";
const POWERUP_TYPES: SpecialType[] = ["tint", "bomb", "lightning"];
const POWERUP_ICONS: Record<SpecialType, string> = {
  tint: "🎨",
  bomb: "💣",
  lightning: "⚡",
};
type PieceLike = {
  type: number;
  shape: number[][];
  special: SpecialType | null;
};
type Piece = PieceLike & { x: number; y: number };
type FloatingText = {
  text: string;
  color: string;
  alpha: number;
  y: number;
  life: number;
  maxLife: number;
};
export class TetrisEngine {
  private boardCtx: CanvasRenderingContext2D;
  private nextCtx: CanvasRenderingContext2D;
  private nextCanvas: HTMLCanvasElement;
  private callbacks: EngineCallbacks;
  private board!: number[][];
  private current!: Piece;
  private next!: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private state: "playing" | "dead" | "gameover" = "playing";
  private combo = 0;
  private linesUntilPowerUp = 0;
  private nextIsSpecial = false;
  private floatingTexts: FloatingText[] = [];
  private currentSkin: SkinName = "retro";
  private paused = false;
  private lastTime: number | null = null;
  private dropAccum = 0;
  private dropInterval = 1000;
  private rafId: number | null = null;
  private audioCtx: AudioContext | null = null;
  constructor(canvases: TetrisCanvases, callbacks: EngineCallbacks) {
    const boardCtx = canvases.board.getContext("2d");
    const nextCtx = canvases.next.getContext("2d");
    if (!boardCtx || !nextCtx) {
      throw new Error("No se pudo obtener el contexto 2D de los canvases");
    }
    this.nextCanvas = canvases.next;
    this.boardCtx = boardCtx;
    this.nextCtx = nextCtx;
    this.callbacks = callbacks;
    window.addEventListener("keydown", this.handleKeyDown);
    this.initGame();
    this.rafId = requestAnimationFrame(this.loop);
  }
  private handleKeyDown = (e: KeyboardEvent) => {
    const capturedCodes = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown",
      "ArrowUp",
      "Space",
    ];
    if (capturedCodes.includes(e.code)) e.preventDefault();
    if (this.paused || this.state === "gameover") return;
    switch (e.code) {
      case "ArrowLeft":
        if (
          !this.collide(this.current.shape, this.current.x - 1, this.current.y)
        )
          this.current.x--;
        break;
      case "ArrowRight":
        if (
          !this.collide(this.current.shape, this.current.x + 1, this.current.y)
        )
          this.current.x++;
        break;
      case "ArrowDown":
        this.softDrop();
        break;
      case "ArrowUp":
        this.tryRotate();
        break;
      case "Space":
        this.hardDrop();
        break;
    }
  };
  // ---- audio ----
  private getAudioCtx(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioCtx = new AudioCtor();
    }
    return this.audioCtx;
  }
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    gain = 0.15,
    delay = 0,
  ) {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const startAt = ctx.currentTime + delay;
    gainNode.gain.setValueAtTime(0, startAt);
    gainNode.gain.linearRampToValueAtTime(gain, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration);
  }
  private playLineClearSound(cleared: number) {
    this.playTone(330 + cleared * 60, 0.15);
  }
  private playComboSound(comboCount: number) {
    const base = 440 + Math.min(comboCount, 8) * 40;
    this.playTone(base, 0.12);
    this.playTone(base * 1.25, 0.15, "sine", 0.15, 0.08);
  }
  private playTetrisSound() {
    this.playTone(523.25, 0.25, "square", 0.1);
    this.playTone(659.25, 0.25, "square", 0.1);
    this.playTone(783.99, 0.3, "square", 0.1);
  }
  private playPerfectClearSound() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.playTone(freq, 0.3, "triangle", 0.15, i * 0.09);
    });
  }
  // ---- state / rules ----
  private createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }
  private randomPowerUpThreshold() {
    return 8 + Math.floor(Math.random() * 8);
  }
  private randomPiece(isSpecial: boolean): Piece {
    // Tope en 7: la pieza N (tuerca, índice 8) está deshabilitada arriba en PIECES.
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    const special = isSpecial
      ? POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
      : null;
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
      special,
    };
  }
  private collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }
  private rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }
  private tryRotate() {
    const rotated = this.rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }
  private merge() {
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.board[this.current.y + r][this.current.x + c] =
            this.current.shape[r][c];
  }
  private isBoardEmpty() {
    return this.board.every((row) => row.every((v) => v === 0));
  }
  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.combo++;
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level * this.combo;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
      this.linesUntilPowerUp -= cleared;
      if (this.linesUntilPowerUp <= 0) {
        this.nextIsSpecial = true;
        this.linesUntilPowerUp = this.randomPowerUpThreshold();
      }
      if (cleared === 4) {
        this.spawnFloatingText("TETRIS!", "#ffd54f");
        this.playTetrisSound();
      } else if (this.combo >= 2) {
        this.spawnFloatingText(`COMBO x${this.combo}`, "#7aa2f7");
        this.playComboSound(this.combo);
      } else {
        this.playLineClearSound(cleared);
      }
      if (this.isBoardEmpty()) {
        this.score += PERFECT_CLEAR_BONUS[cleared] * this.level;
        this.spawnFloatingText("PERFECT CLEAR!", "#ffe066");
        this.playPerfectClearSound();
      }
    } else {
      this.combo = 0;
    }
  }
  private clearFullRow(r: number) {
    this.board.splice(r, 1);
    this.board.unshift(new Array(COLS).fill(0));
    this.lines += 1;
    this.score += (LINE_SCORES[1] || 0) * this.level;
    this.level = Math.floor(this.lines / 10) + 1;
    this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
  }
  private collapseColumns(colsAffected: Set<number>) {
    for (const c of colsAffected) {
      const values: number[] = [];
      for (let r = 0; r < ROWS; r++) {
        if (this.board[r][c] !== 0) values.push(this.board[r][c]);
      }
      for (let r = 0; r < ROWS; r++) {
        const fromBottom = ROWS - 1 - r;
        const valueIndex = values.length - 1 - fromBottom;
        this.board[r][c] = valueIndex >= 0 ? values[valueIndex] : 0;
      }
    }
  }
  private pieceBounds(piece: PieceLike) {
    let minR = Infinity,
      maxR = -Infinity,
      minC = Infinity,
      maxC = -Infinity;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          minR = Math.min(minR, r);
          maxR = Math.max(maxR, r);
          minC = Math.min(minC, c);
          maxC = Math.max(maxC, c);
        }
      }
    }
    return { minR, maxR, minC, maxC };
  }
  private applyPowerUp(piece: Piece) {
    const { minR, maxR, minC, maxC } = this.pieceBounds(piece);
    if (piece.special === "bomb") {
      const centerR = piece.y + Math.round((minR + maxR) / 2);
      const centerC = piece.x + Math.round((minC + maxC) / 2);
      const colsAffected = new Set<number>();
      for (let r = centerR - 1; r <= centerR + 1; r++) {
        if (r < 0 || r >= ROWS) continue;
        for (let c = centerC - 1; c <= centerC + 1; c++) {
          if (c < 0 || c >= COLS) continue;
          this.board[r][c] = 0;
          colsAffected.add(c);
        }
      }
      this.collapseColumns(colsAffected);
    } else if (piece.special === "lightning") {
      const width = maxC - minC + 1;
      const height = maxR - minR + 1;
      if (width >= height) {
        const rows = new Set<number>();
        for (let r = minR; r <= maxR; r++) rows.add(piece.y + r);
        for (const r of [...rows].sort((a, b) => b - a)) {
          if (r >= 0 && r < ROWS) this.clearFullRow(r);
        }
      } else {
        const colsAffected = new Set<number>();
        for (let c = minC; c <= maxC; c++) {
          const col = piece.x + c;
          if (col < 0 || col >= COLS) continue;
          for (let r = 0; r < ROWS; r++) this.board[r][col] = 0;
          colsAffected.add(col);
        }
        this.collapseColumns(colsAffected);
      }
    } else if (piece.special === "tint") {
      const counts = new Array(COLORS.length).fill(0);
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (this.board[r][c]) counts[this.board[r][c]]++;
      let target = 0;
      for (let i = 1; i < counts.length; i++) {
        if (counts[i] > counts[target]) target = i;
      }
      const colsAffected = new Set<number>();
      if (target > 0) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (this.board[r][c] === target) {
              this.board[r][c] = 0;
              colsAffected.add(c);
            }
          }
        }
      }
      this.collapseColumns(colsAffected);
    }
  }
  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }
  private hardDrop() {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }
  private softDrop() {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }
  private lockPiece() {
    this.merge();
    if (this.current.special) this.applyPowerUp(this.current);
    this.clearLines();
    this.spawn();
  }
  private spawn() {
    this.current = this.next;
    this.next = this.randomPiece(this.nextIsSpecial);
    this.nextIsSpecial = false;
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.endGame();
    }
    this.drawNext();
  }
  private spawnFloatingText(text: string, color: string) {
    this.floatingTexts.push({
      text,
      color,
      alpha: 1,
      y: H / 2,
      life: 900,
      maxLife: 900,
    });
  }
  private updateFloatingTexts(dt: number) {
    for (const t of this.floatingTexts) {
      t.life -= dt;
      t.y -= dt * 0.03;
      t.alpha = Math.max(0, t.life / t.maxLife);
    }
    this.floatingTexts = this.floatingTexts.filter((t) => t.life > 0);
  }
  // ---- drawing ----
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  private drawPixelTexture(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    size: number,
  ) {
    const cells = 4;
    const cellSize = size / cells;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        if ((r + c) % 2 !== 0) continue;
        ctx.fillStyle =
          r % 2 === 0 ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.10)";
        ctx.fillRect(px + c * cellSize, py + r * cellSize, cellSize, cellSize);
      }
    }
  }
  private drawBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    const color = SKIN_PALETTES[this.currentSkin][colorIndex] as string;
    const px = x * size;
    const py = y * size;
    ctx.globalAlpha = alpha ?? 1;
    if (this.currentSkin === "neon") {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
      ctx.restore();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
    } else if (this.currentSkin === "pastel") {
      ctx.fillStyle = color;
      this.drawRoundedRect(
        ctx,
        px + 2,
        py + 2,
        size - 4,
        size - 4,
        size * 0.22,
      );
      ctx.fill();
    } else if (this.currentSkin === "pixelart") {
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
      this.drawPixelTexture(ctx, px + 1, py + 1, size - 2);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(px + 1, py + 1, size - 2, 4);
    }
    ctx.globalAlpha = 1;
  }
  private drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = "#22222e";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(W, r * BLOCK);
      ctx.stroke();
    }
  }
  private drawSpecialOverlay(
    ctx: CanvasRenderingContext2D,
    piece: PieceLike,
    originX: number,
    originY: number,
    size: number,
  ) {
    if (!piece.special) return;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * pulse})`;
    ctx.lineWidth = 2;
    const { minR, maxR, minC, maxC } = this.pieceBounds(piece);
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        ctx.strokeRect(
          (originX + c) * size + 1.5,
          (originY + r) * size + 1.5,
          size - 3,
          size - 3,
        );
      }
    }
    const centerR = originY + (minR + maxR) / 2 + 0.5;
    const centerC = originX + (minC + maxC) / 2 + 0.5;
    ctx.font = `${size * 0.7}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(POWERUP_ICONS[piece.special], centerC * size, centerR * size);
    ctx.restore();
  }
  private drawPreview(
    ctx: CanvasRenderingContext2D,
    canvasEl: HTMLCanvasElement,
    piece: PieceLike | null,
  ) {
    const NB = 30;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (!piece) return;
    const shape = piece.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(ctx, offX + c, offY + r, shape[r][c], NB);
    this.drawSpecialOverlay(ctx, piece, offX, offY, NB);
  }
  private drawNext() {
    this.drawPreview(this.nextCtx, this.nextCanvas, this.next);
  }
  private draw() {
    const ctx = this.boardCtx;
    ctx.clearRect(0, 0, W, H);
    this.drawGrid(ctx);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(ctx, c, r, this.board[r][c], BLOCK);
    const gy = this.ghostY();
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.drawBlock(
            ctx,
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            BLOCK,
            0.2,
          );
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        this.drawBlock(
          ctx,
          this.current.x + c,
          this.current.y + r,
          this.current.shape[r][c],
          BLOCK,
        );
    this.drawSpecialOverlay(
      ctx,
      this.current,
      this.current.x,
      this.current.y,
      BLOCK,
    );
    ctx.textAlign = "left";
    ctx.font = "13px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(`SCORE ${this.score}`, 8, 16);
    ctx.fillText(`LINES ${this.lines}`, 8, 32);
    ctx.fillText(`LEVEL ${this.level}`, 8, 48);
    if (this.combo >= 2) {
      ctx.fillStyle = "#7aa2f7";
      ctx.fillText(`COMBO x${this.combo}`, 8, 64);
    }
    for (const t of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, W / 2, t.y);
      ctx.fillText(t.text, W / 2, t.y);
      ctx.restore();
    }
    if (this.state === "gameover") {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px monospace";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 10);
      ctx.font = "14px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(`PUNTAJE: ${this.score}`, W / 2, H / 2 + 20);
    }
  }
  private loop = (ts: number) => {
    const dt = this.lastTime === null ? 0 : ts - this.lastTime;
    this.lastTime = ts;
    this.updateFloatingTexts(dt);
    this.dropAccum += dt;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (
        !this.collide(this.current.shape, this.current.x, this.current.y + 1)
      ) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.state === "gameover" ? 0 : 1,
      level: this.level,
      state: this.state,
    });
    if (this.state !== "gameover") {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };
  private initGame() {
    this.board = this.createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.state = "playing";
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.lastTime = null;
    this.combo = 0;
    this.floatingTexts = [];
    this.linesUntilPowerUp = this.randomPowerUpThreshold();
    this.nextIsSpecial = false;
    this.next = this.randomPiece(false);
    this.spawn();
  }
  private endGame() {
    this.state = "gameover";
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: 0,
      level: this.level,
      state: "gameover",
    });
    this.callbacks.onGameOver(this.score);
  }
  // ---- public contract ----
  setSkin(skin: SkinName): void {
    this.currentSkin = skin;
    this.draw();
    this.drawNext();
  }
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  resume(): void {
    if (!this.paused || this.state === "gameover") return;
    this.paused = false;
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.loop);
  }
  reset(): void {
    this.initGame();
    this.paused = false;
    this.lastTime = null;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }
  forceGameOver(): void {
    if (this.state === "gameover") return;
    this.endGame();
  }
  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
