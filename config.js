// ══════════════════════════════════════════════
//  GAME CONFIGURATION & CONSTANTS
// ══════════════════════════════════════════════
const COLS = 5;
const ROWS = 10;
const LOOP = 50; // 20 FPS Logic update rate (ms)

const killsPerWave = () => Math.floor(5 + wave * 4);

// Basic Upgrade definitions
// Costs use persistent scrap (iron/steel/titan) + metalCore for final tiers
const UG = [
  {
    name: "🔥 Fire Rate", accent: "#ff6600",
    desc: l => ["2.0s", "1.6s", "1.2s", "0.8s", "0.5s", "0.3s", "0.10s"][l] + " cd",
    costs: [
      { iron: 8 },
      { iron: 20, steel: 5 },
      { iron: 40, steel: 15 },
      { steel: 30, titan: 5 },
      { steel: 60, titan: 20 },
      { metalCore: 1, titan: 20 }
    ],
    vals: [1600, 1200, 800, 500, 300, 150, 100], lvl: 0,
    apply: v => { shootCooldown = v; }
  },
  {
    name: "💨 Bullet Speed", accent: "#00ccff",
    desc: l => ["Base", "Fast", "Faster", "Rapid", "Hyper", "Instant"][l],
    costs: [
      { iron: 5 },
      { iron: 15, steel: 3 },
      { steel: 12 },
      { steel: 30, titan: 3 },
      { metalCore: 1 }
    ],
    vals: [0.8, 1.2, 1.7, 2.3, 3.0], lvl: 0,
    apply: v => { bulletSpeed = v; }
  },
  {
    name: "💥 Damage", accent: "#ff073a",
    desc: l => ["1", "2", "3", "4", "6", "10"][l] + " dmg",
    costs: [
      { iron: 15 },
      { iron: 30, steel: 8 },
      { steel: 25 },
      { steel: 50, titan: 8 },
      { metalCore: 2, titan: 15 }
    ],
    vals: [2, 3, 4, 6, 10], lvl: 0,
    apply: v => { bulletDamage = v; }
  },
  {
    name: "🔮 Pierce", accent: "#aa44ff",
    desc: l => ["No pierce", "Thru 1", "Thru 2", "Thru 3", "Thru ALL"][l],
    costs: [
      { iron: 25, steel: 5 },
      { steel: 25, titan: 5 },
      { titan: 25 },
      { metalCore: 2 }
    ],
    vals: [1, 2, 3, 99], lvl: 0,
    apply: v => { bulletPierce = v; }
  },
  {
    name: "📦 Burst Ammo", accent: "#44dd88",
    desc: l => ["1", "2", "3", "4", "5"][l] + " shots",
    costs: [
      { iron: 12, steel: 4 },
      { steel: 25, titan: 5 },
      { titan: 20 },
      { metalCore: 2 }
    ],
    vals: [2, 3, 4, 5], lvl: 0,
    apply: v => { burst = v; burstLeft = v; coolingDown = false; }
  },
  {
    name: "🔄 Knockback", accent: "#88aaff",
    desc: l => ["No KB", "Light", "Medium", "Heavy", "Massive"][l],
    costs: [
      { iron: 15, steel: 8 },
      { steel: 35 },
      { titan: 15 },
      { metalCore: 1, titan: 20 }
    ],
    vals: [0.2, 0.5, 0.8, 1.2], lvl: 0,
    apply: v => { knockback = v; }
  },
];

// ══════════════════════════════════════════════
//  CLASS SHARD CURRENCIES (earned in raids, persistent)
// ══════════════════════════════════════════════
const CLASS_SHARDS = {
  fire:  { key: 'fireShard',   icon: '🔥', label: 'Embers',    color: '#ff6d00' },
  storm: { key: 'stormShard',  icon: '⚡', label: 'Sparks',    color: '#aeea00' },
  cryo:  { key: 'cryoShard',   icon: '❄️', label: 'Crystals',  color: '#80deea' },
  void:  { key: 'voidShard',   icon: '🌀', label: 'Void Dust', color: '#ce93d8' },
  tech:  { key: 'techShard',   icon: '💾', label: 'Data Chips', color: '#00e5ff' },
};

// Per-class cores (raid drops) — used for class unlocking + top upgrade tiers
// Broken Core: from raid miniboss  |  Full Core: from raid boss
const CLASS_CORES = {
  fire:  {
    brokenKey: 'fireCoreBroken',  brokenIcon: '💜🔥', brokenLabel: 'Broken Fire Core',
    fullKey:   'fireCore',        fullIcon:   '❤️🔥', fullLabel:   'Fire Core',
  },
  storm: {
    brokenKey: 'stormCoreBroken', brokenIcon: '💜⚡', brokenLabel: 'Broken Storm Core',
    fullKey:   'stormCore',       fullIcon:   '❤️⚡', fullLabel:   'Storm Core',
  },
  cryo:  {
    brokenKey: 'cryoCoreBroken',  brokenIcon: '💜❄️', brokenLabel: 'Broken Cryo Core',
    fullKey:   'cryoCore',        fullIcon:   '❤️❄️', fullLabel:   'Cryo Core',
  },
  void:  {
    brokenKey: 'voidCoreBroken',  brokenIcon: '💜🌀', brokenLabel: 'Broken Void Core',
    fullKey:   'voidCore',        fullIcon:   '❤️🌀', fullLabel:   'Void Core',
  },
  tech:  {
    brokenKey: 'techCoreBroken',  brokenIcon: '💜💾', brokenLabel: 'Broken Tech Core',
    fullKey:   'techCore',        fullIcon:   '❤️💾', fullLabel:   'Tech Core',
  },
};

// ══════════════════════════════════════════════
//  RAID ZONE DEFINITIONS
// ══════════════════════════════════════════════
const RAID_ZONES = {
  fire: {
    name: '🔥 Inferno Raid',
    desc: 'Battle through the volcanic hellscape. Earn Embers + Fire Cores to power Inferno.',
    bossName: '☀️ THE PHOENIX TYRANT',
    minibossName: '🔥 Ember Colossus',
    color: '#ff6d00', glow: 'rgba(255,109,0,0.3)',
    gridTint: 'rgba(255,60,0,0.09)',
    zombies: [
      { type: 'flame_imp',    label: 'Flame Imp',    hp: 1, speed: 0.070, color: '#ff5500', glow: 'rgba(255,85,0,0.55)',    radius: 17, dropWeight: 3 },
      { type: 'ash_knight',   label: 'Ash Knight',   hp: 3, speed: 0.048, color: '#ff8800', glow: 'rgba(255,136,0,0.45)',   radius: 22, dropWeight: 2 },
      { type: 'cinder_brute', label: 'Cinder Brute', hp: 7, speed: 0.022, color: '#cc2200', glow: 'rgba(204,34,0,0.45)',    radius: 27, dropWeight: 1 },
    ],
  },
  storm: {
    name: '⚡ Storm Raid',
    desc: 'Survive the electrified skies. Earn Sparks + Storm Cores to power Storm.',
    bossName: '🌪️ THE TEMPEST GOD',
    minibossName: '⚡ Arc Leviathan',
    color: '#aeea00', glow: 'rgba(174,234,0,0.25)',
    gridTint: 'rgba(174,234,0,0.07)',
    zombies: [
      { type: 'thunder_sprite', label: 'Thunder Sprite', hp: 1, speed: 0.082, color: '#ccff00', glow: 'rgba(200,255,0,0.55)',  radius: 16, dropWeight: 3 },
      { type: 'shock_knight',   label: 'Shock Knight',   hp: 5, speed: 0.033, color: '#7cb900', glow: 'rgba(124,185,0,0.45)',  radius: 23, dropWeight: 2 },
      { type: 'storm_titan',    label: 'Storm Titan',    hp: 9, speed: 0.018, color: '#3a5c00', glow: 'rgba(58,92,0,0.40)',    radius: 29, dropWeight: 1 },
    ],
  },
  cryo: {
    name: '❄️ Cryo Raid',
    desc: 'Push through the frozen tundra. Earn Crystals + Cryo Cores to power Cryo.',
    bossName: '🧊 THE ABSOLUTE ZERO',
    minibossName: '❄️ Glacier Behemoth',
    color: '#80deea', glow: 'rgba(128,222,234,0.25)',
    gridTint: 'rgba(128,222,234,0.07)',
    zombies: [
      { type: 'frost_lurker',     label: 'Frost Lurker',     hp: 1, speed: 0.063, color: '#b2ebf2', glow: 'rgba(178,235,242,0.50)', radius: 17, dropWeight: 3 },
      { type: 'blizzard_specter', label: 'Blizzard Specter', hp: 2, speed: 0.088, color: '#4dd0e1', glow: 'rgba(77,208,225,0.50)',  radius: 20, dropWeight: 2 },
      { type: 'ice_golem',        label: 'Ice Golem',        hp: 8, speed: 0.020, color: '#0097a7', glow: 'rgba(0,151,167,0.45)',   radius: 29, dropWeight: 1 },
    ],
  },
  void: {
    name: '🌀 Void Raid',
    desc: 'Enter the space between realities. Earn Void Dust + Void Cores to power Void.',
    bossName: '⚫ THE VOID SOVEREIGN',
    minibossName: '🌀 The Singularity',
    color: '#ce93d8', glow: 'rgba(206,147,216,0.3)',
    gridTint: 'rgba(206,147,216,0.08)',
    zombies: [
      { type: 'void_shade',    label: 'Void Shade',        hp: 1,  speed: 0.068, color: '#e1bee7', glow: 'rgba(225,190,231,0.50)', radius: 17, dropWeight: 3 },
      { type: 'reality_eater', label: 'Reality Eater',     hp: 5,  speed: 0.030, color: '#9c27b0', glow: 'rgba(156,39,176,0.45)',  radius: 23, dropWeight: 2 },
      { type: 'dark_matter',   label: 'Dark Matter Titan', hp: 10, speed: 0.015, color: '#4a148c', glow: 'rgba(74,20,140,0.40)',   radius: 29, dropWeight: 1 },
    ],
  },
  tech: {
    name: '🏭 Tech Factory Raid',
    desc: 'Survive in the automated cybernetic plant. Earn Data Chips + Tech Cores to power Tech.',
    bossName: '🦾 THE NEXUS OVERLORD',
    minibossName: '🤖 Mech Sentinel',
    color: '#00e5ff', glow: 'rgba(0, 229, 255, 0.25)',
    gridTint: 'rgba(0, 229, 255, 0.08)',
    zombies: [
      { type: 'cyber_drone', label: 'Cyber Drone', hp: 1, speed: 0.080, color: '#00e5ff', glow: 'rgba(0, 229, 255, 0.55)', radius: 16, dropWeight: 3 },
      { type: 'mech_zombie', label: 'Mech Zombie', hp: 4, speed: 0.045, color: '#00b3cc', glow: 'rgba(0, 179, 204, 0.45)', radius: 22, dropWeight: 2 },
      { type: 'rust_hulk',   label: 'Rust Hulk',   hp: 8, speed: 0.020, color: '#007799', glow: 'rgba(0, 119, 153, 0.45)', radius: 28, dropWeight: 1 },
    ],
  },
};

// ══════════════════════════════════════════════
//  CLASSES — upgrade costs now use class-specific core keys
// ══════════════════════════════════════════════
const CLASSES = {
  fire: {
    name: "🔥 Inferno", color: "#ff6d00", glow: "rgba(255,109,0,0.3)",
    // Unlock: 3 Broken Fire Cores OR 1 Fire Core (checked via canUnlockClass)
    req: { fireCoreBroken: 3 }, altReq: { fireCore: 1 },
    desc: "Bullets ignite zombies. Upgrades add spreading flames, lava puddles, and catastrophic explosions.",
    upgrades: [
      { name: "🔥 Ignite",       desc: "Bullets set zombies on fire — deal 1 dmg/sec for 3s",                              cost: { fireShard: 12 },                   effect: "ignite",     flavor: "A touch of flame on every shot."           },
      { name: "🔥 Spread Fire",  desc: "Burning zombies ignite adjacent zombies in same column",                            cost: { fireShard: 30 },                   effect: "spreadFire", flavor: "One torch lights many."                    },
      { name: "🌋 Lava Pool",    desc: "Slain zombies leave a burning puddle for 4s — damages anything walking over it",   cost: { fireShard: 55, fireCoreBroken: 1 }, effect: "lavaPool",   flavor: "The ground itself becomes your weapon."    },
      { name: "💥 Napalm Round", desc: "Every 5th bullet explodes on impact — deals 3x damage to all in column",           cost: { fireShard: 85, fireCoreBroken: 2 }, effect: "napalm",     flavor: "One shot, five victims."                   },
      { name: "☀️ Inferno Nova", desc: "On kill, 30% chance to trigger a column-wide firestorm dealing 8 dmg to all",      cost: { fireShard: 140, fireCore: 1 },     effect: "nova",       flavor: "The sun has nothing on you."               },
      { name: "🔥 Inferno Cataclysm", desc: "Every 25th shot rains fireballs in all columns, leaving lava pools",          cost: { fireShard: 220, fireCore: 2 },     effect: "cataclysm",  flavor: "Unleash volcanic hell upon the horde."     },
    ]
  },
  storm: {
    name: "⚡ Storm", color: "#aeea00", glow: "rgba(174,234,0,0.25)",
    req: { stormCoreBroken: 3 }, altReq: { stormCore: 1 },
    desc: "Bullets chain lightning between nearby zombies. Escalates into EMP blasts and ball lightning.",
    upgrades: [
      { name: "⚡ Chain Arc",       desc: "On hit, lightning chains to 1 other zombie in adjacent column",                  cost: { stormShard: 12 },                    effect: "chain",        flavor: "Electricity finds the path of least resistance." },
      { name: "⚡ Double Arc",      desc: "Chains to 2 zombies instead of 1",                                               cost: { stormShard: 28 },                    effect: "doubleArc",    flavor: "The arc grows wider."                            },
      { name: "🌩 EMP Burst",      desc: "Every 8th shot stuns all on-screen zombies for 1.5s",                             cost: { stormShard: 50, stormCoreBroken: 1 },effect: "emp",          flavor: "The whole horde short-circuits."                 },
      { name: "🌩 Plasma Field",   desc: "Turret emits a passive aura — zombies entering bottom 2 rows take 1 dmg/sec",    cost: { stormShard: 78, stormCoreBroken: 2 },effect: "plasmaField",  flavor: "The air crackles with danger."                   },
      { name: "🔵 Ball Lightning", desc: "Every 12th shot spawns a bouncing orb — travels full board width dealing 5 dmg", cost: { stormShard: 130, stormCore: 1 },     effect: "ballLightning",flavor: "Nature's deadliest pinball."                      },
      { name: "⚡ Storm Overload",  desc: "Every 22nd shot unleashes a chain-lightning storm arcing to 8 zombies, stuns 2s",cost: { stormShard: 200, stormCore: 2 },     effect: "overload",     flavor: "The sky answers your call."                      },
    ]
  },
  cryo: {
    name: "❄️ Cryo", color: "#80deea", glow: "rgba(128,222,234,0.25)",
    req: { cryoCoreBroken: 3 }, altReq: { cryoCore: 1 },
    desc: "Bullets slow zombies on contact. Upgrades freeze solid, shatter for bonus damage, and blizzard the whole board.",
    upgrades: [
      { name: "❄️ Chill",       desc: "Bullets reduce zombie speed by 30% for 2s",                                         cost: { cryoShard: 12 },                   effect: "chill",      flavor: "A cold shoulder, every shot."          },
      { name: "🧊 Deep Freeze", desc: "Chill stacks — 3 hits freeze zombie solid for 2s (paused, takes 2x damage)",        cost: { cryoShard: 30 },                   effect: "deepFreeze", flavor: "Still as a statue. Just as fragile."   },
      { name: "💎 Shatter",     desc: "Killing a frozen zombie shatters it — deals 6 dmg to all in same column",            cost: { cryoShard: 55, cryoCoreBroken: 1 },effect: "shatter",    flavor: "Cold death, explosive consequences."   },
      { name: "❄️ Frost Aura",  desc: "Zombies within 2 rows of turret are permanently 20% slowed",                        cost: { cryoShard: 80, cryoCoreBroken: 2 },effect: "frostAura",  flavor: "Your presence alone chills the horde." },
      { name: "🌨 Blizzard",    desc: "Every 15th shot triggers a 2s blizzard — all zombies slowed 80% and take 1 dmg/sec",cost: { cryoShard: 130, cryoCore: 1 },     effect: "blizzard",   flavor: "A winter of your own making."          },
      { name: "❄️ Glacier Collapse", desc: "Every 25th shot freezes all zombies and shatters frozen ones for 20 dmg",      cost: { cryoShard: 210, cryoCore: 2 },     effect: "glacierCollapse", flavor: "An absolute freeze, followed by absolute destruction." },
    ]
  },
  void: {
    name: "🌀 Void", color: "#ce93d8", glow: "rgba(206,147,216,0.3)",
    req: { voidCoreBroken: 3 }, altReq: { voidCore: 1 },
    desc: "Bullets warp reality. Pull zombies off course, distort time, and eventually rip open a black hole.",
    upgrades: [
      { name: "🌀 Warp Pull",      desc: "Bullets knock zombies back AND pull nearby zombies toward impact column",          cost: { voidShard: 15 },                   effect: "warpPull",    flavor: "Gravity bends at your command."         },
      { name: "🌀 Gravity Well",   desc: "Slain zombies create a 3s gravity well — pulls all nearby zombies back 1.5 rows", cost: { voidShard: 35 },                   effect: "gravWell",    flavor: "Even death serves the void."            },
      { name: "⏱ Time Dilation",  desc: "Every 10th shot slows ALL zombies to 10% speed for 3s",                           cost: { voidShard: 60, voidCoreBroken: 1 }, effect: "timeDilation",flavor: "The horde moves like molasses."          },
      { name: "🕳 Singularity",   desc: "On kill, 15% chance to implode zombie — sucks in all others in 2 cols, 10 dmg",   cost: { voidShard: 95, voidCoreBroken: 2 }, effect: "singularity", flavor: "Everything collapses inward."            },
      { name: "⚫ Black Hole",    desc: "Every 20th shot summons a black hole for 5s — traps all zombies, 3 dmg/sec",       cost: { voidShard: 150, voidCore: 1 },     effect: "blackHole",   flavor: "Not even light escapes. Nor will they." },
      { name: "🌀 Singularity Rift", desc: "Every 28th shot summons a gravity rift in center row for 6s — pulls and 6 dmg/s",cost: { voidShard: 230, voidCore: 2 },     effect: "rift",        flavor: "Reality bends, then breaks."            },
    ]
  },
  tech: {
    name: "🛠️ Tech", color: "#00e5ff", glow: "rgba(0, 229, 255, 0.25)",
    req: { techCoreBroken: 3 }, altReq: { techCore: 1 },
    desc: "Harness cybernetic machinery. Deploy barriers, summon companion drones, repair fortifications, and sweep columns with a giant Giga-Beam.",
    upgrades: [
      { name: "🔋 Plasma Pulse",       desc: "Bullets deal +1 damage and have a 25% chance to shock adjacent zombies (deals 1 dmg)",    cost: { techShard: 12 },                      effect: "plasmaPulse", flavor: "Charged bullets crackling with cyber-energy." },
      { name: "🛸 Nano-Drone",         desc: "Summon a floating companion drone that automatically shoots lasers at the nearest zombie", cost: { techShard: 30 },                      effect: "nanoDrone",   flavor: "A robotic eye keeping watch." },
      { name: "🚧 Tesla Spikes",       desc: "Placed Barricades have +50% HP and shock zombies attacking them for 1 dmg/sec",            cost: { techShard: 55, techCoreBroken: 1 },  effect: "teslaSpikes", flavor: "Don't touch the electric fence." },
      { name: "🤖 Overclocked Sentry", desc: "Placed Sentries fire 50% faster and gain +1 pierce",                                      cost: { techShard: 85, techCoreBroken: 2 },  effect: "overclock",   flavor: "Max speed mechanical support." },
      { name: "🛡️ Nano-Repair Pulse",  desc: "Every 8 seconds, automatically heals all placed barricades/sentries for 30% of max HP",   cost: { techShard: 140, techCore: 1 },        effect: "repairPulse", flavor: "Self-healing structures keep the wall up." },
      { name: "🦾 Giga-Beam",          desc: "Every 20th shot fires a giant laser beam sweeping all columns, vaporizing small enemies",  cost: { techShard: 220, techCore: 2 },        effect: "gigaBeam",    flavor: "Total robotic obliteration." }
    ]
  }
};
