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
const STORAGE_KEY = 'laneSwitchProgressV3';
const LEVEL_ORDER = ['level1', 'level2'];

const LEVEL_DEFS = {
  level1: {
    id: 'level1',
    name: 'Level 1',
    title: 'Warm-Up Route',
    duration: 18,
    blurb: 'A gentle first route with roomy gaps so the player learns lane timing without pressure.',
    clearGoal: 'Survive to the end of the route.',
    masteryGoal: 'Finish with at least 3.0 seconds of buffer before any panic hit would have happened.',
    rewardText: 'Clear earns 1 star. Mastery upgrades it to a gold star.',
    hint: 'Level 1 is meant to teach the rhythm. Start moving early, not late.',
    readyText: 'Easy onboarding route',
    inRunText: 'Learn the lane rhythm and stay calm',
    completeText: 'Level 1 clear secured. Level 2 is up next.',
    masteryWindow: 16.5,
    events: [
      { dodgeAt: 2.8, lane: 1 },
      { dodgeAt: 4.4, lane: 0 },
      { dodgeAt: 5.8, lane: 2 },
      { dodgeAt: 7.3, lane: 1 },
      { dodgeAt: 8.7, lane: 0 },
      { dodgeAt: 10.1, lane: 2 },
      { dodgeAt: 11.6, lanes: [0, 1] },
      { dodgeAt: 13.3, lane: 2 },
      { dodgeAt: 14.8, lane: 1 },
      { dodgeAt: 16.2, lane: 0 },
    ],
    corruptionWindows: [{ start: 12.1, end: 13.7, lane: 2 }],
  },
  level2: {
    id: 'level2',
    name: 'Level 2',
    title: 'Steadier Pressure',
    duration: 22,
    blurb: 'Still fair, but the reads come faster and a few lane traps ask for cleaner commitment.',
    clearGoal: 'Survive the full route with the denser pattern.',
    masteryGoal: 'Finish in one run without dropping a late save, plus hold pace through the final wave.',
    rewardText: 'Clear earns 1 star. Mastery adds a badge and completes the slice cleanly.',
    hint: 'This should feel like the same game, just with less breathing room.',
    readyText: 'Slightly faster pressure route',
    inRunText: 'Commit earlier and respect the two-lane beats',
    completeText: 'Level 2 clear secured. That is the current soft progression arc.',
    masteryWindow: 20.2,
    events: [
      { dodgeAt: 2.4, lane: 1 },
      { dodgeAt: 3.6, lane: 0 },
      { dodgeAt: 4.7, lane: 2 },
      { dodgeAt: 5.8, lanes: [0, 1] },
      { dodgeAt: 7.0, lane: 2 },
      { dodgeAt: 8.0, lane: 1 },
      { dodgeAt: 9.0, lanes: [1, 2] },
      { dodgeAt: 10.3, lane: 0 },
      { dodgeAt: 11.4, lane: 2 },
      { dodgeAt: 12.4, lane: 1 },
      { dodgeAt: 13.6, lanes: [0, 2] },
      { dodgeAt: 15.0, lane: 1 },
      { dodgeAt: 16.1, lane: 0 },
      { dodgeAt: 17.1, lane: 2 },
      { dodgeAt: 18.1, lanes: [0, 1] },
      { dodgeAt: 19.2, lane: 2 },
      { dodgeAt: 20.3, lanes: [1, 2] },
    ],
    corruptionWindows: [
      { start: 8.9, end: 10.0, lane: 2 },
      { start: 17.4, end: 18.8, lane: 0 },
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

function createDefaultProgress() {
  return {
    completed: { level1: false, level2: false },
    bestTimes: { level1: 0, level2: 0 },
    clears: { level1: 0, level2: 0 },
    mastery: { level1: false, level2: false },
    rewards: { level1: 0, level2: 0 },
  };
}

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
      mastery: {
        level1: Boolean(parsed.mastery?.level1),
        level2: Boolean(parsed.mastery?.level2),
      },
      rewards: {
        level1: Number(parsed.rewards?.level1 || 0),
        level2: Number(parsed.rewards?.level2 || 0),
      },
    };
  } catch {
    return createDefaultProgress();
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
let autoAdvanceMessage = '';
let lastRunMastered = false;

function formatTime(time) {
  return `${time.toFixed(1)}s`;
}

function getLevel(id = currentLevelId) {
  return id ? LEVEL_DEFS[id] : null;
}

function getNextLevelId(id) {
  const index = LEVEL_ORDER.indexOf(id);
  return index >= 0 ? LEVEL_ORDER[index + 1] ?? null : null;
}

function isLevelUnlocked(id) {
  if (id === 'level1') return true;
  if (id === 'level2') return progress.completed.level1;
  return false;
}

function getLevelState(id) {
  if (!isLevelUnlocked(id)) return 'locked';
  if (progress.mastery[id]) return 'mastered';
  if (progress.completed[id]) return 'complete';
  return 'open';
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

function getRewardText(id) {
  const stars = progress.rewards[id] || 0;
  const badge = progress.mastery[id] ? ' + badge' : '';
  return `${'★'.repeat(stars)}${stars ? badge : ''}` || 'No rewards yet';
}

function getProgressSummary() {
  if (progress.mastery.level2) return 'Both early levels are cleared, and Level 2 is mastered.';
  if (progress.completed.level2) return 'Both early levels are clear. Chase mastery if you want a cleaner finish.';
  if (progress.completed.level1) return 'Level 1 clear banked. Level 2 is active now.';
  return 'Start with Level 1. Clear moves you forward, mastery is extra.';
}

function renderLevelSelect() {
  levelListEl.innerHTML = '';

  LEVEL_ORDER.forEach((id) => {
    const level = getLevel(id);
    const state = getLevelState(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `level-button is-${state}${currentLevelId === id ? ' is-selected' : ''}`;
    button.disabled = state === 'locked';
    button.innerHTML = `
      <div class="level-meta">
        <strong>${level.name}</strong>
        <span class="badge">${state === 'open' ? 'OPEN' : state === 'complete' ? 'CLEAR' : state === 'mastered' ? 'MASTERED' : 'LOCKED'}</span>
      </div>
      <small>${level.blurb}</small>
      <small class="level-subline">Reward: ${getRewardText(id)}</small>
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

  levelNameEl.textContent = level ? `${level.name} · ${level.title}` : 'Select';
  timeEl.textContent = formatTime(runTime);
  scoreEl.textContent = `${completed}/${totalSpawns}`;
  progressSummaryEl.textContent = getProgressSummary();

  if (!level) {
    bestEl.textContent = '0.0s • 0 clears';
    paceEl.textContent = '0%';
    corruptEl.textContent = 'SELECT A LEVEL';
    goalTextEl.textContent = 'Pick a level to see clear and mastery goals.';
    statusTextEl.textContent = 'Level 1 is open. Level 2 waits for your first clear.';
    hintTextEl.textContent = 'Clear advances immediately. Mastery is optional and rewards a little extra.';
    restartBtn.disabled = true;
    return;
  }

  const bestTime = progress.bestTimes[level.id] || 0;
  const clears = progress.clears[level.id] || 0;
  bestEl.textContent = `${formatTime(bestTime)} • ${clears} clears`;
  paceEl.textContent = gameState === 'won' ? (lastRunMastered ? 'MASTERED' : 'LEVEL CLEAR') : `${Math.round((Math.min(runTime, level.duration) / level.duration) * 100)}%`;
  goalTextEl.textContent = `Clear: ${level.clearGoal}`;
  hintTextEl.textContent = `${level.hint} Reward: ${level.rewardText}`;
  restartBtn.disabled = false;

  if (!isLevelUnlocked(level.id)) {
    statusTextEl.textContent = `${level.name} is locked.`;
  } else if (progress.mastery[level.id]) {
    statusTextEl.textContent = `${level.name} mastered. Reward banked: ${getRewardText(level.id)}.`;
  } else if (progress.completed[level.id]) {
    statusTextEl.textContent = `${level.name} cleared. Bonus mastery is still available.`;
  } else {
    statusTextEl.textContent = `${level.name} is ready. Mastery target: ${level.masteryGoal}`;
  }

  if (gameState === 'select') {
    corruptEl.textContent = 'READY';
  } else if (gameState === 'ready') {
    corruptEl.textContent = 'PRE-LEVEL';
  } else if (gameState === 'won') {
    corruptEl.textContent = lastRunMastered ? 'MASTERED' : 'CLEAR';
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
  lastRunMastered = false;
  renderLevelSelect();
  updateHud();
}

function selectLevel(id) {
  if (!isLevelUnlocked(id)) return;
  currentLevelId = id;
  autoAdvanceMessage = '';
  setIdleStateFromSelection();
}

function startRun() {
  if (gameState !== 'ready') return;
  if (!currentLevelId || !isLevelUnlocked(currentLevelId)) return;
  autoAdvanceMessage = '';
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

  finishTime = runTime;
  const masteredThisRun = finishTime <= level.masteryWindow;
  lastRunMastered = masteredThisRun;

  progress.bestTimes[level.id] = Math.max(progress.bestTimes[level.id] || 0, finishTime);
  progress.clears[level.id] = Math.max(progress.clears[level.id] || 0, 1);
  progress.completed[level.id] = true;
  progress.rewards[level.id] = Math.max(progress.rewards[level.id] || 0, masteredThisRun ? 2 : 1);
  progress.mastery[level.id] = progress.mastery[level.id] || masteredThisRun;
  saveProgress();

  const nextLevelId = getNextLevelId(level.id);
  if (nextLevelId && isLevelUnlocked(nextLevelId)) {
    currentLevelId = nextLevelId;
    autoAdvanceMessage = `${level.name} clear banked. ${LEVEL_DEFS[nextLevelId].name} is active now.`;
    setIdleStateFromSelection();
    return;
  }

  gameState = 'won';
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
    ctx.fillText('Clear opens the next route right away', 18, HEIGHT - 54);
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

function drawPanel(x, y, width, height) {
  ctx.fillStyle = 'rgba(10, 14, 26, 0.9)';
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 22);
  ctx.fill();
  ctx.stroke();
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
    ctx.fillText('Level 1 is your soft onboarding start', WIDTH / 2, HEIGHT / 2 - 8);
    ctx.fillStyle = '#aab6d3';
    ctx.fillText('Clear to move on, mastery for extra reward', WIDTH / 2, HEIGHT / 2 + 30);
    return;
  }

  if (gameState === 'ready' && level) {
    const panelX = 22;
    const panelY = 120;
    const panelWidth = WIDTH - 44;
    const panelHeight = 280;
    drawPanel(panelX, panelY, panelWidth, panelHeight);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8cb1ff';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(autoAdvanceMessage ? 'NEXT LEVEL READY' : 'PRE-LEVEL BRIEF', panelX + 22, panelY + 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui';
    ctx.fillText(`${level.name} · ${level.title}`, panelX + 22, panelY + 68);

    ctx.font = '17px system-ui';
    ctx.fillStyle = '#d8e2ff';
    ctx.fillText(level.blurb, panelX + 22, panelY + 98, panelWidth - 44);

    ctx.font = 'bold 16px system-ui';
    ctx.fillStyle = '#9af7c2';
    ctx.fillText(`Clear: ${level.clearGoal}`, panelX + 22, panelY + 140, panelWidth - 44);

    ctx.fillStyle = '#ffe26f';
    ctx.fillText(`Mastery: ${level.masteryGoal}`, panelX + 22, panelY + 184, panelWidth - 44);

    ctx.fillStyle = '#7df9ff';
    ctx.fillText(`Reward: ${level.rewardText}`, panelX + 22, panelY + 228, panelWidth - 44);

    ctx.font = '16px system-ui';
    ctx.fillStyle = '#aab6d3';
    ctx.fillText(
      autoAdvanceMessage || 'Tap, swipe, or press a lane key to start immediately',
      panelX + 22,
      panelY + 260,
      panelWidth - 44,
    );
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
    ctx.fillStyle = lastRunMastered ? '#ffe26f' : '#9af7c2';
    ctx.fillText(lastRunMastered ? 'Mastery Earned' : 'Level Clear', WIDTH / 2, HEIGHT / 2 - 42);
    ctx.font = '22px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Finish time ${formatTime(finishTime)}`, WIDTH / 2, HEIGHT / 2 - 2);
    ctx.fillStyle = '#aab6d3';
    ctx.font = '18px system-ui';
    ctx.fillText(`Reward banked: ${getRewardText(level.id)}`, WIDTH / 2, HEIGHT / 2 + 38);
    ctx.fillText('Press Space or Reset to replay the selected level', WIDTH / 2, HEIGHT / 2 + 70);
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
  if (!currentLevelId) {
    currentLevelId = LEVEL_ORDER.find((id) => isLevelUnlocked(id)) ?? null;
  }
  autoAdvanceMessage = '';
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
