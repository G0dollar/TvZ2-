// ══════════════════════════════════════════════
//  TURRET VS ZOMBIES GAME ENGINE
// ══════════════════════════════════════════════

// Global Game Variables
let turretCol = 2;
let bullets = [];
let zombies = [];
let enemyBullets = [];
let kills = 0;
let waveKills = 0;
let wave = 1;
let health = 100;
let combo = 0;
let comboTimer = 0;

let running = false;
let over = false;
let spawningEnabled = true;
let paused = false;
let bossAlive = false;
let minibossAlive = false;

let shootCooldown = 2000;
let bulletSpeed = 0.5;
let bulletDamage = 1;
let bulletPierce = 0;
let burst = 1;
let burstLeft = 1;
let coolingDown = false;
let cooldownStart = 0;
let cooldownPauseAcc = 0;

let spawnDelay = 4250;
let nextSpawnTime = 0;
let coinMult = 1;
let knockback = 0;
let bossPhase = 1;

let scrap = { iron: 0, steel: 0, titan: 0 };
let activeClass = null;
let classPowers = { fire: {}, storm: {}, cryo: {}, void: {}, tech: {} };
let currentTab = 'basic';
let controlsMode = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) ? 'mobile' : 'pc';

// Game mode: 'menu' | 'standard' | 'raid' | 'endless'
let gameMode = 'menu';
let raidClass = null;
let activeMutator = null;

const MUTATORS = {
  solar: { name: "🔥 SOLAR FLARE", desc: "Inferno deals 2x burn damage; fire rate is 20% slower." },
  overcharge: { name: "⚡ OVERCHARGE", desc: "Storm arcs +2 targets; bullet damage is halved." },
  absolute_frost: { name: "❄️ ABSOLUTE FROST", desc: "Freeze duration +100%; non-frozen zombies are 20% faster." },
  warp: { name: "🌀 DISTORTION", desc: "Bullet knockback +150%; max ammo capacity is reduced by 1." }
};

function getMaxBurst() {
  let b = burst;
  if (activeMutator === 'warp') {
    b = Math.max(1, b - 1);
  }
  return b;
}

function chooseRandomMutator() {
  const keys = Object.keys(MUTATORS);
  const picked = keys[Math.floor(Math.random() * keys.length)];
  activeMutator = picked;
  
  const m = MUTATORS[picked];
  showWaveTxt(`MUTATOR: ${m.name}`);
  doFlash("fr");
  playTone(80, 0.9, 0.6, 'sawtooth');
  
  const el = document.getElementById("mutatorIndicator");
  if (el) {
    el.innerHTML = `⚠️ <strong>MUTATOR ACTIVE:</strong> ${m.name}<br><small>${m.desc}</small>`;
    el.style.display = "block";
  }
}

// Exit countdown & run tracking variables
let exitTimerActive = false;
let exitTimerTime = 0;
let lastRunKeptResourcesHTML = '';
let lastRunSavedWaveNum = 1;

let runGathered = {
  iron: 0, steel: 0, titan: 0,
  metalCore: 0,
  fireShard: 0, stormShard: 0, cryoShard: 0, voidShard: 0, techShard: 0,
  fireCoreBroken: 0, stormCoreBroken: 0, cryoCoreBroken: 0, voidCoreBroken: 0, techCoreBroken: 0,
  fireCore: 0, stormCore: 0, cryoCore: 0, voidCore: 0, techCore: 0
};

// ── Persistent state (saved to localStorage, survives across runs) ──
const SAVE_KEY = 'tvz2_save_v8'; // v8: added tech class + deployables
let persistent = {
  // Basic scrap — now accumulates across runs
  iron: 0, steel: 0, titan: 0,
  // Standard game boss/miniboss drops
  metalCore: 0,
  // Class shard currencies (from raid regular zombies)
  fireShard: 0, stormShard: 0, cryoShard: 0, voidShard: 0, techShard: 0,
  // Per-class broken cores (from raid MINIBOSS) — 3 = unlock that class
  fireCoreBroken: 0, stormCoreBroken: 0, cryoCoreBroken: 0, voidCoreBroken: 0, techCoreBroken: 0,
  // Per-class full cores (from raid BOSS) — 1 = unlock that class
  fireCore: 0, stormCore: 0, cryoCore: 0, voidCore: 0, techCore: 0,
  // Persistent upgrade levels
  ugLvls: [0, 0, 0, 0, 0, 0],
  classLvls: { fire: 0, storm: 0, cryo: 0, void: 0, tech: 0 },
  // Explicitly unlocked classes (cores spent) — gates class powers in raids
  unlockedClasses: [],
  // Chosen class for standard battle (null = none)
  activeClass: null,
  // Wave check points
  savedWave: 1,
  savedRaidWaves: { fire: 1, storm: 1, cryo: 1, void: 1, tech: 1 },
  // Endless personal record
  endlessBestWave: 0
};

// Deployables State
let deployables = [];
let utilityInventory = { barricade: 0, sentry: 0, mine: 0 };
let activeUtility = 'barricade';

let classPowerState = {
  fireDoT: [],
  lavaPools: [],
  napalmCounter: 0,
  empCounter: 0,
  empStunActive: false,
  empStunTimer: 0,
  chainCount: 0,
  ballCounter: 0,
  ballLightnings: [],
  plasmaActive: false,
  frozenZombies: new Set(),
  chillStacks: new Map(),
  blizzardCounter: 0,
  blizzardActive: false,
  blizzardTimer: 0,
  frostAuraActive: false,
  gravWells: [],
  dilationCounter: 0,
  dilationActive: false,
  dilationTimer: 0,
  blackHoleCounter: 0,
  blackHoleActive: false,
  blackHoleTimer: 0,
  riftActive: false,
  riftTimer: 0,
  // Tech Class power states
  droneDmgTimer: 0,
  repairTimer: 0,
  gigaBeamActive: false,
  gigaBeamTimer: 0,
  gigaBeamCol: 0
};

let shotCounter = 0;

// Canvas rendering elements
let canvas;
let ctx;
let lastTime = 0;
let recoilAmt = 0;

// Active transient visual effects (zaps, rings, damage pops)
let activeEffects = [];

/**
 * Game Setup & Initialization
 */
function initGame() {
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  // Safe fallback polyfill for older browsers/renderers without Canvas2D roundRect support
  if (ctx && !ctx.roundRect) {
    ctx.roundRect = function (x, y, w, h, r) {
      if (typeof r === 'number') {
        r = { tl: r, tr: r, br: r, bl: r };
      } else if (Array.isArray(r)) {
        r = { tl: r[0] || 0, tr: r[1] || 0, br: r[2] || 0, bl: r[3] || 0 };
      } else {
        r = { tl: r.tl || 0, tr: r.tr || 0, br: r.br || 0, bl: r.bl || 0 };
      }
      this.beginPath();
      this.moveTo(x + r.tl, y);
      this.lineTo(x + w - r.tr, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
      this.lineTo(x + w, y + h - r.br);
      this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
      this.lineTo(x + r.bl, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
      this.lineTo(x, y + r.tl);
      this.quadraticCurveTo(x, y, x + r.tl, y);
      this.closePath();
      return this;
    };
  }

  createParticles();
  setControlsMode(controlsMode);

  // Load persistent progress from localStorage
  loadProgress();

  // Show main menu on boot
  showMainMenu();

  // Start the 60 FPS animation/draw loop
  requestAnimationFrame(drawLoop);
}

// Particle elements background placeholder
function createParticles() {
  // Configured in TvZ2.html background div particles float
}

function updateVignette() {
  document.getElementById("vignette").className = health <= 30 ? "low" : "";
}

function updateWaveBadge() {
  const b = document.getElementById("waveBadge");
  const nw = wave + 1;
  if (nw % 10 === 0) {
    b.className = "boss-next";
    b.innerHTML = "⚠️ WAVE " + nw + ": ☠ BOSS";
  } else if (nw % 5 === 0) {
    b.className = "mini-next";
    b.innerHTML = "⚠️ WAVE " + nw + ": 💜 MINIBOSS";
  } else {
    b.className = "";
    b.innerHTML = "🌊 WAVE " + wave;
  }
}

function updateScrapBar() {
  document.getElementById('sc-iron').textContent = `🔩 ${scrap.iron}`;
  document.getElementById('sc-steel').textContent = `🔷 ${scrap.steel}`;
  document.getElementById('sc-titan').textContent = `💠 ${scrap.titan}`;
  updatePersistentBar();
}

function updatePersistentBar() {
  const mc = document.getElementById('sc-metal-core');
  if (mc) mc.textContent = `⚙️ ${persistent.metalCore}`;
  // Show raid class shard chip only in raid mode
  const shardChip = document.getElementById('sc-raid-shard');
  if (shardChip) {
    if (gameMode === 'raid' && raidClass) {
      const sh = CLASS_SHARDS[raidClass];
      shardChip.textContent = `${sh.icon} ${persistent[sh.key]}`;
      shardChip.style.display = 'inline-flex';
      shardChip.style.borderColor = sh.color;
      shardChip.style.color = sh.color;
    } else {
      shardChip.style.display = 'none';
    }
  }
  updateMainMenuResources();
}

function updateBoardBorder() {
  const b = document.getElementById("board");
  b.className = bossAlive ? "boss-mode" : (activeClass ? activeClass + "-mode" : "");
}

function updateClassBadge() {
  const b = document.getElementById("activeClassBadge");
  if (!activeClass) {
    b.style.display = "none";
    return;
  }
  const cls = CLASSES[activeClass];
  b.style.display = "inline-block";
  b.style.background = cls.glow;
  b.style.border = `1px solid ${cls.color}`;
  b.style.color = cls.color;
  b.textContent = cls.name;
}

function shake() {
  const w = document.getElementById("boardWrapper");
  w.classList.remove("shake");
  void w.offsetWidth;
  w.classList.add("shake");
}

function doFlash(t) {
  const f = document.getElementById("waveFlash");
  f.className = "";
  void f.offsetWidth;
  f.className = t;
}

function showWaveTxt(txt) {
  const w = document.getElementById("waveTxt");
  w.textContent = txt;
  w.className = "";
  void w.offsetWidth;
  w.className = "show";
}

// Spawning Flash effect at columns
function spawnFlashCol(col, color) {
  activeEffects.push({
    type: 'spawnFlash',
    col: col,
    color: color,
    alpha: 1.0,
    decay: 0.05
  });
}

// ══════════════════════════════════════════════
//  VISUAL EFFECTS ENGINE
// ══════════════════════════════════════════════
function fireRing(col, y) {
  activeEffects.push({
    type: 'ring',
    col, y,
    radius: 10,
    maxRadius: 42,
    color: 'rgba(255, 109, 0, 0.8)',
    shadowColor: '#ff3300',
    alpha: 1.0,
    decay: 0.05
  });
}

function iceRing(col, y) {
  activeEffects.push({
    type: 'ring',
    col, y,
    radius: 10,
    maxRadius: 42,
    color: 'rgba(128, 222, 234, 0.8)',
    shadowColor: '#00e5ff',
    alpha: 1.0,
    decay: 0.06
  });
}

function voidRing(col, y) {
  activeEffects.push({
    type: 'ring',
    col, y,
    radius: 10,
    maxRadius: 42,
    color: 'rgba(206, 147, 216, 0.8)',
    shadowColor: '#9c27b0',
    alpha: 1.0,
    decay: 0.07
  });
}

function lightningZap(fromCol, fromY, toCol, toY) {
  activeEffects.push({
    type: 'zap',
    x1: (fromCol + 0.5) * 100,
    y1: fromY * 100 + 50,
    x2: (toCol + 0.5) * 100,
    y2: toY * 100 + 50,
    alpha: 1.0,
    decay: 0.1
  });
}

function dmgTxt(x, y, dmg, color) {
  let txtColor = color;
  if (!color) {
    if (dmg >= 6) txtColor = "#ff44ff";
    else if (dmg >= 4) txtColor = "#ff2200";
    else if (dmg >= 3) txtColor = "#ff6600";
    else txtColor = "#ffd700";
  }
  activeEffects.push({
    type: 'text',
    text: dmg > 0 ? `-${dmg}` : `+${-dmg}`,
    x: x * 100 + 50 + (Math.random() - 0.5) * 20,
    y: y * 100 + 40,
    color: txtColor,
    vy: -1.2,
    alpha: 1.0,
    decay: 0.03
  });
}

function scrapPickupTxt(x, y, type) {
  const colors = {
    iron: "#b0bec5", steel: "#4fc3f7", titan: "#ffb74d",
    metalCore: "#aaaaff",
    fireShard: "#ff6d00", stormShard: "#aeea00", cryoShard: "#80deea", voidShard: "#ce93d8",
    fireCoreBroken: "#ff9944", stormCoreBroken: "#ccff00", cryoCoreBroken: "#4dd0e1", voidCoreBroken: "#e1bee7",
    fireCore: "#ff5500", stormCore: "#aeea00", cryoCore: "#00acc1", voidCore: "#9c27b0"
  };
  const icons = {
    iron: "🔩", steel: "🔷", titan: "💠",
    metalCore: "⚙️",
    fireShard: "🔥", stormShard: "⚡", cryoShard: "❄️", voidShard: "🌀",
    fireCoreBroken: "💜🔥", stormCoreBroken: "💜⚡", cryoCoreBroken: "💜❄️", voidCoreBroken: "💜🌀",
    fireCore: "❤️🔥", stormCore: "❤️⚡", cryoCore: "❤️❄️", voidCore: "❤️🌀"
  };
  activeEffects.push({
    type: 'text',
    text: `+1 ${icons[type] || "?"}`,
    x: x * 100 + 50,
    y: y * 100 + 10,
    color: colors[type] || "white",
    vy: -0.9,
    alpha: 1.0,
    decay: 0.02
  });
}

function updateEffects() {
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const fx = activeEffects[i];
    fx.alpha -= fx.decay;
    if (fx.vy) fx.y += fx.vy;
    if (fx.radius !== undefined) fx.radius += (fx.maxRadius - fx.radius) * 0.22;

    if (fx.alpha <= 0) {
      activeEffects.splice(i, 1);
    }
  }
}

// ══════════════════════════════════════════════
//  GAME CYCLE SETUP
// ══════════════════════════════════════════════
function startGame() {
  if (AC.state === 'suspended') AC.resume();
  document.getElementById("startScreen").style.display = "none";
  resetGame();
}

function resetGame() {
  stopMusic();
  activeMutator = null;
  const mInd = document.getElementById("mutatorIndicator");
  if (mInd) mInd.style.display = "none";

  let theme = 'menu';
  if (gameMode === 'standard' || gameMode === 'endless') {
    theme = 'standard';
  } else if (gameMode === 'raid' && raidClass) {
    theme = raidClass;
  }
  if (!musicMuted) startMusic(theme);
  setControlsMode(controlsMode);

  turretCol = 2;
  bullets = [];
  zombies = [];
  enemyBullets = [];
  kills = 0;
  waveKills = 0;
  
  if (gameMode === 'standard') {
    wave = persistent.savedWave || 1;
  } else if (gameMode === 'raid' && raidClass) {
    wave = (persistent.savedRaidWaves && persistent.savedRaidWaves[raidClass]) || 1;
  } else {
    wave = 1;
  }
  
  health = 100;
  combo = 0;
  comboTimer = 0;

  spawnDelay = 4250;
  nextSpawnTime = Date.now() + spawnDelay;

  paused = false;
  bossAlive = false;
  minibossAlive = false;
  bossPhase = 1;

  // Apply persistent UG levels to current game state
  applyAllUGEffects();

  burstLeft = getMaxBurst();
  coolingDown = false;
  cooldownStart = 0;
  cooldownPauseAcc = 0;

  // Reset run gathered and HUD scrap to 0 at start of run
  scrap = { iron: 0, steel: 0, titan: 0 };
  runGathered = {
    iron: 0, steel: 0, titan: 0,
    metalCore: 0,
    fireShard: 0, stormShard: 0, cryoShard: 0, voidShard: 0, techShard: 0,
    fireCoreBroken: 0, stormCoreBroken: 0, cryoCoreBroken: 0, voidCoreBroken: 0, techCoreBroken: 0,
    fireCore: 0, stormCore: 0, cryoCore: 0, voidCore: 0, techCore: 0
  };
  shotCounter = 0;
  exitTimerActive = false;
  document.getElementById('exitCountdownIndicator').style.display = 'none';

  // In raid mode, only activate class powers if the player has unlocked that class.
  // Entering a raid without unlocking = you earn drops but get NO class powers.
  if (gameMode === 'raid' && raidClass) {
    if (persistent.unlockedClasses.includes(raidClass)) {
      activeClass = raidClass;
    } else {
      activeClass = null; // no powers until unlocked
    }
  }

  // Clear active deployables and inventory
  deployables = [];
  utilityInventory = { barricade: 0, sentry: 0, mine: 0 };
  activeUtility = 'barricade';

  classPowerState = {
    fireDoT: [], lavaPools: [], napalmCounter: 0,
    empCounter: 0, empStunActive: false, empStunTimer: 0, chainCount: 0,
    ballCounter: 0, ballLightnings: [], plasmaActive: false,
    frozenZombies: new Set(), chillStacks: new Map(), blizzardCounter: 0,
    blizzardActive: false, blizzardTimer: 0, frostAuraActive: false,
    gravWells: [], dilationCounter: 0, dilationActive: false, dilationTimer: 0,
    blackHoleCounter: 0, blackHoleActive: false, blackHoleTimer: 0,
    riftActive: false, riftTimer: 0,
    droneDmgTimer: 0, repairTimer: 0, gigaBeamActive: false, gigaBeamTimer: 0, gigaBeamCol: 0
  };

  activeEffects = [];
  gameParticles = [];
  recoilAmt = 0;

  over = false;
  running = true;
  currentTab = 'basic';

  document.getElementById("gameOver").style.display = "none";
  document.getElementById("bossBarContainer").style.display = "none";
  document.getElementById("minibossBarContainer").style.display = "none";
  document.getElementById("waveBarContainer").style.display = "block";
  document.getElementById("waveBarFill").style.width = "0%";
  document.getElementById("healthFill").style.width = "100%";
  document.getElementById("board").className = "";

  // Trigger boss/miniboss check for starting wave checkpoint
  if (wave % 10 === 0) {
    spawnTrueBoss();
  } else if (wave % 5 === 0) {
    spawnMiniboss();
  } else {
    spawningEnabled = true;
  }

  updateVignette();
  updateWaveBadge();
  updateScrapBar();
  updatePersistentBar();
  updateClassBadge();
}

// Apply all purchased UG effects (called at run start so persistent upgrades take effect)
function applyAllUGEffects() {
  // Reset to base values
  shootCooldown = 2000;
  bulletSpeed = 0.5;
  bulletDamage = 1;
  bulletPierce = 0;
  burst = 1;
  knockback = 0;
  // Sync UG.lvl from persistent and apply effects
  UG.forEach((u, i) => {
    u.lvl = persistent.ugLvls[i] || 0;
    if (u.lvl > 0 && u.lvl <= u.vals.length) {
      u.apply(u.vals[u.lvl - 1]);
    }
  });
}

function toggleInfo() {
  const b = document.getElementById("infoBox");
  b.style.display = b.style.display === "block" ? "none" : "block";
}

function updateCombo() {
  comboTimer = 3000;
  const d = document.getElementById("comboDisplay");
  d.textContent = `COMBO x${combo}`;
  d.style.transform = "translate(-50%,-50%) scale(1)";
  d.classList.remove("show");
  void d.offsetWidth;
  d.classList.add("show");
  setTimeout(() => {
    d.style.transform = "translate(-50%,-50%) scale(0)";
  }, 1800);
}

// ══════════════════════════════════════════════
//  CONTROLS & INPUT ACTIONS
// ══════════════════════════════════════════════
function move(dir) {
  if (!running || paused) return;
  turretCol = Math.max(0, Math.min(COLS - 1, turretCol + dir));
}

function shoot() {
  if (!running || coolingDown || burstLeft <= 0 || paused) return;
  sndShoot();

  // Apply recoil
  recoilAmt = 15;

  let pierceV = bulletPierce;
  const b = { col: turretCol, y: ROWS - 1, prevY: ROWS - 1, pierceLeft: pierceV };
  bullets.push(b);
  burstLeft--;
  shotCounter++;

  // Trigger class shot abilities
  if (activeClass) triggerShotAbility();
  if (burstLeft === 0) {
    coolingDown = true;
    cooldownStart = Date.now();
    cooldownPauseAcc = 0;
  }
  drawCD();
}

function reload() {
  if (!running || coolingDown || burstLeft === getMaxBurst() || paused) return;
  burstLeft = 0;
  coolingDown = true;
  cooldownStart = Date.now();
  cooldownPauseAcc = 0;
  sndReload();
}

function triggerShotAbility() {
  if (!activeClass) return;
  const fx = getClassFx(activeClass);
  if (activeClass === 'storm') {
    if (fx.emp && shotCounter % 8 === 0) triggerEMP();
    if (fx.ballLightning && shotCounter % 12 === 0) spawnBallLightning();
    if (fx.overload && shotCounter % 22 === 0) triggerStormOverload();
  }
  if (activeClass === 'cryo') {
    if (fx.blizzard && shotCounter % 15 === 0) triggerBlizzard();
    if (fx.glacierCollapse && shotCounter % 25 === 0) triggerGlacierCollapse();
  }
  if (activeClass === 'void') {
    if (fx.timeDilation && shotCounter % 10 === 0) triggerDilation();
    if (fx.blackHole && shotCounter % 20 === 0) triggerBlackHole();
    if (fx.rift && shotCounter % 28 === 0) triggerSingularityRift();
  }
  if (activeClass === 'fire') {
    if (fx.cataclysm && shotCounter % 25 === 0) triggerInfernoCataclysm();
    if (fx.napalm) {
      classPowerState.napalmCounter++;
      if (classPowerState.napalmCounter % 5 === 0) return "napalm";
    }
  }
  if (activeClass === 'tech') {
    if (fx.gigaBeam && shotCounter % 20 === 0) triggerGigaBeam();
  }
}

function triggerGigaBeam() {
  classPowerState.gigaBeamActive = true;
  classPowerState.gigaBeamTimer = 1500;
  classPowerState.gigaBeamCol = turretCol;
  
  showWaveTxt("🦾 GIGA-BEAM DETONATION!");
  doFlash("fg");
  shake();
  playTone(120, 0.8, 0.5, 'sawtooth');
  
  zombies.forEach(z => {
    if (z.y > -1) {
      z.hp -= 20;
      z.isHit = true;
      dmgTxt(z.col, z.y, 20, '#00e5ff');
      explode(z.col, z.y, 'tech', 20);
    }
  });
}

function updateUtilityHUD() {
  const slotEl = document.getElementById("activeUtilitySlot");
  if (!slotEl) return;
  const count = utilityInventory[activeUtility] || 0;
  const icons = { barricade: '🚧', sentry: '🤖', mine: '💣' };
  const names = { barricade: 'Barricade', sentry: 'Sentry Gun', mine: 'Prox Mine' };
  const label = names[activeUtility];
  const icon = icons[activeUtility];
  
  slotEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding: 1px 3px;">
      <span style="font-size:15px;text-shadow:0 0 6px var(--gold);">${icon}</span>
      <div style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;">
        <span style="font-size:8px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
        <span style="font-size:9px;font-weight:bold;font-family:var(--mono);color:#aaa;">QTY: ${count}/3</span>
      </div>
    </div>
  `;

  const mBtn = document.getElementById("mobilePlaceBtn");
  if (mBtn) {
    mBtn.innerHTML = `${icon} <small style="font-size:8px;font-family:var(--mono);display:block;margin-top:1px;">${count}</small>`;
  }
}

function toggleUtility() {
  const order = ['barricade', 'sentry', 'mine'];
  const idx = order.indexOf(activeUtility);
  activeUtility = order[(idx + 1) % order.length];
  playTone(600, 0.05, 0.12, 'sine');
  updateUtilityHUD();
}

function deployActiveUtility() {
  if (!running || paused || over || gameMode === 'menu') return;
  const count = utilityInventory[activeUtility] || 0;
  if (count <= 0) {
    playTone(150, 0.3, 0.15, 'sawtooth');
    return;
  }

  let targetRow = ROWS - 2;
  while (targetRow >= 0) {
    const occupied = deployables.some(d => d.col === turretCol && d.row === targetRow);
    if (!occupied) break;
    targetRow--;
  }

  if (targetRow < 0) {
    playTone(150, 0.3, 0.15, 'sawtooth');
    return;
  }

  let maxHp = 20;
  if (activeUtility === 'sentry') maxHp = 10;
  else if (activeUtility === 'mine') maxHp = 1;

  const fx = getClassFx(activeClass);
  if (activeClass === 'tech') {
    if (activeUtility === 'barricade' && fx.teslaSpikes) {
      maxHp = 30;
    }
  }

  const d = {
    id: Math.random(),
    type: activeUtility,
    col: turretCol,
    row: targetRow,
    hp: maxHp,
    maxHp: maxHp,
    shootTimer: 0
  };

  deployables.push(d);
  utilityInventory[activeUtility]--;
  updateUtilityHUD();
  playTone(400, 0.1, 0.2, 'sine');
}

// ══════════════════════════════════════════════
//  SCRAP & CURRENCY SYSTEM
// ══════════════════════════════════════════════
function dropScrap(z) {
  if (gameMode === 'raid' && raidClass) {
    // ── RAID DROPS ──────────────────────────────────────────
    const sh = CLASS_SHARDS[raidClass];
    const cc = CLASS_CORES[raidClass];
    if (z.type === 'boss') {
      runGathered[cc.fullKey] = (runGathered[cc.fullKey] || 0) + 1;
      runGathered[sh.key] = (runGathered[sh.key] || 0) + 5;
      scrapPickupTxt(z.col, z.y, cc.fullKey);
      sndScrap();
    } else if (z.type === 'miniboss') {
      runGathered[cc.brokenKey] = (runGathered[cc.brokenKey] || 0) + 1;
      runGathered[sh.key] = (runGathered[sh.key] || 0) + 3;
      scrapPickupTxt(z.col, z.y, cc.brokenKey);
      sndScrap();
    } else {
      const amount = Math.random() < 0.35 ? 2 : 1;
      runGathered[sh.key] = (runGathered[sh.key] || 0) + amount;
      scrapPickupTxt(z.col, z.y, sh.key);
      sndScrap();
    }
    const shardChip = document.getElementById('sc-raid-shard');
    if (shardChip) {
      shardChip.classList.remove('sc-new');
      void shardChip.offsetWidth;
      shardChip.classList.add('sc-new');
      setTimeout(() => shardChip.classList.remove('sc-new'), 400);
    }
    updatePersistentBar();
    return;
  }

  // ── STANDARD GAME DROPS ─────────────────────────────────
  if (z.type === 'boss') {
    runGathered.metalCore += 2;
    runGathered.iron  += 8;
    runGathered.steel += 6;
    runGathered.titan += 3;
    scrap.iron = runGathered.iron;
    scrap.steel = runGathered.steel;
    scrap.titan = runGathered.titan;
    updateScrapBar();
    scrapPickupTxt(z.col, z.y, 'metalCore');
    sndScrap();
    return;
  } else if (z.type === 'miniboss') {
    runGathered.metalCore += 1;
    runGathered.steel += 4;
    runGathered.titan += 2;
    scrap.iron = runGathered.iron;
    scrap.steel = runGathered.steel;
    scrap.titan = runGathered.titan;
    updateScrapBar();
    scrapPickupTxt(z.col, z.y, 'metalCore');
    sndScrap();
    return;
  }

  let type = null;
  if (z.type === 'heavy') {
    type = Math.random() < 0.5 ? 'titan' : 'steel';
  } else if (z.type === 'armored') {
    type = Math.random() < 0.6 ? 'steel' : 'iron';
  } else if (z.type === 'fast') {
    type = Math.random() < 0.4 ? 'steel' : 'iron';
  } else {
    type = Math.random() < 0.15 ? 'steel' : 'iron';
  }

  if (type) {
    runGathered[type]++;
    scrap[type] = runGathered[type];
    updateScrapBar();
    const el = document.getElementById('sc-' + type);
    if (el) {
      el.classList.remove('sc-new');
      void el.offsetWidth;
      el.classList.add('sc-new');
      setTimeout(() => el.classList.remove('sc-new'), 400);
    }
    scrapPickupTxt(z.col, z.y, type);
    sndScrap();
  }
}

function canAffordScrap(cost) {
  return Object.entries(cost).every(([k, v]) => (getAllResources()[k] || 0) >= v);
}

function spendScrap(cost) {
  Object.entries(cost).forEach(([k, v]) => {
    if (k === 'iron' || k === 'steel' || k === 'titan') {
      persistent[k] = (persistent[k] || 0) - v;
      scrap[k] = persistent[k];
    } else if (persistent.hasOwnProperty(k)) {
      persistent[k] = (persistent[k] || 0) - v;
    }
  });
  updateScrapBar();
  saveProgress();
}

function getAllResources() {
  if (running) {
    return {
      iron: runGathered.iron, steel: runGathered.steel, titan: runGathered.titan,
      metalCore: runGathered.metalCore,
      fireShard: runGathered.fireShard, stormShard: runGathered.stormShard,
      cryoShard: runGathered.cryoShard, voidShard: runGathered.voidShard,
      fireCore: runGathered.fireCore, stormCore: runGathered.stormCore,
      cryoCore: runGathered.cryoCore, voidCore: runGathered.voidCore,
      fireCoreBroken: runGathered.fireCoreBroken, stormCoreBroken: runGathered.stormCoreBroken,
      cryoCoreBroken: runGathered.cryoCoreBroken, voidCoreBroken: runGathered.voidCoreBroken
    };
  } else {
    return {
      iron: persistent.iron, steel: persistent.steel, titan: persistent.titan,
      metalCore: persistent.metalCore,
      fireShard: persistent.fireShard, stormShard: persistent.stormShard,
      cryoShard: persistent.cryoShard, voidShard: persistent.voidShard,
      fireCore: persistent.fireCore, stormCore: persistent.stormCore,
      cryoCore: persistent.cryoCore, voidCore: persistent.voidCore,
      fireCoreBroken: persistent.fireCoreBroken, stormCoreBroken: persistent.stormCoreBroken,
      cryoCoreBroken: persistent.cryoCoreBroken, voidCoreBroken: persistent.voidCoreBroken
    };
  }
}

// ══════════════════════════════════════════════
//  WAVE MANAGEMENT & SPAWNING
// ══════════════════════════════════════════════
function spawnZ() {
  if (over || !spawningEnabled) return;
  if (zombies.some(z => z.type === "boss" || z.type === "miniboss")) return;

  // Delegate to raid spawner when in raid mode
  if (gameMode === 'raid' && raidClass) {
    spawnRaidZ();
    return;
  }

  const eff = (wave >= 6 && wave <= 15) ? spawnDelay * 0.72 : spawnDelay;
  let z = { type: "basic", hp: 1, maxHp: 1, speed: 0.04, isHit: false };
  const r = Math.random();

  if (kills >= 80 && r < 0.04) {
    z = { type: "heavy", hp: Math.max(8, wave * 2), speed: 0.02 };
  } else if (kills >= 40 && r < 0.10) {
    z = { type: "armored", hp: Math.max(4, wave), speed: 0.04 };
  } else if (kills >= 15 && r < 0.15) {
    z = { type: "fast", hp: 1, speed: 0.08 };
  }

  // Endless Mode scaling difficulty
  if (gameMode === 'endless') {
    const endlessMult = Math.pow(1.15, wave - 1);
    const endlessSpeedMult = Math.min(2.5, 1 + (wave - 1) * 0.04);
    z.hp = Math.round(z.hp * endlessMult);
    z.speed = z.speed * endlessSpeedMult;
  }

  z.maxHp = z.hp;
  z.zId = Math.random();
  z.status = null;
  z.statusTimer = 0;
  z.baseSpeed = z.speed;

  const col = Math.floor(Math.random() * COLS);
  z.col = col;
  z.y = -1;
  zombies.push(z);

  const clrs = { basic: "rgba(78,205,196,0.85)", fast: "rgba(255,0,80,0.85)", armored: "rgba(247,127,0,0.85)", heavy: "rgba(160,160,170,0.85)" };
  spawnFlashCol(col, clrs[z.type] || "rgba(255,80,0,0.85)");

  nextSpawnTime = Date.now() + eff;
}

// ══════════════════════════════════════════════
//  RAID ZOMBIE SPAWNER
// ══════════════════════════════════════════════
function spawnRaidZ() {
  const zone = RAID_ZONES[raidClass];
  const eff = (wave >= 6 && wave <= 15) ? spawnDelay * 0.72 : spawnDelay;

  // Weighted random pick of zombie definition
  const totalWeight = zone.zombies.reduce((s, zd) => s + zd.dropWeight, 0);
  let rand = Math.random() * totalWeight;
  let def = zone.zombies[0];
  for (const zd of zone.zombies) {
    rand -= zd.dropWeight;
    if (rand <= 0) { def = zd; break; }
  }

  // Scale hp with wave progression
  const hp = Math.max(1, Math.round(def.hp * (1 + wave * 0.12)));
  const z = {
    type: def.type,
    label: def.label,
    hp, maxHp: hp,
    speed: def.speed,
    baseSpeed: def.speed,
    raidColor: def.color,
    raidGlow: def.glow,
    raidRadius: def.radius,
    zId: Math.random(),
    status: null, statusTimer: 0,
    isHit: false
  };

  const col = Math.floor(Math.random() * COLS);
  z.col = col;
  z.y = -1;
  zombies.push(z);
  spawnFlashCol(col, def.glow);
  nextSpawnTime = Date.now() + eff;
}

function spawnMiniboss() {
  zombies = [];
  minibossAlive = true;
  spawningEnabled = false;

  let hp = Math.ceil(2.25 * Math.pow(wave, 1));
  if (gameMode === 'endless') {
    hp = Math.ceil(hp * Math.pow(1.15, wave - 1));
  }
  const z = {
    type: "miniboss", hp, maxHp: hp, speed: 0.013, y: -1, cols: [1, 2, 3], zId: Math.random(),
    sTimer: 0, sPat: [0, 2, 4], isHit: false, status: null, statusTimer: 0, baseSpeed: 0.013
  };
  zombies.push(z);

  document.getElementById("minibossBarContainer").style.display = "block";
  document.getElementById("minibossBarFill").style.width = "100%";
  document.getElementById("waveBarContainer").style.display = "none";

  const minibossLabel = (gameMode === 'raid' && raidClass)
    ? RAID_ZONES[raidClass].minibossName
    : '💜 MINIBOSS';

  playTone(200, 0.5, 0.28);
  doFlash("fr");
  showWaveTxt(minibossLabel + "!");
}

function spawnTrueBoss() {
  zombies = [];
  bossAlive = true;
  spawningEnabled = false;
  bossPhase = 1;

  let hp = Math.ceil(3 * Math.pow(wave, 1.25));
  if (gameMode === 'endless') {
    hp = Math.ceil(hp * Math.pow(1.15, wave - 1));
  }
  const boss = {
    type: "boss", hp, maxHp: hp, speed: 0.008, y: -1,
    cols: [0, 1, 2, 3, 4], zId: Math.random(),
    sTimer: 0, sPat: [0, 2, 4], enraged: false, isHit: false, status: null, statusTimer: 0, baseSpeed: 0.008
  };
  zombies.push(boss);

  const bossNameLabel = (gameMode === 'raid' && raidClass)
    ? RAID_ZONES[raidClass].bossName
    : '☠ THE DREAD REVENANT ☠';

  document.getElementById("bossBarContainer").style.display = "block";
  document.getElementById("bossBarFill").style.width = "100%";
  document.getElementById("bossHpText").textContent = `${hp} / ${hp} HP`;
  document.getElementById("bossPhaseLabel").textContent = "PHASE 1";
  document.getElementById("bossBarFill").style.background = "linear-gradient(to right,#ff0000,#ff5500,#ffaa00)";
  document.getElementById("bossNameLabel").textContent = bossNameLabel;
  document.getElementById("waveBarContainer").style.display = "none";

  updateBoardBorder();

  const ann = document.getElementById("bossAnnounce");
  document.getElementById("annSub").textContent = (gameMode === 'raid' && raidClass)
    ? `${RAID_ZONES[raidClass].name} final boss approaches...`
    : 'The Dread Revenant awakens...';
  ann.style.display = "flex";
  sndBossIntro();
  setTimeout(() => { ann.style.display = "none"; }, 2400);

  doFlash("fr");
  showWaveTxt("☠ BOSS WAVE ☠");
}

function advWave() {
  wave++;
  waveKills = 0;
  document.getElementById("waveBarFill").style.width = "0%";
  spawnDelay = Math.max(800, spawnDelay - 220);

  sndWaveClear();
  doFlash("fg");
  showWaveTxt("WAVE " + wave + "!");
  updateWaveBadge();

  if (gameMode === 'endless' && wave % 5 === 1 && wave > 1) {
    chooseRandomMutator();
  } else if (gameMode !== 'endless') {
    activeMutator = null;
    const el = document.getElementById("mutatorIndicator");
    if (el) el.style.display = "none";
  }

  if (wave % 10 === 0) spawnTrueBoss();
  else if (wave % 5 === 0) spawnMiniboss();
  else spawningEnabled = true;
}

// ══════════════════════════════════════════════
//  CLASS MODIFIERS (HIT & SLAY)
// ══════════════════════════════════════════════
function getClassFx(cls) {
  const fx = {};
  if (!cls) return fx;
  const lvl = persistent.classLvls[cls] || 0;
  CLASSES[cls].upgrades.forEach((u, i) => {
    if (i < lvl) fx[u.effect] = true;
  });
  return fx;
}

function applyClassHit(z, b) {
  if (!activeClass) return;
  const fx = getClassFx(activeClass);
  if (activeClass === 'fire') {
    if (fx.ignite) {
      z.status = 'fire';
      z.statusTimer = 3000;
    }
    if (fx.napalm && classPowerState.napalmCounter > 0 && shotCounter % 5 === 0) {
      zombies.forEach(t => {
        if (t !== z && t.col === b.col) {
          t.hp -= bulletDamage * 2;
          t.isHit = true;
          dmgTxt(b.col, t.y, bulletDamage * 2, "#ff6d00");
        }
      });
      fireRing(b.col, z.y);
      playTone(300, 0.3, 0.3, 'sawtooth');
    }
  }
  if (activeClass === 'storm' && fx.chain) {
    const targets = zombies.filter(t => t !== z && Math.abs(t.col - (z.cols ? z.cols[1] : z.col)) <= 1 && t.y > 0);
    let count = fx.doubleArc ? 2 : 1;
    if (activeMutator === 'overcharge') count += 2;
    targets.slice(0, count).forEach(t => {
      let dmgVal = Math.ceil(bulletDamage * 0.5);
      if (activeMutator === 'overcharge') dmgVal = Math.ceil(dmgVal * 0.5);
      t.hp -= dmgVal;
      t.isHit = true;
      dmgTxt(t.col, t.y, dmgVal, "#aeea00");
      lightningZap(z.cols ? z.cols[1] : z.col, z.y, t.col, t.y);
    });
  }
  if (activeClass === 'cryo') {
    if (fx.chill) {
      const id = z.zId;
      const fzDuration = activeMutator === 'absolute_frost' ? 4000 : 2000;
      if (fx.deepFreeze) {
        let stacks = (classPowerState.chillStacks.get(id) || 0) + 1;
        classPowerState.chillStacks.set(id, stacks);
        if (stacks >= 3 && z.status !== 'frozen') {
          z.status = 'frozen';
          z.statusTimer = fzDuration;
          iceRing(b.col, z.y);
        } else if (stacks < 3) {
          z.status = 'chill';
          z.statusTimer = fzDuration;
        }
      } else {
        z.status = 'chill';
        z.statusTimer = fzDuration;
      }
    }
  }
  if (activeClass === 'void') {
    if (fx.warpPull) {
      const pullCol = z.cols ? z.cols[1] : z.col;
      zombies.forEach(t => {
        if (t !== z && Math.abs(t.col - pullCol) <= 1) t.y = Math.max(0, t.y - 0.3);
      });
      voidRing(b.col, z.y);
    }
    z.status = 'voided';
    z.statusTimer = 1500;
  }
}

function applyClassKill(z) {
  if (!activeClass) return;
  const fx = getClassFx(activeClass);
  if (activeClass === 'fire') {
    if (fx.spreadFire) {
      zombies.forEach(t => {
        if (t !== z && t.col === z.col) {
          t.status = 'fire';
          t.statusTimer = 2500;
        }
      });
    }
    if (fx.lavaPool) {
      classPowerState.lavaPools.push({ col: z.col, row: Math.floor(z.y), timer: 4000 });
    }
    if (fx.nova && Math.random() < 0.3) {
      zombies.forEach(t => {
        if (t.col === z.col) {
          t.hp -= 8;
          t.isHit = true;
          dmgTxt(t.col, t.y, 8, "#ff6d00");
        }
      });
      fireRing(z.col, z.y);
      playTone(200, 0.5, 0.35, 'sawtooth');
      showWaveTxt("☀ INFERNO NOVA!");
    }
  }
  if (activeClass === 'cryo') {
    if (fx.shatter && classPowerState.frozenZombies.has(z.zId)) {
      zombies.forEach(t => {
        if (t.col === z.col) {
          t.hp -= 6;
          t.isHit = true;
          dmgTxt(t.col, t.y, 6, "#80deea");
        }
      });
      iceRing(z.col, z.y);
      playTone(600, 0.2, 0.25);
    }
    classPowerState.frozenZombies.delete(z.zId);
    classPowerState.chillStacks.delete(z.zId);
  }
  if (activeClass === 'void') {
    if (fx.gravWell) {
      classPowerState.gravWells.push({ col: z.col, timer: 3000 });
      voidRing(z.col, z.y);
    }
    if (fx.singularity && Math.random() < 0.15) {
      const pullCol = z.col;
      zombies.forEach(t => {
        if (t !== z && Math.abs(t.col - pullCol) <= 1) {
          t.hp -= 10;
          t.isHit = true;
          dmgTxt(t.col, t.y, 10, "#ce93d8");
        }
      });
      voidRing(pullCol, z.y);
      playTone(80, 0.8, 0.4, 'sawtooth');
      showWaveTxt("🕳 SINGULARITY!");
    }
  }
}

function triggerEMP() {
  classPowerState.empStunActive = true;
  classPowerState.empStunTimer = 1500;
  showWaveTxt("⚡ EMP BURST!");
  doFlash("fg");
  playTone(100, 0.5, 0.35, 'square');
}

function spawnBallLightning() {
  classPowerState.ballLightnings.push({ x: turretCol, y: ROWS - 2, dx: 1, dy: -0.1, timer: 3000, hits: [] });
  showWaveTxt("🔵 BALL LIGHTNING!");
  playTone(1000, 0.2, 0.2, 'square');
}

function triggerBlizzard() {
  classPowerState.blizzardActive = true;
  classPowerState.blizzardTimer = 2000;
  showWaveTxt("🌨 BLIZZARD!");
  doFlash("fg");
  playTone(300, 0.5, 0.3);
}

function triggerDilation() {
  classPowerState.dilationActive = true;
  classPowerState.dilationTimer = 3000;
  showWaveTxt("⏱ TIME DILATION!");
  doFlash("fg");
  playTone(80, 0.8, 0.35, 'sawtooth');
}

function triggerBlackHole() {
  classPowerState.blackHoleActive = true;
  classPowerState.blackHoleTimer = 5000;
  showWaveTxt("⚫ BLACK HOLE!");
  doFlash("fr");
  shake();
  playTone(40, 1, 0.4, 'sawtooth');
}

function triggerInfernoCataclysm() {
  showWaveTxt("🔥 INFERNO CATACLYSM!");
  doFlash("fr");
  playTone(150, 0.6, 0.5, 'sawtooth');
  
  for (let col = 0; col < COLS; col++) {
    setTimeout(() => {
      if (!running || paused) return;
      fireRing(col, 4);
      explode(col, 4, 'fire', 25);
      playTone(200 + col * 50, 0.4, 0.3, 'sawtooth');
      
      zombies.forEach(z => {
        const check = z.cols ? z.cols.includes(col) : z.col === col;
        if (check) {
          z.hp -= 15;
          z.isHit = true;
          dmgTxt(col, z.y, 15, "#ff3300");
        }
      });
      classPowerState.lavaPools.push({ col, row: 4, timer: 6000 });
    }, col * 150);
  }
}

function triggerStormOverload() {
  showWaveTxt("⚡ STORM OVERLOAD!");
  doFlash("fg");
  playTone(80, 0.8, 0.4, 'square');
  
  const targets = zombies.filter(z => z.y > 0).slice(0, 8);
  targets.forEach((z, i) => {
    setTimeout(() => {
      if (!running || paused || z.hp <= 0) return;
      z.hp -= 12;
      z.isHit = true;
      z.status = 'frozen';
      z.statusTimer = 2000;
      dmgTxt(z.col, z.y, 12, "#aeea00");
      explode(z.col, z.y, 'storm', 15);
      playTone(600 - i * 40, 0.2, 0.15, 'square');
      
      const prevCol = i === 0 ? turretCol : targets[i - 1].col;
      const prevY = i === 0 ? ROWS - 1 : targets[i - 1].y;
      lightningZap(prevCol, prevY, z.col, z.y);
    }, i * 80);
  });
}

function triggerGlacierCollapse() {
  showWaveTxt("❄️ GLACIER COLLAPSE!");
  doFlash("fg");
  playTone(400, 0.6, 0.4);
  
  zombies.forEach(z => {
    if (z.y > 0) {
      if (z.status === 'frozen') {
        z.hp -= 20;
        z.isHit = true;
        dmgTxt(z.col, z.y, 20, "#80deea");
        iceRing(z.col, z.y);
        explode(z.col, z.y, 'ice', 20);
      } else {
        z.status = 'frozen';
        z.statusTimer = 3000;
        iceRing(z.col, z.y);
        explode(z.col, z.y, 'ice', 10);
      }
    }
  });
}

function triggerSingularityRift() {
  classPowerState.riftActive = true;
  classPowerState.riftTimer = 6000;
  showWaveTxt("🌀 SINGULARITY RIFT!");
  doFlash("fr");
  shake();
  playTone(30, 1.2, 0.6, 'sawtooth');
}

// ══════════════════════════════════════════════
//  PHYSICS ENGINE (20 FPS LOOP)
// ══════════════════════════════════════════════
function update() {
  if (paused) return;

  // Exit timer countdown logic
  if (exitTimerActive) {
    exitTimerTime -= LOOP;
    if (exitTimerTime <= 0) {
      exitTimerActive = false;
      document.getElementById('exitCountdownIndicator').style.display = 'none';
      
      // Survive escape successfully! Keep 50% resources, reset wave to closest 5 below.
      resolveRunResources(0.5, false);
      alert(`Escape Successful!\n\nSecured 50% of run-gathered resources.\nWave checkpoint set to: Wave ${lastRunSavedWaveNum}`);
      performMainMenuExit();
      return;
    } else {
      document.getElementById('exitCountdownTime').textContent = (exitTimerTime / 1000).toFixed(1);
    }
  }

  if (coolingDown) {
    const el = (Date.now() - cooldownStart) + cooldownPauseAcc;
    const mCd = activeMutator === 'solar' ? shootCooldown * 1.25 : shootCooldown;
    const per = mCd / getMaxBurst();
    burstLeft = Math.floor(el / per);
    if (burstLeft >= getMaxBurst()) {
      burstLeft = getMaxBurst();
      coolingDown = false;
    }
    drawCD();
    updateClassPowerHUD();
  }

  if (comboTimer > 0) {
    comboTimer -= LOOP;
    if (comboTimer <= 0) combo = 0;
  }

  if (!bossAlive && !minibossAlive) {
    const t = killsPerWave();
    document.getElementById("waveBarFill").style.width = Math.min(100, waveKills / t * 100) + "%";
    if (waveKills >= t) advWave();
  }

  if (spawningEnabled && Date.now() >= nextSpawnTime && running) spawnZ();

  // Passive status loops
  zombies.forEach(z => {
    if (z.status) {
      z.statusTimer -= LOOP;
      if (z.statusTimer <= 0) {
        if (z.status === 'frozen') classPowerState.frozenZombies.delete(z.zId);
        z.status = null;
        z.speed = z.baseSpeed;
        classPowerState.chillStacks.delete(z.zId);
      }
    }

    // Speed adjustments
    let speedMod = 1;
    if (z.status === 'chill') speedMod *= 0.7;
    if (z.status === 'frozen') speedMod = 0;
    if (z.status === 'voided') speedMod *= 0.5;
    if (activeClass === 'cryo' && getClassFx('cryo').frostAura && z.y >= (ROWS - 3)) speedMod *= 0.8;
    if (classPowerState.blizzardActive) speedMod *= 0.2;
    if (classPowerState.dilationActive) speedMod *= 0.1;
    if (classPowerState.blackHoleActive) speedMod = 0;

    let baseSpeedVal = z.baseSpeed;
    if (activeMutator === 'absolute_frost' && z.status !== 'frozen' && z.status !== 'chill') {
      baseSpeedVal *= 1.2;
    }

    let isBlocked = false;
    let targetDeployable = null;
    const zCols = z.cols || [z.col];
    let closestDep = null;
    deployables.forEach(d => {
      if (zCols.includes(d.col) && d.row > z.y) {
        if (!closestDep || d.row < closestDep.row) {
          closestDep = d;
        }
      }
    });

    if (closestDep) {
      const speedTerm = baseSpeedVal * speedMod;
      if (z.y + speedTerm >= closestDep.row - 0.8) {
        z.y = closestDep.row - 0.8;
        isBlocked = true;
        targetDeployable = closestDep;
      }
    }

    if (!isBlocked) {
      z.y += baseSpeedVal * speedMod;
    } else {
      let dmgRate = 5;
      if (z.type === 'fast') dmgRate = 4;
      else if (z.type === 'armored') dmgRate = 8;
      else if (z.type === 'heavy') dmgRate = 12;
      else if (z.type === 'miniboss') dmgRate = 15;
      else if (z.type === 'boss') dmgRate = 20;

      targetDeployable.hp -= dmgRate * (LOOP / 1000);

      const fx = getClassFx(activeClass);
      if (activeClass === 'tech' && targetDeployable.type === 'barricade' && fx.teslaSpikes) {
        z.hp -= 1.5 * (LOOP / 1000);
        if (Math.random() < 0.15) {
          lightningZap(targetDeployable.col, targetDeployable.row, z.col, z.y);
          dmgTxt(z.col, z.y, 1, '#00e5ff');
        }
      }

      if (targetDeployable.type === 'mine') {
        targetDeployable.hp = 0; // Trigger mine explosion
      }

      if (Math.random() < 0.08) {
        explode(targetDeployable.col, targetDeployable.row, 'metal', 4);
        playTone(180, 0.08, 0.12, 'sawtooth');
      }
    }

    if (z.status === 'frozen') classPowerState.frozenZombies.add(z.zId);

    // Boss enraged phase 2
    if (z.type === "boss" && !z.enraged && z.hp <= z.maxHp * 0.5) {
      z.enraged = true;
      z.speed *= 1.8;
      z.baseSpeed *= 1.8;
      bossPhase = 2;
      document.getElementById("bossPhaseLabel").textContent = "⚡ PHASE 2";
      document.getElementById("bossBarFill").style.background = "linear-gradient(to right,#ff0000,#ff00ff,#ffff00)";
      doFlash("fr");
      showWaveTxt("⚡ ENRAGED!");
    }

    // Boss / Miniboss shooting
    if (z.type === "boss" || z.type === "miniboss") {
      z.sTimer += LOOP;
      const interval = z.type === "boss" ? (z.enraged ? 1800 : 1600) : 1800;
      if (z.sTimer >= interval) {
        z.sTimer = 0;
        if (z.type === "boss") {
          let cols = [];
          const bulletSpeedVal = z.enraged ? 0.07 : 0.08;
          if (z.enraged) {
            z.enragedPattern = (z.enragedPattern || 0) + 1;
            if (z.lastSafeCol === undefined) {
              z.lastSafeCol = 2; // Start center
            }
            if (z.enragedPattern % 2 === 1) {
              // Option 1: 4 columns shot, 1 safe column (guaranteed not on player)
              let validCols = [0, 1, 2, 3, 4].filter(c => Math.abs(c - z.lastSafeCol) <= 2 && c !== z.lastSafeCol && c !== turretCol);
              if (validCols.length === 0) {
                validCols = [0, 1, 2, 3, 4].filter(c => c !== turretCol);
              }
              const safeCol = validCols[Math.floor(Math.random() * validCols.length)];
              
              z.lastSafeCol = safeCol;
              cols = [0, 1, 2, 3, 4].filter(c => c !== safeCol);
            } else {
              // Option 3: 3 columns shot, 2 safe columns (adjacent, guaranteed not on player)
              let validCols1 = [0, 1, 2, 3, 4].filter(c => Math.abs(c - z.lastSafeCol) <= 1 && c !== turretCol);
              if (validCols1.length === 0) {
                validCols1 = [0, 1, 2, 3, 4].filter(c => c !== turretCol);
              }
              const safeCol1 = validCols1[Math.floor(Math.random() * validCols1.length)];
              
              let validCols2 = [];
              if (safeCol1 > 0 && (safeCol1 - 1) !== turretCol) validCols2.push(safeCol1 - 1);
              if (safeCol1 < COLS - 1 && (safeCol1 + 1) !== turretCol) validCols2.push(safeCol1 + 1);
              
              // Fallback if no adjacent columns are non-player
              if (validCols2.length === 0) {
                if (safeCol1 > 0) validCols2.push(safeCol1 - 1);
                if (safeCol1 < COLS - 1) validCols2.push(safeCol1 + 1);
              }
              
              const safeCol2 = validCols2[Math.floor(Math.random() * validCols2.length)];
              
              z.lastSafeCol = safeCol1;
              cols = [0, 1, 2, 3, 4].filter(c => c !== safeCol1 && c !== safeCol2);
            }
          } else {
            cols = z.sPat;
            z.sPat = z.sPat[0] === 0 ? [1, 3] : [0, 2, 4];
          }
          cols.forEach(col => enemyBullets.push({ col, y: z.y + 0.8, isBoss: true, speed: bulletSpeedVal }));
        } else {
          z.sPat.forEach(col => enemyBullets.push({ col, y: z.y + 0.8, isBoss: false, speed: 0.14 }));
          z.sPat = (Math.random() < 0.5) ? [0, 2, 4] : [1, 3];
        }
      }
    }

    // Row breaches (Turret damage)
    if (z.y >= ROWS - 2) {
      const dmg = z.type === "boss" ? 15 : z.type === "miniboss" ? 12 : 10;
      health -= dmg;
      document.getElementById("healthFill").style.width = Math.max(0, health) + "%";
      updateVignette();
      shake();
      if (health <= 0) endGame();
    }
  });

  // Bullet & projectile physics
  bullets.forEach(b => {
    b.prevY = b.y;
    b.y -= bulletSpeed;
    if (activeClass) {
      const pType = activeClass === 'cryo' ? 'ice' : activeClass;
      if (Math.random() < 0.45) {
        explode(b.col, b.y, pType, 1);
      }
    }
  });

  enemyBullets.forEach(b => {
    b.y += (b.speed || 0.15);
    if (Math.abs(b.y - (ROWS - 1)) < 0.25 && b.col === turretCol) {
      health -= (b.isBoss ? 10 : 8);
      document.getElementById("healthFill").style.width = Math.max(0, health) + "%";
      updateVignette();
      shake();
      if (health <= 0) endGame();
    }
  });



  // Lava pool DoT
  classPowerState.lavaPools.forEach(pool => {
    pool.timer -= LOOP;
    zombies.forEach(z => {
      if (z.col === pool.col && Math.abs(z.y - pool.row) < 1) {
        if (Math.random() < 0.1) {
          z.hp -= 1;
          dmgTxt(pool.col, pool.row, 1, "#ff6d00");
        }
      }
    });
  });
  classPowerState.lavaPools = classPowerState.lavaPools.filter(p => p.timer > 0);

  // Ball lightning updates
  classPowerState.ballLightnings.forEach(ball => {
    ball.timer -= LOOP;
    ball.x += ball.dx * 0.12;
    if (ball.x <= 0 || ball.x >= COLS - 1) ball.dx *= -1;
    zombies.forEach(z => {
      if (!ball.hits.includes(z.zId) && Math.abs(z.col - ball.x) < 1 && Math.abs(z.y - ball.y) < 1.5) {
        z.hp -= 5;
        z.isHit = true;
        ball.hits.push(z.zId);
        dmgTxt(z.col, z.y, 5, "#aeea00");
        lightningZap(Math.round(ball.x), ball.y, z.col, z.y);
        if (ball.hits.length > zombies.length) ball.hits = [];
      }
    });
  });
  classPowerState.ballLightnings = classPowerState.ballLightnings.filter(b => b.timer > 0);

  // Gravity wells pull
  classPowerState.gravWells.forEach(well => {
    well.timer -= LOOP;
    zombies.forEach(z => {
      if (Math.abs(z.col - well.col) <= 1) z.y = Math.max(0, z.y - 0.015);
    });
  });
  classPowerState.gravWells = classPowerState.gravWells.filter(w => w.timer > 0);

  // Fire status DoT
  zombies.forEach(z => {
    if (z.status === 'fire' && Math.random() < 0.05) {
      z.hp -= 1;
      dmgTxt(z.col, z.y, 1, "#ff6d00");
    }
  });

  // Black hole damage ticks
  if (classPowerState.blackHoleActive) {
    if (Math.random() < 0.3) zombies.forEach(z => { z.hp -= 3; z.isHit = true; });
    classPowerState.blackHoleTimer -= LOOP;
    if (classPowerState.blackHoleTimer <= 0) classPowerState.blackHoleActive = false;
  }

  // Singularity Rift logic
  if (classPowerState.riftActive) {
    classPowerState.riftTimer -= LOOP;
    if (classPowerState.riftTimer <= 0) {
      classPowerState.riftActive = false;
    } else {
      zombies.forEach(z => {
        if (z.y > 0) {
          z.y += (4 - z.y) * 0.15;
          if (z.col !== 2 && Math.random() < 0.15) {
            z.col += z.col < 2 ? 1 : -1;
            spawnFlashCol(z.col, "rgba(206, 147, 216, 0.2)");
          }
          if (Math.abs(z.y - 4) < 2 && Math.random() < 0.35) {
            z.hp -= 2;
            z.isHit = true;
            dmgTxt(z.col, z.y, 2, "#ce93d8");
          }
        }
      });
    }
  }

  // EMP stun
  if (classPowerState.empStunActive) {
    classPowerState.empStunTimer -= LOOP;
    if (classPowerState.empStunTimer <= 0) classPowerState.empStunActive = false;
  }

  // Blizzard damage ticks
  if (classPowerState.blizzardActive) {
    classPowerState.blizzardTimer -= LOOP;
    if (Math.random() < 0.04) zombies.forEach(z => { z.hp -= 1; });
    if (classPowerState.blizzardTimer <= 0) classPowerState.blizzardActive = false;
  }

  // Time dilation ticks
  if (classPowerState.dilationActive) {
    classPowerState.dilationTimer -= LOOP;
    if (classPowerState.dilationTimer <= 0) classPowerState.dilationActive = false;
  }

  // Collisions Processing
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    for (let j = zombies.length - 1; j >= 0; j--) {
      const z = zombies[j];
      const hc = z.cols ? z.cols.includes(b.col) : b.col === z.col;
      if (hc && b.y <= z.y + 0.6 && b.prevY >= z.y) {
        sndHit();
        const isNapalm = activeClass === 'fire' && getClassFx('fire').napalm && classPowerState.napalmCounter > 0 && (shotCounter % 5 === 0);
        let dmg = isNapalm ? bulletDamage * 3 : bulletDamage;
        if (activeMutator === 'overcharge') dmg = Math.max(1, Math.floor(dmg * 0.5));

        z.hp -= dmg;
        z.isHit = true;
        let kb = knockback;
        if (activeMutator === 'warp') kb *= 2.5;
        if (kb > 0) z.y = Math.max(0, z.y - kb);

        applyClassHit(z, b);

        const deb = activeClass || (z.type === 'armored' || z.type === 'heavy' || z.type === 'miniboss' || z.type === 'boss' ? 'metal' : 'flesh');
        explode(b.col, z.y, deb, z.hp <= 0 ? 15 : 7);
        dmgTxt(b.col, z.y, dmg);

        if (z.type === "boss") {
          const pct = Math.max(0, z.hp) / z.maxHp * 100;
          document.getElementById("bossBarFill").style.width = pct + "%";
          document.getElementById("bossHpText").textContent = `${Math.max(0, z.hp)} / ${z.maxHp} HP`;
        }
        if (z.type === "miniboss") {
          document.getElementById("minibossBarFill").style.width = (Math.max(0, z.hp) / z.maxHp * 100) + "%";
        }

        if (z.hp <= 0) {
          combo++;
          updateCombo();
          kills++;
          if (z.type !== 'boss' && z.type !== 'miniboss') waveKills++;

          applyClassKill(z);
          dropScrap(z);

          if (z.type === "boss") {
            bossAlive = false;
            spawningEnabled = true;
            document.getElementById("bossBarContainer").style.display = "none";
            document.getElementById("waveBarContainer").style.display = "block";
            updateBoardBorder();
            waveKills = 0;
            document.getElementById("waveBarFill").style.width = "0%";
            shake();
            doFlash("fg");
            showWaveTxt("☠ BOSS SLAIN!");
            playTone(1046, 0.4, 0.35);
            advWave();
            if (gameMode !== 'endless') {
              showCheckpointChoices();
            }
          }
          if (z.type === "miniboss") {
            minibossAlive = false;
            spawningEnabled = true;
            document.getElementById("minibossBarContainer").style.display = "none";
            document.getElementById("waveBarContainer").style.display = "block";
            waveKills = 0;
            document.getElementById("waveBarFill").style.width = "0%";
            shake();
            doFlash("fg");
            showWaveTxt("💜 MINIBOSS SLAIN!");
            playTone(1046, 0.3, 0.35);
            advWave();
            if (gameMode !== 'endless') {
              showCheckpointChoices();
            }
          }

          zombies.splice(j, 1);
        }

        if (b.pierceLeft > 0) {
          b.pierceLeft--;
        } else {
          bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  // Secondary check for DoT kills
  for (let j = zombies.length - 1; j >= 0; j--) {
    const z = zombies[j];
    if (z.hp <= 0) {
      combo++;
      kills++;
      if (z.type !== 'boss' && z.type !== 'miniboss') waveKills++;
      applyClassKill(z);
      dropScrap(z);
      const deb = activeClass || (z.type === 'armored' || z.type === 'heavy' || z.type === 'miniboss' || z.type === 'boss' ? 'metal' : 'flesh');
      explode(z.col, z.y, deb, 12);
      zombies.splice(j, 1);
    }
  }

  // Handle deployables destruction / mine explosions
  for (let i = deployables.length - 1; i >= 0; i--) {
    const d = deployables[i];
    if (d.hp <= 0) {
      if (d.type === 'mine') {
        explode(d.col, d.row, 'fire', 25);
        playTone(120, 0.4, 0.4, 'sawtooth');
        showWaveTxt("💣 MINE DETONATION!");
        shake();
        
        zombies.forEach(z => {
          const zCols = z.cols || [z.col];
          const distCol = zCols.reduce((min, c) => Math.min(min, Math.abs(c - d.col)), 99);
          if (distCol <= 1 && Math.abs(z.y - d.row) <= 1.5) {
            z.hp -= 12;
            z.isHit = true;
            dmgTxt(z.col, z.y, 12, '#ff6d00');
          }
        });
      } else {
        explode(d.col, d.row, 'metal', 15);
        playTone(100, 0.25, 0.2, 'sawtooth');
      }
      deployables.splice(i, 1);
    }
  }

  // Sentry Gun shooting loop
  deployables.forEach(d => {
    if (d.type === 'sentry') {
      d.shootTimer -= LOOP;
      if (d.shootTimer <= 0) {
        let targetZ = null;
        zombies.forEach(z => {
          const zCols = z.cols || [z.col];
          if (zCols.includes(d.col) && z.y < d.row && z.y > -1) {
            if (!targetZ || z.y > targetZ.y) {
              targetZ = z;
            }
          }
        });

        if (targetZ) {
          const fx = getClassFx(activeClass);
          const isOverclocked = activeClass === 'tech' && fx.overclock;
          
          d.shootTimer = isOverclocked ? 800 : 1200; // 0.8s vs 1.2s
          let sDmg = 1;
          let pierce = isOverclocked ? 1 : 0;
          
          targetZ.hp -= sDmg;
          targetZ.isHit = true;
          dmgTxt(d.col, targetZ.y, sDmg, '#00e5ff');
          explode(d.col, targetZ.y, 'tech', 4);
          
          activeEffects.push({
            type: 'zap',
            x1: (d.col + 0.5) * 100,
            y1: d.row * 100 + 40,
            x2: (d.col + 0.5) * 100,
            y2: targetZ.y * 100 + 50,
            alpha: 1.0,
            decay: 0.15,
            color: '#00e5ff'
          });

          playTone(800, 0.08, 0.08, 'sine');

          if (pierce > 0) {
            let nextZ = null;
            zombies.forEach(z => {
              if (z !== targetZ) {
                const zCols = z.cols || [z.col];
                if (zCols.includes(d.col) && z.y < targetZ.y && z.y > -1) {
                  if (!nextZ || z.y > nextZ.y) {
                    nextZ = z;
                  }
                }
              }
            });

            if (nextZ) {
              nextZ.hp -= sDmg;
              nextZ.isHit = true;
              dmgTxt(d.col, nextZ.y, sDmg, '#00e5ff');
              explode(d.col, nextZ.y, 'tech', 4);
              
              activeEffects.push({
                type: 'zap',
                x1: (d.col + 0.5) * 100,
                y1: targetZ.y * 100 + 50,
                x2: (d.col + 0.5) * 100,
                y2: nextZ.y * 100 + 50,
                alpha: 1.0,
                decay: 0.15,
                color: '#00e5ff'
              });
            }
          }
        }
      }
    }
  });

  // Companion Tech Drone
  if (activeClass === 'tech' && getClassFx('tech').nanoDrone) {
    classPowerState.droneDmgTimer -= LOOP;
    if (classPowerState.droneDmgTimer <= 0) {
      classPowerState.droneDmgTimer = 1500;
      
      let targetZ = null;
      let minDist = 999;
      zombies.forEach(z => {
        if (z.y > -1) {
          const dx = z.col - turretCol;
          const dy = z.y - (ROWS - 1);
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < minDist) {
            minDist = dist;
            targetZ = z;
          }
        }
      });

      if (targetZ) {
        targetZ.hp -= 1;
        targetZ.isHit = true;
        dmgTxt(targetZ.col, targetZ.y, 1, '#00e5ff');
        explode(targetZ.col, targetZ.y, 'tech', 4);
        playTone(900, 0.08, 0.08, 'sine');
        
        const droneX = turretCol * 100 + 50 + Math.sin(Date.now() / 200) * 25;
        const droneY = 900 - 45 + Math.cos(Date.now() / 200) * 10;
        activeEffects.push({
          type: 'zap',
          x1: droneX,
          y1: droneY,
          x2: (targetZ.col + 0.5) * 100,
          y2: targetZ.y * 100 + 50,
          alpha: 1.0,
          decay: 0.15,
          color: '#00e5ff'
        });
      }
    }
  }

  // Tech Nano-Repair Pulse
  if (activeClass === 'tech' && getClassFx('tech').repairPulse) {
    classPowerState.repairTimer -= LOOP;
    if (classPowerState.repairTimer <= 0) {
      classPowerState.repairTimer = 8000;
      
      let healedAny = false;
      deployables.forEach(d => {
        if (d.type === 'barricade' || d.type === 'sentry') {
          const healAmt = Math.round(d.maxHp * 0.3);
          if (d.hp < d.maxHp) {
            d.hp = Math.min(d.maxHp, d.hp + healAmt);
            healedAny = true;
            dmgTxt(d.col, d.row, -healAmt, '#00ff88');
            
            activeEffects.push({
              type: 'ring',
              col: d.col, y: d.row,
              radius: 10,
              maxRadius: 35,
              color: 'rgba(0, 255, 136, 0.8)',
              shadowColor: '#00ff88',
              alpha: 1.0,
              decay: 0.08
            });
          }
        }
      });
      
      if (healedAny) {
        playTone(440, 0.2, 0.15, 'sine');
        showWaveTxt("🛡️ NANO-REPAIR PULSE!");
      }
    }
  }

  // Giga Beam Active Timer
  if (classPowerState.gigaBeamActive) {
    classPowerState.gigaBeamTimer -= LOOP;
    if (classPowerState.gigaBeamTimer <= 0) {
      classPowerState.gigaBeamActive = false;
    }
  }

  // Clean up off-screen entities at the very end of the tick
  bullets = bullets.filter(b => b.y > -1);
  enemyBullets = enemyBullets.filter(b => b.y < ROWS + 1);
  zombies = zombies.filter(z => z.y < ROWS - 1);
}

// ══════════════════════════════════════════════
//  CANVAS RENDERING ENGINE (60 FPS DRAW)
// ══════════════════════════════════════════════
function drawLoop(timestamp) {
  // Update particles and visual effects at 60 FPS
  updateParticles();
  updateEffects();

  // Decrease recoil nozzle
  recoilAmt = Math.max(0, recoilAmt - 1.2);

  // Render scene
  if (running || over || paused) {
    draw();
  }

  requestAnimationFrame(drawLoop);
}

function draw() {
  if (!ctx) return;

  // 1. Clear Screen
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Draw Grid Cells & Outlines (with optional raid/class tinting)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === ROWS - 2) {
        // Danger row grid cell
        const pulse = 0.18 + Math.sin(Date.now() / 240) * 0.08;
        ctx.fillStyle = `rgba(220, 0, 0, ${pulse})`;
        ctx.fillRect(c * 100, r * 100, 99, 99);
      } else {
        // Standard dark grid cell + optional raid/class color tint
        let cellFill = "rgba(0, 255, 255, 0.015)";
        if (gameMode === 'raid' && raidClass) {
          cellFill = RAID_ZONES[raidClass].gridTint || "rgba(0, 255, 255, 0.015)";
        } else if (activeClass) {
          cellFill = CLASSES[activeClass].color + "0a"; // ~4% opacity hex
        }
        ctx.fillStyle = cellFill;
        ctx.fillRect(c * 100, r * 100, 99, 99);
      }

      // Cell borders - brighter and themed
      let borderCol = "rgba(0, 255, 255, 0.14)";
      if (gameMode === 'raid' && raidClass) {
        borderCol = RAID_ZONES[raidClass].color + "33"; // ~20% opacity hex
      } else if (activeClass) {
        borderCol = CLASSES[activeClass].color + "30"; // ~19% opacity hex
      }
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(c * 100, r * 100, 100, 100);
    }
  }

  // Danger Row glowing indicator line
  const drY = (ROWS - 2) * 100;
  ctx.fillStyle = "rgba(255, 0, 0, 0.6)";
  ctx.fillRect(0, drY + 49, 500, 2);

  // 3. Draw Active Visual Effects Fields (Lava, Grav, BlackHoles)
  // Lava pools
  classPowerState.lavaPools.forEach(pool => {
    const pulse = 0.5 + Math.sin(Date.now() / 150) * 0.15;
    ctx.save();
    ctx.fillStyle = `rgba(255, 109, 0, ${pulse * 0.4})`;
    ctx.shadowColor = "#ff3300";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(pool.col * 100 + 50, pool.row * 100 + 50, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Gravity wells
  classPowerState.gravWells.forEach(well => {
    ctx.save();
    ctx.strokeStyle = "rgba(206, 147, 216, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#ce93d8";
    ctx.shadowBlur = 10;
    const rad = (Date.now() / 5) % 40 + 10;
    ctx.beginPath();
    ctx.arc(well.col * 100 + 50, (ROWS - 3) * 100 + 50, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // Black hole indicators
  if (classPowerState.blackHoleActive) {
    ctx.save();
    const rot = (Date.now() / 240) % (Math.PI * 2);
    ctx.translate(250, (ROWS / 2 - 1) * 100 + 50);
    ctx.rotate(rot);

    // Core accretion disk gradient
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 48);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.4, 'rgba(150, 0, 200, 0.45)');
    grad.addColorStop(1, 'rgba(206, 147, 216, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ce93d8";
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ce93d8";
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw Singularity Rift indicators
  if (classPowerState.riftActive) {
    ctx.save();
    const rot = (Date.now() / 150) % (Math.PI * 2);
    ctx.translate(250, 450); // center of board (col 2, row 4)
    ctx.rotate(rot);

    // Accretion disk
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 80);
    grad.addColorStop(0, '#020205');
    grad.addColorStop(0.3, 'rgba(156, 39, 176, 0.7)');
    grad.addColorStop(0.7, 'rgba(206, 147, 216, 0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ce93d8";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ce93d8";
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Giga-Beam rendering
  if (classPowerState.gigaBeamActive) {
    ctx.save();
    const colX = classPowerState.gigaBeamCol * 100 + 50;
    const alpha = classPowerState.gigaBeamTimer / 1500;
    
    const beamGrad = ctx.createLinearGradient(colX - 45, 0, colX + 45, 0);
    beamGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
    beamGrad.addColorStop(0.3, `rgba(0, 229, 255, ${0.8 * alpha})`);
    beamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
    beamGrad.addColorStop(0.7, `rgba(0, 229, 255, ${0.8 * alpha})`);
    beamGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
    
    ctx.fillStyle = beamGrad;
    ctx.shadowBlur = 30 * alpha;
    ctx.shadowColor = '#00e5ff';
    ctx.fillRect(colX - 45, 0, 90, 1000);
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(colX - 10, 0); ctx.lineTo(colX - 10, 1000);
    ctx.moveTo(colX + 10, 0); ctx.lineTo(colX + 10, 1000);
    ctx.stroke();
    ctx.restore();
  }

  // 3.5 Draw placed Deployables (barricades, sentries, proximity mines)
  deployables.forEach(d => {
    ctx.save();
    const x = d.col * 100 + 50;
    const y = d.row * 100 + 50;
    const isTech = activeClass === 'tech';
    
    if (d.type === 'barricade') {
      ctx.shadowBlur = 10;
      ctx.shadowColor = isTech ? '#00e5ff' : '#666';
      
      const grad = ctx.createLinearGradient(x - 40, y, x + 40, y);
      grad.addColorStop(0, '#2a2a2a');
      grad.addColorStop(0.5, isTech ? '#00e5ff' : '#b0bec5');
      grad.addColorStop(1, '#2a2a2a');
      
      ctx.fillStyle = grad;
      ctx.strokeStyle = isTech ? '#00e5ff' : '#888';
      ctx.lineWidth = 2.5;
      
      ctx.beginPath();
      ctx.roundRect(x - 40, y - 10, 80, 20, 6);
      ctx.fill();
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let offset = -30; offset <= 30; offset += 15) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y - 10);
        ctx.lineTo(x + offset, y + 10);
        ctx.stroke();
      }
    } else if (d.type === 'sentry') {
      const baseGrad = ctx.createRadialGradient(x - 2, y - 2, 2, x, y, 22);
      baseGrad.addColorStop(0, '#555');
      baseGrad.addColorStop(1, '#1a1a1a');
      
      ctx.fillStyle = baseGrad;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00e5ff';
      
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      let targetY = 0;
      let targetZ = zombies.find(z => {
        const zCols = z.cols || [z.col];
        return zCols.includes(d.col) && z.y < d.row && z.y > -1;
      });
      if (targetZ) {
        targetY = targetZ.y * 100 + 50;
      }
      
      ctx.save();
      ctx.translate(x, y);
      let angle = -Math.PI / 2;
      if (targetZ) {
        angle = Math.atan2(targetY - y, 0);
      }
      ctx.rotate(angle);
      
      ctx.fillStyle = '#333';
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-5, -30, 10, 25, 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(0, -30, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
    } else if (d.type === 'mine') {
      const pulse = 0.7 + Math.sin(Date.now() / 120) * 0.3;
      ctx.shadowBlur = 10 * pulse;
      ctx.shadowColor = '#ff6d00';
      
      ctx.fillStyle = '#3a2000';
      ctx.strokeStyle = '#ff6d00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = `rgba(255, 109, 0, ${pulse})`;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    
    if (d.hp < d.maxHp) {
      const pct = Math.max(0, d.hp) / d.maxHp;
      const barW = 32;
      const barH = 3;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#111';
      ctx.fillRect(x - barW / 2, y - 28, barW, barH);
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(x - barW / 2, y - 28, barW * pct, barH);
    }
    ctx.restore();
  });

  // 4. Draw Projectiles & Lasers
  bullets.forEach(b => {
    ctx.save();
    const trailLength = (bulletSpeed * 100) * 1.5;

    let colorCore = "white";
    let colorGlow = "#ffd700";
    if (activeClass === 'fire') colorGlow = "#ff6d00";
    else if (activeClass === 'storm') colorGlow = "#aeea00";
    else if (activeClass === 'cryo') colorGlow = "#80deea";
    else if (activeClass === 'void') colorGlow = "#ce93d8";

    const grad = ctx.createLinearGradient(0, b.y * 100, 0, b.y * 100 + trailLength);
    grad.addColorStop(0, colorCore);
    grad.addColorStop(0.3, colorGlow);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo((b.col + 0.5) * 100, b.y * 100);
    ctx.lineTo((b.col + 0.5) * 100, b.y * 100 + trailLength);
    ctx.stroke();

    // Core tip
    ctx.fillStyle = colorCore;
    ctx.shadowColor = colorGlow;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc((b.col + 0.5) * 100, b.y * 100, 5, 0, Math.PI * 2);
    ctx.fill();

    // Pierce Rings
    const pl = UG[3].lvl;
    if (pl >= 1) {
      ctx.strokeStyle = "rgba(185, 65, 255, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#a000ff";
      ctx.shadowBlur = 4;
      const rad = 8 + (Date.now() / 160) % 6;
      ctx.beginPath();
      ctx.arc((b.col + 0.5) * 100, b.y * 100, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });

  // Ball lightnings
  classPowerState.ballLightnings.forEach(ball => {
    ctx.save();
    const grad = ctx.createRadialGradient(ball.x * 100 + 50, ball.y * 100 + 50, 2, ball.x * 100 + 50, ball.y * 100 + 50, 22);
    grad.addColorStop(0, "white");
    grad.addColorStop(0.4, "#aeea00");
    grad.addColorStop(1, "rgba(174, 234, 0, 0)");

    ctx.fillStyle = grad;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#aeea00";
    ctx.beginPath();
    ctx.arc(ball.x * 100 + 50, ball.y * 100 + 50, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Enemy Bullets
  enemyBullets.forEach(eb => {
    ctx.save();
    ctx.fillStyle = eb.isBoss ? "#ff88ff" : "#ff073a";
    ctx.shadowColor = eb.isBoss ? "#ff00ff" : "#ff073a";
    ctx.shadowBlur = 8;
    const rad = eb.isBoss ? 9 : 6;
    ctx.beginPath();
    ctx.arc((eb.col + 0.5) * 100, eb.y * 100, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 5. Draw Zombies (walking wobble, hit flashes, HP indicators, and statuses)
  zombies.forEach(z => {
    ctx.save();
    const wobble = (z.status === 'frozen' || classPowerState.empStunActive) ? 0 : Math.sin(Date.now() / 140 + z.zId * 10) * 3.5;

    let baseX = z.col * 100 + 50 + wobble;
    let baseY = z.y * 100 + 50;

    if (z.type === "boss") {
      // BOSS GRAPHICS
      baseX = 250 + wobble;
      const enraged = z.enraged;

      // Draw Aura Rings
      ctx.strokeStyle = enraged ? 'rgba(200, 0, 255, 0.25)' : 'rgba(255, 50, 0, 0.25)';
      ctx.lineWidth = enraged ? 3 : 2;
      for (let i = 0; i < 3; i++) {
        const rad = 220 + ((Date.now() / 10 + i * 50) % 80);
        ctx.beginPath();
        ctx.arc(baseX, baseY, rad, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Spikes
      ctx.fillStyle = enraged ? "#cc00ff" : "#ff3300";
      ctx.shadowColor = enraged ? "#cc00ff" : "#ff3300";
      ctx.shadowBlur = 10;
      for (let i = 0; i < 7; i++) {
        const sX = baseX - 210 + i * 70;
        const sY = baseY - 40;
        ctx.beginPath();
        ctx.moveTo(sX - 8, sY);
        ctx.lineTo(sX + 8, sY);
        const sHeight = 15 + Math.sin(Date.now() / 200 + i) * 4;
        ctx.lineTo(sX, sY - sHeight);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Main Armor Body
      const bodyGrad = ctx.createLinearGradient(0, baseY - 40, 0, baseY + 40);
      if (enraged) {
        bodyGrad.addColorStop(0, "#0a0020");
        bodyGrad.addColorStop(0.3, "#200040");
        bodyGrad.addColorStop(1, "#100030");
      } else {
        bodyGrad.addColorStop(0, "#1a0000");
        bodyGrad.addColorStop(0.3, "#3a0000");
        bodyGrad.addColorStop(1, "#0d0000");
      }

      ctx.fillStyle = z.isHit ? "white" : bodyGrad;
      ctx.strokeStyle = enraged ? "#cc00ff" : "#ff2200";
      ctx.lineWidth = 3;
      ctx.shadowColor = enraged ? "#cc00ff" : "#ff2200";
      ctx.shadowBlur = enraged ? 25 : 18;

      ctx.beginPath();
      ctx.roundRect(baseX - 220, baseY - 40, 440, 75, 12);
      ctx.fill();
      ctx.stroke();

      // Armor plate lines
      ctx.strokeStyle = enraged ? "rgba(200, 0, 255, 0.4)" : "rgba(255, 60, 0, 0.4)";
      ctx.lineWidth = 2;
      for (let p = 1; p < 5; p++) {
        const lineX = baseX - 220 + p * 88;
        ctx.beginPath();
        ctx.moveTo(lineX, baseY - 38);
        ctx.lineTo(lineX, baseY + 33);
        ctx.stroke();
      }

      // Draw Eyes (Central cluster)
      const eyePositions = [-70, -35, 0, 35, 70];
      eyePositions.forEach((offX, idx) => {
        const isCenter = idx === 2;
        const eX = baseX + offX;
        const eY = baseY - 2;

        ctx.save();
        ctx.shadowBlur = isCenter ? 20 : 10;
        ctx.shadowColor = enraged ? "#e040ff" : "#ff6600";

        const eyeGrad = ctx.createRadialGradient(eX - 2, eY - 2, 1, eX, eY, isCenter ? 14 : 9);
        if (enraged) {
          eyeGrad.addColorStop(0, "white");
          eyeGrad.addColorStop(0.4, "#cc00ff");
          eyeGrad.addColorStop(1, "#440088");
        } else {
          eyeGrad.addColorStop(0, "white");
          eyeGrad.addColorStop(0.4, "#ff4400");
          eyeGrad.addColorStop(1, "#880000");
        }

        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(eX, eY, isCenter ? 14 : 9, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(eX, eY, isCenter ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

    } else if (z.type === "miniboss") {
      // MINIBOSS GRAPHICS
      z.cols.forEach(col => {
        const mX = col * 100 + 50 + wobble;
        ctx.save();
        ctx.fillStyle = z.isHit ? "white" : "linear-gradient(135deg,#280045,#500088)";
        ctx.strokeStyle = "#cc44ff";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(160,0,255,0.6)";
        ctx.shadowBlur = 10;

        // Draw Core Body
        ctx.beginPath();
        ctx.arc(mX, baseY, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Core Eye
        ctx.fillStyle = "#bb44ff";
        ctx.beginPath();
        ctx.arc(mX, baseY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(mX, baseY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    } else if (z.raidColor) {
      // RAID ZOMBIE — class-themed design
      ctx.save();
      ctx.fillStyle = z.isHit ? "white" : z.raidColor;
      ctx.strokeStyle = z.raidGlow;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = z.raidGlow;
      ctx.shadowBlur = 9;

      // Main body
      ctx.beginPath();
      ctx.arc(baseX, baseY, z.raidRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // White eyes
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 4;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(baseX - 5, baseY - 6, 2.5, 0, Math.PI * 2);
      ctx.arc(baseX + 5, baseY - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // HP bar for tanky raid zombies
      if (z.maxHp > 1) {
        const hpPct = Math.max(0, z.hp) / z.maxHp;
        const barW = 40;
        const barH = 4;
        const bX = baseX - barW / 2;
        const bY = baseY - z.raidRadius - 10;
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#111";
        ctx.fillRect(bX, bY, barW, barH);
        ctx.fillStyle = hpPct > 0.6 ? "#33ff55" : hpPct > 0.3 ? "#ffcc00" : "#ff3300";
        ctx.fillRect(bX, bY, barW * hpPct, barH);
      }

      // Status auras (reused from standard zombie section)
      if (z.status === 'fire') {
        ctx.strokeStyle = "rgba(255, 109, 0, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(baseX, baseY, z.raidRadius + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (z.status === 'frozen' || z.status === 'chill') {
        ctx.strokeStyle = "rgba(128, 222, 234, 0.75)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(baseX, baseY, z.raidRadius + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (z.status === 'voided') {
        ctx.strokeStyle = "rgba(206, 147, 216, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(baseX, baseY, z.raidRadius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

    } else {
      // STANDARD ZOMBIES
      let colorBody = "#4ecdc4";
      let colorGlow = "rgba(78, 205, 196, 0.4)";
      let radius = 22;
      let strokeStyle = "rgba(0,0,0,0.5)";
      let strokeWidth = 2;

      if (z.type === 'fast') {
        colorBody = "#ff0054";
        colorGlow = "rgba(255, 0, 84, 0.4)";
        radius = 18;
      } else if (z.type === 'armored') {
        colorBody = "#f77f00";
        colorGlow = "rgba(247, 127, 0, 0.4)";
        radius = 24;
        strokeStyle = "#ffaa00";
        strokeWidth = 3;
      } else if (z.type === 'heavy') {
        colorBody = "#444444";
        colorGlow = "rgba(160, 160, 170, 0.3)";
        radius = 28;
        strokeStyle = "#888888";
        strokeWidth = 3;
      }

      ctx.save();
      ctx.fillStyle = z.isHit ? "white" : colorBody;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = strokeWidth;
      ctx.shadowColor = colorGlow;
      ctx.shadowBlur = 6;

      // Main Core
      ctx.beginPath();
      ctx.arc(baseX, baseY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eyes
      ctx.fillStyle = "red";
      ctx.shadowColor = "red";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(baseX - 6, baseY - 6, 2.5, 0, Math.PI * 2);
      ctx.arc(baseX + 6, baseY - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Health bars (above normal zombie heads)
      if (z.maxHp > 1) {
        const hpPct = Math.max(0, z.hp) / z.maxHp;
        const barW = 42;
        const barH = 4;
        const bX = baseX - barW / 2;
        const bY = baseY - radius - 10;

        ctx.fillStyle = "#111";
        ctx.fillRect(bX, bY, barW, barH);

        const hpCol = hpPct > 0.6 ? "#33ff55" : hpPct > 0.3 ? "#ffcc00" : "#ff3300";
        ctx.fillStyle = hpCol;
        ctx.fillRect(bX, bY, barW * hpPct, barH);
      }

      // Class status auras
      if (z.status === 'fire') {
        ctx.strokeStyle = "rgba(255, 109, 0, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(baseX, baseY, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (z.status === 'frozen' || z.status === 'chill') {
        ctx.strokeStyle = "rgba(128, 222, 234, 0.75)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(baseX, baseY, radius + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Ice block translucent wrap
        ctx.fillStyle = "rgba(128, 222, 234, 0.25)";
        ctx.fillRect(baseX - radius - 2, baseY - radius - 2, radius * 2 + 4, radius * 2 + 4);
      } else if (z.status === 'voided') {
        ctx.strokeStyle = "rgba(206, 147, 216, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(baseX, baseY, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Clear hits
    z.isHit = false;
    ctx.restore();
  });

  // 6. Draw Spawning flash animations
  activeEffects.forEach(fx => {
    if (fx.type === 'spawnFlash') {
      ctx.save();
      const grad = ctx.createLinearGradient(fx.col * 100, 0, fx.col * 100, 120);
      grad.addColorStop(0, fx.color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.globalAlpha = fx.alpha * 0.45;
      ctx.fillRect(fx.col * 100, 0, 100, 120);
      ctx.restore();
    }
  });

  // 7. Draw Emitters and Debris particles (Silky 60FPS physics updates)
  drawParticles(ctx);

  // 8. Draw Active Floating Text & Lightning effects
  drawEffects(ctx);

  // 9. Draw Turret Graphic (Base, nozzle with recoil, and element badges)
  ctx.save();
  const tX = turretCol * 100 + 50;
  const tY = 950;

  const speedLvl = UG[1].lvl;
  const dmgLvl = UG[2].lvl;
  const pierceLvl = UG[3].lvl;
  const burstLvl = burst;

  // Draw Damage spikes behind the rotator base
  if (dmgLvl >= 1) {
    ctx.save();
    const spikeCount = 2 + dmgLvl * 2;
    const spikeLen = 8 + dmgLvl * 5;
    const baseRadius = 32;

    const startAngle = Math.PI * 0.85;
    const endAngle = Math.PI * 2.15;
    const angleStep = (endAngle - startAngle) / (spikeCount - 1);

    for (let i = 0; i < spikeCount; i++) {
      const angle = startAngle + i * angleStep;
      const tipX = tX + Math.cos(angle) * (baseRadius + spikeLen);
      const tipY = tY + Math.sin(angle) * (baseRadius + spikeLen);
      
      const baseAngleLeft = angle - 0.15;
      const baseAngleRight = angle + 0.15;
      const blX = tX + Math.cos(baseAngleLeft) * baseRadius;
      const blY = tY + Math.sin(baseAngleLeft) * baseRadius;
      const brX = tX + Math.cos(baseAngleRight) * baseRadius;
      const brY = tY + Math.sin(baseAngleRight) * baseRadius;

      ctx.beginPath();
      ctx.moveTo(blX, blY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(brX, brY);
      ctx.closePath();

      const spikeGrad = ctx.createLinearGradient(blX, blY, tipX, tipY);
      spikeGrad.addColorStop(0, "#444");
      spikeGrad.addColorStop(0.5, "#888");
      spikeGrad.addColorStop(1, "#333");
      ctx.fillStyle = spikeGrad;
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw Nozzles/Barrels (recoiling offset, multi-barrel array, golden and plasma effects)
  const nozzleW = burstLvl === 1 ? 18 : 12;
  const nozzleH = 40;
  for (let i = 0; i < burstLvl; i++) {
    const spacing = 16;
    const xOffset = (i - (burstLvl - 1) / 2) * spacing;
    const nozzleX = tX + xOffset;
    const nozzleY = tY - 45 + recoilAmt;

    ctx.save();
    let nozzleGrad;
    if (speedLvl >= 1) {
      nozzleGrad = ctx.createLinearGradient(nozzleX - nozzleW / 2, nozzleY, nozzleX + nozzleW / 2, nozzleY + nozzleH);
      nozzleGrad.addColorStop(0, "#b8860b");
      nozzleGrad.addColorStop(0.3, "#ffd700");
      nozzleGrad.addColorStop(0.7, "#fff2b2");
      nozzleGrad.addColorStop(1, "#b8860b");
    } else {
      nozzleGrad = ctx.createLinearGradient(nozzleX - nozzleW / 2, nozzleY, nozzleX + nozzleW / 2, nozzleY + nozzleH);
      nozzleGrad.addColorStop(0, "#444");
      nozzleGrad.addColorStop(0.5, "#222");
      nozzleGrad.addColorStop(1, "#111");
    }

    ctx.fillStyle = nozzleGrad;
    ctx.strokeStyle = speedLvl >= 1 ? "#ffd700" : "#666";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(nozzleX - nozzleW / 2, nozzleY, nozzleW, nozzleH, 3);
    ctx.fill();
    ctx.stroke();

    // Glowing cyan plasma ring at the tip of each nozzle if speed level >= 4
    if (speedLvl >= 4) {
      ctx.save();
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#00ffff";
      ctx.beginPath();
      ctx.ellipse(nozzleX, nozzleY, nozzleW * 0.6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Draw Turret Base (rotator)
  const turretGrad = ctx.createRadialGradient(tX - 4, tY - 4, 4, tX, tY, 32);
  turretGrad.addColorStop(0, "#555");
  turretGrad.addColorStop(0.7, "#1c1c1c");
  turretGrad.addColorStop(1, "#0a0a0a");

  ctx.fillStyle = turretGrad;
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(tX, tY, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner Core (glowing class Badge color)
  let coreCol = "#ffd700";
  let coreShadow = "rgba(255, 215, 0, 0.7)";
  if (activeClass === 'fire') { coreCol = "#ff6d00"; coreShadow = "rgba(255, 109, 0, 0.8)"; }
  else if (activeClass === 'storm') { coreCol = "#aeea00"; coreShadow = "rgba(174, 234, 0, 0.8)"; }
  else if (activeClass === 'cryo') { coreCol = "#80deea"; coreShadow = "rgba(128, 222, 234, 0.8)"; }
  else if (activeClass === 'void') { coreCol = "#ce93d8"; coreShadow = "rgba(206, 147, 216, 0.8)"; }
  else if (activeClass === 'tech') { coreCol = "#00e5ff"; coreShadow = "rgba(0, 229, 255, 0.8)"; }

  ctx.save();
  ctx.fillStyle = coreCol;
  ctx.shadowColor = coreShadow;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(tX, tY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw Holographic Pierce accelerator rings (on top of base and nozzle assembly)
  if (pierceLvl >= 1) {
    ctx.save();
    const assemblyWidth = (burstLvl - 1) * 16 + nozzleW;
    const rx = assemblyWidth / 2 + 6;
    const ry = 6;
    const ringY = tY - 22; // positioned vertically on nozzle

    ctx.strokeStyle = "rgba(170, 68, 255, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#aa44ff";
    ctx.shadowBlur = 10;
    
    const dashOffset = -Date.now() / 20;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = dashOffset;

    ctx.beginPath();
    ctx.ellipse(tX, ringY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (pierceLvl >= 3) {
      ctx.strokeStyle = "rgba(0, 255, 255, 0.7)";
      ctx.shadowColor = "#00ffff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 10]);
      ctx.lineDashOffset = -dashOffset * 1.5;
      ctx.beginPath();
      ctx.ellipse(tX, ringY, rx + 4, ry + 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // Draw companion drone
  if (activeClass === 'tech' && getClassFx('tech').nanoDrone) {
    ctx.save();
    const droneX = tX + Math.sin(Date.now() / 200) * 35;
    const droneY = tY - 65 + Math.cos(Date.now() / 200) * 10;
    
    ctx.translate(droneX, droneY);
    
    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00e5ff';
    
    ctx.beginPath();
    ctx.ellipse(-15, 0, 8, 3, Math.PI/6, 0, Math.PI*2);
    ctx.ellipse(15, 0, 8, 3, -Math.PI/6, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  // 10. Draw Holographic scanline sweep
  ctx.save();
  const scanY = (Date.now() / 6) % 1000;
  const sGrad = ctx.createLinearGradient(0, scanY - 5, 0, scanY + 5);
  sGrad.addColorStop(0, "rgba(0, 255, 255, 0)");
  sGrad.addColorStop(0.5, "rgba(0, 255, 255, 0.25)");
  sGrad.addColorStop(1, "rgba(0, 255, 255, 0)");
  ctx.fillStyle = sGrad;
  ctx.fillRect(0, scanY - 5, 500, 10);

  // Core scan laser line
  ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
  ctx.fillRect(0, scanY - 0.5, 500, 1);
  ctx.restore();
}

function drawEffects(ctx) {
  activeEffects.forEach(fx => {
    ctx.save();
    ctx.globalAlpha = fx.alpha;

    if (fx.type === 'ring') {
      ctx.strokeStyle = fx.color;
      ctx.shadowColor = fx.shadowColor;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(fx.col * 100 + 50, fx.y * 100 + 50, fx.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === 'zap') {
      ctx.strokeStyle = "#aeea00";
      ctx.shadowColor = "#aeea00";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
    } else if (fx.type === 'text') {
      ctx.fillStyle = fx.color;
      ctx.shadowColor = fx.color;
      ctx.shadowBlur = 5;
      ctx.font = "bold 13px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(fx.text, fx.x, fx.y);
    }
    ctx.restore();
  });
}

function drawCD() {
  const bar = document.getElementById("cooldownBar");
  bar.innerHTML = "";
  const fc = frCls();

  for (let i = 0; i < burst; i++) {
    const seg = document.createElement("div");
    seg.className = "cseg";
    const fill = document.createElement("div");
    fill.className = "cfill" + (fc ? " " + fc : "");

    if (!coolingDown) {
      fill.style.width = i < burstLeft ? "100%" : "0%";
    } else {
      const per = shootCooldown / burst;
      const el = (Date.now() - cooldownStart) + cooldownPauseAcc;
      fill.style.width = Math.min(100, Math.max(0, (el - i * per) / per * 100)) + "%";
    }
    seg.appendChild(fill);
    bar.appendChild(seg);
  }
}

function frCls() {
  const l = UG[0].lvl;
  return l >= 6 ? "fr6" : l >= 5 ? "fr5" : l >= 4 ? "fr4" : l >= 3 ? "fr3" : l >= 2 ? "fr2" : l >= 1 ? "fr1" : "";
}

// ======================================================
//  CLASS POWER HUD
// ======================================================
function makeRing(pct, cls) {
  const r = 6, circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return `<div class="cp-ring-wrap">
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle class="cp-ring-bg" cx="8" cy="8" r="${r}"/>
      <circle class="cp-ring-arc cp-${cls}" cx="8" cy="8" r="${r}"
        stroke-dasharray="${circ.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"/>
    </svg>
    <div class="cp-ring-num">${Math.ceil(pct * 100) > 0 && pct < 1 ? Math.ceil(pct * 100) : ''}</div>
  </div>`;
}

function chip(cls, icon, label, extraHTML, isActive) {
  const activeClass2 = isActive ? ' cp-active' : '';
  return `<div class="cp-chip cp-${cls}${activeClass2}">${icon} <span class="cp-label">${label}</span>${extraHTML}</div>`;
}

function updateClassPowerHUD() {
  const hud = document.getElementById('classPowerHUD');
  if (!hud) return;

  if (!activeClass || !running) {
    hud.style.display = 'none';
    return;
  }

  const fx = getClassFx(activeClass);
  const cls = activeClass;
  const lvl = persistent.classLvls[cls] || 0;
  if (lvl === 0) { hud.style.display = 'none'; return; }

  hud.style.display = 'flex';
  let html = '';

  if (cls === 'fire') {
    // Ignite: always active passive — show active burn count
    if (fx.ignite) {
      const burnCount = zombies.filter(z => z.status === 'fire').length;
      html += chip(cls, '🔥', 'IGNITE', `<span class="cp-value">${burnCount > 0 ? burnCount + '🔥' : '—'}</span>`, burnCount > 0);
    }
    // Spread Fire: passive, lights up if any zombie is on fire
    if (fx.spreadFire) {
      const spreading = zombies.some(z => z.status === 'fire');
      html += chip(cls, '🌊', 'SPREAD', `<span class="cp-value">${spreading ? '✓' : '—'}</span>`, spreading);
    }
    // Lava Pool: show active pool count
    if (fx.lavaPool) {
      const pools = classPowerState.lavaPools.length;
      html += chip(cls, '🌋', 'LAVA', `<span class="cp-value">${pools > 0 ? pools : '—'}</span>`, pools > 0);
    }
    // Napalm: shot counter ring (every 5th shot)
    if (fx.napalm) {
      const progress = (shotCounter % 5) / 5;
      const next = 5 - (shotCounter % 5);
      html += chip(cls, '💥', 'NAPALM', makeRing(progress, cls) + `<span class="cp-value">${next}</span>`, false);
    }
    // Nova: passive chance, show count
    if (fx.nova) {
      html += chip(cls, '☀️', 'NOVA', `<span class="cp-value">30%</span>`, false);
    }
  }

  if (cls === 'storm') {
    // Chain Arc: passive, always active
    if (fx.chain) {
      html += chip(cls, '⚡', fx.doubleArc ? 'ARC×2' : 'ARC', `<span class="cp-value">✓</span>`, true);
    }
    // EMP: shot counter ring (every 8th shot), or active stun
    if (fx.emp) {
      const stunActive = classPowerState.empStunActive;
      const progress = stunActive ? (classPowerState.empStunTimer / 1500) : ((shotCounter % 8) / 8);
      const label = stunActive ? 'EMP ⚡' : 'EMP';
      const next = stunActive ? '⚡' : (8 - (shotCounter % 8)).toString();
      html += chip(cls, '🌩', label, makeRing(progress, cls) + `<span class="cp-value">${next}</span>`, stunActive);
    }
    // Plasma Field: passive aura, always active
    if (fx.plasmaField) {
      html += chip(cls, '🔋', 'PLASMA', `<span class="cp-value">✓</span>`, true);
    }
    // Ball Lightning: shot counter ring (every 12th shot)
    if (fx.ballLightning) {
      const progress = (shotCounter % 12) / 12;
      const next = 12 - (shotCounter % 12);
      html += chip(cls, '🔵', 'BALL', makeRing(progress, cls) + `<span class="cp-value">${next}</span>`, classPowerState.ballLightnings.length > 0);
    }
  }

  if (cls === 'cryo') {
    // Chill: passive, show count of slowed zombies
    if (fx.chill) {
      const chillCount = classPowerState.chillStacks.size;
      html += chip(cls, '❄️', 'CHILL', `<span class="cp-value">${chillCount > 0 ? chillCount : '—'}</span>`, chillCount > 0);
    }
    // Deep Freeze: show frozen count
    if (fx.deepFreeze) {
      const frozenCount = classPowerState.frozenZombies.size;
      html += chip(cls, '🧊', 'FROZEN', `<span class="cp-value">${frozenCount > 0 ? frozenCount : '—'}</span>`, frozenCount > 0);
    }
    // Shatter: passive on frozen kill
    if (fx.shatter) {
      html += chip(cls, '💎', 'SHATTER', `<span class="cp-value">✓</span>`, true);
    }
    // Frost Aura: passive
    if (fx.frostAura) {
      html += chip(cls, '🌀', 'AURA', `<span class="cp-value">✓</span>`, true);
    }
    // Blizzard: shot counter (every 15th) or active timer
    if (fx.blizzard) {
      const blizActive = classPowerState.blizzardActive;
      const progress = blizActive ? (classPowerState.blizzardTimer / 2000) : ((shotCounter % 15) / 15);
      const next = blizActive ? '❄️' : (15 - (shotCounter % 15)).toString();
      html += chip(cls, '🌨', blizActive ? 'BLIZZ!' : 'BLIZZ', makeRing(progress, cls) + `<span class="cp-value">${next}</span>`, blizActive);
    }
  }

  if (cls === 'void') {
    // Warp Pull: passive
    if (fx.warpPull) {
      html += chip(cls, '🌀', 'WARP', `<span class="cp-value">✓</span>`, true);
    }
    // Gravity Well: show active well count
    if (fx.gravWell) {
      const wells = classPowerState.gravWells.length;
      html += chip(cls, '🕳', 'GRAV', `<span class="cp-value">${wells > 0 ? wells : '—'}</span>`, wells > 0);
    }
    // Time Dilation: shot counter (every 10th) or active
    if (fx.timeDilation) {
      const dilActive = classPowerState.dilationActive;
      const progress = dilActive ? (classPowerState.dilationTimer / 3000) : ((shotCounter % 10) / 10);
      const next = dilActive ? '⏱' : (10 - (shotCounter % 10)).toString();
      html += chip(cls, '⏱', dilActive ? 'DILA!' : 'DILA', makeRing(progress, cls) + `<span class="cp-value">${next}</span>`, dilActive);
    }
    // Singularity: passive 15% chance
    if (fx.singularity) {
      html += chip(cls, '🕳', 'SINGUL', `<span class="cp-value">15%</span>`, false);
    }
    // Black Hole: shot counter (every 20th) or active
    if (fx.blackHole) {
      const bhActive = classPowerState.blackHoleActive;
      const progress = bhActive ? (classPowerState.blackHoleTimer / 5000) : ((shotCounter % 20) / 20);
      const next = bhActive ? '⚫' : (20 - (shotCounter % 20)).toString();
      html += chip(cls, '⚫', bhActive ? 'BHOLE!' : 'BHOLE', makeRing(progress, cls) + `<span class="cp-value">${next}</span>`, bhActive);
    }
  }

  hud.innerHTML = html;
}

// ══════════════════════════════════════════════
//  SHOP MANAGER
// ══════════════════════════════════════════════
function openShop() {
  paused = true;
  spawningEnabled = false;
  if (coolingDown) cooldownPauseAcc += Date.now() - cooldownStart;
  document.getElementById("upgradeOverlay").style.display = "flex";
  switchTab(currentTab);
}

function closeShop() {
  document.getElementById("upgradeOverlay").style.display = "none";
  const closeBtn = document.getElementById('shopCloseBtn');
  if (closeBtn) closeBtn.textContent = '← BACK TO BATTLE';
  if (!running && gameMode === 'menu') {
    // Opened from class manager on main menu
    showMainMenu();
    return;
  }
  paused = false;
  if (!bossAlive && !minibossAlive) spawningEnabled = true;
  if (coolingDown) cooldownStart = Date.now();
  nextSpawnTime = Date.now() + spawnDelay;
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById("tabBasic").classList.toggle("active", tab === 'basic');
  document.getElementById("tabClass").classList.toggle("active", tab === 'class');
  document.getElementById("tabUtility").classList.toggle("active", tab === 'utility');
  document.getElementById("basicSection").style.display = tab === 'basic' ? "block" : "none";
  document.getElementById("classSection").style.display = tab === 'class' ? "block" : "none";
  document.getElementById("utilitySection").style.display = tab === 'utility' ? "block" : "none";
  if (tab === 'basic') refreshBasicUG();
  else if (tab === 'class') refreshClassSection();
  else if (tab === 'utility') refreshUtilitySection();
}

function refreshUtilitySection() {
  const list = document.getElementById("utilityList");
  if (!list) return;
  list.innerHTML = "";

  const items = [
    { key: 'barricade', name: '🚧 Barricade', cost: { iron: 15 }, desc: 'Blocks zombie movement. HP: 20 (base)' },
    { key: 'sentry', name: '🤖 Sentry Gun', cost: { iron: 25, steel: 10 }, desc: 'Fires laser bullets in its column. HP: 10 (base), 1.2s cd' },
    { key: 'mine', name: '💣 Proximity Mine', cost: { iron: 10, steel: 5 }, desc: 'Detonates on contact, dealing 12 area damage. HP: 1' }
  ];

  items.forEach(item => {
    const currentQty = utilityInventory[item.key] || 0;
    const isMax = currentQty >= 3;
    const canAfford = isMax || canAffordUpgrade(item.cost);
    
    const row = document.createElement("div");
    row.className = "uRow";

    const acc = document.createElement("div");
    acc.className = "uAccent";
    acc.style.background = item.key === 'barricade' ? '#00e5ff' : item.key === 'sentry' ? '#00ff88' : '#ff6d00';
    row.appendChild(acc);

    const info = document.createElement("div");
    info.className = "uInfo";
    info.innerHTML = `
      <div class="uName">${item.name}</div>
      <div class="uDesc">${item.desc}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
        ${fmtScrapCost(item.cost)}
        <span style="font-size:10px;font-family:var(--mono);color:#aaa;">Carry: ${currentQty}/3</span>
      </div>
    `;
    row.appendChild(info);

    const btn = document.createElement("button");
    btn.className = "bbtn";
    if (!canAfford && !isMax) btn.classList.add("no-afford");
    btn.innerHTML = isMax ? "✓ MAX" : "BUY";
    btn.disabled = isMax || !canAfford;
    btn.onclick = () => {
      sndBuy();
      spendScrap(item.cost);
      utilityInventory[item.key] = (utilityInventory[item.key] || 0) + 1;
      updateUtilityHUD();
      refreshUtilitySection();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function fmtScrapCost(cost) {
  const icons = { iron: '🔩', steel: '🔷', titan: '💠', coreMini: '💜', coreBoss: '❤️' };
  const labels = { iron: 'iron', steel: 'steel', titan: 'titan', coreMini: 'core-m', coreBoss: 'core-b' };
  return `<div class="scrap-cost">${Object.entries(cost).map(([k, v]) => `<span class="sc-tag ${labels[k]}">${icons[k]} ${v}</span>`).join('')}</div>`;
}

function canAffordUpgrade(cost) {
  const all = getAllResources();
  return Object.entries(cost).every(([k, v]) => (all[k] || 0) >= v);
}

function refreshBasicUG() {
  const list = document.getElementById("upgradeList");
  list.innerHTML = "";
  UG.forEach(u => {
    const mx = u.lvl >= u.vals.length;
    const cost = mx ? null : u.costs[u.lvl];
    const canAfford = mx || canAffordUpgrade(cost);
    const row = document.createElement("div");
    row.className = "uRow";

    const acc = document.createElement("div");
    acc.className = "uAccent";
    acc.style.background = u.accent;
    row.appendChild(acc);

    let pips = "";
    for (let i = 0; i < u.vals.length; i++) {
      pips += `<div class="pip ${i < u.lvl ? 'on' : ''}"></div>`;
    }

    const info = document.createElement("div");
    info.className = "uInfo";
    info.innerHTML = `<div class="uName">${u.name}</div><div class="uDesc">${u.desc(u.lvl)}</div><div class="pips">${pips}</div>${!mx ? fmtScrapCost(cost) : ''}`;
    row.appendChild(info);

    const btn = document.createElement("button");
    btn.className = "bbtn";
    if (!canAfford && !mx) btn.classList.add("no-afford");
    btn.innerHTML = mx ? "✓ MAX" : "BUY";
    btn.disabled = mx || !canAfford;
    btn.onclick = () => {
      sndBuy();
      spendScrap(cost);
      u.apply(u.vals[u.lvl]);
      u.lvl++;
      refreshBasicUG();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function refreshClassSection() {
  if (activeClass) {
    showClassUpgrades();
  } else {
    showClassPick();
  }
}

function showClassPick() {
  document.getElementById("classPickSection").style.display = "block";
  document.getElementById("classUpgradeSection").style.display = "none";
  const cards = document.getElementById("classCards");
  cards.innerHTML = "";

  Object.entries(CLASSES).forEach(([key, cls]) => {
    const isUnlocked = persistent.unlockedClasses.includes(key); // already paid for
    const canAfford  = canUnlockClass(key);                      // has resources to unlock now
    const isSelected = activeClass === key;
    const card = document.createElement("div");

    const reqStr    = Object.entries(cls.req).map(([k, v]) => `${getResourceIcon(k)}×${v}`).join(" ");
    const altReqStr = cls.altReq ? Object.entries(cls.altReq).map(([k, v]) => `${getResourceIcon(k)}×${v}`).join(" ") : "";
    const reqLabel  = altReqStr ? `${reqStr} or ${altReqStr}` : reqStr;

    const accessible = isUnlocked || canAfford || isSelected;
    card.className = `class-card ${key}${!accessible ? " locked" : ""}${isSelected ? " selected" : ""}`;

    let statusLabel = "";
    if (isSelected)   statusLabel = `<div style="font-size:9px;color:var(--gold);margin-top:4px;font-family:var(--mono);">✓ ACTIVE — click to manage</div>`;
    else if (isUnlocked) statusLabel = `<div style="font-size:9px;color:#88ff88;margin-top:4px;font-family:var(--mono);">✅ UNLOCKED — click to activate</div>`;
    else if (canAfford)  statusLabel = `<div style="font-size:9px;color:#ffcc44;margin-top:4px;font-family:var(--mono);">🔓 AFFORDABLE — click to unlock</div>`;
    else                 statusLabel = `<div class="class-locked-msg">⚠ Need ${reqLabel} to unlock</div>`;

    card.innerHTML = `
      <div class="class-card-header">
        <div class="class-name" style="color:${cls.color};">${cls.name}</div>
        <div class="class-req">${reqLabel}</div>
      </div>
      <div class="class-desc">${cls.desc}</div>
      ${statusLabel}`;

    if (accessible) {
      card.onclick = () => {
        if (!isSelected) {
          if (!isUnlocked) {
            // Not yet unlocked — verify affordability at click time and spend resources
            if (!canUnlockClass(key)) {
              alert("You can no longer afford this class. Check your resources.");
              showClassPick();
              return;
            }
            if (activeClass) {
              if (!confirm("Switch class? You'll lose current class upgrades.")) return;
              persistent.classLvls = { fire: 0, storm: 0, cryo: 0, void: 0 };
              persistent.activeClass = null;
              saveProgress();
            }
            spendClassUnlock(key); // spends resources AND records in unlockedClasses
          } else {
            // Already unlocked — switching to it is free (cores already spent)
            if (activeClass && activeClass !== key) {
              if (!confirm("Switch class? You'll lose current class upgrades.")) return;
              persistent.classLvls = { fire: 0, storm: 0, cryo: 0, void: 0 };
              persistent.activeClass = null;
              saveProgress();
            }
          }
          activeClass = key;
          persistent.activeClass = key;
          saveProgress();
          updateBoardBorder();
          updateClassBadge();
          sndClassPower(key);
        }
        showClassUpgrades();
      };
    }
    cards.appendChild(card);
  });
}

function showClassUpgrades() {
  document.getElementById("classPickSection").style.display = "none";
  document.getElementById("classUpgradeSection").style.display = "block";
  if (!activeClass) {
    showClassPick();
    return;
  }

  const cls = CLASSES[activeClass];
  document.getElementById("classHeader").innerHTML = `<div style="font-size:12px;font-weight:700;color:${cls.color};">${cls.name} — Upgrade Tree</div><div style="font-size:10px;opacity:0.55;margin-top:2px;font-family:var(--mono);">Each upgrade unlocks new powers</div>`;
  const list = document.getElementById("classUpgradeList");
  list.innerHTML = "";
  const lvl = persistent.classLvls[activeClass] || 0;

  cls.upgrades.forEach((u, i) => {
    const unlocked = i < lvl;
    const isNext = i === lvl;
    const locked = i > lvl;
    const canBuy = isNext && canAffordUpgrade(u.cost);
    const row = document.createElement("div");
    row.className = "uRow";
    row.style.opacity = locked ? "0.4" : "1";
    if (unlocked) row.style.borderColor = cls.color;

    const acc = document.createElement("div");
    acc.className = "uAccent";
    acc.style.background = unlocked ? cls.color : locked ? "#333" : "#555";
    row.appendChild(acc);

    const info = document.createElement("div");
    info.className = "uInfo";
    info.innerHTML = `<div class="uName" style="${unlocked ? `color:${cls.color}` : 'color:#999'}">${unlocked ? '✓ ' : isNext ? '→ ' : '🔒 '}${u.name}</div>
      <div class="uDesc">${u.desc}</div>
      <div class="uDesc" style="font-style:italic;color:${cls.color}80;">${u.flavor}</div>
      ${!unlocked && !locked ? fmtScrapCost(u.cost) : ''}`;
    row.appendChild(info);

    const btn = document.createElement("button");
    btn.className = `bbtn class-bbtn-${activeClass}`;
    btn.innerHTML = unlocked ? "✓ HAVE" : locked ? "🔒" : "BUY";
    btn.disabled = unlocked || locked || !canBuy;
    if (!canBuy && !unlocked && !locked) btn.classList.add("no-afford");
    btn.onclick = () => {
      sndBuy();
      spendScrap(u.cost);
      persistent.classLvls[activeClass]++;
      saveProgress();
      sndClassPower(activeClass);
      showWaveTxt(u.name + " UNLOCKED!");
      showClassUpgrades();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

// ══════════════════════════════════════════════
//  SETTINGS DIALOG MANAGER
// ══════════════════════════════════════════════
function openSettings() {
  // Only pause/affect game state when called during active battle
  if (gameMode !== 'menu') {
    paused = true;
    spawningEnabled = false;
    if (coolingDown) cooldownPauseAcc += Date.now() - cooldownStart;
  }
  document.getElementById("settingsOverlay").style.display = "flex";

  // Update back button label based on context
  const closeBtn = document.getElementById("settingsCloseBtn");
  if (closeBtn) {
    closeBtn.textContent = gameMode === 'menu' ? '← BACK TO MENU' : '← BACK TO BATTLE';
  }

  document.getElementById("sfxToggle").checked = sfxEnabled;
  document.getElementById("sfxVolumeSlider").value = sfxVolume;
  document.getElementById("sfxVolVal").textContent = Math.round(sfxVolume * 100) + "%";

  document.getElementById("musicToggle").checked = !musicMuted;
  document.getElementById("musicVolumeSlider").value = musicVolume;
  document.getElementById("musicVolVal").textContent = Math.round(musicVolume * 100) + "%";

  setControlsMode(controlsMode);
}

function closeSettings() {
  document.getElementById("settingsOverlay").style.display = "none";
  // Only resume game state if we're in a battle
  if (gameMode !== 'menu') {
    paused = false;
    if (!bossAlive && !minibossAlive) spawningEnabled = true;
    if (coolingDown) cooldownStart = Date.now();
    nextSpawnTime = Date.now() + spawnDelay;
  }
}

function openHowToPlay() {
  if (gameMode !== 'menu') {
    paused = true;
    spawningEnabled = false;
    if (coolingDown) cooldownPauseAcc += Date.now() - cooldownStart;
  }
  document.getElementById("howToPlayOverlay").classList.add("show");
}

function closeHowToPlay() {
  document.getElementById("howToPlayOverlay").classList.remove("show");
  if (gameMode !== 'menu') {
    paused = false;
    if (!bossAlive && !minibossAlive) spawningEnabled = true;
    if (coolingDown) cooldownStart = Date.now();
    nextSpawnTime = Date.now() + spawnDelay;
  }
}

function setControlsMode(mode) {
  controlsMode = mode;
  const controlsEl = document.getElementById("controls");
  if (mode === 'pc') {
    controlsEl.style.display = 'none';
  } else {
    controlsEl.style.display = 'grid';
  }

  const pcBtn = document.getElementById("modePCBtn");
  const mobBtn = document.getElementById("modeMobileBtn");

  if (mode === 'pc') {
    pcBtn.style.background = 'linear-gradient(135deg, var(--gold), #cc9900)';
    pcBtn.style.color = 'black';
    pcBtn.style.borderColor = 'var(--gold)';
    mobBtn.style.background = 'linear-gradient(135deg, #2a2a2a, #111)';
    mobBtn.style.color = 'white';
    mobBtn.style.borderColor = '#444';
  } else {
    mobBtn.style.background = 'linear-gradient(135deg, var(--gold), #cc9900)';
    mobBtn.style.color = 'black';
    mobBtn.style.borderColor = 'var(--gold)';
    pcBtn.style.background = 'linear-gradient(135deg, #2a2a2a, #111)';
    pcBtn.style.color = 'white';
    pcBtn.style.borderColor = '#444';
  }
}

// ══════════════════════════════════════════════
//  END GAME TERMINATION
// ══════════════════════════════════════════════
function endGame() {
  const isNewRecord = gameMode === 'endless' && wave > (persistent.endlessBestWave || 0);
  if (isNewRecord) {
    persistent.endlessBestWave = wave;
    saveProgress();
  }

  if (exitTimerActive) {
    exitTimerActive = false;
    document.getElementById('exitCountdownIndicator').style.display = 'none';
  }

  const mutIndicator = document.getElementById("mutatorIndicator");
  if (mutIndicator) mutIndicator.style.display = "none";

  // Died! Secures 25% resources and resets checkpoint wave below (if standard/raid)
  resolveRunResources(0.25, false);

  stopMusic();
  running = false;
  over = true;
  spawningEnabled = false;
  paused = false;
  document.getElementById("board").className = "";
  document.getElementById("gameOver").style.display = "flex";

  const modeLabel = (gameMode === 'raid' && raidClass)
    ? `🎯 ${RAID_ZONES[raidClass].name}`
    : gameMode === 'endless'
      ? '🏆 Endless Mode'
      : '⚔ Standard Battle';
  const shardInfo = (gameMode === 'raid' && raidClass)
    ? `<br>${CLASS_SHARDS[raidClass].icon} ${CLASS_SHARDS[raidClass].label} Earned: <strong>+${runGathered[CLASS_SHARDS[raidClass].key] || 0}</strong> this run`
    : '';
  const recordTxt = isNewRecord 
    ? `<br><span style="color:var(--gold);font-weight:bold;">🎉 NEW PERSONAL BEST RECORD!</span>`
    : gameMode === 'endless'
      ? `<br><small style="opacity:0.65;">Endless Best: Wave ${persistent.endlessBestWave}</small>`
      : '';

  document.getElementById("finalScore").innerHTML = `<strong>📊 Final Stats</strong><br><small style="opacity:0.6">${modeLabel}</small>${recordTxt}<br><br>
    👾 Kills: <strong>${kills}</strong><br>
    🌊 Ended on Wave: <strong>${wave}</strong><br>
    ${gameMode !== 'endless' ? `💾 Wave Reset To: <strong>Wave ${lastRunSavedWaveNum}</strong><br>` : ''}
    ⚡ Max Combo: <strong>${combo}x</strong>${shardInfo}<br>
    ${activeClass ? `⚔ Class: ${CLASSES[activeClass].name} (Lvl ${persistent.classLvls[activeClass] || 0})` : ''}
    ${lastRunKeptResourcesHTML}`;
}

// ══════════════════════════════════════════════
//  INPUT BINDINGS & KEYBOARD EVENT LISTENERS
// ══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (!running || paused) return;
  switch (e.key.toLowerCase()) {
    case 'arrowleft':
    case 'a':
      move(-1);
      break;
    case 'arrowright':
    case 'd':
      move(1);
      break;
    case ' ':
    case 'enter':
      e.preventDefault();
      shoot();
      break;
    case 'r':
      reload();
      break;
    case 'q':
      toggleUtility();
      break;
    case 'e':
      deployActiveUtility();
      break;
    case 'b':
    case 'p':
      openShop();
      break;
  }
});

// ══════════════════════════════════════════════
//  MAIN MENU & MODE NAVIGATION
// ══════════════════════════════════════════════
function showMainMenu() {
  gameMode = 'menu';
  running = false;
  over = false;
  spawningEnabled = false;
  paused = false;
  // If returning from a raid, clear the raid-assigned class.
  // Standard battle class (set in shop) is preserved in persistent.activeClass.
  if (gameMode === 'raid') {
    activeClass = persistent.activeClass; // restore standard class if any
  }
  updateBoardBorder();
  updateClassBadge();
  updateMainMenuResources();
  document.getElementById('mainMenu').style.display = 'flex';
  document.getElementById('gameOver').style.display = 'none';
  if (!musicMuted) {
    startMusic('menu');
  } else {
    currentMusicTheme = 'menu';
  }
}

function updateMainMenuResources() {
  const menu = document.getElementById('mainMenu');
  if (!menu || menu.style.display === 'none') return;
  Object.keys(CLASS_SHARDS).forEach(cls => {
    const sh = CLASS_SHARDS[cls];
    const el = document.getElementById(`menu-shard-${cls}`);
    if (el) el.textContent = `${sh.icon} ${persistent[sh.key]} ${sh.label}`;
  });
  const mini = document.getElementById('mm-core-mini');
  if (mini) mini.textContent = `⚙️ ${persistent.metalCore} Metal Core${persistent.metalCore !== 1 ? 's' : ''}`;
  
  const endlessBest = document.getElementById('mm-endless-best');
  if (endlessBest) {
    if (persistent.endlessBestWave > 0) {
      endlessBest.textContent = `🏆 Endless Record: Wave ${persistent.endlessBestWave}`;
      endlessBest.style.display = 'inline-block';
    } else {
      endlessBest.style.display = 'none';
    }
  }
}

function startStandardGame() {
  gameMode = 'standard';
  raidClass = null;
  document.getElementById('mainMenu').style.display = 'none';
  resetGame();
}

function startEndlessGame() {
  gameMode = 'endless';
  raidClass = null;
  document.getElementById('mainMenu').style.display = 'none';
  resetGame();
}

function startRaid(cls) {
  gameMode = 'raid';
  raidClass = cls;
  document.getElementById('mainMenu').style.display = 'none';
  resetGame();
  updateBoardBorder();
  updateClassBadge();
}

function goToMainMenu() {
  if (running && !over) {
    showExitConfirmation();
  } else {
    performMainMenuExit();
  }
}

function performMainMenuExit() {
  stopMusic();
  running = false;
  over = false;
  spawningEnabled = false;
  paused = false;
  exitTimerActive = false;
  document.getElementById('exitCountdownIndicator').style.display = 'none';
  zombies = [];
  bullets = [];
  enemyBullets = [];
  activeEffects = [];
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('bossBarContainer').style.display = 'none';
  document.getElementById('minibossBarContainer').style.display = 'none';
  showMainMenu();
}

function showExitConfirmation() {
  paused = true;
  if (coolingDown) cooldownPauseAcc += Date.now() - cooldownStart;
  
  const overlay = document.getElementById('exitConfirmOverlay');
  const titleEl = document.getElementById('exitConfirmTitle');
  const textEl = document.getElementById('exitConfirmText');
  const yesBtn = document.getElementById('exitConfirmYesBtn');

  // Emergency exit!
  const resetWave = Math.max(1, Math.floor((wave - 1) / 5) * 5 + 1);
  titleEl.textContent = "⚠️ EMERGENCY EXIT";
  titleEl.style.color = "#ff4444";
  textEl.innerHTML = `You are on <strong>Wave ${wave}</strong>.<br><br>To exit, you must survive a <strong>3-second countdown</strong>.<br><br>If you survive, you keep <strong>50%</strong> of gathered resources, and wave progress resets to <strong>Wave ${resetWave}</strong>.`;
  yesBtn.textContent = "START ESCAPE COUNTDOWN";
  yesBtn.style.background = "linear-gradient(135deg,#ff3300,#b30000)";
  yesBtn.style.borderColor = "#ff5533";
  yesBtn.onclick = () => {
    overlay.style.display = 'none';
    startExitCountdown();
  };

  overlay.style.display = 'flex';
}

function startExitCountdown() {
  exitTimerActive = true;
  exitTimerTime = 3000;
  document.getElementById('exitCountdownIndicator').style.display = 'block';
  document.getElementById('exitCountdownTime').textContent = '3.0';

  // Resume game for the countdown duration
  paused = false;
  if (coolingDown) cooldownStart = Date.now();
  nextSpawnTime = Date.now() + spawnDelay;
}

function cancelExit() {
  document.getElementById('exitConfirmOverlay').style.display = 'none';
  
  // Resume game
  paused = false;
  if (coolingDown) cooldownStart = Date.now();
  nextSpawnTime = Date.now() + spawnDelay;
}

function resolveRunResources(multiplier, saveWaveProgress) {
  // 1. Credit resources to persistent stash
  let creditedTxt = [];
  Object.entries(runGathered).forEach(([k, gathered]) => {
    if (gathered > 0) {
      const credited = Math.floor(gathered * multiplier);
      persistent[k] = (persistent[k] || 0) + credited;
      if (credited > 0) {
        creditedTxt.push(`${getResourceIcon(k)} ${getResourceLabel(k)}: +${credited} <small style="opacity:0.65;">(from ${gathered})</small>`);
      }
    }
  });

  // Make credited text HTML
  const keptResourcesHTML = creditedTxt.length > 0 
    ? `<div style="text-align:left; background:rgba(0,0,0,0.4); border:1px solid #333; border-radius:8px; padding:8px; font-size:11px; margin-top:8px; font-family:var(--mono);">
         <div style="color:var(--gold); font-weight:bold; margin-bottom:4px;">📦 SECURED RESOURCES (${Math.round(multiplier * 100)}%):</div>
         ${creditedTxt.map(t => `<div style="margin-bottom:2px;">${t}</div>`).join('')}
       </div>`
    : `<div style="font-size:11px; color:#888; margin-top:8px;">No resources secured this run.</div>`;

  lastRunKeptResourcesHTML = keptResourcesHTML;

  // 2. Resolve wave progression
  let savedWaveNum = wave;
  if (saveWaveProgress) {
    if (gameMode === 'standard') {
      persistent.savedWave = wave;
      savedWaveNum = wave;
    } else if (gameMode === 'raid' && raidClass) {
      persistent.savedRaidWaves = persistent.savedRaidWaves || {};
      persistent.savedRaidWaves[raidClass] = wave;
      savedWaveNum = wave;
    }
  } else {
    const resetWave = Math.max(1, Math.floor((wave - 1) / 5) * 5 + 1);
    if (gameMode === 'standard') {
      persistent.savedWave = resetWave;
      savedWaveNum = resetWave;
    } else if (gameMode === 'raid' && raidClass) {
      persistent.savedRaidWaves = persistent.savedRaidWaves || {};
      persistent.savedRaidWaves[raidClass] = resetWave;
      savedWaveNum = resetWave;
    }
  }

  lastRunSavedWaveNum = savedWaveNum;

  // 3. Save to localStorage
  saveProgress();
}

function showCheckpointChoices() {
  paused = true;

  const overlay = document.getElementById('checkpointOverlay');
  const textEl = document.getElementById('checkpointText');
  const saveBtn = document.getElementById('checkpointSaveBtn');
  const continueBtn = document.getElementById('checkpointContinueBtn');

  // Summarize current runGathered resources in HTML
  let gatheredList = [];
  Object.entries(runGathered).forEach(([k, gathered]) => {
    if (gathered > 0) {
      gatheredList.push(`${getResourceIcon(k)} ${getResourceLabel(k)}: ${gathered}`);
    }
  });

  const gatheredHTML = gatheredList.length > 0
    ? `<div style="text-align:left; background:rgba(0,0,0,0.4); border:1px solid #333; border-radius:8px; padding:8px; font-size:11px; margin-top:8px; font-family:var(--mono);">
         <div style="color:var(--gold); font-weight:bold; margin-bottom:4px;">📦 ACCUMULATED RESOURCES:</div>
         ${gatheredList.map(t => `<div style="margin-bottom:2px;">${t}</div>`).join('')}
       </div>`
    : `<div style="font-size:11px; color:#888; margin-top:8px;">No resources gathered yet.</div>`;

  textEl.innerHTML = `You completed **Wave ${wave - 1}**!<br><br>
    Choose your path:<br>
    - **SECURE & HOME**: Secures **100%** of accumulated resources and exit safely to main menu.<br>
    - **1.5x & CONTINUE**: Multiplies current accumulated resources by **1.5x** and proceeds to **Wave ${wave}**. (Caution: If you die later, you only secure 25% of them!)<br>
    ${gatheredHTML}`;

  saveBtn.onclick = () => {
    overlay.style.display = 'none';
    resolveRunResources(1.0, true);
    performMainMenuExit();
  };

  continueBtn.onclick = () => {
    overlay.style.display = 'none';
    // Multiply resources by 1.5x
    Object.keys(runGathered).forEach(k => {
      runGathered[k] = Math.floor(runGathered[k] * 1.5);
    });
    updateScrapBar();
    paused = false;
    if (coolingDown) cooldownStart = Date.now();
    nextSpawnTime = Date.now() + spawnDelay;
    spawningEnabled = true;
  };

  overlay.style.display = 'flex';
}

function openClassManager() {
  // Open the shop on the class tab so user can spend shards from main menu
  paused = false;
  document.getElementById('mainMenu').style.display = 'none';
  // Ensure game state is minimal
  if (!running) {
    // Stub minimal state so shop can render
    scrap = { iron: 0, steel: 0, titan: 0 };
  }
  document.getElementById('upgradeOverlay').style.display = 'flex';
  switchTab('class');
  // Override close button text
  const closeBtn = document.getElementById('shopCloseBtn');
  if (closeBtn) {
    closeBtn.textContent = '← BACK TO MENU';
    closeBtn.setAttribute('data-from-menu', '1');
  }
}

function closeShopFromMenu() {
  document.getElementById('upgradeOverlay').style.display = 'none';
  showMainMenu();
}

// ══════════════════════════════════════════════
//  CLASS & RESOURCE HELPERS
// ══════════════════════════════════════════════
function canUnlockClass(key) {
  const cls = CLASSES[key];
  return canAffordUpgrade(cls.req) || (cls.altReq && canAffordUpgrade(cls.altReq));
}

function spendClassUnlock(key) {
  const cls = CLASSES[key];
  if (cls.altReq && canAffordUpgrade(cls.altReq)) {
    spendScrap(cls.altReq);
  } else {
    spendScrap(cls.req);
  }
  // Record this class as officially unlocked
  if (!persistent.unlockedClasses.includes(key)) {
    persistent.unlockedClasses.push(key);
  }
}

function getResourceIcon(key) {
  const icons = {
    iron: '🔩', steel: '🔷', titan: '💠', metalCore: '⚙️',
    fireShard: '🔥', stormShard: '⚡', cryoShard: '❄️', voidShard: '🌀',
    fireCoreBroken: '💜🔥', stormCoreBroken: '💜⚡', cryoCoreBroken: '💜❄️', voidCoreBroken: '💜🌀',
    fireCore: '❤️🔥', stormCore: '❤️⚡', cryoCore: '❤️❄️', voidCore: '❤️🌀'
  };
  return icons[key] || '❓';
}

function getResourceLabel(key) {
  const labels = {
    iron: 'Iron', steel: 'Steel', titan: 'Titanium', metalCore: 'Metal Core',
    fireShard: 'Embers', stormShard: 'Sparks', cryoShard: 'Crystals', voidShard: 'Void Dust',
    fireCoreBroken: 'Broken Fire Core', stormCoreBroken: 'Broken Storm Core', cryoCoreBroken: 'Broken Cryo Core', voidCoreBroken: 'Broken Void Core',
    fireCore: 'Fire Core', stormCore: 'Storm Core', cryoCore: 'Cryo Core', voidCore: 'Void Core'
  };
  return labels[key] || key;
}

// ══════════════════════════════════════════════
//  INVENTORY & MENU UPGRADE SYSTEM
// ══════════════════════════════════════════════
function openInventory() {
  document.getElementById('inventoryOverlay').style.display = 'flex';
  document.getElementById('mainMenu').style.display = 'none';
  refreshInventory();
}

function closeInventory() {
  document.getElementById('inventoryOverlay').style.display = 'none';
  showMainMenu();
}

function refreshInventory() {
  const all = getAllResources();

  // 1. Update Base Materials display
  document.getElementById('inv-iron').textContent = all.iron;
  document.getElementById('inv-steel').textContent = all.steel;
  document.getElementById('inv-titan').textContent = all.titan;
  document.getElementById('inv-metal-core').textContent = all.metalCore;

  // 2. Update Class Currencies
  // Fire
  document.getElementById('inv-shard-fire').textContent = `🔥 ${all.fireShard}`;
  document.getElementById('inv-broken-fire').textContent = `💜 ${all.fireCoreBroken}`;
  document.getElementById('inv-full-fire').textContent = `❤️ ${all.fireCore}`;
  // Storm
  document.getElementById('inv-shard-storm').textContent = `⚡ ${all.stormShard}`;
  document.getElementById('inv-broken-storm').textContent = `💜 ${all.stormCoreBroken}`;
  document.getElementById('inv-full-storm').textContent = `❤️ ${all.stormCore}`;
  // Cryo
  document.getElementById('inv-shard-cryo').textContent = `❄️ ${all.cryoShard}`;
  document.getElementById('inv-broken-cryo').textContent = `💜 ${all.cryoCoreBroken}`;
  document.getElementById('inv-full-cryo').textContent = `❤️ ${all.cryoCore}`;
  // Void
  document.getElementById('inv-shard-void').textContent = `🌀 ${all.voidShard}`;
  document.getElementById('inv-broken-void').textContent = `💜 ${all.voidCoreBroken}`;
  document.getElementById('inv-full-void').textContent = `❤️ ${all.voidCore}`;

  // 3. Render Permanent Upgrades
  const list = document.getElementById("invUpgradeList");
  list.innerHTML = "";
  
  UG.forEach((u, i) => {
    const mx = u.lvl >= u.costs.length;
    const cost = mx ? null : u.costs[u.lvl];
    const canAfford = mx || canAffordUpgrade(cost);
    const row = document.createElement("div");
    row.className = "uRow";

    const acc = document.createElement("div");
    acc.className = "uAccent";
    acc.style.background = u.accent;
    row.appendChild(acc);

    let pips = "";
    for (let j = 0; j < u.vals.length; j++) {
      pips += `<div class="pip ${j < u.lvl ? 'on' : ''}"></div>`;
    }

    const info = document.createElement("div");
    info.className = "uInfo";
    info.innerHTML = `
      <div class="uName">${u.name}</div>
      <div class="uDesc">${u.desc(u.lvl)}</div>
      <div class="pips" style="margin-bottom: 4px;">${pips}</div>
      ${!mx ? fmtScrapCost(cost) : ''}
    `;
    row.appendChild(info);

    const btn = document.createElement("button");
    btn.className = "bbtn";
    if (!canAfford && !mx) btn.classList.add("no-afford");
    btn.innerHTML = mx ? "✓ MAX" : "BUY";
    btn.disabled = mx || !canAfford;
    btn.onclick = () => {
      sndBuy();
      spendScrap(cost);
      
      // Update the level inside UG
      u.lvl++;
      // Sync to persistent object
      persistent.ugLvls[i] = u.lvl;
      // Save to localStorage
      saveProgress();
      
      // Apply the upgrade effects (so it updates in-game variables if needed)
      u.apply(u.vals[u.lvl - 1]);
      
      // Refresh inventory display
      refreshInventory();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

// ══════════════════════════════════════════════
//  PERSISTENCE (localStorage)
// ══════════════════════════════════════════════
function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(persistent));
  } catch (e) { /* ignore quota errors */ }
}

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data) return;
    // Scrap (now persistent)
    persistent.iron  = data.iron   || 0;
    persistent.steel = data.steel  || 0;
    persistent.titan = data.titan  || 0;
    scrap.iron   = persistent.iron;
    scrap.steel  = persistent.steel;
    scrap.titan  = persistent.titan;
    // Standard drops
    persistent.metalCore      = data.metalCore      || 0;
    // Class shards
    persistent.fireShard      = data.fireShard      || 0;
    persistent.stormShard     = data.stormShard     || 0;
    persistent.cryoShard      = data.cryoShard      || 0;
    persistent.voidShard      = data.voidShard      || 0;
    persistent.techShard      = data.techShard      || 0;
    // Broken class cores (raid miniboss)
    persistent.fireCoreBroken  = data.fireCoreBroken  || 0;
    persistent.stormCoreBroken = data.stormCoreBroken || 0;
    persistent.cryoCoreBroken  = data.cryoCoreBroken  || 0;
    persistent.voidCoreBroken  = data.voidCoreBroken  || 0;
    persistent.techCoreBroken  = data.techCoreBroken  || 0;
    // Full class cores (raid boss)
    persistent.fireCore  = data.fireCore  || 0;
    persistent.stormCore = data.stormCore || 0;
    persistent.cryoCore  = data.cryoCore  || 0;
    persistent.voidCore  = data.voidCore  || 0;
    persistent.techCore  = data.techCore  || 0;
    // UG levels
    if (Array.isArray(data.ugLvls)) {
      persistent.ugLvls = data.ugLvls.map((v, i) => v || 0);
      UG.forEach((u, i) => { u.lvl = persistent.ugLvls[i] || 0; });
    }
    // Class levels
    if (data.classLvls) {
      persistent.classLvls = { ...persistent.classLvls, ...data.classLvls };
    }
    // Saved waves checkpoints
    persistent.savedWave = data.savedWave || 1;
    if (data.savedRaidWaves) {
      persistent.savedRaidWaves = { ...persistent.savedRaidWaves, ...data.savedRaidWaves };
    }
    // Endless personal record
    persistent.endlessBestWave = data.endlessBestWave || 0;
    // Restore unlocked classes list
    if (Array.isArray(data.unlockedClasses)) {
      persistent.unlockedClasses = data.unlockedClasses.filter(k => Object.keys(CLASSES).includes(k));
    }
    // Restore chosen standard class
    const validClasses = Object.keys(CLASSES);
    if (data.activeClass && validClasses.includes(data.activeClass)) {
      persistent.activeClass = data.activeClass;
      activeClass = data.activeClass;
    } else {
      persistent.activeClass = null;
      activeClass = null;
    }
  } catch (e) { /* ignore parse errors */ }
}

// Setup 20 FPS game tick loop for physics and updates
const gLoop = setInterval(() => {
  if (running && !over) {
    update();
  }
}, LOOP);

window.addEventListener('beforeunload', () => {
  clearInterval(gLoop);
});

// Initialize game
initGame();
