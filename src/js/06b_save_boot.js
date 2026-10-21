// ═══════════════════════════════════════════

//  【白天模块 A11】SAVE/LOAD（存档/读档）
// ═══════════════════════════════════════════
// 构建存档状态对象（供文件存档和localStorage共用）
function buildSaveState() {
  return {
    score, best, health, maxHp, coins, wave, killCount, curWpnIdx,
    wAmmo, upgrades,
    ownedWeapons, unlockedWeapons: WEAPONS.map((w,i)=>ownedWeaponsSet.has(i)),
    player: { x: player.x, y: player.y },
    vehicle: { exists: vehicle.exists, entered: vehicle.entered, x: vehicle.x, y: vehicle.y, hp: vehicle.hp },
    sprite: { exists: sprite.exists, x: sprite.x, y: sprite.y, level: sprite.level },
    bossCount, cameraX,
    hiredCompanions: hiredCompanions.map(c => ({ type: c.type, name: c.name, x: c.x, y: c.y, walkT: c.walkT, facingR: c.facingR, timer: c.timer, color: c.color, fireRate: c.fireRate, dmg: c.dmg, maxHp: c.maxHp, hp: c.hp, isStoryNpc: !!c.isStoryNpc })),
    safehouseRestUsed, safehouseCraftUsed, damageBuffActive,
    woodPlanks, scrapMetal, cabinUpgrades, cabinCrates,
    towers: towers.map(t => ({ x: t.x, y: t.y, level: t.level, type: t.type, slotIdx: t.slotIdx, hp: t.hp, hpMax: t.hpMax, front: t.front?1:0 })),
    traps: traps.map(tr => ({ x: tr.x, y: tr.y, type: tr.type, charges: tr.charges })),
    wallHp, wallLevel, homeHp, HOME_HP_MAX,
    hiddenChestsFound: hiddenChests.map(c => c.found),
    oldTownEventsTriggered: oldTownEvents.map(ev => ev.triggered),
    gasStationExploded,
    achievementsUnlocked: Object.keys(achievements).filter(k => achievements[k].unlocked),
    restRep, restUpgradeLevel: { ...restUpgradeLevel },
    // 经营重做：员工等级/今晚菜单/待生效菜品增益 一并持久化
    restHiredStaff: restHiredStaff.map(s => ({ id: s.id, type: s.type, name: s.name, color: s.color, skill: s.skill, hireCost: s.hireCost, desc: s.desc, level: s.level || 1, xp: s.xp || 0 })),
    meatInventory: { ...meatInventory },
    restPendingInfluencerBoost,
    moraleBuff,
    tonightMenu: [...tonightMenu],
    queuedBattleBuffs: queuedBattleBuffs.map(b => ({ id: b.id, stacks: b.stacks })),
    activeBattleBuffs: activeBattleBuffs.map(b => ({ id: b.id, stacks: b.stacks, timeLeft: b.timeLeft })),
    wastegramFans,
    wastegramRank,
    vipCompendium: JSON.parse(JSON.stringify(vipCompendium || {})),
    // ── v49批4：叙事flag持久化（修"读档后餐厅剧情重播/二周目跳过"错乱）──
    restStoryTriggered: JSON.parse(JSON.stringify(restStoryTriggered || {})),
    // ── v49批1/2：流派与武器成长持久化 ──
    playerClassId: playerClass ? playerClass.id : null,
    weaponLevels: JSON.parse(JSON.stringify(weaponLevels || {})),
    annGranted: !!window._annGranted,
    // ── v52修：等级/经验/天赋进度原本从不存档——读档后波数还在但等级天赋全丢 ──
    playerLevel, playerXp, playerXpNeed,
    playerPerks: { ...playerPerks },
    perkPendingLevels,
    playerClassPerks: playerClass ? { ...playerClass.perks } : null,
    backpackInventory: (typeof backpackInventory !== 'undefined') ? { ...backpackInventory } : null,
    duffWeaponMods: JSON.parse(JSON.stringify(duffWeaponMods || {})),
    activeTacticalMealId: (typeof activeTacticalMeal !== 'undefined' && activeTacticalMeal) ? activeTacticalMeal.id : null,
    meleeComboSaveFlag: true,
    saveTime: Date.now(),
  };
}

// 自动保存到localStorage（每波结束/进餐厅时调用）
function autoSaveToStorage(){
  try{
    const state = buildSaveState();
    localStorage.setItem('zombie_game_autosave', JSON.stringify(state));
  }catch(e){
    console.log('自动存档失败:', e);
  }
}

function saveGameToFile() {
  const saveState = buildSaveState();
  // 同时保存到localStorage
  try{ localStorage.setItem('zombie_game_autosave', JSON.stringify(saveState)); }catch(e){}
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saveState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "zombie_game_save.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  addBanner('💾 存档已保存！（文件已下载+本地存储）');
}

// 下载游戏本体（把当前页面HTML导出为一个可独立运行的文件）
function downloadGame(){
  try{
    // 方法1：尝试用Blob下载
    const htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    const blob = new Blob([htmlContent], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zombie-game-v55.html';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
    addBanner('💾 游戏已下载！双击HTML文件即可离线游玩');
  }catch(e){
    // 方法2：如果Blob失败，用data URI
    try{
      const htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = 'zombie-game-v55.html';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ document.body.removeChild(a); }, 2000);
      addBanner('💾 游戏已下载！');
    }catch(e2){
      // 方法3：最后兜底——新窗口打开让用户手动保存
      const htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      const newWin = window.open('', '_blank');
      if(newWin){
        newWin.document.write(htmlContent);
        newWin.document.close();
        addBanner('💾 游戏已在新窗口打开，按Ctrl+S保存');
      } else {
        alert('下载失败：浏览器拦截了弹窗。请允许弹窗后重试，或手动按Ctrl+S保存本页面。');
      }
    }
  }
}

function triggerLoadFile() {
  document.getElementById('save-file-input').click();
}

function loadGameFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const state = JSON.parse(e.target.result);
      restoreSaveState(state);
      addBanner('📂 存档已成功导入并加载！');
      if (gamePaused) togglePause();
    } catch (err) {
      alert('读取存档失败：文件格式不正确！');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function restoreSaveState(state) {
  if (!state) return;
  if(typeof RuntimeBattleContext !== 'undefined') RuntimeBattleContext.reset();
  score = state.score ?? 0;
  best = Math.max(best, state.best ?? 0);
  moraleBuff = state.moraleBuff ?? 0;  // 恢复士气加成
  WEAPONS.forEach(w=>{if(w.id==='minigun'){w.heat=0;w.overheated=false;}});
  health = state.health ?? 100;
  maxHp = state.maxHp ?? 100;
  coins = state.coins ?? 100;
  wave = state.wave ?? 1;
  killCount = state.killCount ?? 0;
  curWpnIdx = state.curWpnIdx ?? 0;
  
  woodPlanks = state.woodPlanks ?? 0;
  scrapMetal = state.scrapMetal ?? 0;
  if (state.cabinUpgrades) {
    cabinUpgrades.turret = state.cabinUpgrades.turret ?? 0;
    cabinUpgrades.barricade = state.cabinUpgrades.barricade ?? 0;
    cabinUpgrades.supplier = state.cabinUpgrades.supplier ?? 0;
    cabinUpgrades.fortify = state.cabinUpgrades.fortify ?? 0;
    cabinUpgrades.farm = state.cabinUpgrades.farm ?? 0;
    cabinUpgrades.watchtower = state.cabinUpgrades.watchtower ?? 0;
  } else {
    cabinUpgrades.turret = 0;
    cabinUpgrades.barricade = 0;
    cabinUpgrades.supplier = 0;
    cabinUpgrades.fortify = 0;
    cabinUpgrades.farm = 0;
    cabinUpgrades.watchtower = 0;
  }
  if (state.cabinCrates) {
    cabinCrates.ammoSpawned = state.cabinCrates.ammoSpawned ?? false;
    cabinCrates.medkitSpawned = state.cabinCrates.medkitSpawned ?? false;
  } else {
    cabinCrates.ammoSpawned = false;
    cabinCrates.medkitSpawned = false;
  }
  
  if (state.upgrades) {
    upgrades.damage = state.upgrades.damage ?? 0;
    upgrades.speed = state.upgrades.speed ?? 0;
    upgrades.armor = state.upgrades.armor ?? 0;
    upgrades.maxHp = state.upgrades.maxHp ?? 0;
    upgrades.ammo = state.upgrades.ammo ?? 0;
    upgrades.clinicArmor = state.upgrades.clinicArmor ?? 0;
    upgrades.armoryCooling = state.upgrades.armoryCooling ?? 0;
    upgrades.armoryAmmo = state.upgrades.armoryAmmo ?? 0;
    upgrades.armoryDamageBoost = state.upgrades.armoryDamageBoost ?? 0;
  }
  
  if (state.ownedWeapons && Array.isArray(state.ownedWeapons)) {
    // 新存档格式：直接用 ownedWeapons 索引数组
    ownedWeapons = state.ownedWeapons.filter(i => i>=0 && i<WEAPONS.length);
    // 合并开局武器（确保至少有手枪）
    WEAPONS.forEach((w,i)=>{if(w.startOwned && !ownedWeapons.includes(i))ownedWeapons.push(i);});
  } else if (state.unlockedWeapons) {
    // 兼容旧存档格式：从 unlockedWeapons 布尔数组转换
    ownedWeapons = state.unlockedWeapons.map((unlocked, idx) => unlocked ? idx : -1).filter(i => i>=0);
  }
  // 严格维持 MAX_OWNED_WEAPONS = 2 双持槽位限制（防旧档多武器突破上限）
  if (ownedWeapons.length > MAX_OWNED_WEAPONS) {
    const active = ownedWeapons.includes(curWpnIdx) ? curWpnIdx : ownedWeapons[0];
    const others = ownedWeapons.filter(i => i !== active);
    ownedWeapons = [active, ...others].slice(0, MAX_OWNED_WEAPONS);
  }
  if (!ownedWeapons.includes(curWpnIdx)) {
    curWpnIdx = ownedWeapons[0] || 0;
  }
  refreshOwnedSet();
  WEAPONS.forEach(w=>{if(w.id==='minigun'){w.heat=0;w.overheated=false;}});
  
  rebuildAmmo();
  if (state.wAmmo) {
    state.wAmmo.forEach((amt, idx) => {
      if(idx<wAmmo.length) wAmmo[idx] = amt;
    });
  }
  
  if (state.player) {
    player.x = state.player.x ?? 100;
    player.y = state.player.y ?? CHAR_GY;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
  }
  
  if (state.vehicle) {
    vehicle.exists = state.vehicle.exists ?? false;
    vehicle.entered = state.vehicle.entered ?? false;
    vehicle.x = state.vehicle.x ?? 650;
    vehicle.y = state.vehicle.y ?? GROUND_Y-44;
    vehicle.hp = state.vehicle.hp ?? 150;
    vehicle.vx = 0;
  }
  
  if (state.sprite) {
    sprite.exists = state.sprite.exists ?? false;
    sprite.x = state.sprite.x ?? 0;
    sprite.y = state.sprite.y ?? 0;
    sprite.level = state.sprite.level ?? 1;
    sprite.attackTimer = 180;
    sprite.healTimer = 480;
    sprite.shieldReady = true;
  }
  
  bossCount = state.bossCount ?? 0;
  cameraX = state.cameraX ?? 0;
  
  if (state.hiredCompanions) {
    hiredCompanions = state.hiredCompanions.map(c => ({
      type: c.type,
      name: c.name,
      x: c.x ?? player.x,
      y: c.y ?? CHAR_GY,
      walkT: c.walkT ?? 0,
      facingR: c.facingR ?? true,
      timer: c.timer ?? 0,
      color: c.color,
      fireRate: c.fireRate,
      dmg: c.dmg,
      maxHp: c.maxHp,
      hp: c.hp,
      isStoryNpc: !!c.isStoryNpc
    }));
  } else {
    hiredCompanions = [];
  }
  
  safehouseRestUsed = state.safehouseRestUsed ?? false;
  safehouseCraftUsed = state.safehouseCraftUsed ?? false;
  damageBuffActive = state.damageBuffActive ?? false;
  gameState = 'world';
  activeBuilding = null;

  // 恢复建筑（塔/陷阱/围墙/家园）
  if (state.towers && Array.isArray(state.towers)) {
    towers = state.towers.map(t => ({ ...t, cooldown: 0, angle: -Math.PI/4, recoil: 0 }));
    // 城堡塔防制（v47回退）：塔按存档位置自由恢复（夹紧到平台范围）
    // heal 类型塔（旧版治疗塔）迁移为 repair（塔防重做）
    towers.forEach(t => {
      if(t.type==='heal')t.type='repair';
      if(!t.type||!TOWER_TYPES[t.type]){towers.splice(towers.indexOf(t),1);return;}
      t.x = Math.max(TOWER_PLACE_MIN_X, Math.min(TOWER_PLACE_MAX_X, t.x||400));
      // v52：前排塔恢复位置（墙外战场），后排夹紧平台
      if(t.front){
        t.x = Math.max(RIGHT_WALL_X+60, Math.min(1400, t.x||800));
        t.y = GROUND_Y - 40;
      }else{
        t.y = PLATFORM_TOP - 40;
      }
      t.slotIdx = 0;
      // v52塔防强化：旧档塔无HP字段时按等级补齐
      const tt=TOWER_TYPES[t.type];
      if(t.hp===undefined||t.hpMax===undefined){
        t.hpMax=Math.round((tt.hp||150)*(1+0.4*(t.level-1)));
        t.hp=t.hpMax;
      }
      t.hitFlash=0;
    });
    // 丢弃后重新紧凑数组
    towers = towers.filter(t=>t&&t.type&&TOWER_TYPES[t.type]);
  } else { towers = []; }
  if (state.traps && Array.isArray(state.traps)) {
    traps = state.traps.map(tr => ({ ...tr }));
  } else { traps = []; }
  wallHp = state.wallHp ?? WALL_HP_PER_LEVEL[1];
  wallLevel = state.wallLevel ?? 1;
  // v52修：先恢复上限再恢复当前值——旧顺序用本局的 HOME_HP_MAX(100) 兜底 homeHp，
  // 强化过的存档（如上限300）读回来血量被错误基准钳制
  HOME_HP_MAX = state.HOME_HP_MAX ?? 100;
  homeHp = Math.min(state.homeHp ?? HOME_HP_MAX, HOME_HP_MAX);

  // ── v52修：等级/经验/天赋进度恢复（原本读档后等级天赋全丢）──
  playerLevel = state.playerLevel ?? 1;
  playerXp = state.playerXp ?? 0;
  playerXpNeed = state.playerXpNeed ?? 100;
  if (state.playerPerks) {
    Object.keys(playerPerks).forEach(k=>delete playerPerks[k]);
    Object.keys(state.playerPerks).forEach(k=>{ if(state.playerPerks[k]>0) playerPerks[k]=state.playerPerks[k]; });
  }
  perkPendingLevels = state.perkPendingLevels ?? 0;

  // 恢复旧小镇状态
  if (state.hiddenChestsFound && hiddenChests.length === state.hiddenChestsFound.length) {
    hiddenChests.forEach((c, i) => { c.found = state.hiddenChestsFound[i]; });
  }
  if (state.oldTownEventsTriggered && oldTownEvents.length === state.oldTownEventsTriggered.length) {
    oldTownEvents.forEach((ev, i) => { ev.triggered = state.oldTownEventsTriggered[i]; });
  }
  gasStationExploded = state.gasStationExploded ?? false;

  // 恢复成就
  if (state.achievementsUnlocked) {
    state.achievementsUnlocked.forEach(k => { if (achievements[k]) achievements[k].unlocked = true; });
  }

  // 恢复餐厅系统（跨夜保留）
  restRep = state.restRep ?? 0;
  if (state.restUpgradeLevel) {
    restUpgradeLevel.stoves = state.restUpgradeLevel.stoves ?? 3;
    restUpgradeLevel.tables = state.restUpgradeLevel.tables ?? 4;
    restUpgradeLevel.decor = state.restUpgradeLevel.decor ?? 0;
  }
  if (state.restHiredStaff && Array.isArray(state.restHiredStaff)) {
    restHiredStaff = state.restHiredStaff.map(s => ({ ...s, level: s.level || 1, xp: s.xp || 0 }));  // 员工养成等级随档保留
  }
  if (state.meatInventory) {
    meatInventory.normal = state.meatInventory.normal ?? 0;
    meatInventory.fast = state.meatInventory.fast ?? 0;
    meatInventory.tank = state.meatInventory.tank ?? 0;
    meatInventory.elite = state.meatInventory.elite ?? 0;
  }
  if (state.backpackInventory && typeof backpackInventory !== 'undefined') {
    backpackInventory = { ...state.backpackInventory };
    if (typeof syncBackpackToGlobals === 'function') syncBackpackToGlobals();
  }
  restPendingInfluencerBoost = state.restPendingInfluencerBoost ?? 0;
  // 经营重做：恢复菜单注册与菜品增益
  tonightMenu = (state.tonightMenu && Array.isArray(state.tonightMenu)) ? [...state.tonightMenu] : [];
  queuedBattleBuffs = (state.queuedBattleBuffs && Array.isArray(state.queuedBattleBuffs)) ? state.queuedBattleBuffs.map(b => ({...b})) : [];
  activeBattleBuffs = (state.activeBattleBuffs && Array.isArray(state.activeBattleBuffs)) ? state.activeBattleBuffs.map(b => ({...b})) : [];
  // 恢复Wastegram粉丝和VIP图鉴
  wastegramFans = state.wastegramFans ?? 0;
  wastegramRank = state.wastegramRank ?? 'E';
  vipCompendium = state.vipCompendium ? JSON.parse(JSON.stringify(state.vipCompendium)) : {};
  // ── v49批4/1/2：叙事flag/流派/武器成长恢复 ──
  restStoryTriggered = state.restStoryTriggered ? {...state.restStoryTriggered} : {};
  if(state.playerClassId){
    playerClass = START_CLASSES.find(c=>c.id===state.playerClassId) || null;
    if(playerClass){
      // v52修：读档恢复流派被动天赋层数（applyStartClass 只在开局选人时走，读档曾把流派加成全丢）
      const cls = playerClass;
      Object.keys(cls.perks||{}).forEach(pid=>{ playerPerks[pid]=(playerPerks[pid]||0)+cls.perks[pid]; });
      addBanner(`${playerClass.icon} 流派「${playerClass.name}」已恢复`);
    }
  }
  // 恢复流派技能状态与HUD按钮（防狼人读档黑屏或状态失效）
  window._classSkillT = 0;
  window._classSkillCd = 0;
  skillWolves.length = 0;
  try{ updateClassSkillBtn(); }catch(e){}
  // 恢复武器基础定义并重新应用超武觉醒
  if (typeof resetWeaponDefs === 'function') resetWeaponDefs();
  weaponLevels = state.weaponLevels ? JSON.parse(JSON.stringify(state.weaponLevels)) : {};
  if (typeof SUPER_WEAPON_EVOLUTIONS !== 'undefined') {
    Object.keys(weaponLevels).forEach(wid => {
      const rec = weaponLevels[wid];
      if (rec && rec.isSuperEvolved && SUPER_WEAPON_EVOLUTIONS[wid]) {
        const w = WEAPONS.find(x => x.id === wid);
        if (w) {
          SUPER_WEAPON_EVOLUTIONS[wid].apply(w);
          rec.evoName = SUPER_WEAPON_EVOLUTIONS[wid].name;
          rec.isSuperEvolved = true;
          rec.evoBranch = 'super_evolved';
          rec.evoQueued = true;
        }
      }
    });
  }
  window._annGranted = !!state.annGranted;
  // ── v55 小胡军备改造台与战前特餐持久化恢复 ──
  if (state.duffWeaponMods) {
    duffWeaponMods = JSON.parse(JSON.stringify(state.duffWeaponMods));
  } else {
    duffWeaponMods = {};
  }
  if (state.activeTacticalMealId && typeof TACTICAL_FEASTS !== 'undefined') {
    activeTacticalMeal = TACTICAL_FEASTS.find(f => f.id === state.activeTacticalMealId) || null;
  } else {
    activeTacticalMeal = null;
  }
  if (typeof updateTacticalMealHUD === 'function') updateTacticalMealHUD();
  updateXpBar();  // v52：恢复等级后同步经验条UI

  zombies.forEach(z => { if (z.burnTimer) clearInterval(z.burnTimer); });
  zombies = [];
  bullets = [];
  bossProjList = [];
  particles.length = 0;
  poisonPools.length = 0;
  boss = null;
  bossActive = false;
  endingTriggered = false;
  
  scEl.textContent = score;
  killsEl.textContent = killCount;
  bestEl.textContent = best;
  updateHpUI();
  updateCoinUI();
  // 确保 curWpnIdx 指向已拥有的武器
  if(!ownedWeaponsSet.has(curWpnIdx))curWpnIdx=ownedWeapons[0]||0;
  buildWeaponBar();
  refreshWBar();
  updateAmmoUI();
  waveTxt.textContent = '第 ' + wave + ' 波';
  bossHpBar.style.display = 'none';
  setInteractPrompt(null);
  
  if (isMobile()) {
    buildMobileWpnStrip();
    updateMobileStatus();
  }
  
  if (!gameRunning) {
    gameRunning = true;
    cancelAnimationFrame(animFrame);
    gameLoop();
    // 恢复后重新启动当前波（不走章节卡，直接进入波次正文）
    wavePhase = 'waiting';
    waveSpawnQueue = 0;
    envNarratedIdx = 0;
    // 重新触发当前波内容（对话+刷怪/Boss）
    const w = wave;
    wave--; // nextWave 会 wave++
    nextWave();
  }
}

buildWeaponBar();

// ═══════════════════════════════════════════

//  【系统模块 C4】START / END（游戏开始/结束）
// ═══════════════════════════════════════════
function startGame(){
  startBGM();
  initHiddenChests();
  initOldTownEvents();
  oldTownWanderers = [];
  gasStationExploded = false;
  oldTownMiniBoss = null;
  if(typeof stopMenuBgAnimation === 'function') stopMenuBgAnimation();
  try{ sndBtnClick(); }catch(e){}
  if(typeof closeDuffWorkshop === 'function') closeDuffWorkshop();
  if(typeof closeTacticalFeastModal === 'function') closeTacticalFeastModal();
  if(typeof resetWeaponDefs === 'function') resetWeaponDefs();
  weaponLevels = {};
  duffWeaponMods = {};
  activeTacticalMeal = null;
  wsActiveSlot = 0;
  if(typeof updateTacticalMealHUD === 'function') updateTacticalMealHUD();
  // 隐藏主菜单和其他界面
  document.getElementById('main-menu-scr').style.display='none';
  document.getElementById('start-scr').style.display='none';
  document.getElementById('over-scr').style.display='none';
  document.getElementById('pause-scr').style.display='none';
  closeShop();stopAuto();
  // v53 & v55：清空局内瞬态与战斗上下文（引信/狼群/火海/狂暴/流派技能等）——防上一局残留
  fuseList.length=0;skillWolves.length=0;
  if(typeof RuntimeBattleContext !== 'undefined') RuntimeBattleContext.reset();
  score=0;health=100;maxHp=100;coins=150;wave=1;killCount=0;isReloading=false;curWpnIdx=0;frameT=0;bossCount=0;
  moraleBuff=0;  // 重置士气加成
  cameraX=0;lastMX=400;lastMY=300;endingTriggered=false;scoutView=false;
  Object.keys(upgrades).forEach(k=>upgrades[k]=0);
  mingToughness = 0;  // 重置小胡硬汉被动
  hiredCompanions = [];
  gameState = 'world';
  activeBuilding = null;
  buildingReturnState = null;
  if(typeof resetBackpackInventory === 'function') resetBackpackInventory();
  if(typeof syncBackpackToGlobals === 'function') syncBackpackToGlobals();
  if(typeof closeBackpack === 'function') closeBackpack();
  if(typeof closeExpeditionModal === 'function') closeExpeditionModal();
  safehouseRestUsed = false;
  safehouseCraftUsed = false;
  damageBuffActive = false;
  combo=0; comboTimer=0; lastComboMilestone=0; comboFlash=0; hitstop=0; progressMilestone=0;
  updateComboHUD();
  if(wpFill)wpFill.style.width='0%';
  // 重置波次系统状态（阶段一-3：用 waiting 等待章节卡/对话结束再开始 spawning）
  wavePhase='waiting';waveSpawnQueue=0;waveSpawnTimer=0;waveTotalThisWave=0;waveKilledThisWave=0;envNarratedIdx=0;
  bufferWaveLevel = 0;  // 重置缓冲期等级
  bufferWaveThreat = 0;  // 重置缓冲期威胁
  window.__waveSpecial = 'normal';  // 重置波次特殊类型
  document.getElementById('chapter-scr').style.display='none';
  chapterCardCallback = null;
  clearTimeout(chapterCardTimer);
  
  woodPlanks = 0;
  scrapMetal = 0;
  meatInventory = { normal: 5, fast: 0, tank: 0, elite: 0 };  // 重置肉块库存（给5块普通肉让玩家第一波就能进餐厅体验）
  // 重置餐厅系统（新游戏从头开始经营）
  restRep = 0;
  restHiredStaff = [];
  restUpgradeLevel = { stoves: 3, tables: 4, decor: 0 };
  restPendingInfluencerBoost = 0;  // 清空跨夜网红加成
  // 经营重做：新游戏重置菜单/增益（防上一局残留）
  tonightMenu = [];
  queuedBattleBuffs = [];
  activeBattleBuffs = [];
  moraleBuff = 0;
  wastegramFans = 0;  // 重置粉丝数（从0开始，第一夜服务顾客快速积累）
  wastegramRank = 'E';  // 重置社媒评级
  vipCompendium = {};  // 重置VIP图鉴
  vipActiveInRestaurant = null;  // 重置VIP占位
  currentTrend = null;  // 重置今日热搜
  lastSMRankIdx = 0;  // 重置社媒等级索引
  tutorialSeen = {};  // 重置教程（新游戏重新教学）
  cabinUpgrades.turret = 0;
  cabinUpgrades.barricade = 0;
  cabinUpgrades.supplier = 0;
  cabinUpgrades.fortify = 0;
  cabinUpgrades.farm = 0;
  cabinUpgrades.watchtower = 0;
  cabinCrates.ammoSpawned = false;
  cabinCrates.medkitSpawned = false;
  lootDrops = [];
  turretCooldown = 0;
  // ── 末世武器极其珍贵，开局严禁无脑空投超级武器 ──
  window._annGranted = false;
  // 重置家园塔防系统
  HOME_HP_MAX = 100; homeHp = HOME_HP_MAX;
  towers = []; traps = []; nextTowerSlot = 0; placementMode = null; closeTowerPopover();
  wallHp = WALL_HP_PER_LEVEL[1]; wallLevel = 1; restTimerVal = 0; wavePhase = 'waiting';  // 开局自带1级木栅栏
  
  Object.keys(buildingInteriorCleared).forEach(k => buildingInteriorCleared[k] = (k === 'cabin'));
  Object.keys(buildingInteriorLooted).forEach(k => buildingInteriorLooted[k] = false);
  buildingInteriorZombies = [];
  wAmmo=WEAPONS.map(w=>w.maxAmmo);
  WEAPONS.forEach(w=>{
    if(w.id==='minigun'){w.heat=0;w.overheated=false;}
  });
  // 重置武器库存：开局拥有 startOwned 标记的武器（手枪+霰弹枪）
  ownedWeapons=WEAPONS.map((w,i)=>w.startOwned?i:-1).filter(i=>i>=0);
  refreshOwnedSet();
  curWpnIdx=ownedWeapons[0]||0;
  zombies.forEach(z=>{if(z.burnTimer){clearInterval(z.burnTimer);z.burnTimer=null;}});
  zombies=[];bullets=[];bossProjList=[];particles.length=0;poisonPools.length=0;
  boss=null;bossActive=false;
  shakeX=0;shakeY=0;redFlash=0;orangeFlash=0;purpleFlash=0;
  // 重置新增特效状态
  muzzleFlashT=0;reloadAnimT=0;shootRecoil=0;
  reloadWpnId='pistol';reloadPhase=0;reloadMagDrop=null;
  muzzleLightFlash=0;critFlash=0;smokeAccum=0;
  clearReloadSounds();
  // Reset dialogue state
  closeDlg();
  // 重置全屏剧情对话状态
  if(cinActive){ cinActive=false; cinQueue=[]; cinOnStage={}; clearTimeout(cinTypeTimer); clearTimeout(cinAutoplayTimer);
    const cs=document.getElementById('cinematic-scr'); if(cs)cs.classList.remove('open');
    const stg=document.getElementById('cinematic-stage'); if(stg)stg.querySelectorAll('.cin-npc').forEach(el=>el.remove());
  }
  storySceneIdx=0;
  vehicle.exists=false;vehicle.entered=false;vehicle.hp=150;vehicle.vx=0;
  sprite.exists=false;sprite.level=1;sprite.attackTimer=180;sprite.healTimer=480;sprite.shieldReady=true;
  // Bug修复：#weapon-bar/#hud/#m-status 也是 game-wrap 的直接div子节点但从未进豁免名单——
  // 第二局起会被此清理删掉，随后 buildWeaponBar 对 null 写 innerHTML 崩溃。加入豁免。
  document.querySelectorAll('#game-wrap > div:not(.overlay):not(canvas):not(#emergency-retreat-hud):not(#tactical-door-wipe):not(#shop-scr):not(#cabin-scr):not(#boss-hpbar):not(#vehicle-prompt):not(#dialogue-box):not(#combo-hud):not(#combo-vignette):not(#chapter-scr):not(#world-progress):not(#home-hp-hud):not(#touch-overlay):not(#tower-popover):not(#cinematic-scr):not(#restaurant-scr):not(#transition-overlay):not(#rest-end-scr):not(#dave-transition):not(#tutorial-scr):not(#codex-scr):not(#vip-compendium-scr):not(#main-menu-scr):not(#settings-scr):not(#wastegram-hud):not(#wastegram-notify):not(#weapon-bar):not(#hud):not(#m-status):not(#wave-dlg-bar):not(#backpack-modal):not(#expedition-modal):not(#duff-workshop-modal):not(#tactical-feast-modal)').forEach(e=>e.remove());
  scEl.textContent='0';killsEl.textContent='0';updateHpUI();updateCoinUI();
  buildWeaponBar();refreshWBar();updateAmmoUI();
  waveTxt.textContent='第 1 波';bossHpBar.style.display='none';setInteractPrompt(null);
  if(isMobile()){buildMobileWpnStrip();updateMobileStatus();}
  rldBtn.disabled=false;rldW.style.display='none';clearInterval(reloadTimer);
  keys.l=false;keys.r=false;keys.j=false;
  // 重置等级系统 + 闪避状态 + 肉鸽天赋（任务7）
  playerLevel=1;playerXp=0;playerXpNeed=35;levelUpFlash=0;dodgeT=0;dodgeCd=0;
  perkPendingLevels=0;perkChoiceActive=false;
  Object.keys(playerPerks).forEach(k=>delete playerPerks[k]);
  // 重置肉鸽天赋状态变量（狼化/先锋/连锁处决）
  window._berserkActive=false;window._berserkUsed=false;window._berserkTimer=0;
  window._vanguardBuffT=0;window._chainkillBuff=0;clearTimeout(window._chainkillTimer);
  window._railCharge=0;  // v52修：磁轨充能跨局残留，新局首发即触发爆射路径
  document.getElementById('perk-choice-scr').style.display='none';
  updateXpBar();
  player.x=100;player.y=PLATFORM_TOP-CHAR_H;player.vx=0;player.vy=0;player.onGround=true;player.facingRight=true;player.iframes=0;player.walkT=0;
  timeOfDay = 'day';  // 游戏开始时是白天
  updateTodHUD();
  gameRunning=true;cancelAnimationFrame(animFrame);gameLoop();
  // 启动第1波：先播放序章全屏剧情（NPC友军主动走过来与玩家对话），再进入第1波
  // nextWave 会 wave++ 变成2，所以手动设 wave=0 再调用
  wave=0;
  playerClass = null;  // 批1：重置流派（新局重选）
  showCinematic(CINEMATIC_INTRO, ()=>{
    // 序章结束 → v49批1：先选流派（每局构筑核心），再教程，再第1波
    showClassChoice(()=>{
      showOpeningTutorial(()=>nextWave());
    });
  });
}

// 开局新手教程：介绍塔防系统+商店系统，教程期间不出僵尸
function showOpeningTutorial(onComplete){
  const tutScr = document.getElementById('tutorial-scr');
  if(!tutScr){ onComplete(); return; }
  tutScr.style.display = 'flex';
  tutScr.classList.add('show');
  sndShopOpen();
  // 直接调用多步教程（第1步=基础操作）
  setupTutorialSteps(onComplete);
}

let _tutorialStep = 0;
let _tutorialCompleteCb = null;
function setupTutorialSteps(onComplete){
  _tutorialStep = 0;
  _tutorialCompleteCb = onComplete;
  // 教程有多步内容
  const steps = [
    {
      title: '🎮 新手教程 · 第1步：基础操作',
      html: `<div style="text-align:left;line-height:1.7;">
        <div style="background:rgba(40,60,90,.3);padding:6px 10px;border-radius:4px;border-left:3px solid #5be4ff;margin-bottom:8px;">
          <b>🎯 目标：</b>守住城堡15波尸潮，活到直升机撤离。
        </div>
        <div style="margin-bottom:6px;"><b>A/D 或 ←/→</b> 移动 · <b>鼠标</b> 瞄准射击 · <b>R</b> 换弹</div>
        <div style="margin-bottom:6px;"><b>空格/Shift</b> 翻滚闪避（无敌帧）· <b>F</b> 近战 · <b>右键</b> 蓄力重击 · <b>X</b> 流派觉醒技</div>
        <div style="margin-bottom:6px;"><b>TAB</b> 武器商店 · <b>E</b> 拾取/交互 · 靠近高地基座按 [E] 部署机枪塔</div>
        <div style="color:#ffcc66;margin-top:8px;">💡 教程期间不出僵尸，请熟悉操作。点击"下一步"继续。</div>
      </div>`
    },
    {
      title: '🛒 第2步：武器商店（TAB）',
      html: `<div style="text-align:left;line-height:1.7;">
        <div style="background:rgba(60,40,20,.4);padding:6px 10px;border-radius:4px;border-left:3px solid #f0c060;margin-bottom:8px;">
          <b>按 TAB</b> 随时打开武器商店（波次进行中也能买）。
        </div>
        <div style="margin-bottom:6px;">💰 金币来自击杀僵尸和清波奖励。</div>
        <div style="margin-bottom:6px;">🔫 商店卖各种武器：手枪/霰弹/狙击/喷火/火箭筒...每种有<b>独特特性</b>。</div>
        <div style="margin-bottom:6px;">⚙️ 也可买<b>升级</b>：伤害+、移速+、护甲+、弹匣+等。</div>
        <div style="color:#ffcc66;margin-top:8px;">💡 只能携带2把武器，新武器会替换旧的（旧的掉地上可捡回）。</div>
      </div>`
    },
    {
      title: '🧱 第3步：围墙与塔防',
      html: `<div style="text-align:left;line-height:1.7;">
        <div style="background:rgba(60,20,20,.4);padding:6px 10px;border-radius:4px;border-left:3px solid #ff6644;margin-bottom:8px;">
          <b>围墙是你的生命线！</b>僵尸从右侧冲过来，先撞围墙。
        </div>
        <div style="margin-bottom:6px;">🗼 <b>防御哨塔</b>：靠近城堡高地基座按 <b>[E] 键</b>一键部署并升级机枪塔，自动索敌倾泻火力，压制迫近尸潮。</div>
        <div style="margin-bottom:6px;">⚔️ <b>双轴克制</b>：装甲怪(🗡️高护甲)用能量穿甲打；抗性怪(⚡高魔抗)用物理实弹打。看图鉴抗性选武器。</div>
        <div style="margin-bottom:6px;">🧱 <b>围墙</b>：木→石→铁。是守家生命线，墙破后你每秒持续掉血！</div>
        <div style="margin-bottom:6px;">🗡️ <b>陷阱</b>：地刺(多充能)/地雷(单发高伤)。放在墙外。</div>
        <div style="color:#ff6644;margin-top:8px;">💡 围墙=生命。墙在人在，墙破人亡。每波清剿奖励足够补一座塔。</div>
      </div>`
    },
    {
      title: '🏠 第4步：据点与餐厅',
      html: `<div style="text-align:left;line-height:1.7;">
        <div style="background:rgba(40,60,20,.4);padding:6px 10px;border-radius:4px;border-left:3px solid #5bba6f;margin-bottom:8px;">
          每波清场后进入<b>缓冲期</b>：外界僵尸暴增5倍！必须进据点避难。
        </div>
        <div style="margin-bottom:6px;">🚪 走到城堡门按 <b>E</b> 或 <b>N</b> 进入据点。</div>
        <div style="margin-bottom:6px;">🛏️ <b>床</b>：按E睡觉回满血。</div>
        <div style="margin-bottom:6px;">⚒️ <b>据点管理</b>：升级围墙、买塔防、买陷阱。</div>
        <div style="margin-bottom:6px;">🍳 <b>秘密餐厅</b>：用僵尸肉做菜赚金币+声望！每夜90秒营业。</div>
        <div style="margin-bottom:6px;">⚔️ <b>出击门</b>：按E或B出击下一波（缓冲期硬刚5倍僵尸）。</div>
        <div style="color:#5bba6f;margin-top:8px;">💡 推荐：进餐厅经营→赚金币→黎明出击下一波。</div>
      </div>`
    },
    {
      title: '🧟 第5步：僵尸图鉴',
      html: `<div style="text-align:left;line-height:1.7;">
        <div style="background:rgba(60,20,60,.4);padding:6px 10px;border-radius:4px;border-left:3px solid #cc66cc;margin-bottom:8px;">
          顶部 <b>🧟图鉴</b> 按钮可查看所有僵尸的特性。
        </div>
        <div style="margin-bottom:6px;">📊 12种僵尸：普通/装甲/特殊/精英 4个层级。</div>
        <div style="margin-bottom:6px;">🔓 每首次击杀一种新僵尸，会<b>弹窗介绍</b>它的机制和弱点。</div>
        <div style="margin-bottom:6px;">🛡️ 装甲僵尸：先打掉护甲(路障/铁桶)才能有效伤害。</div>
        <div style="margin-bottom:6px;">🚪 特殊僵尸：弹跳狂尸会越墙、自爆者死亡爆炸、火焰投手远距火球。</div>
        <div style="color:#cc66cc;margin-top:8px;">💡 了解敌人=克敌制胜。遇到新僵尸记得看图鉴！</div>
      </div>`
    },
    {
      title: '⚔️ 准备好了！第1波即将开始',
      html: `<div style="text-align:left;line-height:1.7;">
        <div style="background:rgba(60,40,20,.4);padding:6px 10px;border-radius:4px;border-left:3px solid #ffee44;margin-bottom:8px;">
          <b>最后提醒：</b>
        </div>
        <div style="margin-bottom:6px;">✅ 开局配备 <b>战术自卫手枪</b>（基础伤害14，弹夹10发），200金币，5块普通肉。</div>
        <div style="margin-bottom:6px;">✅ 第1波普通感染者（HP 80），爆头精准回弹，走位拉扯度过初期尸潮。</div>
        <div style="margin-bottom:6px;">✅ 每5波一个Boss（第5/10/15波），提前升级围墙和武器。</div>
        <div style="margin-bottom:6px;">✅ 升级会弹<b>三选一天赋</b>，肉鸽元素，每局不同。</div>
        <div style="color:#ff4444;margin-top:8px;font-weight:bold;">💀 这游戏有难度！墙破=持续掉血，死了从头来。祝你好运。</div>
      </div>`
    },
  ];
  // 渲染当前步
  const bodyEl = document.getElementById('tutorial-body');
  function renderStep(){
    const step = steps[_tutorialStep];
    if(!step){
      // 教程结束
      dismissTutorial();
      if(_tutorialCompleteCb) _tutorialCompleteCb();
      return;
    }
    document.getElementById('tutorial-title').innerHTML = step.title;
    bodyEl.innerHTML = step.html + `<div style="margin-top:10px;text-align:center;">
      <button class="big-btn" id="tut-next-btn" style="font-size:.85rem;padding:6px 24px;">${_tutorialStep < steps.length-1 ? '下一步 ▶' : '开始战斗 ⚔️'}</button>
      <button class="big-btn" id="tut-skip-btn" style="font-size:.75rem;padding:6px 16px;margin-left:8px;border-color:#6a5a4a;color:#b0a284;">跳过教程</button>
    </div>`;
    document.getElementById('tut-next-btn').onclick = () => {
      sndClick();
      _tutorialStep++;
      renderStep();
    };
    document.getElementById('tut-skip-btn').onclick = () => {
      sndClick();
      _tutorialStep = steps.length;
      renderStep();
    };
  }
  renderStep();
}
function endGame(){
  stopBGM();
  gameRunning=false;stopAuto();cancelAnimationFrame(animFrame);
  clearTimeout(spawnTimer);clearInterval(waveTimer);clearInterval(reloadTimer);clearInterval(shopTimerInterval);
  clearReloadSounds();
  isReloading=false;reloadAnimT=0;reloadPhase=0;reloadMagDrop=null;
  scoutView=false;const bs=document.getElementById('btn-scout');if(bs)bs.classList.remove('active');
  closeTowerPopover();
  zombies.forEach(z=>{if(z.burnTimer)clearInterval(z.burnTimer);});
  if(score>best){best=score;bestEl.textContent=best;}
  // 播放死亡过渡，中点显示结算
  playTransition('death', '据点沦陷', '第 ' + wave + ' 波 · 击杀 ' + killCount + ' 只', '殁',
    () => {
      document.getElementById('over-txt').textContent=`击杀 ${killCount} 只僵尸 · 第 ${wave} 波 · 得分 ${score}`;
      document.getElementById('over-scr').style.display='flex';
    }, 2000);
}

function togglePause() {
  if (!gameRunning) return;
  // 不允许在戴夫式过渡期间暂停（避免过渡的 setTimeout 在存档/读档后误触发）
  const daveOv = document.getElementById('dave-transition');
  if (daveOv && daveOv.classList.contains('active')) {
    addBanner('过渡动画中，无法暂停');
    return;
  }
  gamePaused = !gamePaused;
  const pauseScr = document.getElementById('pause-scr');
  if (gamePaused) {
    keys.holdInteract = false;
    if(cabinHoldActive) cancelCabinHold();
    pauseScr.style.display = 'flex';
    stopAuto();
  } else {
    pauseScr.style.display = 'none';
  }
}

// ═══════════════════════════════════════════

// ── 全局页面载入初始化 (Block 06 Initialization) ──
initHiddenChests();
initOldTownEvents();
