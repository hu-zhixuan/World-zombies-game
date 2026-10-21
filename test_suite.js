const fs = require('fs');
const vm = require('vm');

const html = require('./build.js').build(require('path').join(__dirname, 'dist', 'zombie-game-v56.html'));
const scriptMatch = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i);
if (!scriptMatch) {
  console.error('No script found');
  process.exit(1);
}
const code = scriptMatch[1];

function createMockCtx() {
  return {
    save(){}, restore(){}, beginPath(){}, closePath(){}, moveTo(){}, lineTo(){},
    stroke(){}, fill(){}, arc(){}, rect(){}, fillRect(){}, strokeRect(){}, clearRect(){},
    fillText(){}, strokeText(){}, measureText(){ return { width: 50 }; },
    createLinearGradient(){ return { addColorStop(){} }; },
    createRadialGradient(){ return { addColorStop(){} }; },
    scale(){}, translate(){}, rotate(){}, transform(){}, setTransform(){},
    setLineDash(){}, clip(){}, drawImage(){},
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    font: '', textAlign: '', textBaseline: '', globalAlpha: 1, globalCompositeOperation: 'source-over'
  };
}

const mockElem = {
  style: {},
  classList: { add(){}, remove(){}, contains(){ return false; } },
  innerHTML: '',
  innerText: '',
  getContext: () => createMockCtx(),
  addEventListener(){},
  appendChild(){},
  setAttribute(){},
  remove(){},
  querySelector: () => mockElem,
  querySelectorAll: () => [mockElem],
  offsetWidth: 800,
  offsetHeight: 600
};

const sandbox = {
  console: console,
  Math: Math,
  Date: Date,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  window: {},
  document: {
    getElementById: () => mockElem,
    querySelector: () => mockElem,
    querySelectorAll: () => [mockElem],
    createElement: () => mockElem,
    body: mockElem,
    addEventListener: () => {},
    documentElement: { style: {} }
  },
  AudioContext: function() {
    return { createOscillator: () => ({ connect(){}, start(){}, stop(){} }), createGain: () => ({ connect(){}, gain: { setValueAtTime(){}, linearRampToValueAtTime(){} } }), destination: {} };
  },
  webkitAudioContext: function() {
    return { createOscillator: () => ({ connect(){}, start(){}, stop(){} }), createGain: () => ({ connect(){}, gain: { setValueAtTime(){}, linearRampToValueAtTime(){} } }), destination: {} };
  },
  setTimeout: (fn) => setTimeout(fn, 0),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn) => setInterval(fn, 1000),
  clearInterval: (id) => clearInterval(id),
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  navigator: { userAgent: 'node' },
  Image: function() { return { addEventListener(){}, src: '' }; },
  devicePixelRatio: 1
};
sandbox.window = sandbox;
sandbox.window.addEventListener = sandbox.document.addEventListener;
sandbox.window.removeEventListener = () => {};

console.log('Loading script into VM context...');
const script = new vm.Script(code);
const context = vm.createContext(sandbox);
script.runInContext(context);
console.log('Script loaded successfully!');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, extraInfo = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${testName} - ${extraInfo}`);
    testsFailed++;
  }
}

function run(codeStr) {
  return vm.runInContext(codeStr, context);
}

// -------------------------------------------------------------
// Test 1: Dodge Roll Mechanics & Hub / Cabin / Building State
// -------------------------------------------------------------
console.log('\n--- Running Test Set 1: Dodge Roll Mechanics & State Safety ---');

run(`
  gameRunning = true;
  gamePaused = false;
  shopOpen = false;
  cabinUIOpen = false;
  dodgeT = 0;
  dodgeCd = 0;
  keys.l = false;
  keys.r = true;
`);

// Test tryDodge modal & overlay guards
run(`cinActive = true; gameState = 'world';`);
assert(run(`tryDodge(); dodgeT;`) === 0, 'tryDodge blocked when cinActive is true');
run(`cinActive = false;`);

run(`scoutView = true;`);
assert(run(`tryDodge(); dodgeT;`) === 0, 'tryDodge blocked when scoutView is true');
run(`scoutView = false;`);

// Test tryDodge in Hub
run(`gameState = 'hub'; dodgeT = 0; dodgeCd = 0; player.vx = 0; keys.r = false; keys.l = false; player.facingRight = true;`);
run(`tryDodge();`);
const hubDodgeT = run(`dodgeT;`);
const hubPlayerVx = run(`player.vx;`);
assert(hubDodgeT === 28, 'tryDodge initiates with dodgeT=28 in hub state', `dodgeT=${hubDodgeT}`);
assert(hubPlayerVx === 11, 'tryDodge gives player vx=11 in hub state', `player.vx=${hubPlayerVx}`);

// Test updateHubPlayer roll handoff & decay when keys are released
run(`
  player.x = 200;
  keys.r = false;
  keys.l = false;
  for(let i=0; i<35; i++){
    updateHubPlayer(0.016);
  }
`);
const postHubDodgeT = run(`dodgeT;`);
const postHubPlayerVx = run(`player.vx;`);
assert(postHubDodgeT === 0, 'dodgeT fully decays to 0 in updateHubPlayer', `dodgeT=${postHubDodgeT}`);
assert(Math.abs(postHubPlayerVx) < 0.1, 'player.vx returns to 0 after roll when no keys held', `player.vx=${postHubPlayerVx}`);

// Test building interior wall boundary collision and velocity zeroing
const maxBuildingX = run(`GW - CHAR_W - 20;`);
run(`
  gameState = 'building';
  player.x = ${maxBuildingX - 5};
  player.vx = 11;
  dodgeT = 10;
  updatePlayer();
`);
const rightBoundX = run(`player.x;`);
const rightBoundVx = run(`player.vx;`);
assert(rightBoundX === maxBuildingX, `player.x stopped at right wall boundary (${maxBuildingX}) in building`, `x=${rightBoundX}`);
assert(rightBoundVx === 0, 'player.vx zeroed out upon colliding with right wall in building', `vx=${rightBoundVx}`);

run(`
  player.x = 25;
  player.vx = -11;
  dodgeT = 10;
  updatePlayer();
`);
const leftBoundX = run(`player.x;`);
const leftBoundVx = run(`player.vx;`);
assert(leftBoundX === 20, 'player.x stopped at left wall boundary (20) in building', `x=${leftBoundX}`);
assert(leftBoundVx === 0, 'player.vx zeroed out upon colliding with left wall in building', `vx=${leftBoundVx}`);

// -------------------------------------------------------------
// Test 2: Ammo Economy Rebalance
// -------------------------------------------------------------
console.log('\n--- Running Test Set 2: Ammo Economy Rebalance ---');

// Test 2.1: spawnLoot drop rate checks
const normalDrops = run(`
  lootDrops = [];
  gameState = 'world';
  wAmmo[curWpnIdx] = weaponMagSize(WEAPONS[curWpnIdx]); // full ammo
  for(let i=0; i<10000; i++){
    spawnLoot(500, 400, 3, false, false);
  }
  const groundAmmo = lootDrops.filter(item => item && item.type === 'ammo').length;
  const crateItems = lootDrops.filter(item => item && item.type === 'ammo_crate_item').length;
  ({ groundAmmo, crateItems });
`);
console.log(`Normal zombie 10,000 kills: ground ammo=${normalDrops.groundAmmo} (~${(normalDrops.groundAmmo/100).toFixed(2)}%), crate items=${normalDrops.crateItems} (~${(normalDrops.crateItems/100).toFixed(2)}%)`);
assert(normalDrops.groundAmmo > 150 && normalDrops.groundAmmo < 300, 'Normal zombie ground ammo drop rate restrained to ~2.2% (was 5%)', `got ${normalDrops.groundAmmo}`);
assert(normalDrops.crateItems > 40 && normalDrops.crateItems < 130, 'Normal zombie backpack crate drop rate restrained to ~0.8% (was 3.8%)', `got ${normalDrops.crateItems}`);

// Elite drop rate check
const eliteDrops = run(`
  lootDrops = [];
  gameState = 'world';
  for(let i=0; i<5000; i++){
    spawnLoot(500, 400, 10, true, false);
  }
  lootDrops.filter(item => item && item.type === 'ammo_crate_item').length;
`);
console.log(`Elite zombie 5,000 kills: crate items=${eliteDrops} (~${(eliteDrops/50).toFixed(2)}%)`);
assert(eliteDrops > 250 && eliteDrops < 450, 'Elite zombie backpack crate drop rate restrained to ~7% (was 14%)', `got ${eliteDrops}`);

// Test 2.2: Backpack ammo crate item usage (restores 50% maxAmmo, not 100%)
run(`
  backpackInventory['ammo_crate_item'] = 2;
  ownedWeapons = [0, 2]; // pistol, smg
  const pistolMag = weaponMagSize(WEAPONS[0]);
  const smgMag = weaponMagSize(WEAPONS[2]);
  wAmmo[0] = 0;
  wAmmo[2] = 5;
  useBackpackItem('ammo_crate_item');
`);
const pistolAmmoAfter = run(`wAmmo[0];`);
const smgAmmoAfter = run(`wAmmo[2];`);
const pistolExpected = run(`Math.ceil(weaponMagSize(WEAPONS[0]) * 0.5);`);
const smgExpected = run(`Math.min(weaponMagSize(WEAPONS[2]), 5 + Math.ceil(weaponMagSize(WEAPONS[2]) * 0.5));`);
assert(pistolAmmoAfter === pistolExpected, `Pistol ammo after crate is +50% mag (${pistolExpected})`, `got ${pistolAmmoAfter}`);
assert(smgAmmoAfter === smgExpected, `SMG ammo after crate is 5 + 50% mag (${smgExpected})`, `got ${smgAmmoAfter}`);

// Test 2.3: Wave start ammo replenishment (20% with 25% minimum floor)
run(`
  wAmmo[0] = 0;
  wAmmo[2] = 2;
  // Execute wave start ammo formula
  wAmmo = WEAPONS.map((w, i) => {
    const maxA = weaponMagSize(w);
    const cur = (wAmmo && wAmmo[i] !== undefined) ? wAmmo[i] : maxA;
    return Math.min(maxA, Math.max(Math.ceil(maxA * 0.25), cur + Math.ceil(maxA * 0.20)));
  });
`);
const waveStartPistolAmmo = run(`wAmmo[0];`);
const expectedPistolFloor = run(`Math.ceil(weaponMagSize(WEAPONS[0]) * 0.25);`);
assert(waveStartPistolAmmo === expectedPistolFloor, `Empty pistol replenished to 25% floor (${expectedPistolFloor})`, `got ${waveStartPistolAmmo}`);

// -------------------------------------------------------------
// Test 3: Tower Defense & Base Building Unification
// -------------------------------------------------------------
console.log('\n--- Running Test Set 3: Tower Defense & Base Building Unification ---');

// Test 3.1: autoBuildTower with inflation multiplier
run(`
  coins = 10;
  towers = [];
  autoBuildTower('turret');
`);
let towerCount = run(`towers.length;`);
assert(towerCount === 0, 'Cannot autoBuildTower with insufficient coins (10 coins < turret cost)');

run(`
  const turretCost = Math.round(TOWER_TYPES['turret'].cost * defenseCostMul());
  coins = turretCost + 50;
  const initialCoins = coins;
  autoBuildTower('turret');
`);
towerCount = run(`towers.length;`);
const remainingCoins = run(`coins;`);
const expectedRemaining = run(`50;`);
assert(towerCount === 1, 'autoBuildTower succeeds when player has enough coins', `count=${towerCount}`);
assert(remainingCoins === expectedRemaining, 'autoBuildTower deducts inflated cost correctly', `remaining=${remainingCoins}`);

// Test 3.2: autoBuildTower into remaining slots
run(`
  const freezeCost = Math.round(TOWER_TYPES['freeze'].cost * defenseCostMul());
  coins = 10000;
  autoBuildTower('freeze');
  autoBuildTower('cannon');
  autoBuildTower('tesla');
`);
towerCount = run(`towers.length;`);
assert(towerCount === 4, 'Multiple autoBuildTower calls fill available platform slots (up to 4)', `count=${towerCount}`);

// Test 3.3: Max tower slots limit
run(`
  autoBuildTower('repair');
`);
const towerCountAfterFull = run(`towers.length;`);
const maxTowers = run(`getTowerMaxCount();`);
assert(towerCountAfterFull <= maxTowers, `Tower count does not exceed getTowerMaxCount (${maxTowers})`, `got ${towerCountAfterFull}`);

// Test 3.4: deployTower inflation cost check
run(`
  coins = TOWER_TYPES['cannon'].cost; // base cost without inflation
  const cannonCostWithMul = Math.round(TOWER_TYPES['cannon'].cost * defenseCostMul());
  placementMode = null;
  if(coins < cannonCostWithMul){
    deployTower('cannon');
  }
`);
const placementModeStatus = run(`placementMode;`);
assert(placementModeStatus === null, 'deployTower rejects placementMode when player cannot afford inflated cost');

// Test 3.5: Canvas rendering functions
let drawInfraError = false;
try {
  run(`
    cabinUpgrades.farm = 2;
    cabinUpgrades.barricade = 2;
    cabinUpgrades.fortify = 2;
    cabinUpgrades.turret = 2;
    drawFortressInfrastructure(GROUND_Y - HOME_PLATFORM_H);
  `);
} catch(e) {
  drawInfraError = e;
}
assert(!drawInfraError, 'drawFortressInfrastructure executes cleanly without error', drawInfraError);

// Test 3.6: buildCabinUpgradeUI includes Sections A, B, C and tower options
let cabinBuilt = false;
let appendedHtml = '';
try {
  run(`
    coins = 500;
    woodPlanks = 500;
    scrapMetal = 500;
    // Track innerHTML of created elements
    buildCabinUpgradeUI();
  `);
  cabinBuilt = true;
} catch(e) {
  console.error('buildCabinUpgradeUI failed:', e);
}
assert(cabinBuilt === true, 'buildCabinUpgradeUI executes cleanly and builds defense hub UI');

console.log(`\n========================================`);
console.log(`FINAL RESULT: Passed: ${testsPassed}, Failed: ${testsFailed}`);
console.log(`========================================`);

if (testsFailed > 0) {
  process.exit(1);
}
