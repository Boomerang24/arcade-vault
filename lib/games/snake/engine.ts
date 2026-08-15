// Motor de Snake escrito desde cero (no hay game.js de referencia para este
// juego). Atlas de coordenadas portado desde
// references/source-assets/snake-assets/sprites.js a TS, embebido aquí mismo
// siguiendo el mismo criterio que ArkanoidEngine.
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
const CELL = 20;
const COLS = W / CELL; // 40
const ROWS = H / CELL; // 30
const POINTS_PER_FRUIT = 10;
const FRUITS_PER_LEVEL = 5;
const BASE_TICK_MS = 140;
const MIN_TICK_MS = 60;
const TICK_STEP_MS = 8; // reducción del intervalo por nivel
// ---- skins ----
export type SkinName = "classic" | "neon" | "retro";
type Palette = {
  background: string;
  head: string;
  body: string;
  bodyEdge: string | null; // contorno del segmento (null = sin contorno)
  fruitTint: string | null; // teñido del sprite (null = sprite original)
  fruitTintAlpha: number;
  overlayBackdrop: string;
  overlayTitle: string;
  overlaySub: string;
  cornerRadius: number;
};
const SKIN_PALETTES: Record<SkinName, Palette> = {
  // `classic` reproduce exactamente los literales originales del motor.
  classic: {
    background: "#000000",
    head: "#4ade80",
    body: "#16a34a",
    bodyEdge: null,
    fruitTint: null,
    fruitTintAlpha: 0,
    overlayBackdrop: "rgba(0, 0, 0, 0.6)",
    overlayTitle: "#f0f0f0",
    overlaySub: "#f0f0f0",
    cornerRadius: 4,
  },
  neon: {
    background: "#06000f",
    head: "#00f5ff",
    body: "#00ff88",
    bodyEdge: "#00f5ff",
    fruitTint: "#f5ff00",
    fruitTintAlpha: 0.35,
    overlayBackdrop: "rgba(6, 0, 15, 0.68)",
    overlayTitle: "#ff006e",
    overlaySub: "#00f5ff",
    cornerRadius: 4,
  },
  retro: {
    background: "#0a0600",
    head: "#ffb000",
    body: "#cc7a00",
    bodyEdge: "#0a0600",
    fruitTint: "#ffb000",
    fruitTintAlpha: 1,
    overlayBackdrop: "rgba(10, 6, 0, 0.68)",
    overlayTitle: "#ffb000",
    overlaySub: "#ffb000",
    cornerRadius: 0,
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
type SpriteFrame = { x: number; y: number; w: number; h: number };
// Hoja: 3790x442 px, fondo transparente. Fila usada: y=136-295.
const FRUIT_SPRITES: Record<string, SpriteFrame> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};
const FRUIT_KEYS = Object.keys(FRUIT_SPRITES);
type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
const DIRECTION_DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
function tickIntervalForLevel(level: number): number {
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - (level - 1) * TICK_STEP_MS);
}
export class SnakeEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private snake: Point[] = [];
  private direction: Direction = "right";
  private queuedDirection: Direction = "right";
  private fruit: { pos: Point; kind: string } | null = null;
  private score = 0;
  private level = 1;
  private fruitsEaten = 0;
  private phase: "playing" | "gameover" = "playing";
  private gameOverNotified = false;
  private lastTickTime = 0;
  private spriteImage: HTMLImageElement;
  private spritesLoaded = false;
  private rafId: number | null = null;
  private paused = false;
  private destroyed = false;
  private currentSkin: SkinName = "classic";
  // Cache de sprites teñidos, clave `${kind}|${skin}`. Evita re-teñir por frame.
  private tintedFruits = new Map<string, HTMLCanvasElement>();
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
    this.ctx.fillStyle = this.palette.background;
    this.ctx.fillRect(0, 0, W, H);
    this.spriteImage = new Image();
    this.spriteImage.onload = () => {
      if (this.destroyed) return;
      this.spritesLoaded = true;
      this.lastTickTime = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    };
    this.spriteImage.onerror = () =>
      console.error("Failed to load snake spritesheet");
    this.spriteImage.src = "/games/snake/fruits.png";
  }
  private initState() {
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    this.snake = [
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
      { x: startX - 3, y: startY },
    ];
    this.direction = "right";
    this.queuedDirection = "right";
    this.score = 0;
    this.level = 1;
    this.fruitsEaten = 0;
    this.phase = "playing";
    this.gameOverNotified = false;
    this.placeFruit();
  }
  private handleKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIRECTION[e.code];
    if (!dir) return;
    e.preventDefault();
    if (this.paused || this.phase !== "playing") return;
    if (dir === OPPOSITE[this.direction]) return;
    this.queuedDirection = dir;
  };
  private isOccupied(x: number, y: number): boolean {
    return this.snake.some((seg) => seg.x === x && seg.y === y);
  }
  private placeFruit() {
    const maxAttempts = COLS * ROWS;
    let pos: Point | null = null;
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      if (!this.isOccupied(candidate.x, candidate.y)) {
        pos = candidate;
        break;
      }
    }
    if (!pos) {
      // Fallback determinista: primera celda libre en orden de barrido.
      outer: for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!this.isOccupied(x, y)) {
            pos = { x, y };
            break outer;
          }
        }
      }
    }
    if (!pos) {
      // Tablero completamente lleno: no hay celda disponible.
      this.fruit = null;
      return;
    }
    const kind = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
    this.fruit = { pos, kind };
  }
  private triggerGameOver() {
    if (this.gameOverNotified) return;
    this.gameOverNotified = true;
    this.callbacks.onGameOver(this.score);
  }
  private tickMovement() {
    this.direction = this.queuedDirection;
    const delta = DIRECTION_DELTA[this.direction];
    const head = this.snake[0];
    const newHead = { x: head.x + delta.x, y: head.y + delta.y };
    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      this.phase = "gameover";
      this.triggerGameOver();
      return;
    }
    const willEat =
      this.fruit &&
      newHead.x === this.fruit.pos.x &&
      newHead.y === this.fruit.pos.y;
    const bodyToCheck = willEat ? this.snake : this.snake.slice(0, -1);
    if (bodyToCheck.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      this.phase = "gameover";
      this.triggerGameOver();
      return;
    }
    this.snake.unshift(newHead);
    if (willEat) {
      this.score += POINTS_PER_FRUIT;
      this.fruitsEaten += 1;
      this.level = 1 + Math.floor(this.fruitsEaten / FRUITS_PER_LEVEL);
      this.placeFruit();
    } else {
      this.snake.pop();
    }
  }
  private update(now: number) {
    if (this.phase !== "playing") return;
    const interval = tickIntervalForLevel(this.level);
    if (now - this.lastTickTime >= interval) {
      this.lastTickTime = now;
      this.tickMovement();
    }
  }
  private drawSnake() {
    const ctx = this.ctx;
    const p = this.palette;
    const skin = this.currentSkin;
    this.snake.forEach((seg, i) => {
      const color = i === 0 ? p.head : p.body;
      const pad = 1;
      const x = seg.x * CELL + pad;
      const y = seg.y * CELL + pad;
      const size = CELL - pad * 2;
      applySkinGlow(ctx, skin, color, i === 0 ? 14 : 8);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, p.cornerRadius);
      ctx.fill();
      if (p.bodyEdge) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = p.bodyEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    });
  }
  // Devuelve el frame del sprite teñido con el color de la skin actual,
  // usando un canvas offscreen + `source-atop` (respeta la transparencia).
  private tintedFruit(kind: string): CanvasImageSource | null {
    const p = this.palette;
    const sprite = FRUIT_SPRITES[kind];
    if (!sprite) return null;
    if (!p.fruitTint) return null;
    const key = `${kind}|${this.currentSkin}`;
    const cached = this.tintedFruits.get(key);
    if (cached) return cached;
    const off = document.createElement("canvas");
    off.width = sprite.w;
    off.height = sprite.h;
    const octx = off.getContext("2d");
    if (!octx) return null;
    octx.drawImage(
      this.spriteImage,
      sprite.x,
      sprite.y,
      sprite.w,
      sprite.h,
      0,
      0,
      sprite.w,
      sprite.h,
    );
    octx.globalCompositeOperation = "source-atop";
    octx.globalAlpha = p.fruitTintAlpha;
    octx.fillStyle = p.fruitTint;
    octx.fillRect(0, 0, sprite.w, sprite.h);
    this.tintedFruits.set(key, off);
    return off;
  }
  private drawFruit() {
    if (!this.fruit || !this.spritesLoaded) return;
    const sprite = FRUIT_SPRITES[this.fruit.kind];
    if (!sprite) return;
    const ctx = this.ctx;
    const dx = this.fruit.pos.x * CELL;
    const dy = this.fruit.pos.y * CELL;
    applySkinGlow(
      ctx,
      this.currentSkin,
      this.palette.fruitTint ?? "#ffffff",
      12,
    );
    const tinted = this.tintedFruit(this.fruit.kind);
    if (tinted) {
      ctx.drawImage(tinted, 0, 0, sprite.w, sprite.h, dx, dy, CELL, CELL);
    } else {
      ctx.drawImage(
        this.spriteImage,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h,
        dx,
        dy,
        CELL,
        CELL,
      );
    }
    ctx.shadowBlur = 0;
  }
  // Textura CRT de la skin `retro`: scanlines horizontales sutiles.
  private drawScanlines() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx;
    const p = this.palette;
    ctx.fillStyle = p.overlayBackdrop;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    applySkinGlow(ctx, this.currentSkin, p.overlayTitle, 18);
    ctx.fillStyle = p.overlayTitle;
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillText(title, W / 2, H / 2 - 20);
    applySkinGlow(ctx, this.currentSkin, p.overlaySub, 10);
    ctx.fillStyle = p.overlaySub;
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText(sub, W / 2, H / 2 + 30);
    ctx.shadowBlur = 0;
  }
  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = this.palette.background;
    ctx.fillRect(0, 0, W, H);
    this.drawFruit();
    this.drawSnake();
    if (this.currentSkin === "retro") this.drawScanlines();
    if (this.phase === "gameover") {
      this.drawOverlay("GAME OVER", `Score final: ${this.score}`);
    }
  }
  private loop = (now: number) => {
    this.update(now);
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.phase === "gameover" ? 0 : 1,
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
    this.lastTickTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }
  reset(): void {
    this.initState();
    if (this.paused) {
      this.paused = false;
    }
    this.lastTickTime = performance.now();
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
