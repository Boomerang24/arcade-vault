// Port de references/started-games/04-arkanoid/game.js a TypeScript,
// sin cambios de balance/físicas respecto al original salvo el reescalado
// proporcional de constantes de layout para el canvas 800x600 (antes 640x480).
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
// Escala 1.25x respecto al original (640x480 -> 800x600), aplicada de forma
// uniforme a todas las constantes de layout para no deformar los sprites.
const SCALE = 1.25;
const PADDLE_WIDTH = 100 * SCALE;
const PADDLE_HEIGHT = 14 * SCALE;
const PADDLE_SPEED = 7 * SCALE;
const PADDLE_Y = H - 30 * SCALE;
const BALL_RADIUS = 8 * SCALE;
const BASE_BALL_SPEED = 5 * SCALE;
const BRICK_COLS = 8;
const BRICK_WIDTH = 68 * SCALE;
const BRICK_HEIGHT = 20 * SCALE;
const BRICK_PADDING = 8 * SCALE;
const BRICK_OFFSET_TOP = 50 * SCALE;
const BRICK_OFFSET_LEFT =
  (W - (BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_PADDING)) / 2;
const BRICK_ROW_COLORS = ["red", "yellow", "green", "cyan", "magenta"];
const LEVELS = [{ rows: 5 }, { rows: 6 }, { rows: 7 }];
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;
const EXPLOSION_DURATION = 150;
const LEVEL_TRANSITION_DURATION = 1500;
function getBallSpeedForLevel(level: number): number {
  return BASE_BALL_SPEED * 0.8 + (level - 1) * (BASE_BALL_SPEED * 0.05);
}
type SpriteFrame = { sx: number; sy: number; sw: number; sh: number };
const SPRITES: {
  paddle: SpriteFrame;
  ball: SpriteFrame;
  blocks: Record<string, SpriteFrame>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};
const EXPLOSION_FRAMES: Record<string, SpriteFrame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
};
type Brick = {
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
  color: string;
};
type Explosion = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  startTime: number;
};
type Paddle = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
};
type Ball = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  radius: number;
};
export class ArkanoidEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private keys: Record<string, boolean> = {
    ArrowLeft: false,
    ArrowRight: false,
  };
  private paddle: Paddle;
  private ball: Ball;
  private bricks: Brick[] = [];
  private explosions: Explosion[] = [];
  private score = 0;
  private lives = 3;
  private currentLevel = 1;
  private phase: "playing" | "levelup" | "gameover" = "playing";
  private outcome: "lost" | "won" | null = null;
  private levelUpStartTime = 0;
  private gameOverNotified = false;
  private spriteImage: HTMLImageElement;
  private spritesLoaded = false;
  private bounceSound: HTMLAudioElement;
  private breakSound: HTMLAudioElement;
  private activeClones: HTMLAudioElement[] = [];
  private rafId: number | null = null;
  private paused = false;
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.paddle = {
      x: 0,
      y: PADDLE_Y,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      speed: PADDLE_SPEED,
    };
    this.ball = {
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
      speed: BASE_BALL_SPEED,
      radius: BALL_RADIUS,
    };
    this.bounceSound = new Audio("/games/arkanoid/ball-bounce.mp3");
    this.bounceSound.volume = 0.85;
    this.breakSound = new Audio("/games/arkanoid/break-sound.mp3");
    this.breakSound.volume = 0.85;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.resetPaddle();
    this.resetBall();
    this.generateBricks();
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, W, H);
    this.spriteImage = new Image();
    this.spriteImage.onload = () => {
      this.spritesLoaded = true;
      this.rafId = requestAnimationFrame(this.loop);
    };
    this.spriteImage.onerror = () =>
      console.error("Failed to load arkanoid spritesheet");
    this.spriteImage.src = "/games/arkanoid/spritesheet-breakout.png";
  }
  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      e.preventDefault();
      if (this.paused) return;
      this.keys[e.code] = true;
    }
  };
  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      this.keys[e.code] = false;
    }
  };
  private playSound(audio: HTMLAudioElement) {
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = audio.volume;
    this.activeClones.push(clone);
    clone.addEventListener("ended", () => {
      this.activeClones = this.activeClones.filter((c) => c !== clone);
    });
    clone.play().catch(() => {});
  }
  private resetBall() {
    this.ball.speed = getBallSpeedForLevel(this.currentLevel);
    this.ball.x = W / 2;
    this.ball.y = this.paddle.y - this.ball.radius;
    this.ball.dx = this.ball.speed * 0.6;
    this.ball.dy = -this.ball.speed;
  }
  private resetPaddle() {
    this.paddle.x = (W - this.paddle.width) / 2;
  }
  private generateBricks() {
    this.bricks = [];
    const rows = LEVELS[this.currentLevel - 1].rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        this.bricks.push({
          x: BRICK_OFFSET_LEFT + col * (BRICK_WIDTH + BRICK_PADDING),
          y: BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_PADDING),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          active: true,
          color: BRICK_ROW_COLORS[row % BRICK_ROW_COLORS.length],
        });
      }
    }
  }
  private updatePaddle() {
    if (this.keys.ArrowLeft) this.paddle.x -= this.paddle.speed;
    if (this.keys.ArrowRight) this.paddle.x += this.paddle.speed;
    if (this.paddle.x < 0) this.paddle.x = 0;
    if (this.paddle.x + this.paddle.width > W)
      this.paddle.x = W - this.paddle.width;
  }
  private checkBrickCollisions() {
    const { ball } = this;
    for (const brick of this.bricks) {
      if (!brick.active) continue;
      const closestX = Math.max(
        brick.x,
        Math.min(ball.x, brick.x + brick.width),
      );
      const closestY = Math.max(
        brick.y,
        Math.min(ball.y, brick.y + brick.height),
      );
      const distX = ball.x - closestX;
      const distY = ball.y - closestY;
      if (distX * distX + distY * distY > ball.radius * ball.radius) continue;
      brick.active = false;
      this.score += 10;
      this.playSound(this.breakSound);
      this.explosions.push({
        x: brick.x,
        y: brick.y,
        width: brick.width,
        height: brick.height,
        color: brick.color,
        startTime: performance.now(),
      });
      const overlapLeft = ball.x + ball.radius - brick.x;
      const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
      const overlapTop = ball.y + ball.radius - brick.y;
      const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);
      const minOverlap = Math.min(
        overlapLeft,
        overlapRight,
        overlapTop,
        overlapBottom,
      );
      if (minOverlap === overlapLeft || minOverlap === overlapRight) {
        ball.dx = -ball.dx;
      } else {
        ball.dy = -ball.dy;
      }
      break;
    }
  }
  private checkPaddleCollision() {
    const { ball, paddle } = this;
    if (ball.dy <= 0) return;
    const closestX = Math.max(
      paddle.x,
      Math.min(ball.x, paddle.x + paddle.width),
    );
    const closestY = Math.max(
      paddle.y,
      Math.min(ball.y, paddle.y + paddle.height),
    );
    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    if (distX * distX + distY * distY > ball.radius * ball.radius) return;
    const paddleCenter = paddle.x + paddle.width / 2;
    const relativeIntersect = (ball.x - paddleCenter) / (paddle.width / 2);
    const clampedIntersect = Math.max(-1, Math.min(1, relativeIntersect));
    const bounceAngle = clampedIntersect * MAX_BOUNCE_ANGLE;
    ball.dx = ball.speed * Math.sin(bounceAngle);
    ball.dy = -ball.speed * Math.cos(bounceAngle);
    ball.y = paddle.y - ball.radius;
    this.playSound(this.bounceSound);
  }
  private triggerGameOver() {
    if (this.gameOverNotified) return;
    this.gameOverNotified = true;
    this.callbacks.onGameOver(this.score);
  }
  private updateBall() {
    const { ball } = this;
    ball.x += ball.dx;
    ball.y += ball.dy;
    this.checkBrickCollisions();
    this.checkPaddleCollision();
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.dx = -ball.dx;
      this.playSound(this.bounceSound);
    } else if (ball.x + ball.radius > W) {
      ball.x = W - ball.radius;
      ball.dx = -ball.dx;
      this.playSound(this.bounceSound);
    }
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.dy = -ball.dy;
      this.playSound(this.bounceSound);
    }
    if (ball.y - ball.radius > H) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.phase = "gameover";
        this.outcome = "lost";
        this.triggerGameOver();
      } else {
        this.resetPaddle();
        this.resetBall();
      }
    }
  }
  private updateExplosions() {
    const now = performance.now();
    this.explosions = this.explosions.filter(
      (e) => now - e.startTime < EXPLOSION_DURATION,
    );
  }
  private checkVictory() {
    if (this.bricks.every((b) => !b.active)) {
      if (this.currentLevel < LEVELS.length) {
        this.phase = "levelup";
        this.levelUpStartTime = performance.now();
      } else {
        this.phase = "gameover";
        this.outcome = "won";
        this.triggerGameOver();
      }
    }
  }
  private update() {
    if (this.phase === "playing") {
      this.updatePaddle();
      this.updateBall();
      this.updateExplosions();
      this.checkVictory();
    } else if (this.phase === "levelup") {
      this.updateExplosions();
      if (
        performance.now() - this.levelUpStartTime >=
        LEVEL_TRANSITION_DURATION
      ) {
        this.currentLevel += 1;
        this.generateBricks();
        this.resetPaddle();
        this.resetBall();
        this.phase = "playing";
      }
    }
  }
  private drawSprite(
    sprite: SpriteFrame,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    if (!this.spritesLoaded) return;
    this.ctx.drawImage(
      this.spriteImage,
      sprite.sx,
      sprite.sy,
      sprite.sw,
      sprite.sh,
      x,
      y,
      w,
      h,
    );
  }
  private drawPaddle() {
    this.drawSprite(
      SPRITES.paddle,
      this.paddle.x,
      this.paddle.y,
      this.paddle.width,
      this.paddle.height,
    );
  }
  private drawBall() {
    const { ball } = this;
    this.drawSprite(
      SPRITES.ball,
      ball.x - ball.radius,
      ball.y - ball.radius,
      ball.radius * 2,
      ball.radius * 2,
    );
  }
  private drawBricks() {
    for (const brick of this.bricks) {
      if (!brick.active) continue;
      const sprite = SPRITES.blocks[brick.color];
      if (sprite)
        this.drawSprite(sprite, brick.x, brick.y, brick.width, brick.height);
    }
  }
  private drawExplosions() {
    const now = performance.now();
    for (const explosion of this.explosions) {
      const elapsed = now - explosion.startTime;
      const frameIndex = Math.min(
        3,
        Math.floor(elapsed / (EXPLOSION_DURATION / 4)),
      );
      const frames = EXPLOSION_FRAMES[explosion.color];
      const frame = frames ? frames[frameIndex] : undefined;
      if (frame)
        this.drawSprite(
          frame,
          explosion.x,
          explosion.y,
          explosion.width,
          explosion.height,
        );
    }
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f0f0f0";
    ctx.textAlign = "center";
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillText(title, W / 2, H / 2 - 20);
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText(sub, W / 2, H / 2 + 30);
  }
  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    this.drawBricks();
    this.drawExplosions();
    this.drawPaddle();
    this.drawBall();
    if (this.phase === "levelup") {
      this.drawOverlay(`Nivel ${this.currentLevel + 1}`, "");
    } else if (this.phase === "gameover") {
      this.drawOverlay(
        this.outcome === "won" ? "VICTORIA" : "GAME OVER",
        `Score final: ${this.score}`,
      );
    }
  }
  private loop = () => {
    this.update();
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.lives,
      level: this.currentLevel,
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
    this.rafId = requestAnimationFrame(this.loop);
  }
  reset(): void {
    this.score = 0;
    this.lives = 3;
    this.currentLevel = 1;
    this.phase = "playing";
    this.outcome = null;
    this.gameOverNotified = false;
    this.explosions = [];
    this.generateBricks();
    this.resetPaddle();
    this.resetBall();
    if (this.paused) {
      this.paused = false;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }
  forceGameOver(): void {
    if (this.phase === "gameover") return;
    this.phase = "gameover";
    this.outcome = "lost";
    this.lives = 0;
    this.triggerGameOver();
    this.draw();
    this.callbacks.onStats({
      score: this.score,
      lives: this.lives,
      level: this.currentLevel,
      state: "gameover",
    });
  }
  destroy(): void {
    this.pause();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.bounceSound.pause();
    this.breakSound.pause();
    this.activeClones.forEach((c) => c.pause());
    this.activeClones = [];
  }
}
