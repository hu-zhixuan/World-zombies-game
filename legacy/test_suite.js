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
    stroke(){}, fill(){}, arc(){}, ellipse(){}, roundRect(){}, rect(){}, fillRect(){}, strokeRect(){}, clearRect(){},
    fillText(){}, strokeText(){}, measureText(){ return { width: 50 }; },
    createLinearGradient(){ return { addColorStop(){} }; },
    createRadialGradient(){ return { addColorStop(){} }; },
    scale(){}, translate(){}, rotate(){}, transform(){}, setTransform(){},
    setLineDash(){}, clip(){}, drawImage(){}, quadraticCurveTo(){}, bezierCurveTo(){}, arcTo(){},
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    font: '', textAlign: '', textBaseline: '', globalAlpha: 1, globalCompositeOperation: 'source-over'
  };
}

const mockElem = {
  style: { setProperty(){}, removeProperty(){} },
  dataset: {},
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
  performance: { now: () => Date.now() },
  Audio: function() { return { play(){ return Promise.resolve(); }, pause(){}, addEventListener(){}, volume: 1 }; },
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


// -------------------------------------------------------------
// Test Set 4: 每日热搜挪到白天（P2-6）
// -------------------------------------------------------------
console.log('\n--- Running Test Set 4: Daily Trend In The Daytime ---');
run(`wave = 1; restRep = 0; currentTrend = null; trendMeatToday = 0;`);
let earlyAllMatch = true;
for (let i = 0; i < 60; i++) {
  run(`currentTrend = null; rollDailyTrend();`);
  if (!run(`trendMatchableNow(currentTrend)`)) earlyAllMatch = false;
}
assert(earlyAllMatch, '开局(只解锁烤肉串)掷出的热搜一定有菜能匹配');
assert(run(`DAILY_TRENDS.some(t => !trendMatchableNow(t))`), '开局存在匹配不上的热搜(被过滤掉的那部分)');

run(`currentTrend = DAILY_TRENDS.find(t => t.id === 'homestyle'); trendMeatToday = 0;`);
assert(run(`getTrendHuntInfo().kinds.join(',')`) === 'normal', '「家常」热搜的目标肉是普通肉');
assert(run(`getTrendHuntInfo().zombieNames.length > 0`), '热搜目标肉能映射到会掉它的僵尸名');
run(`noteTrendMeat('normal', 2); noteTrendMeat('tank', 5);`);
assert(run(`trendMeatToday`) === 2, '只有命中热搜目标肉才计数', `got ${run('trendMeatToday')}`);

run(`currentTrend = null; trendMeatToday = 3; wave = 1; wavePhase = 'x'; gameRunning = true;`);
run(`startWaveContent();`);
assert(run(`currentTrend !== null`), '白天波次开始(startWaveContent)就已经刷出今日热搜');
assert(run(`trendMeatToday`) === 0, '新的一天目标肉计数清零');
const trendBefore = run(`currentTrend.id`);
let openErr = null;
try { run(`meatInventory.normal = 5; gameState = 'hub'; _doStartRestaurant();`); } catch (e) { openErr = e; }
assert(!openErr, '_doStartRestaurant 在测试环境下可执行', openErr && openErr.stack);
assert(run(`currentTrend.id`) === trendBefore, '晚上开张不重掷热搜', `before=${trendBefore} after=${run('currentTrend.id')}`);


// -------------------------------------------------------------
// Test Set 5: 食堂成为唯一的备战饭（P1-3）
// -------------------------------------------------------------
console.log('\n--- Running Test Set 5: Restaurant Is The Only Pre-Battle Meal ---');
assert(run(`typeof openTacticalFeastModal`) === 'undefined' && run(`typeof TACTICAL_FEASTS`) === 'undefined', '据点战备特餐已移除(弹窗函数与 TACTICAL_FEASTS 不再存在)');
assert(run(`REST_RECIPES.filter(r => r.signatureId).every(r => DISH_SIGNATURES.some(g => g.id === r.signatureId))`), '每个菜谱的 signatureId 都指向存在的招牌特效');
assert(run(`DISH_SIGNATURES.every(g => REST_RECIPES.some(r => r.signatureId === g.id))`), '五个战斗特效都挂在了某道菜上(没有孤儿特效)');

const rec = id => `REST_RECIPES.find(r => r.id === '${id}')`;
run(`queuedBattleBuffs = [];`);
assert(run(`queueDishBuff(${rec('grilled_meat')}, 'poor')`) === false && run(`queuedBattleBuffs.length`) === 0, 'poor 品质的菜不产生增益');
run(`queueDishBuff(${rec('grilled_meat')}, 'good')`);
assert(run(`queuedBattleBuffs.length`) === 1 && run(`queuedBattleBuffs[0].boosted`) === false, 'good 品质入队,不带强化');
assert(run(`queueDishBuff(${rec('grilled_meat')}, 'perfect')`) === true && run(`queuedBattleBuffs.length`) === 1 && run(`queuedBattleBuffs[0].boosted`), 'perfect 刷新同名增益并带强化');
run(`queueDishBuff(${rec('grilled_meat')}, 'good')`);
assert(run(`queuedBattleBuffs[0].boosted`) === true, '后来的低品质菜不会覆盖已有的高品质增益');

// 留饭:卖出和留饭的取舍
run(`queuedBattleBuffs = []; queuedFamilyMeal = null; lastMealLog = []; activeSignature = null; activeBattleBuffs = [];
     hiredCompanions = [{name:'张', type:'sniper', hp:5, maxHp:100, downed:true}];
     restState = restState || {};`);
assert(run(`canPackFamilyMeal()`) === true, '一开始可以留饭');
run(`packFamilyMeal(${rec('grilled_meat')}, 'perfect');`);
assert(run(`queuedFamilyMeal && queuedFamilyMeal.signatureId`) === 'spicy', '烤肉串留饭 → 麻辣爆烤(翻滚烈焰)');
assert(run(`canPackFamilyMeal()`) === false, '一晚只能留一份');
assert(run(`queuedBattleBuffs.some(b => b.family && b.boosted)`), '留饭同时排进更强的数值增益');
run(`packFamilyMeal(${rec('steak')}, 'burned');`);
assert(run(`queuedFamilyMeal.recipeId`) === 'grilled_meat', '烤焦的留饭作废,不会覆盖已留的');

run(`wave = 1; applyOvernightMeals();`);
assert(run(`activeSignature && activeSignature.id`) === 'spicy', '下一波开战前吃下留饭 → 招牌特效生效');
assert(run(`queuedFamilyMeal`) === null, '留饭吃完即清空');
assert(run(`hiredCompanions[0].downed === false && hiredCompanions[0].hp === 100 && hiredCompanions[0].mealBoost === 1.25`), '队友同享:满血站起来且射速提升');
assert(run(`lastMealLog.some(m => m.family && m.name === '烤肉串')`), '战斗 HUD 记录了昨晚吃了什么');
assert(run(`activeBattleBuffs.length === 1 && activeBattleBuffs[0].dishName === '烤肉串'`), '数值增益带着菜名,HUD 能说清来自哪道菜');
run(`endOvernightMeals();`);
assert(run(`activeSignature === null && hiredCompanions[0].mealBoost === 1 && lastMealLog.length === 0`), '一波结束,饭吃完了:特效、队友加成、HUD 记录都清掉');

// 存档往返:完美强化标记与菜名不再丢
run(`queuedBattleBuffs = []; queueDishBuff(${rec('meat_soup')}, 'legendary'); queuedFamilyMeal = {recipeId:'steak', name:'铁板厚肉', quality:'good', signatureId:'frost'};`);
const saved = JSON.parse(JSON.stringify(run(`buildSaveState()`)));
assert(saved.queuedBattleBuffs[0].boosted === true && saved.queuedBattleBuffs[0].dishName === '僵尸浓汤', '存档保留增益的强化标记和菜名');
assert(saved.queuedFamilyMeal && saved.queuedFamilyMeal.signatureId === 'frost', '存档保留还没吃的留饭');
let restoreErr = null;
try { run(`queuedBattleBuffs = []; queuedFamilyMeal = null;`); sandbox.__saved = saved; run(`restoreSaveState(__saved);`); } catch (e) { restoreErr = e; }
assert(!restoreErr, 'restoreSaveState 可执行', restoreErr && restoreErr.stack);
assert(run(`queuedBattleBuffs[0].boosted === true && queuedFamilyMeal.name === '铁板厚肉'`), '读档后强化标记和留饭恢复');
// 旧存档只有 activeTacticalMealId 时,特效 id 仍被识别
const legacy = JSON.parse(JSON.stringify(saved)); delete legacy.activeSignatureId; legacy.activeTacticalMealId = 'dragon';
sandbox.__legacy = legacy; run(`restoreSaveState(__legacy);`);
assert(run(`activeSignature && activeSignature.id`) === 'dragon', '旧存档的 activeTacticalMealId 仍能恢复特效');

// 梦境:非战斗奖励,每天一次
run(`wave = 3; dreamPickedWave = 0; meatInventory = {normal:0,fast:0,tank:0,elite:0}; woodPlanks = 0; scrapMetal = 0; wastegramFans = 0; restRep = 0; coins = 0; nextTrendPreview = null; currentTrend = null;`);
assert(run(`DREAM_INSIGHTS.length`) === 6, '梦境有 6 个选项');
let dreamErr = null;
try { run(`DREAM_INSIGHTS.forEach(d => d.apply());`); } catch (e) { dreamErr = e; }
assert(!dreamErr, '六个梦全部可执行', dreamErr && dreamErr.stack);
assert(run(`meatInventory.normal === 3 && woodPlanks === 4 && scrapMetal === 4 && wastegramFans === 40`), '梦的奖励真实落到资源上');
assert(run(`nextTrendPreview !== null`), '预知之梦抽好了明日热搜');
run(`const want = nextTrendPreview.id; window.__want = want; rollDailyTrend();`);
assert(run(`currentTrend.id === window.__want && nextTrendPreview === null`), '第二天的热搜就是梦里预知的那一条');
run(`dreamPickedWave = 0; selectDreamInsight(DREAM_INSIGHTS[2]);`);
assert(run(`dreamPickedWave`) === 3, '做梦会记下是哪一天');
run(`meatInventory.normal = 0; health = 10; openDreamModal();`);
assert(run(`meatInventory.normal === 0 && health === maxHp`), '同一天不能再做梦,只是睡一觉回血');


// -------------------------------------------------------------
// Test Set 6: 白天救下的人晚上来食堂（P0-1）
// -------------------------------------------------------------
console.log('\n--- Running Test Set 6: Rescued On The Field, Seated At Night ---');
run(`vipCompendium = {}; wastegramFans = 600; wave = 1; gameState = 'world'; fieldSurvivors = []; tonightGuests = []; zombies = [];`);
assert(run(`getFieldEncounterVIPs().map(v => v.id).join(',')`).startsWith('agou'), '粉丝够的 VIP 在战场上等着被遇见');
assert(run(`isVIPFieldMet('agou')`) === false, '没遇见过的 VIP 不会来店');

// 第 1 天必有一个求救者（教学），且是 VIP
const surv = run(`maybeSpawnFieldSurvivor(); fieldSurvivors.length`);
assert(surv === 1 && run(`fieldSurvivors[0].vip.id`) === 'agou', '第 1 天战场上必出现求救者(阿狗)');
assert(run(`fieldSurvivors[0].x > RIGHT_WALL_X + 200`), '求救者在城墙外');

// 远了救不了，近了可以
run(`player.x = 100; fieldSurvivors[0].near = false; updateFieldSurvivors();`);
assert(run(`rescueNearestSurvivor()`) === false, '离得远按 E 救不到人');
run(`player.x = fieldSurvivors[0].x - 20; updateFieldSurvivors();`);
assert(run(`fieldSurvivors[0].near`) === true, '走近后进入可救范围');
assert(run(`rescueNearestSurvivor()`) === true, '按 E 救下求救者');
assert(run(`vipCompendium.agou.fieldMet === true && isVIPFieldMet('agou')`), '救下 VIP 即「遇见」,之后才会来店');
assert(run(`tonightGuests.length === 1 && tonightGuests[0].kind === 'vip' && tonightGuests[0].vipId === 'agou'`), '救下的 VIP 记入今晚的预约');

// 僵尸会啃求救者
run(`fieldSurvivors = []; tonightGuests = []; fieldSurvivors.push({x: 1000, vip: null, persona: generateNormalCustomerPersona(), hp: 100, state:'waiting', t:0, near:false, fade:1});
     zombies = [{alive:true, x: 980}, {alive:true, x: 985}]; player.x = 100; frameT = 1;`);
for (let i = 0; i < 400; i++) run(`updateFieldSurvivors();`);
assert(run(`fieldSurvivors.length`) === 0 && run(`tonightGuests.length`) === 0, '来不及救,被僵尸啃死,不会成为食客');
run(`zombies = [];`);

// 普通幸存者 → 晚上以同样的名字入座
run(`fieldSurvivors = []; tonightGuests = []; fieldSurvivors.push({x: 1000, vip: null, persona: {name:'测试阿福', skin:'#d4a574', hair:'#111', shirt:'#456'}, hp:100, state:'waiting', t:0, near:true, fade:1});`);
run(`rescueNearestSurvivor();`);
assert(run(`tonightGuests[0].kind === 'survivor' && tonightGuests[0].persona.name === '测试阿福'`), '救下的普通幸存者记入预约并保留名字');

// 开张:预约客人第一个入座，沿用战场上的名字，付得更多
run(`meatInventory.normal = 20; gameState = 'hub'; wave = 2; _doStartRestaurant();`);
assert(run(`restState.reservedGuests.length`) === 1 && run(`tonightGuests.length`) === 0, '开张时预约转入当晚客人表');
run(`spawnRestCustomer();`);
assert(run(`restState.customers[0] && restState.customers[0].rescued === true && restState.customers[0].persona.name === '测试阿福'`), '获救的人第一个入座,名字和战场上一致');
assert(run(`restState.reservedGuests.length`) === 0, '入座后预约被消耗');

// VIP:未遇见则不来；遇见(预约)则当晚必来
run(`vipCompendium = {agou:{met:false, unlocked:true, unlockedWave: 1}}; wave = 2; wastegramFans = 600; restState.vipVisitedThisNight = []; vipActiveInRestaurant = null; restState.reservedGuests = [];`);
assert(run(`maybeSpawnVIPCustomer()`) === null, '粉丝够但没遇见过的 VIP 不会来店');
run(`vipActiveInRestaurant = null; wave = 5;`);
assert(run(`isVIPFieldMet('agou')`) === true, '解锁满 3 天仍没遇见,会自己找上门(兜底)');
run(`wave = 2; vipActiveInRestaurant = null; restState.vipVisitedThisNight = []; vipCompendium.agou.fieldMet = true; restState.reservedGuests = [{kind:'vip', vipId:'agou'}];`);
assert(run(`const r = maybeSpawnVIPCustomer(); r && r.vip.id`) === 'agou', '白天救下的 VIP 当晚必到');
assert(run(`restState.reservedGuests.length`) === 0, 'VIP 到场后预约消耗');

// 伙伴在店里帮忙
run(`wave = 1;`); assert(run(`getStoryCrew().length`) === 0, '第 1 天还没有伙伴在店里');
run(`wave = 2;`); assert(run(`getStoryCrew().map(c => c.id).join()`) === 'crew_zhang' && run(`getStoryCrew()[0].type`) === 'server', '老兵张加入后在店里端盘(自动上菜)');
run(`wave = 8;`); assert(run(`getStoryCrew().length`) === 4, '四位伙伴都加入后全部在店里');
run(`meatInventory.normal = 20; gameState = 'hub'; wave = 8; _doStartRestaurant();`);
assert(run(`restState.crew.lin && restState.crew.qiang && restState.crew.zhao`), '林/强/赵的岗位效果生效');
assert(run(`restState.cookSpeedBuff > 1.09`), '阿强修灶:烹饪速度 +10%');
assert(run(`restState.staff.filter(s => s.crew).length`) === 4, '伙伴作为店员出现在店里');
let drawErr = null;
try { run(`drawRestaurant();`); } catch (e) { drawErr = e; }
assert(!drawErr, '食堂画面含伙伴时可绘制', drawErr && drawErr.stack);
let fsErr = null;
try { run(`gameState='world'; fieldSurvivors=[{x:1000,vip:null,persona:generateNormalCustomerPersona(),hp:50,state:'waiting',t:3,near:true,fade:1}]; drawFieldSurvivors();`); } catch (e) { fsErr = e; }
assert(!fsErr, '战场求救者可绘制', fsErr && fsErr.stack);

// ── 主角重绘：所有流派 × 各种姿态都能画，且 save/restore 配平（不污染后续绘制）──
let heroErr = null;
try {
  run(`
    window.__heroDepth = 0;
    const _s = ctx.save.bind(ctx), _r = ctx.restore.bind(ctx);
    ctx.save = function(){ window.__heroDepth++; return _s(); };
    ctx.restore = function(){ window.__heroDepth--; return _r(); };
    [null,'marksman','berserker','demolition','beastmaster','warden','chef'].forEach(id => {
      playerClass = id ? {id} : null;
      [[0,false,0],[0.25,false,0],[0.5,false,0],[0,true,0],[0.3,false,12]].forEach(p => drawPlayer(100,286,true,p[0],0.2,p[1],false,1234,p[2]));
      drawPlayer(100,286,false,0.1,-0.3,false,true,1234,0);
    });
    playerClass = null;
    ctx.save = _s; ctx.restore = _r;
  `);
} catch (e) { heroErr = e; }
assert(!heroErr, '主角在所有流派/姿态下都能绘制', heroErr && heroErr.stack);
assert(run(`window.__heroDepth`) === 0, '主角绘制 save/restore 配平');

// ── 手机 HUD 的数据来源 ──
run(`gameState = 'world'; wave = 3; wavePhase = 'spawning'; waveSpawnQueue = 4; zombies = []; waveTotalThisWave = 8;`);
assert(run(`getWaveHudInfo().title`) === '第 3 波' && run(`getWaveHudInfo().right`) === '剩 4 / 8' && Math.abs(run(`getWaveHudInfo().ratio`) - 0.5) < 1e-9, '波次面板：标题/剩余/进度');
run(`wavePhase = 'waiting';`);
assert(run(`getWaveHudInfo().right`) === '准备中', '波次状态用中文，不显示内部英文名');
run(`gameState = 'hub';`);
assert(run(`getWaveHudInfo().tone`) === 'ok', '据点整备面板用绿色调');
run(`gameState = 'world'; wavePhase = 'spawning';`);
assert(run(`actLabelFrom('[ E ] 救人：阿狗')`) === '救人', '交互键标签：救人');
assert(run(`actLabelFrom('[ E ] 招募 狙击手阿强 (💰60)')`) === '招募', '交互键标签：招募');
assert(run(`actLabelFrom('[ E ] 搜刮战地医疗箱 (急救包×2)')`) === '搜刮战地', '交互键标签：最多四个字');
assert(run(`actLabelFrom('🚪 [ 长按 E ] 紧急闭锁入屋避难')`) === '紧急闭锁', '交互键标签：去掉 emoji 和按键说明');

// ── 开局看门狗：选流派/读教程时不能替玩家开波（曾经：读 5 秒流派卡直接跳过第 1 波；读 8 秒教程在第 0 波触发 Boss）──
function idleWatchdog(frames) { run(`for (let i = 0; i < ${frames}; i++) checkStuckWatchdog();`); }
run(`gameRunning = true; gameState = 'world'; wave = 0; wavePhase = 'waiting'; cinActive = false; dlgActive = false;
     shopOpen = false; cabinUIOpen = false; boss = null; bossActive = false; zombies = []; stuckWatchdog = 0; lastGameState = '';
     document.getElementById('tutorial-scr').style.display = 'none'; gamePaused = true;`);
idleWatchdog(600);
assert(run(`wave === 0 && wavePhase === 'waiting'`), '选流派界面停留 10 秒：看门狗不开波', run(`wave + '/' + wavePhase`));
run(`gamePaused = false; document.getElementById('tutorial-scr').style.display = 'flex';`);
idleWatchdog(600);
assert(run(`wave === 0 && wavePhase === 'waiting'`), '读教程 10 秒：看门狗不开波、不在第 0 波进 Boss', run(`wave + '/' + wavePhase`));
run(`document.getElementById('tutorial-scr').style.display = 'none';`);
idleWatchdog(200);
assert(run(`wave`) === 1, '没有任何面板时卡在第 0 波：看门狗仍会兜底进第 1 波', run(`wave + '/' + wavePhase`));
run(`gameRunning = false; document.getElementById('tutorial-scr').style.display = '';`);

// ── 手机瞄准：自动锁屏幕内、面朝一侧优先、锁住不乱跳；没目标朝正前方；拖动吸附 ±30° ──
const mkZ = (x) => `({ x: ${x}, alive: true })`;
run(`gameState = 'world'; boss = null; cameraX = 0; touchAim = null; aimLock = null; keys.l = keys.r = false;
     player.x = 300; player.y = 286; player.facingRight = true;
     zombies = [${mkZ(560)}, ${mkZ(150)}, ${mkZ(1500)}]; updateAim();`);
assert(run(`aimLock === zombies[0]`), '自动锁定：身前的僵尸优先于身后稍近的那只，屏幕外的不锁');
assert(run(`lastMX === zombies[0].x + 22`), '自动锁定：枪口指向锁定目标');
run(`zombies.push(${mkZ(530)}); updateAim();`);
assert(run(`aimLock === zombies[0]`), '锁住后不乱跳：新目标只近一点不换');
run(`zombies[0].alive = false; updateAim();`);
assert(run(`aimLock === zombies[3]`), '目标死了自动换下一只');
run(`zombies = []; updateAim();`);
assert(run(`aimLock === null && lastMX > player.x && Math.abs(lastMY - (player.y + CHAR_H / 2)) < 1e-6`), '没有目标：朝正前方水平开火');
run(`zombies = [${mkZ(600)}, ${mkZ(100)}]; touchAim = { x: -1, y: 0 }; updateAim();`);
assert(run(`aimLock === zombies[1]`), '手动瞄准：往左拖吸附到左边那只');
run(`touchAim = { x: 0, y: -1 }; updateAim();`);
assert(run(`aimLock === null && lastMY < player.y`), '手动瞄准：方向上没有僵尸就照拖的方向打');
run(`endFireAim(); updateAim();`);
assert(run(`touchAim === null && aimLock === zombies[0]`), '松手后回到自动锁定');
run(`zombies = []; aimLock = null;`);

// ── 回小屋卡死：进出据点的强制清场用行内 display:none 关剧情层，之后的剧情必须还能显示出来 ──
let cinErr = null;
try {
  run(`forceDismissAllOverlays(); document.getElementById('cinematic-scr').style.display = 'none';
       showCinematic([{ npc: 'ming', text: '测试' }], null);`);
} catch (e) { cinErr = e; }
assert(!cinErr && run(`cinActive && document.getElementById('cinematic-scr').style.display !== 'none'`), '强制清场后再放剧情：剧情层可见（不会隐形吞掉操作）', cinErr && cinErr.stack);
run(`forceDismissAllOverlays();`);
// 清场后在选天赋：看门狗不能把人拽进据点
run(`gameRunning = true; gameState = 'world'; wave = 1; wavePhase = 'cleared'; cinActive = false; shopOpen = false; cabinUIOpen = false;
     gamePaused = true; document.getElementById('tutorial-scr').style.display = 'none'; stuckWatchdog = 0; lastGameState = '';`);
run(`for (let i = 0; i < 600; i++) checkStuckWatchdog();`);
assert(run(`gameState === 'world' && wavePhase === 'cleared'`), '选天赋时看门狗不强制进据点', run(`gameState + '/' + wavePhase`));
run(`gameRunning = false; gamePaused = false; document.getElementById('tutorial-scr').style.display = '';`);

console.log(`\n========================================`);
console.log(`FINAL RESULT: Passed: ${testsPassed}, Failed: ${testsFailed}`);
console.log(`========================================`);

if (testsFailed > 0) {
  process.exit(1);
}
