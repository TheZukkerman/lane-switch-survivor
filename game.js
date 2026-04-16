const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const restartBtn = document.getElementById('restartBtn');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const LANE_COUNT = 3;
const laneWidth = WIDTH / LANE_COUNT;
const playerY = HEIGHT - 92;
const playerRadius = 24;
const hazardWidth = laneWidth * 0.52;
const hazardHeight = 54;

let bestTime = Number(localStorage.getItem('laneSwitchBest') || 0);
let currentLane = 1;
let hazards = [];
let spawnTimer = 0;
let runTime = 0;
let gameOver = false;
let lastFrame = 0;

bestEl.textContent = formatTime(bestTime);

function formatTime(time) {
  return `${time.toFixed(1)}s`;
}

function laneCenter(lane) {
  return lane * laneWidth + laneWidth / 2;
}

function resetGame() {
  currentLane = 1;
  hazards = [];
  spawnTimer = 0.6;
  runTime = 0;
  gameOver = false;
  lastFrame = 0;
  timeEl.textContent = formatTime(0);
}

function moveLane(delta) {
  if (gameOver) return;
  currentLane = Math.max(0, Math.min(LANE_COUNT - 1, currentLane + delta));
}

function spawnHazard() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const speed = 260 + Math.min(runTime * 8, 180);
  hazards.push({
    lane,
    y: -hazardHeight,
    speed,
  });
}

function update(delta) {
  if (gameOver) return;

  runTime += delta;
  timeEl.textContent = formatTime(runTime);
  spawnTimer -= delta;

  if (spawnTimer <= 0) {
    spawnHazard();
    const pressure = Math.max(0.34, 0.9 - runTime * 0.03);
    spawnTimer = pressure + Math.random() * 0.25;
  }

  hazards.forEach((hazard) => {
    hazard.y += hazard.speed * delta;
  });

  hazards = hazards.filter((hazard) => hazard.y < HEIGHT + hazardHeight);

  const playerLeft = laneCenter(currentLane) - playerRadius;
  const playerRight = laneCenter(currentLane) + playerRadius;
  const playerTop = playerY - playerRadius;
  const playerBottom = playerY + playerRadius;

  for (const hazard of hazards) {
    const hazardLeft = laneCenter(hazard.lane) - hazardWidth / 2;
    const hazardRight = laneCenter(hazard.lane) + hazardWidth / 2;
    const hazardTop = hazard.y;
    const hazardBottom = hazard.y + hazardHeight;

    const overlap =
      playerLeft < hazardRight &&
      playerRight > hazardLeft &&
      playerTop < hazardBottom &&
      playerBottom > hazardTop;

    if (overlap) {
      gameOver = true;
      bestTime = Math.max(bestTime, runTime);
      localStorage.setItem('laneSwitchBest', String(bestTime));
      bestEl.textContent = formatTime(bestTime);
      break;
    }
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#12182c';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 1; i < LANE_COUNT; i += 1) {
    const x = i * laneWidth;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([18, 16]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, HEIGHT - 140, WIDTH, 140);
}

function drawPlayer() {
  const x = laneCenter(currentLane);
  ctx.fillStyle = '#7df9ff';
  ctx.beginPath();
  ctx.arc(x, playerY, playerRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#dffcff';
  ctx.beginPath();
  ctx.arc(x, playerY - 8, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawHazards() {
  hazards.forEach((hazard) => {
    const x = laneCenter(hazard.lane) - hazardWidth / 2;
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(x, hazard.y, hazardWidth, hazardHeight);

    ctx.fillStyle = '#ffd4da';
    ctx.fillRect(x + 8, hazard.y + 8, hazardWidth - 16, 10);
  });
}

function drawOverlay() {
  if (!gameOver) return;

  ctx.fillStyle = 'rgba(4, 6, 12, 0.72)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px system-ui';
  ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 28);

  ctx.font = '22px system-ui';
  ctx.fillText(`Survived ${formatTime(runTime)}`, WIDTH / 2, HEIGHT / 2 + 10);

  ctx.font = '18px system-ui';
  ctx.fillStyle = '#aab6d3';
  ctx.fillText('Tap Restart or press Space', WIDTH / 2, HEIGHT / 2 + 46);
}

function draw() {
  drawBackground();
  drawHazards();
  drawPlayer();
  drawOverlay();
}

function frame(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const delta = Math.min((timestamp - lastFrame) / 1000, 0.033);
  lastFrame = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

leftBtn.addEventListener('click', () => moveLane(-1));
rightBtn.addEventListener('click', () => moveLane(1));
restartBtn.addEventListener('click', resetGame);

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') moveLane(-1);
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') moveLane(1);
  if (event.key === ' ' && gameOver) resetGame();
});

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  touchStartX = event.clientX;
  if (gameOver) {
    resetGame();
    return;
  }
  moveLane(x < bounds.width / 2 ? -1 : 1);
});

let touchStartX = null;
canvas.addEventListener('pointermove', (event) => {
  if (touchStartX === null) return;
  const dx = event.clientX - touchStartX;
  if (Math.abs(dx) > 28) {
    moveLane(dx > 0 ? 1 : -1);
    touchStartX = event.clientX;
  }
});
canvas.addEventListener('pointerup', (event) => {
  canvas.releasePointerCapture?.(event.pointerId);
  touchStartX = null;
});
canvas.addEventListener('pointercancel', () => {
  touchStartX = null;
});
resetGame();
requestAnimationFrame(frame);
