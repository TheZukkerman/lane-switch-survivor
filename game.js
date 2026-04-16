const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const scoreEl = document.getElementById('score');
const corruptEl = document.getElementById('corrupt');
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
const BASE_POINTS_PER_SECOND = 10;
const CORRUPTED_POINTS_PER_SECOND = 26;
const CORRUPTION_TRIGGER_MIN = 6;
const CORRUPTION_TRIGGER_MAX = 10;
const CORRUPTION_DURATION = 5.4;
const CORRUPTION_MAX_EXPOSURE = 1.15;
const CORRUPTION_COOLDOWN_RATE = 1.8;
const CORRUPTION_BONUS_RATE = 42;
const CORRUPTION_EXIT_BONUS_MIN = 18;

let bestTime = Number(localStorage.getItem('laneSwitchBest') || 0);
let bestScore = Number(localStorage.getItem('laneSwitchBestScore') || 0);
let currentLane = 1;
let hazards = [];
let spawnTimer = 0;
let runTime = 0;
let score = 0;
let gameOver = false;
let lastFrame = 0;
let touchStartX = null;
let corruptionLane = null;
let corruptionTimer = 0;
let nextCorruptionAt = 0;
let corruptionExposure = 0;
let corruptionBonusBank = 0;
let bonusPopupTimer = 0;
let lastBonusAward = 0;
let lastDeathReason = 'Hit hazard';

bestEl.textContent = `${formatTime(bestTime)} • ${formatScore(bestScore)}`;

function formatTime(time) {
  return `${time.toFixed(1)}s`;
}

function formatScore(value) {
  return `${Math.floor(value)}`;
}

function laneCenter(lane) {
  return lane * laneWidth + laneWidth / 2;
}

function isLaneCorrupted(lane) {
  return corruptionLane === lane && corruptionTimer > 0;
}

function randomCorruptionTrigger() {
  return CORRUPTION_TRIGGER_MIN + Math.random() * (CORRUPTION_TRIGGER_MAX - CORRUPTION_TRIGGER_MIN);
}

function updateHud() {
  timeEl.textContent = formatTime(runTime);
  scoreEl.textContent = formatScore(score);

  const corruptionPct = Math.min(corruptionExposure / CORRUPTION_MAX_EXPOSURE, 1);
  if (isLaneCorrupted(currentLane)) {
    corruptEl.textContent = `RISK ${Math.round(corruptionPct * 100)}% • BANK ${formatScore(corruptionBonusBank)}`;
  } else if (corruptionBonusBank > 0) {
    corruptEl.textContent = `CASH OUT ${formatScore(corruptionBonusBank)}`;
  } else if (corruptionExposure > 0.03) {
    corruptEl.textContent = `COOL ${Math.round(corruptionPct * 100)}%`;
  } else {
    corruptEl.textContent = 'SAFE';
  }
}

function resetGame() {
  currentLane = 1;
  hazards = [];
  spawnTimer = 0.6;
  runTime = 0;
  score = 0;
  gameOver = false;
  lastFrame = 0;
  touchStartX = null;
  corruptionLane = null;
  corruptionTimer = 0;
  nextCorruptionAt = randomCorruptionTrigger();
  corruptionExposure = 0;
  corruptionBonusBank = 0;
  bonusPopupTimer = 0;
  lastBonusAward = 0;
  lastDeathReason = 'Hit hazard';
  updateHud();
}

function moveLane(delta) {
  if (gameOver) return;
  currentLane = Math.max(0, Math.min(LANE_COUNT - 1, currentLane + delta));
}

function spawnHazard() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const isCorrupted = isLaneCorrupted(lane);
  const speed = 260 + Math.min(runTime * 8, 180) + (isCorrupted ? 78 : 0);
  hazards.push({
    lane,
    y: -hazardHeight,
    speed,
    isCorrupted,
  });
}

function triggerCorruption() {
  const safeLanes = Array.from({ length: LANE_COUNT }, (_, lane) => lane).filter((lane) => lane !== corruptionLane);
  corruptionLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
  corruptionTimer = CORRUPTION_DURATION;
}

function endRun(reason) {
  gameOver = true;
  lastDeathReason = reason;
  bestTime = Math.max(bestTime, runTime);
  bestScore = Math.max(bestScore, score);
  localStorage.setItem('laneSwitchBest', String(bestTime));
  localStorage.setItem('laneSwitchBestScore', String(bestScore));
  bestEl.textContent = `${formatTime(bestTime)} • ${formatScore(bestScore)}`;
}

function awardCorruptionBonus() {
  if (corruptionBonusBank < CORRUPTION_EXIT_BONUS_MIN) {
    corruptionBonusBank = 0;
    return;
  }

  lastBonusAward = Math.round(corruptionBonusBank);
  score += lastBonusAward;
  corruptionBonusBank = 0;
  bonusPopupTimer = 1.1;
}

function update(delta) {
  if (gameOver) return;

  runTime += delta;
  bonusPopupTimer = Math.max(0, bonusPopupTimer - delta);

  if (corruptionTimer > 0) {
    corruptionTimer -= delta;
    if (corruptionTimer <= 0) {
      corruptionTimer = 0;
      corruptionLane = null;
      nextCorruptionAt = runTime + randomCorruptionTrigger();
    }
  } else if (runTime >= nextCorruptionAt) {
    triggerCorruption();
  }

  const onCorruptedLane = isLaneCorrupted(currentLane);
  score += delta * (onCorruptedLane ? CORRUPTED_POINTS_PER_SECOND : BASE_POINTS_PER_SECOND);

  if (onCorruptedLane) {
    corruptionExposure += delta;
    corruptionBonusBank += delta * CORRUPTION_BONUS_RATE;
  } else {
    if (corruptionBonusBank > 0) {
      awardCorruptionBonus();
    }
    corruptionExposure = Math.max(0, corruptionExposure - delta * CORRUPTION_COOLDOWN_RATE);
  }

  if (corruptionExposure >= CORRUPTION_MAX_EXPOSURE) {
    endRun('Overloaded by corruption');
    updateHud();
    return;
  }

  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnHazard();
    const pressure = Math.max(0.3, 0.88 - runTime * 0.03);
    spawnTimer = pressure + Math.random() * 0.22;
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
      endRun(hazard.isCorrupted ? 'Hit a corrupted hazard' : 'Hit hazard');
      break;
    }
  }

  updateHud();
}

function drawBackground() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#12182c';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const x = lane * laneWidth;

    if (isLaneCorrupted(lane)) {
      const pulse = 0.52 + Math.sin(runTime * 8) * 0.18;
      const gradient = ctx.createLinearGradient(x, 0, x + laneWidth, HEIGHT);
      gradient.addColorStop(0, `rgba(168, 91, 255, ${0.22 + pulse * 0.1})`);
      gradient.addColorStop(0.5, `rgba(255, 67, 129, ${0.26 + pulse * 0.12})`);
      gradient.addColorStop(1, `rgba(122, 35, 255, ${0.2 + pulse * 0.1})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, laneWidth, HEIGHT);

      ctx.strokeStyle = `rgba(255, 130, 214, ${0.65 + pulse * 0.15})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 5, 5, laneWidth - 10, HEIGHT - 10);

      ctx.fillStyle = `rgba(255, 210, 245, ${0.8 + pulse * 0.1})`;
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('CORRUPTED', x + laneWidth / 2, 32);
      ctx.font = 'bold 13px system-ui';
      ctx.fillStyle = `rgba(255, 242, 182, ${0.92 + pulse * 0.06})`;
      ctx.fillText('+BANK BONUS', x + laneWidth / 2, 52);
    }
  }

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
  const onCorruptedLane = isLaneCorrupted(currentLane);

  ctx.fillStyle = onCorruptedLane ? '#ffdd66' : '#7df9ff';
  ctx.beginPath();
  ctx.arc(x, playerY, playerRadius, 0, Math.PI * 2);
  ctx.fill();

  if (onCorruptedLane) {
    ctx.strokeStyle = 'rgba(255, 110, 196, 0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, playerY, playerRadius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#dffcff';
  ctx.beginPath();
  ctx.arc(x, playerY - 8, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawHazards() {
  hazards.forEach((hazard) => {
    const x = laneCenter(hazard.lane) - hazardWidth / 2;
    ctx.fillStyle = hazard.isCorrupted ? '#ff3d96' : '#ff5d73';
    ctx.fillRect(x, hazard.y, hazardWidth, hazardHeight);

    ctx.fillStyle = hazard.isCorrupted ? '#ffd1ec' : '#ffd4da';
    ctx.fillRect(x + 8, hazard.y + 8, hazardWidth - 16, 10);
  });
}

function drawStatusText() {
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px system-ui';
  ctx.fillStyle = '#d7e2ff';
  ctx.fillText(`Score ${formatScore(score)}`, 18, HEIGHT - 106);

  if (isLaneCorrupted(currentLane)) {
    const risk = Math.min(corruptionExposure / CORRUPTION_MAX_EXPOSURE, 1);
    ctx.fillStyle = '#ffde75';
    ctx.fillText(`Bank ${formatScore(corruptionBonusBank)}`, 18, HEIGHT - 78);

    ctx.fillStyle = '#ff8fb9';
    ctx.fillRect(18, HEIGHT - 62, 124, 10);
    ctx.fillStyle = '#ffe26f';
    ctx.fillRect(18, HEIGHT - 62, 124 * risk, 10);
  } else if (corruptionBonusBank > 0) {
    ctx.fillStyle = '#ffe26f';
    ctx.fillText(`Leave now to cash out`, 18, HEIGHT - 78);
  }

  if (bonusPopupTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px system-ui';
    ctx.fillStyle = `rgba(255, 226, 111, ${bonusPopupTimer})`;
    ctx.fillText(`+${formatScore(lastBonusAward)} BONUS`, WIDTH / 2, HEIGHT * 0.3);
  }
}

function drawOverlay() {
  if (!gameOver) return;

  ctx.fillStyle = 'rgba(4, 6, 12, 0.72)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px system-ui';
  ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 42);

  ctx.font = '22px system-ui';
  ctx.fillText(`Time ${formatTime(runTime)}`, WIDTH / 2, HEIGHT / 2 - 4);
  ctx.fillText(`Score ${formatScore(score)}`, WIDTH / 2, HEIGHT / 2 + 28);

  ctx.font = '18px system-ui';
  ctx.fillStyle = '#ffb7ca';
  ctx.fillText(lastDeathReason, WIDTH / 2, HEIGHT / 2 + 62);

  ctx.font = '18px system-ui';
  ctx.fillStyle = '#aab6d3';
  ctx.fillText('Tap Restart or press Space', WIDTH / 2, HEIGHT / 2 + 96);
}

function draw() {
  drawBackground();
  drawHazards();
  drawPlayer();
  drawStatusText();
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
