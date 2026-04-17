const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const scoreEl = document.getElementById('score');
const corruptEl = document.getElementById('corrupt');
const paceEl = document.getElementById('pace');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const restartBtn = document.getElementById('restartBtn');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const LANE_COUNT = 3;
const laneWidth = WIDTH / LANE_COUNT;
const playerY = HEIGHT - 92;
const playerRadius = 24;
const HAZARD_WIDTH = laneWidth * 0.56;
const HAZARD_HEIGHT = 56;
const HAZARD_SPEED = 298;
const HAZARD_TRAVEL_TIME = (playerY + playerRadius + HAZARD_HEIGHT) / HAZARD_SPEED;
const LEVEL_DURATION = 24;
const QUICK_RESTART_DELAY = 0.45;

const LEVEL_EVENTS = [
  { dodgeAt: 2.2, lane: 1 },
  { dodgeAt: 3.35, lane: 0 },
  { dodgeAt: 4.25, lane: 2 },
  { dodgeAt: 5.35, lane: 1 },
  { dodgeAt: 6.1, lane: 0 },
  { dodgeAt: 6.65, lane: 2 },
  { dodgeAt: 7.85, lanes: [0, 1] },
  { dodgeAt: 9.05, lane: 2 },
  { dodgeAt: 10.1, lane: 1 },
  { dodgeAt: 11.1, lane: 0 },
  { dodgeAt: 12.25, lane: 2 },
  { dodgeAt: 13.2, lanes: [1, 2] },
  { dodgeAt: 14.5, lane: 0 },
  { dodgeAt: 15.3, lane: 1 },
  { dodgeAt: 16.05, lane: 2 },
  { dodgeAt: 17.1, lanes: [0, 2] },
  { dodgeAt: 18.6, lane: 1 },
  { dodgeAt: 19.55, lane: 0 },
  { dodgeAt: 20.3, lane: 2 },
  { dodgeAt: 21.35, lanes: [0, 1] },
  { dodgeAt: 22.55, lane: 2 },
];

const CORRUPTION_WINDOWS = [
  { start: 8.3, end: 10.5, lane: 1 },
  { start: 18.0, end: 19.9, lane: 2 },
];

const LEVEL_SPAWNS = LEVEL_EVENTS.flatMap((event) => {
  const lanes = event.lanes ?? [event.lane];
  return lanes.map((lane) => ({
    lane,
    spawnAt: Math.max(0.1, event.dodgeAt - HAZARD_TRAVEL_TIME),
    dodgeAt: event.dodgeAt,
  }));
});

let bestTime = Number(localStorage.getItem('laneSwitchBest') || 0);
let wins = Number(localStorage.getItem('laneSwitchWins') || 0);
let currentLane = 1;
let hazards = [];
let runTime = 0;
let gameState = 'ready';
let lastFrame = 0;
let touchStartX = null;
let nextSpawnIndex = 0;
let finishTime = 0;
let restartBuffer = 0;
let lastDeathReason = 'Hit hazard';

bestEl.textContent = `${formatTime(bestTime)} • ${wins} clears`;

function formatTime(time) {
  return `${time.toFixed(1)}s`;
}

function laneCenter(lane) {
  return lane * laneWidth + laneWidth / 2;
}

function getCorruptionWindow() {
  return CORRUPTION_WINDOWS.find((window) => runTime >= window.start && runTime < window.end) ?? null;
}

function isLaneCorrupted(lane) {
  const window = getCorruptionWindow();
  return Boolean(window && window.lane === lane);
}

function updateHud() {
  const activeCorruption = getCorruptionWindow();
  const completed = LEVEL_SPAWNS.filter((spawn) => spawn.dodgeAt <= runTime).length;
  const progress = `${completed}/${LEVEL_SPAWNS.length}`;

  timeEl.textContent = formatTime(runTime);
  scoreEl.textContent = progress;
  paceEl.textContent = gameState === 'won' ? 'LEVEL CLEAR' : `${Math.round((Math.min(runTime, LEVEL_DURATION) / LEVEL_DURATION) * 100)}%`;

  if (gameState === 'ready') {
    corruptEl.textContent = 'TAP TO START';
  } else if (gameState === 'won') {
    corruptEl.textContent = 'FINISH';
  } else if (gameState === 'failed') {
    corruptEl.textContent = 'FAIL';
  } else if (activeCorruption) {
    corruptEl.textContent = `HOT LANE ${activeCorruption.lane + 1}`;
  } else {
    corruptEl.textContent = 'STABLE';
  }
}

function resetRun() {
  currentLane = 1;
  hazards = [];
  runTime = 0;
  gameState = 'ready';
  lastFrame = 0;
  touchStartX = null;
  nextSpawnIndex = 0;
  finishTime = 0;
  restartBuffer = 0;
  lastDeathReason = 'Hit hazard';
  updateHud();
}

function startRun() {
  if (gameState !== 'ready') return;
  gameState = 'running';
  updateHud();
}

function moveLane(delta) {
  if (gameState === 'failed') {
    if (restartBuffer > 0) return;
    resetRun();
    startRun();
  } else if (gameState === 'won') {
    resetRun();
    startRun();
  } else if (gameState === 'ready') {
    startRun();
  }

  if (gameState !== 'running') return;
  currentLane = Math.max(0, Math.min(LANE_COUNT - 1, currentLane + delta));
}

function spawnHazard(lane) {
  hazards.push({
    lane,
    y: -HAZARD_HEIGHT,
    width: HAZARD_WIDTH,
    height: HAZARD_HEIGHT,
    speed: HAZARD_SPEED,
    isCorrupted: isLaneCorrupted(lane),
  });
}

function failRun(reason) {
  gameState = 'failed';
  lastDeathReason = reason;
  bestTime = Math.max(bestTime, runTime);
  localStorage.setItem('laneSwitchBest', String(bestTime));
  bestEl.textContent = `${formatTime(bestTime)} • ${wins} clears`;
  restartBuffer = QUICK_RESTART_DELAY;
  updateHud();
}

function winRun() {
  gameState = 'won';
  finishTime = runTime;
  bestTime = Math.max(bestTime, finishTime);
  wins += 1;
  localStorage.setItem('laneSwitchBest', String(bestTime));
  localStorage.setItem('laneSwitchWins', String(wins));
  bestEl.textContent = `${formatTime(bestTime)} • ${wins} clears`;
  updateHud();
}

function update(delta) {
  if (gameState === 'failed') {
    restartBuffer = Math.max(0, restartBuffer - delta);
    return;
  }

  if (gameState !== 'running') return;

  runTime += delta;

  while (nextSpawnIndex < LEVEL_SPAWNS.length && runTime >= LEVEL_SPAWNS[nextSpawnIndex].spawnAt) {
    spawnHazard(LEVEL_SPAWNS[nextSpawnIndex].lane);
    nextSpawnIndex += 1;
  }

  hazards.forEach((hazard) => {
    hazard.y += hazard.speed * delta;
  });

  const playerLeft = laneCenter(currentLane) - playerRadius;
  const playerRight = laneCenter(currentLane) + playerRadius;
  const playerTop = playerY - playerRadius;
  const playerBottom = playerY + playerRadius;

  for (const hazard of hazards) {
    const hazardLeft = laneCenter(hazard.lane) - hazard.width / 2;
    const hazardRight = laneCenter(hazard.lane) + hazard.width / 2;
    const hazardTop = hazard.y;
    const hazardBottom = hazard.y + hazard.height;

    const overlap =
      playerLeft < hazardRight &&
      playerRight > hazardLeft &&
      playerTop < hazardBottom &&
      playerBottom > hazardTop;

    if (overlap) {
      failRun(hazard.isCorrupted ? 'Hit corrupted lane block' : 'Hit hazard');
      return;
    }
  }

  hazards = hazards.filter((hazard) => hazard.y < HEIGHT + hazard.height);

  if (runTime >= LEVEL_DURATION && nextSpawnIndex >= LEVEL_SPAWNS.length && hazards.length === 0) {
    winRun();
    return;
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
      ctx.fillStyle = 'rgba(181, 79, 255, 0.22)';
      ctx.fillRect(x, 0, laneWidth, HEIGHT);

      ctx.strokeStyle = 'rgba(255, 150, 228, 0.75)';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 6, 6, laneWidth - 12, HEIGHT - 12);

      ctx.fillStyle = '#ffd5f2';
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('CORRUPTED', x + laneWidth / 2, 32);
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

  ctx.fillStyle = '#dffcff';
  ctx.beginPath();
  ctx.arc(x, playerY - 8, 8, 0, Math.PI * 2);
  ctx.fill();

  if (onCorruptedLane) {
    ctx.strokeStyle = 'rgba(255, 110, 196, 0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, playerY, playerRadius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHazards() {
  hazards.forEach((hazard) => {
    const x = laneCenter(hazard.lane) - hazard.width / 2;
    ctx.fillStyle = hazard.isCorrupted ? '#ff3d96' : '#ff5d73';
    ctx.fillRect(x, hazard.y, hazard.width, hazard.height);

    ctx.fillStyle = hazard.isCorrupted ? '#ffd7f0' : '#ffd4da';
    ctx.fillRect(x + 8, hazard.y + 8, hazard.width - 16, 10);
  });
}

function drawStatusText() {
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px system-ui';
  ctx.fillStyle = '#d7e2ff';
  ctx.fillText(`Level 1`, 18, HEIGHT - 106);

  ctx.fillStyle = '#9eb3ff';
  ctx.fillText(`Sequence ${LEVEL_SPAWNS.length} beats`, 18, HEIGHT - 80);

  const activeCorruption = getCorruptionWindow();
  if (gameState === 'ready') {
    ctx.fillStyle = '#ffe26f';
    ctx.fillText('Same pattern every run', 18, HEIGHT - 54);
  } else if (activeCorruption) {
    ctx.fillStyle = '#ff9ccc';
    ctx.fillText(`Lane ${activeCorruption.lane + 1} is corrupted`, 18, HEIGHT - 54);
  } else if (gameState === 'won') {
    ctx.fillStyle = '#9af7c2';
    ctx.fillText('Clean clear. Run it again.', 18, HEIGHT - 54);
  } else {
    ctx.fillStyle = '#c4d2ff';
    ctx.fillText('Learn the route, then commit', 18, HEIGHT - 54);
  }
}

function drawOverlay() {
  if (gameState === 'running') return;

  ctx.fillStyle = 'rgba(4, 6, 12, 0.72)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';

  if (gameState === 'ready') {
    ctx.font = 'bold 34px system-ui';
    ctx.fillText('Level 1', WIDTH / 2, HEIGHT / 2 - 56);
    ctx.font = '20px system-ui';
    ctx.fillText('24 second fixed run', WIDTH / 2, HEIGHT / 2 - 20);
    ctx.fillText('Tap, swipe, or press a lane key to start', WIDTH / 2, HEIGHT / 2 + 16);
    ctx.fillStyle = '#aab6d3';
    ctx.fillText('Fail fast, restart fast, learn the pattern', WIDTH / 2, HEIGHT / 2 + 54);
    return;
  }

  if (gameState === 'failed') {
    ctx.font = 'bold 34px system-ui';
    ctx.fillText('Fail', WIDTH / 2, HEIGHT / 2 - 42);
    ctx.font = '22px system-ui';
    ctx.fillText(`Made it ${formatTime(runTime)}`, WIDTH / 2, HEIGHT / 2 - 4);
    ctx.fillStyle = '#ffb7ca';
    ctx.fillText(lastDeathReason, WIDTH / 2, HEIGHT / 2 + 32);
    ctx.fillStyle = '#aab6d3';
    ctx.font = '18px system-ui';
    ctx.fillText(
      restartBuffer > 0 ? 'Restarting is almost unlocked' : 'Tap canvas, Restart, or Space',
      WIDTH / 2,
      HEIGHT / 2 + 70,
    );
    return;
  }

  ctx.font = 'bold 34px system-ui';
  ctx.fillStyle = '#9af7c2';
  ctx.fillText('Level Complete', WIDTH / 2, HEIGHT / 2 - 42);
  ctx.font = '22px system-ui';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Clear time ${formatTime(finishTime)}`, WIDTH / 2, HEIGHT / 2 - 2);
  ctx.fillStyle = '#aab6d3';
  ctx.font = '18px system-ui';
  ctx.fillText('Run it again and smooth the route', WIDTH / 2, HEIGHT / 2 + 38);
  ctx.fillText('Tap Restart or press Space', WIDTH / 2, HEIGHT / 2 + 70);
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

function tryRestart() {
  if (gameState === 'failed' && restartBuffer > 0) return;
  resetRun();
}

leftBtn.addEventListener('click', () => moveLane(-1));
rightBtn.addEventListener('click', () => moveLane(1));
restartBtn.addEventListener('click', tryRestart);

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (event.key === 'ArrowLeft' || key === 'a') moveLane(-1);
  if (event.key === 'ArrowRight' || key === 'd') moveLane(1);
  if (event.key === ' ' && gameState !== 'running') tryRestart();
});

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  touchStartX = event.clientX;

  moveLane(x < bounds.width / 2 ? -1 : 1);
});

canvas.addEventListener('pointermove', (event) => {
  if (touchStartX === null || gameState !== 'running') return;
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

resetRun();
requestAnimationFrame(frame);
