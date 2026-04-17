const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const scoreEl = document.getElementById('score');
const corruptEl = document.getElementById('corrupt');
const paceEl = document.getElementById('pace');
const levelNameEl = document.getElementById('levelName');
const goalTextEl = document.getElementById('goalText');
const statusTextEl = document.getElementById('statusText');
const progressSummaryEl = document.getElementById('progressSummary');
const hintTextEl = document.getElementById('hintText');
const levelListEl = document.getElementById('levelList');
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
const STORAGE_KEY = 'laneSwitchProgressV2';
const LEVEL_ORDER = ['level1', 'level2'];

const LEVEL_DEFS = {
  level1: {
    id: 'level1',
    name: 'Level 1',
    duration: 24,
    blurb: 'Fixed intro route. Learn one authored pattern and survive to the end.',
    winText: 'Survive the full 24 second route.',
    hint: 'Level 1 stays open until you clear it once.',
    readyText: 'Fixed 24 second route',
    inRunText: 'Learn the route, then commit',
    completeText: 'Level 1 complete. It is now retired.',
    events: [
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
    ],
    corruptionWindows: [
      { start: 8.3, end: 10.5, lane: 1 },
      { start: 18.0, end: 19.9, lane: 2 },
    ],
  },
  level2: {
    id: 'level2',
    name: 'Level 2',
    duration: 28,
    blurb: 'Same core rules, but denser timing and more lane pressure.',
    winText: 'Clear the 28 second route with tighter multi-lane reads.',
    hint: 'Level 2 unlocks after Level 1 is completed.',
    readyText: '28 second pressure test',
    inRunText: 'React faster, hold the route in memory',
    completeText: 'Level 2 complete. Nice, that is the whole test arc for now.',
    events: [
      { dodgeAt: 2.0, lane: 1 },
      { dodgeAt: 2.8, lane: 0 },
      { dodgeAt: 3.55, lane: 2 },
      { dodgeAt: 4.3, lanes: [0, 1] },
      { dodgeAt: 5.15, lane: 2 },
      { dodgeAt: 5.95, lane: 1 },
      { dodgeAt: 6.7, lanes: [1, 2] },
      { dodgeAt: 7.8, lane: 0 },
      { dodgeAt: 8.45, lane: 2 },
      { dodgeAt: 9.2, lane: 1 },
      { dodgeAt: 10.05, lanes: [0, 2] },
      { dodgeAt: 11.15, lane: 1 },
      { dodgeAt: 12.0, lane: 0 },
      { dodgeAt: 12.7, lane: 2 },
      { dodgeAt: 13.45, lanes: [0, 1] },
      { dodgeAt: 14.3, lane: 2 },
      { dodgeAt: 15.15, lane: 1 },
      { dodgeAt: 16.0, lanes: [1, 2] },
      { dodgeAt: 17.05, lane: 0 },
      { dodgeAt: 18.0, lanes: [0, 2] },
      { dodgeAt: 19.15, lane: 1 },
      { dodgeAt: 20.1, lane: 2 },
      { dodgeAt: 21.0, lane: 0 },
      { dodgeAt: 21.85, lanes: [0, 1] },
      { dodgeAt: 22.8, lane: 2 },
      { dodgeAt: 23.65, lane: 1 },
      { dodgeAt: 24.35, lanes: [1, 2] },
      { dodgeAt: 25.3, lane: 0 },
      { dodgeAt: 26.1, lane: 2 },
    ],
    corruptionWindows: [
      { start: 6.8, end: 8.5, lane: 2 },
      { start: 13.4, end: 15.2, lane: 0 },
      { start: 21.6, end: 23.4, lane: 1 },
    ],
  },
};

Object.values(LEVEL_DEFS).forEach((level) => {
  level.spawns = level.events.flatMap((event) => {
    const lanes = event.lanes ?? [event.lane];
    return lanes.map((lane) => ({
      lane,
      spawnAt: Math.max(0.1, event.dodgeAt - HAZARD_TRAVEL_TIME),
      dodgeAt: event.dodgeAt,
    }));
  });
});

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      completed: {
        level1: Boolean(parsed.completed?.level1),
        level2: Boolean(parsed.completed?.level2),
      },
      bestTimes: {
        level1: Number(parsed.bestTimes?.level1 || 0),
        level2: Number(parsed.bestTimes?.level2 || 0),
      },
      clears: {
        level1: Number(parsed.clears?.level1 || 0),
        level2: Number(parsed.clears?.level2 || 0),
      },
    };
  } catch {
    return {
      completed: { level1: false, level2: false },
      bestTimes: { level1: 0, level2: 0 },
      clears: { level1: 0, level2: 0 },
    };
  }
}

let progress = loadProgress();
let currentLevelId = null;
let currentLane = 1;
let hazards = [];
let runTime = 0;
let gameState = 'select';
let lastFrame = 0;
let touchStartX = null;
let nextSpawnIndex = 0;
let finishTime = 0;
let lastDeathReason = 'Hit hazard';

function formatTime(time) {
  return `${time.toFixed(1)}s`;
}

function getLevel(id = currentLevelId) {
  return id ? LEVEL_DEFS[id] : null;
}

function isLevelUnlocked(id) {
  if (id === 'level1') return !progress.completed.level1;
  if (id === 'level2') return progress.completed.level1 && !progress.completed.level2;
  return false;
}

function getLevelState(id) {
  if (progress.completed[id]) return 'complete';
  return isLevelUnlocked(id) ? 'open' : 'locked';
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function laneCenter(lane) {
  return lane * laneWidth + laneWidth / 2;
}

function getCorruptionWindow() {
  const level = getLevel();
  return level?.corruptionWindows.find((window) => runTime >= window.start && runTime < window.end) ?? null;
}

function isLaneCorrupted(lane) {
  const window = getCorruptionWindow();
  return Boolean(window && window.lane === lane);
}

function getProgressSummary() {
  if (progress.completed.level2) return 'Both test levels are complete.';
  if (progress.completed.level1) return 'Level 1 complete. Level 2 is now open.';
  return 'Clear Level 1 to unlock Level 2.';
}

function renderLevelSelect() {
  levelListEl.innerHTML = '';

  LEVEL_ORDER.forEach((id) => {
    const level = getLevel(id);
    const state = getLevelState(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `level-button is-${state}${currentLevelId === id ? ' is-selected' : ''}`;
    button.disabled = state !== 'open';
    button.innerHTML = `
      <div class="level-meta">
        <strong>${level.name}</strong>
        <span class="badge">${state === 'open' ? 'OPEN' : state === 'complete' ? 'DONE' : 'LOCKED'}</span>
      </div>
      <small>${level.blurb}</small>
    `;
    button.addEventListener('click', () => selectLevel(id));
    levelListEl.appendChild(button);
  });
}

function updateHud() {
  const level = getLevel();
  const activeCorruption = getCorruptionWindow();
  const totalSpawns = level?.spawns.length ?? 0;
  const completed = level ? level.spawns.filter((spawn) => spawn.dodgeAt <= runTime).length : 0;

  levelNameEl.textContent = level?.name ?? 'Select';
  timeEl.textContent = formatTime(runTime);
  scoreEl.textContent = `${completed}/${totalSpawns}`;
  progressSummaryEl.textContent = getProgressSummary();

  if (!level) {
    bestEl.textContent = '0.0s • 0 clears';
    paceEl.textContent = '0%';
    corruptEl.textContent = 'SELECT A LEVEL';
    goalTextEl.textContent = 'Pick a level to see its win condition.';
    statusTextEl.textContent = 'Level 1 is open. Level 2 is locked.';
    hintTextEl.textContent = 'Completed levels are retired and cannot be started again.';
    restartBtn.disabled = true;
    return;
  }

  const bestTime = progress.bestTimes[level.id] || 0;
  const clears = progress.clears[level.id] || 0;
  bestEl.textContent = `${formatTime(bestTime)} • ${clears} clears`;
  paceEl.textContent = gameState === 'won' ? 'LEVEL CLEAR' : `${Math.round((Math.min(runTime, level.duration) / level.duration) * 100)}%`;
  goalTextEl.textContent = level.winText;
  hintTextEl.textContent = level.hint;
  restartBtn.disabled = false;

  if (progress.completed[level.id]) {
    statusTextEl.textContent = `${level.name} is completed and retired.`;
  } else if (isLevelUnlocked(level.id)) {
    statusTextEl.textContent = `${level.name} is open and playable.`;
  } else {
    statusTextEl.textContent = `${level.name} is locked.`;
  }

  if (gameState === 'select') {
    corruptEl.textContent = 'READY';
  } else if (gameState === 'ready') {
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

function setIdleStateFromSelection() {
  gameState = currentLevelId ? 'ready' : 'select';
  currentLane = 1;
  hazards = [];
  runTime = 0;
  lastFrame = 0;
  touchStartX = null;
  nextSpawnIndex = 0;
  finishTime = 0;
  lastDeathReason = 'Hit hazard';
  renderLevelSelect();
  updateHud();
}

function selectLevel(id) {
  if (!isLevelUnlocked(id)) return;
  currentLevelId = id;
  setIdleStateFromSelection();
}

function startRun() {
  if (gameState !== 'ready') return;
  if (!currentLevelId || !isLevelUnlocked(currentLevelId)) return;
  gameState = 'running';
  updateHud();
}

function moveLane(delta) {
  if (gameState === 'select') return;
  if (gameState === 'won' || gameState === 'failed') return;
  if (gameState === 'ready') startRun();
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
  const level = getLevel();
  if (!level) return;
  gameState = 'failed';
  lastDeathReason = reason;
  progress.bestTimes[level.id] = Math.max(progress.bestTimes[level.id] || 0, runTime);
  saveProgress();
  updateHud();
}

function winRun() {
  const level = getLevel();
  if (!level) return;
  gameState = 'won';
  finishTime = runTime;
  progress.bestTimes[level.id] = Math.max(progress.bestTimes[level.id] || 0, finishTime);
  progress.clears[level.id] = 1;
  progress.completed[level.id] = true;
  saveProgress();
  renderLevelSelect();
  updateHud();
}

function update(delta) {
  if (gameState !== 'running') return;
  const level = getLevel();
  if (!level) return;

  runTime += delta;

  while (nextSpawnIndex < level.spawns.length && runTime >= level.spawns[nextSpawnIndex].spawnAt) {
    spawnHazard(level.spawns[nextSpawnIndex].lane);
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

  if (runTime >= level.duration && nextSpawnIndex >= level.spawns.length && hazards.length === 0) {
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
  const level = getLevel();
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px system-ui';
  ctx.fillStyle = '#d7e2ff';
  ctx.fillText(level?.name ?? 'Level Select', 18, HEIGHT - 106);

  ctx.fillStyle = '#9eb3ff';
  ctx.fillText(level ? `Sequence ${level.spawns.length} beats` : 'Choose an open level above', 18, HEIGHT - 80);

  const activeCorruption = getCorruptionWindow();
  if (!level) {
    ctx.fillStyle = '#ffe26f';
    ctx.fillText('Completed levels cannot be replayed', 18, HEIGHT - 54);
  } else if (gameState === 'ready') {
    ctx.fillStyle = '#ffe26f';
    ctx.fillText(level.readyText, 18, HEIGHT - 54);
  } else if (activeCorruption) {
    ctx.fillStyle = '#ff9ccc';
    ctx.fillText(`Lane ${activeCorruption.lane + 1} is corrupted`, 18, HEIGHT - 54);
  } else if (gameState === 'won') {
    ctx.fillStyle = '#9af7c2';
    ctx.fillText(level.completeText, 18, HEIGHT - 54);
  } else {
    ctx.fillStyle = '#c4d2ff';
    ctx.fillText(level.inRunText, 18, HEIGHT - 54);
  }
}

function drawOverlay() {
  if (gameState === 'running') return;

  const level = getLevel();

  ctx.fillStyle = 'rgba(4, 6, 12, 0.72)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';

  if (gameState === 'select') {
    ctx.font = 'bold 30px system-ui';
    ctx.fillText('Select a level', WIDTH / 2, HEIGHT / 2 - 44);
    ctx.font = '20px system-ui';
    ctx.fillText('Level 1 is your only open start', WIDTH / 2, HEIGHT / 2 - 8);
    ctx.fillStyle = '#aab6d3';
    ctx.fillText('Clear it once to unlock Level 2', WIDTH / 2, HEIGHT / 2 + 30);
    return;
  }

  if (gameState === 'ready' && level) {
    ctx.font = 'bold 34px system-ui';
    ctx.fillText(level.name, WIDTH / 2, HEIGHT / 2 - 56);
    ctx.font = '20px system-ui';
    ctx.fillText(level.winText, WIDTH / 2, HEIGHT / 2 - 20, WIDTH - 32);
    ctx.fillText('Tap, swipe, or press a lane key to start', WIDTH / 2, HEIGHT / 2 + 18);
    ctx.fillStyle = '#aab6d3';
    ctx.fillText(level.blurb, WIDTH / 2, HEIGHT / 2 + 56, WIDTH - 48);
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
    ctx.fillText('Tap Reset or press Space to try again', WIDTH / 2, HEIGHT / 2 + 70);
    return;
  }

  if (gameState === 'won' && level) {
    ctx.font = 'bold 34px system-ui';
    ctx.fillStyle = '#9af7c2';
    ctx.fillText('Level Complete', WIDTH / 2, HEIGHT / 2 - 42);
    ctx.font = '22px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Clear time ${formatTime(finishTime)}`, WIDTH / 2, HEIGHT / 2 - 2);
    ctx.fillStyle = '#aab6d3';
    ctx.font = '18px system-ui';
    const nextOpen = LEVEL_ORDER.find((id) => isLevelUnlocked(id));
    ctx.fillText(
      nextOpen ? `${LEVEL_DEFS[nextOpen].name} is now open above` : 'Both levels are now complete',
      WIDTH / 2,
      HEIGHT / 2 + 38,
    );
    ctx.fillText('Completed levels cannot be started again', WIDTH / 2, HEIGHT / 2 + 70);
  }
}

function draw() {
  drawBackground();
  if (currentLevelId) {
    drawHazards();
    drawPlayer();
  }
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

function resetSelectedLevel() {
  if (!currentLevelId || progress.completed[currentLevelId]) {
    currentLevelId = LEVEL_ORDER.find((id) => isLevelUnlocked(id)) ?? null;
  }
  setIdleStateFromSelection();
}

leftBtn.addEventListener('click', () => moveLane(-1));
rightBtn.addEventListener('click', () => moveLane(1));
restartBtn.addEventListener('click', resetSelectedLevel);

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (event.key === 'ArrowLeft' || key === 'a') moveLane(-1);
  if (event.key === 'ArrowRight' || key === 'd') moveLane(1);
  if (event.key === ' ' && gameState !== 'running') resetSelectedLevel();
});

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  touchStartX = event.clientX;

  if (gameState === 'failed' || gameState === 'won') return;
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

currentLevelId = LEVEL_ORDER.find((id) => isLevelUnlocked(id)) ?? null;
setIdleStateFromSelection();
requestAnimationFrame(frame);
