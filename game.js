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
const worldMapEl = document.getElementById('worldMap');
const detailEyebrowEl = document.getElementById('detailEyebrow');
const detailTitleEl = document.getElementById('detailTitle');
const detailBodyEl = document.getElementById('detailBody');
const detailMasteryEl = document.getElementById('detailMastery');
const detailRewardEl = document.getElementById('detailReward');
const detailControlsEl = document.getElementById('detailControls');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const restartBtn = document.getElementById('restartBtn');
const startBtn = document.getElementById('startBtn');

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
const STORAGE_KEY = 'laneSwitchProgressV5';
const LEVEL_ORDER = ['level1', 'level2', 'level3'];
const MAP_NODE_LAYOUT = {
  level1: { desktop: { x: '10%', y: '10%' }, mobile: { y: '8%' } },
  level2: { desktop: { x: '56%', y: '38%' }, mobile: { y: '38%' } },
  level3: { desktop: { x: '18%', y: '68%' }, mobile: { y: '69%' } },
};

const LEVEL_DEFS = {
  level1: {
    id: 'level1',
    index: 1,
    name: 'Lägerelden',
    title: 'Startplatsen vid glöden',
    duration: 18,
    blurb: 'Första stoppet på kartan. Lär dig lane-rytmen med en trygg, tydlig öppning.',
    clearGoal: 'Survive to the end of the route.',
    masteryGoal: 'Finish with a clean, calm rhythm and beat the 16.5s mastery target.',
    rewardText: 'Clear earns 1 star. Mastery upgrades it to a gold route marker.',
    hint: 'Start moving before the block is on top of you. Early reads are the whole lesson.',
    readyText: 'Onboarding route. Very readable pressure.',
    inRunText: 'Stay loose, read early, and get used to the lane spacing.',
    completeText: 'Level 1 clear secured. The next route opens immediately.',
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
    index: 2,
    name: 'Skogsstigen',
    title: 'Den smala vägen mellan träden',
    duration: 22,
    blurb: 'Andra stoppet. Samma regler, lite mindre luft, och en tydlig känsla av att du lämnar lägret bakom dig.',
    clearGoal: 'Survive the full route with faster pressure and more committed swaps.',
    masteryGoal: 'Stay clean through the final wave and beat the 20.2s mastery target.',
    rewardText: 'Clear earns 1 star. Mastery upgrades the route marker and completes the bend cleanly.',
    hint: 'This should still feel fair. The jump is mostly reduced breathing room, not chaos.',
    readyText: 'Step up route. Less drift, more commitment.',
    inRunText: 'Commit earlier and respect the two-lane beats.',
    completeText: 'Level 2 clear secured. One more route is waiting up the road.',
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
  level3: {
    id: 'level3',
    index: 3,
    name: 'Ruinen på kullen',
    title: 'Sista klättringen till ruinen',
    duration: 25,
    blurb: 'Sista stoppet i mini-resan. Tydligt skarpare, men fortfarande läsbart om du planerar framåt.',
    clearGoal: 'Hold through the full bridge route and keep control during the layered ending.',
    masteryGoal: 'Beat the 22.7s mastery target while staying ahead of the corruption swings.',
    rewardText: 'Clear earns 1 star. Mastery turns the whole early world map gold.',
    hint: 'Think one beat ahead. The final section rewards committed positioning, not panic flicks.',
    readyText: 'Third route. Noticeably sharper, still readable.',
    inRunText: 'Read one beat ahead and set up the next safe lane early.',
    completeText: 'Level 3 clear secured. The first mini-world is complete.',
    masteryWindow: 22.7,
    events: [
      { dodgeAt: 2.2, lane: 1 },
      { dodgeAt: 3.2, lane: 0 },
      { dodgeAt: 4.2, lane: 2 },
      { dodgeAt: 5.1, lanes: [0, 1] },
      { dodgeAt: 6.1, lane: 2 },
      { dodgeAt: 7.0, lane: 1 },
      { dodgeAt: 7.9, lanes: [1, 2] },
      { dodgeAt: 8.9, lane: 0 },
      { dodgeAt: 9.8, lanes: [0, 2] },
      { dodgeAt: 11.0, lane: 1 },
      { dodgeAt: 12.0, lane: 2 },
      { dodgeAt: 13.0, lanes: [0, 1] },
      { dodgeAt: 14.1, lane: 2 },
      { dodgeAt: 15.1, lane: 0 },
      { dodgeAt: 16.0, lanes: [1, 2] },
      { dodgeAt: 17.1, lane: 0 },
      { dodgeAt: 18.0, lane: 1 },
      { dodgeAt: 18.9, lanes: [0, 2] },
      { dodgeAt: 20.0, lane: 1 },
      { dodgeAt: 20.9, lanes: [0, 1] },
      { dodgeAt: 21.9, lane: 2 },
      { dodgeAt: 22.8, lanes: [1, 2] },
      { dodgeAt: 23.8, lane: 0 },
    ],
    corruptionWindows: [
      { start: 6.7, end: 7.8, lane: 0 },
      { start: 12.7, end: 14.0, lane: 2 },
      { start: 19.7, end: 21.0, lane: 1 },
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

function keyedZeroes() {
  return Object.fromEntries(LEVEL_ORDER.map((id) => [id, 0]));
}

function keyedFalse() {
  return Object.fromEntries(LEVEL_ORDER.map((id) => [id, false]));
}

function createDefaultProgress() {
  return {
    completed: keyedFalse(),
    bestTimes: keyedZeroes(),
    clears: keyedZeroes(),
    mastery: keyedFalse(),
    rewards: keyedZeroes(),
  };
}

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const defaults = createDefaultProgress();
    return {
      completed: Object.fromEntries(LEVEL_ORDER.map((id) => [id, Boolean(parsed.completed?.[id])])),
      bestTimes: Object.fromEntries(LEVEL_ORDER.map((id) => [id, Number(parsed.bestTimes?.[id] || defaults.bestTimes[id])])),
      clears: Object.fromEntries(LEVEL_ORDER.map((id) => [id, Number(parsed.clears?.[id] || defaults.clears[id])])),
      mastery: Object.fromEntries(LEVEL_ORDER.map((id) => [id, Boolean(parsed.mastery?.[id])])),
      rewards: Object.fromEntries(LEVEL_ORDER.map((id) => [id, Number(parsed.rewards?.[id] || defaults.rewards[id])])),
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
  const index = LEVEL_ORDER.indexOf(id);
  if (index <= 0) return true;
  return progress.completed[LEVEL_ORDER[index - 1]];
}

function getLevelState(id) {
  if (!isLevelUnlocked(id)) return 'locked';
  if (currentLevelId === id) return 'current';
  if (progress.completed[id]) return 'done';
  return 'open';
}

function getNodeStatusText(id) {
  const state = getLevelState(id);
  if (state === 'current') return 'Current';
  if (state === 'open') return 'Open';
  if (state === 'done') return 'Done';
  return 'Locked';
}

function getUnlockText(id) {
  const previousLevelId = LEVEL_ORDER[LEVEL_ORDER.indexOf(id) - 1];
  if (!previousLevelId) return 'Start här';
  return `Lås upp genom att klara ${LEVEL_DEFS[previousLevelId].name}`;
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
  if (!stars) return 'Ingen markör ännu';
  return `${'★'.repeat(stars)}${progress.mastery[id] ? ' + guldklar' : ''}`;
}

function getProgressSummary() {
  if (progress.mastery.level3) return 'Hela mini-resan är klar. Kolla om kartan nu känns som en liten värld med tydlig början, mitt och slut.';
  if (progress.completed.level3) return 'Ruinen är nådd. Replays ska nu kännas som förbättring, inte som att leta efter nästa väg.';
  if (progress.completed.level2) return 'Ruinen på kullen är nu öppen som sista stopp på resan.';
  if (progress.completed.level1) return 'Skogsstigen är öppen. Kartan ska nu kännas som att resan fortsätter uppåt.';
  return 'Du börjar vid lägerelden. Klara en nod för att öppna nästa stopp på kartan.';
}

function renderWorldMap() {
  worldMapEl.innerHTML = `
    <svg class="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7df9ff" />
          <stop offset="100%" stop-color="#ffe26f" />
        </linearGradient>
      </defs>
      <path class="path-base" d="M26 24 C40 30, 55 38, 67 46" />
      <path class="path-base" d="M67 46 C58 55, 46 67, 34 78" />
      <path class="path-progress" d="M26 24 C40 30, 55 38, 67 46" />
      <path class="path-progress" d="M67 46 C58 55, 46 67, 34 78" />
    </svg>
  `;

  LEVEL_ORDER.forEach((id) => {
    const level = getLevel(id);
    const state = getLevelState(id);
    const layout = MAP_NODE_LAYOUT[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `world-node is-${state}`;
    button.disabled = state === 'locked';
    button.style.setProperty('--x', layout.desktop.x);
    button.style.setProperty('--y', layout.desktop.y);
    button.dataset.mobileY = layout.mobile.y;
    button.innerHTML = `
      <div class="node-top">
        <span class="node-number">${level.index}</span>
        <span class="badge">${getNodeStatusText(id)}</span>
      </div>
      <div class="node-meta">
        <span class="node-place">Plats ${level.index}</span>
        <span class="node-status">${getNodeStatusText(id)}</span>
      </div>
      <strong>${level.name}</strong>
      <p>${level.title}</p>
      <div class="node-bottom">
        <span>${state === 'locked' ? `🔒 ${getUnlockText(id)}` : state === 'done' ? '✓ Klar väg' : state === 'current' ? 'Du är här' : 'Tryck för att spela'}</span>
      </div>
      <small>${state === 'locked' ? 'Vägen öppnas längre fram' : getRewardText(id)}</small>
    `;
    button.addEventListener('click', () => selectLevel(id));
    worldMapEl.appendChild(button);
  });

  if (window.matchMedia('(max-width: 520px)').matches) {
    Array.from(worldMapEl.querySelectorAll('.world-node')).forEach((node) => {
      node.style.setProperty('--y', node.dataset.mobileY);
    });
  }
}

function updateSideCard() {
  const level = getLevel();

  if (!level) {
    detailEyebrowEl.textContent = 'Route briefing';
    detailTitleEl.textContent = 'Select a route';
    detailBodyEl.textContent = 'Lägerelden lär ut rytmen. Klarar du den öppnas nästa stopp på vägen.';
    detailMasteryEl.textContent = 'Optional extra credit for a cleaner run.';
    detailRewardEl.textContent = '1 star on clear, bonus on mastery.';
    detailControlsEl.textContent = 'Tap left or right side, swipe, or use arrow keys.';
    startBtn.disabled = true;
    startBtn.textContent = 'Select a level first';
    return;
  }

  detailEyebrowEl.textContent =
    gameState === 'running' ? 'Route live' : gameState === 'failed' ? 'Run failed' : gameState === 'won' ? 'Route complete' : autoAdvanceMessage ? 'Next route ready' : 'Route briefing';
  detailTitleEl.textContent = `${level.name} · ${level.title}`;

  if (gameState === 'failed') {
    detailBodyEl.textContent = `${lastDeathReason}. You made it ${formatTime(runTime)}. Reset and test the read again.`;
  } else if (gameState === 'won') {
    detailBodyEl.textContent = lastRunMastered
      ? `Mastery earned at ${formatTime(finishTime)}. This route now reads as solved cleanly.`
      : `Clear banked at ${formatTime(finishTime)}. The route works, but mastery is still there if you want a cleaner line.`;
  } else if (gameState === 'running') {
    detailBodyEl.textContent = level.inRunText;
  } else {
    detailBodyEl.textContent = autoAdvanceMessage || level.blurb;
  }

  detailMasteryEl.textContent = level.masteryGoal;
  detailRewardEl.textContent = `${level.rewardText} Current reward: ${getRewardText(level.id)}.`;
  detailControlsEl.textContent = gameState === 'running' ? 'Stay in motion. Left and right inputs move immediately.' : 'Tap start, then tap sides, swipe, or use arrow keys.';
  startBtn.disabled = !isLevelUnlocked(level.id) || gameState === 'running';
  startBtn.textContent = gameState === 'running' ? 'Run in progress' : gameState === 'won' || gameState === 'failed' ? 'Replay selected level' : 'Start selected level';
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
    goalTextEl.textContent = 'Välj en nod för att se clear- och mastery-mål.';
    statusTextEl.textContent = 'Lägerelden är öppen. Resten av vägen låses upp en klarad nod i taget.';
    hintTextEl.textContent = 'Det här passet testar om kartan känns som en liten resa, inte tre kort i rad.';
    restartBtn.disabled = true;
    updateSideCard();
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
    statusTextEl.textContent = `${level.name} är låst. ${getUnlockText(level.id)}.`;
  } else if (currentLevelId === level.id) {
    statusTextEl.textContent = `${level.name} är nuvarande stopp. Du är här.`;
  } else if (progress.mastery[level.id]) {
    statusTextEl.textContent = `${level.name} är klar med mastery. Belöning: ${getRewardText(level.id)}.`;
  } else if (progress.completed[level.id]) {
    statusTextEl.textContent = `${level.name} är klar. Spela om eller fortsätt vidare på kartan.`;
  } else {
    statusTextEl.textContent = `${level.name} är öppen. Mastery-mål: ${level.masteryGoal}`;
  }

  if (gameState === 'select') {
    corruptEl.textContent = 'SELECT A LEVEL';
  } else if (gameState === 'ready') {
    corruptEl.textContent = 'READY';
  } else if (gameState === 'won') {
    corruptEl.textContent = lastRunMastered ? 'MASTERED' : 'CLEAR';
  } else if (gameState === 'failed') {
    corruptEl.textContent = 'FAIL';
  } else if (activeCorruption) {
    corruptEl.textContent = `HOT LANE ${activeCorruption.lane + 1}`;
  } else {
    corruptEl.textContent = 'STABLE';
  }

  renderWorldMap();
  updateSideCard();
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
  updateHud();
}

function selectLevel(id) {
  if (!isLevelUnlocked(id)) return;
  currentLevelId = id;
  autoAdvanceMessage = '';
  setIdleStateFromSelection();
}

function startRun() {
  if (!currentLevelId || !isLevelUnlocked(currentLevelId)) return;
  if (gameState === 'running') return;
  if (gameState === 'won' || gameState === 'failed') {
    resetSelectedLevel();
  }
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
  progress.clears[level.id] = (progress.clears[level.id] || 0) + 1;
  progress.completed[level.id] = true;
  progress.rewards[level.id] = Math.max(progress.rewards[level.id] || 0, masteredThisRun ? 2 : 1);
  progress.mastery[level.id] = progress.mastery[level.id] || masteredThisRun;
  saveProgress();

  const nextLevelId = getNextLevelId(level.id);
  if (nextLevelId && isLevelUnlocked(nextLevelId)) {
    currentLevelId = nextLevelId;
    autoAdvanceMessage = `${level.name} clear banked. ${LEVEL_DEFS[nextLevelId].title} is now connected on the route map.`;
    setIdleStateFromSelection();
    return;
  }

  gameState = 'won';
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
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#151b31');
  gradient.addColorStop(1, '#0d1020');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const x = lane * laneWidth;
    ctx.fillStyle = lane % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, 0, laneWidth, HEIGHT);

    if (isLaneCorrupted(lane)) {
      ctx.fillStyle = 'rgba(181, 79, 255, 0.22)';
      ctx.fillRect(x, 0, laneWidth, HEIGHT);

      ctx.strokeStyle = 'rgba(255, 150, 228, 0.75)';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 6, 6, laneWidth - 12, HEIGHT - 12);
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
  ctx.fillText(level?.title ?? 'Route Map', 18, HEIGHT - 106);

  ctx.fillStyle = '#9eb3ff';
  ctx.fillText(level ? `${level.spawns.length} beats on this route` : 'Choose an open route above', 18, HEIGHT - 80);

  const activeCorruption = getCorruptionWindow();
  if (!level) {
    ctx.fillStyle = '#ffe26f';
    ctx.fillText('Clear routes to extend the map', 18, HEIGHT - 54);
  } else if (gameState === 'ready') {
    ctx.fillStyle = '#ffe26f';
    ctx.fillText(level.readyText, 18, HEIGHT - 54);
  } else if (activeCorruption) {
    ctx.fillStyle = '#ff9ccc';
    ctx.fillText(`Lane ${activeCorruption.lane + 1} is corrupted`, 18, HEIGHT - 54);
  } else if (gameState === 'won') {
    ctx.fillStyle = '#9af7c2';
    ctx.fillText(level.completeText, 18, HEIGHT - 54);
  } else if (gameState === 'failed') {
    ctx.fillStyle = '#ffb7ca';
    ctx.fillText(lastDeathReason, 18, HEIGHT - 54);
  } else {
    ctx.fillStyle = '#c4d2ff';
    ctx.fillText(level.inRunText, 18, HEIGHT - 54);
  }
}

function drawBanner(text, accent) {
  ctx.fillStyle = 'rgba(4, 6, 12, 0.78)';
  ctx.beginPath();
  ctx.roundRect(20, 18, WIDTH - 40, 56, 18);
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 20px system-ui';
  ctx.fillText(text, WIDTH / 2, 53);
}

function drawOverlay() {
  if (gameState === 'ready') drawBanner('Ready. Start from the side card or move to launch.', '#7df9ff');
  if (gameState === 'failed') drawBanner('Fail. Reset or start again from the side card.', '#ff8db1');
  if (gameState === 'won') drawBanner(lastRunMastered ? 'Mastery earned.' : 'Route clear.', lastRunMastered ? '#ffe26f' : '#9af7c2');
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
startBtn.addEventListener('click', startRun);

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (event.key === 'ArrowLeft' || key === 'a') moveLane(-1);
  if (event.key === 'ArrowRight' || key === 'd') moveLane(1);
  if (event.key === 'Enter' && gameState !== 'running') startRun();
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
renderWorldMap();
setIdleStateFromSelection();
requestAnimationFrame(frame);
