const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const levelEl = document.getElementById('level');
const scoreEl = document.getElementById('score');
const livesCountEl = document.getElementById('lives-count');
const livesIconsEl = document.getElementById('lives-icons');

const bounceSound = new Audio('assets/sounds/ball-bounce.mp3');
bounceSound.volume = 0.85;
const breakSound = new Audio('assets/sounds/break-sound.mp3');
breakSound.volume = 0.85;

function playSound(audioEl) {
  const clone = audioEl.cloneNode();
  clone.volume = audioEl.volume;
  clone.play();
}

let gameState = 'start';
let score = 0;
let lives = 3;

const LEVELS = [
  { rows: 5 },
  { rows: 6 },
  { rows: 7 },
];

let currentLevel = 1;

const BASE_BALL_SPEED = 5;

function getBallSpeedForLevel(level) {
  return BASE_BALL_SPEED * 0.8 + (level - 1) * (BASE_BALL_SPEED * 0.05);
}

const paddle = {
  width: 100,
  height: 14,
  x: (canvas.width - 100) / 2,
  y: canvas.height - 30,
  speed: 7,
};

const keys = {
  ArrowLeft: false,
  ArrowRight: false,
};

const ball = {
  radius: 8,
  speed: BASE_BALL_SPEED,
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
};

function resetBall() {
  ball.speed = getBallSpeedForLevel(currentLevel);
  ball.x = canvas.width / 2;
  ball.y = paddle.y - ball.radius;
  ball.dx = ball.speed * 0.6;
  ball.dy = -ball.speed;
}

function resetPaddle() {
  paddle.x = (canvas.width - paddle.width) / 2;
}

const BRICK_COLS = 8;
const BRICK_WIDTH = 68;
const BRICK_HEIGHT = 20;
const BRICK_PADDING = 8;
const BRICK_OFFSET_TOP = 50;
const BRICK_OFFSET_LEFT =
  (canvas.width - (BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_PADDING)) / 2;

let bricks = [];
let explosions = [];

const BRICK_ROW_COLORS = ['red', 'yellow', 'green', 'cyan', 'magenta'];

function generateBricks() {
  bricks = [];
  const rows = LEVELS[currentLevel - 1].rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
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

function updateHud() {
  levelEl.textContent = `Nivel: ${currentLevel}`;
  scoreEl.textContent = `Score: ${score}`;
  livesCountEl.textContent = lives;
  livesIconsEl.innerHTML = '<span class="life-icon"></span>'.repeat(Math.max(0, lives));
}

function updatePaddle() {
  if (keys.ArrowLeft) {
    paddle.x -= paddle.speed;
  }
  if (keys.ArrowRight) {
    paddle.x += paddle.speed;
  }

  if (paddle.x < 0) {
    paddle.x = 0;
  }
  if (paddle.x + paddle.width > canvas.width) {
    paddle.x = canvas.width - paddle.width;
  }
}

function checkBrickCollisions() {
  for (const brick of bricks) {
    if (!brick.active) continue;

    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
    const distX = ball.x - closestX;
    const distY = ball.y - closestY;

    if (distX * distX + distY * distY > ball.radius * ball.radius) continue;

    brick.active = false;
    score += 10;
    playSound(breakSound);

    explosions.push({
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
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapLeft || minOverlap === overlapRight) {
      ball.dx = -ball.dx;
    } else {
      ball.dy = -ball.dy;
    }

    break;
  }
}

const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

function checkPaddleCollision() {
  if (ball.dy <= 0) return;

  const closestX = Math.max(paddle.x, Math.min(ball.x, paddle.x + paddle.width));
  const closestY = Math.max(paddle.y, Math.min(ball.y, paddle.y + paddle.height));
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
  playSound(bounceSound);
}

function updateBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  checkBrickCollisions();
  checkPaddleCollision();

  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.dx = -ball.dx;
    playSound(bounceSound);
  } else if (ball.x + ball.radius > canvas.width) {
    ball.x = canvas.width - ball.radius;
    ball.dx = -ball.dx;
    playSound(bounceSound);
  }

  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.dy = -ball.dy;
    playSound(bounceSound);
  }

  if (ball.y - ball.radius > canvas.height) {
    lives -= 1;
    if (lives <= 0) {
      gameState = 'gameover';
    } else {
      resetPaddle();
      resetBall();
    }
  }
}

function updateExplosions() {
  const now = performance.now();
  explosions = explosions.filter((explosion) => now - explosion.startTime < EXPLOSION_DURATION);
}

function checkVictory() {
  if (bricks.every((brick) => !brick.active)) {
    if (currentLevel < LEVELS.length) {
      gameState = 'levelup';
    } else {
      gameState = 'victory';
    }
  }
}

function update() {
  if (gameState === 'playing') {
    updatePaddle();
    updateBall();
    updateExplosions();
    checkVictory();
  }
}

function drawStartScreen() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f0f0f0';
  ctx.textAlign = 'center';

  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.fillText('ARKANOID', canvas.width / 2, canvas.height / 2 - 20);

  ctx.font = '20px "Courier New", monospace';
  ctx.fillText('Pulsa una tecla para empezar', canvas.width / 2, canvas.height / 2 + 30);
}

function drawPaddle() {
  drawSprite(ctx, 'paddle', paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawBall() {
  drawSprite(ctx, 'ball', ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2);
}

function drawBricks() {
  for (const brick of bricks) {
    if (!brick.active) continue;
    drawSprite(ctx, 'block_' + brick.color, brick.x, brick.y, brick.width, brick.height);
  }
}

function drawExplosions() {
  for (const explosion of explosions) {
    const elapsed = performance.now() - explosion.startTime;
    const frameIndex = Math.min(3, Math.floor(elapsed / (EXPLOSION_DURATION / 4)));
    const frame = EXPLOSION_FRAMES[explosion.color][frameIndex];
    drawFrame(ctx, frame, explosion.x, explosion.y, explosion.width, explosion.height);
  }
}

function drawGameOverScreen() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f0f0f0';
  ctx.textAlign = 'center';

  ctx.font = 'bold 44px "Courier New", monospace';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);

  ctx.font = '20px "Courier New", monospace';
  ctx.fillText(`Score final: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
  ctx.fillText('Pulsa una tecla para reiniciar', canvas.width / 2, canvas.height / 2 + 50);
}

function drawVictoryScreen() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f0f0f0';
  ctx.textAlign = 'center';

  ctx.font = 'bold 44px "Courier New", monospace';
  ctx.fillText('VICTORIA', canvas.width / 2, canvas.height / 2 - 30);

  ctx.font = '20px "Courier New", monospace';
  ctx.fillText(`Score final: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
  ctx.fillText('Pulsa una tecla para reiniciar', canvas.width / 2, canvas.height / 2 + 50);
}

function drawLevelUpScreen() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f0f0f0';
  ctx.textAlign = 'center';

  ctx.font = 'bold 44px "Courier New", monospace';
  ctx.fillText(`Nivel ${currentLevel + 1}`, canvas.width / 2, canvas.height / 2 - 20);

  ctx.font = '20px "Courier New", monospace';
  ctx.fillText('Pulsa una tecla para continuar', canvas.width / 2, canvas.height / 2 + 30);
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f0f0f0';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px "Courier New", monospace';
  ctx.fillText('PAUSA', canvas.width / 2, canvas.height / 2);
}

function draw() {
  if (gameState === 'start') {
    drawStartScreen();
  } else if (gameState === 'playing' || gameState === 'paused') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    drawExplosions();
    drawPaddle();
    drawBall();

    if (gameState === 'paused') {
      drawPauseOverlay();
    }
  } else if (gameState === 'gameover') {
    drawGameOverScreen();
  } else if (gameState === 'victory') {
    drawVictoryScreen();
  } else if (gameState === 'levelup') {
    drawLevelUpScreen();
  }
}

function loop() {
  update();
  draw();
  updateHud();
  requestAnimationFrame(loop);
}

function resetGame() {
  score = 0;
  lives = 3;
  currentLevel = 1;
  generateBricks();
  resetPaddle();
  resetBall();
  gameState = 'start';
}

document.addEventListener('keydown', (e) => {
  if (gameState === 'start') {
    gameState = 'playing';
  } else if (gameState === 'gameover' || gameState === 'victory') {
    resetGame();
  } else if (gameState === 'levelup') {
    currentLevel += 1;
    generateBricks();
    resetPaddle();
    resetBall();
    gameState = 'playing';
  }

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    keys[e.key] = true;
  }

  if (e.key === 'p' || e.key === 'P') {
    if (gameState === 'playing') {
      gameState = 'paused';
    } else if (gameState === 'paused') {
      gameState = 'playing';
    }
  }
});

canvas.addEventListener('click', () => {
  if (gameState === 'start') {
    gameState = 'playing';
  } else if (gameState === 'gameover' || gameState === 'victory') {
    resetGame();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    keys[e.key] = false;
  }
});

resetPaddle();
resetBall();
generateBricks();
updateHud();

ctx.fillStyle = '#000';
ctx.fillRect(0, 0, canvas.width, canvas.height);

loadSpritesheet(() => {
  loop();
});
