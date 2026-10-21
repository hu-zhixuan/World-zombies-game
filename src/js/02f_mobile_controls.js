// ═══════════════════════════════════════════
//  MOBILE TOUCH CONTROLS
// ═══════════════════════════════════════════
const isMobile = ()=> window.innerWidth <= 840 || ('ontouchstart' in window);

// ── Joystick ──────────────────────────────
const joyZone  = document.getElementById('joy-zone');
const joyKnob  = document.getElementById('joy-knob');
const JOY_R    = 34; // max knob travel radius
let joyActive  = false;
let joyId      = -1;
let joyOx=0, joyOy=0; // origin of this touch

function joyStart(e){
  e.preventDefault();
  const t = e.changedTouches[0];
  joyId = t.identifier;
  const r = joyZone.getBoundingClientRect();
  joyOx = r.left + r.width/2;
  joyOy = r.top  + r.height/2;
  joyActive = true;
  joyMove(e);
}
function joyMove(e){
  e.preventDefault();
  if(!joyActive) return;
  let t = null;
  for(let i=0;i<e.touches.length;i++) if(e.touches[i].identifier===joyId){t=e.touches[i];break;}
  if(!t) return;
  const dx = t.clientX - joyOx;
  const dy = t.clientY - joyOy;
  const dist = Math.sqrt(dx*dx+dy*dy);
  const clamp = Math.min(dist, JOY_R);
  const nx = dist>0 ? dx/dist : 0;
  const ny = dist>0 ? dy/dist : 0;
  // Move knob visually
  joyKnob.style.transform = `translate(calc(-50% + ${nx*clamp}px), calc(-50% + ${ny*clamp}px))`;
  // Map to keys — horizontal only (vertical would be jump, handled by btn)
  keys.l = nx < -0.35 && clamp > 8;
  keys.r = nx >  0.35 && clamp > 8;
  // Vertical: swipe up = jump
  if(ny < -0.5 && clamp > 20 && player.onGround) keys.j = true;
  else if(ny >= -0.3) keys.j = false;
}
function joyEnd(e){
  e.preventDefault();
  let found = false;
  for(let i=0;i<e.touches.length;i++) if(e.touches[i].identifier===joyId) found=true;
  if(!found){
    joyActive=false; joyId=-1;
    keys.l=false; keys.r=false; keys.j=false;
    joyKnob.style.transform='translate(-50%,-50%)';
  }
}
joyZone.addEventListener('touchstart', joyStart, {passive:false});
joyZone.addEventListener('touchmove',  joyMove,  {passive:false});
joyZone.addEventListener('touchend',   joyEnd,   {passive:false});
joyZone.addEventListener('touchcancel',joyEnd,   {passive:false});

// ── Fire button ───────────────────────────
const btnFire = document.getElementById('btn-fire');
let fireTouch = -1;
let fireTouchInterval = null;

function touchFire(toX, toY) {
  if (!gameRunning || shopOpen || cabinUIOpen) return;
  mouseHeld = true;
  const near = findNearestEnemy(player.x + CHAR_W / 2, player.y + CHAR_H / 2, 9999);
  if (near) {
    lastMX = near.x;
    lastMY = near.y;
  }
  fireWeapon(lastMX, lastMY);
}

btnFire.addEventListener('touchstart', e => {
  e.preventDefault();
  btnFire.classList.add('pressed');
  const t = e.changedTouches[0];
  fireTouch = t.identifier;
  touchFire(lastMX, lastMY);
  // v52修：清旧间隔防堆叠；近战自动武器不建循环（同黑屏根因）
  if (fireTouchInterval) { clearInterval(fireTouchInterval); fireTouchInterval = null; }
  if ((cw().autofire || cw().id === 'minigun') && !cw().meleeWeapon) {
    fireTouchInterval = setInterval(() => { if (gameRunning && !shopOpen && !cabinUIOpen) touchFire(lastMX, lastMY); }, getFireInterval());
  }
}, { passive: false });
btnFire.addEventListener('touchend', e => {
  e.preventDefault();
  btnFire.classList.remove('pressed');
  mouseHeld = false;
  if (fireTouchInterval) { clearInterval(fireTouchInterval); fireTouchInterval = null; }
  fireTouch = -1;
  stopAuto();
}, { passive: false });

// ── Jump button ───────────────────────────
const btnJump = document.getElementById('btn-jump');
btnJump.addEventListener('touchstart', e => {
  e.preventDefault();
  btnJump.classList.add('pressed');
  keys.j = true;
}, { passive: false });
btnJump.addEventListener('touchend', e => {
  e.preventDefault();
  btnJump.classList.remove('pressed');
  keys.j = false;
}, { passive: false });

// ── Dodge button (mobile) ─────────────────
const btnDodge = document.getElementById('btn-dodge');
if(btnDodge){
  btnDodge.addEventListener('touchstart', e => {
    e.preventDefault();
    btnDodge.classList.add('pressed');
    tryDodge();
  }, { passive: false });
  btnDodge.addEventListener('touchend', e => {
    e.preventDefault();
    btnDodge.classList.remove('pressed');
  }, { passive: false });
}

// ── Reload button ─────────────────────────
document.getElementById('btn-reload').addEventListener('touchstart', e => {
  e.preventDefault(); reloadWeapon();
}, { passive: false });

// ── v53 Class skill button (mobile) ───────
const btnSkill = document.getElementById('btn-skill');
if(btnSkill){
  btnSkill.addEventListener('touchstart', e => {
    e.preventDefault();
    btnSkill.classList.add('pressed');
    tryClassSkill();
  }, { passive: false });
  btnSkill.addEventListener('touchend', e => {
    e.preventDefault();
    btnSkill.classList.remove('pressed');
  }, { passive: false });
}

// ── Shop button mobile ────────────────────
document.getElementById('btn-shop-m').addEventListener('touchstart', e => {
  e.preventDefault(); if (shopOpen) closeShop(); else openShop();
}, { passive: false });
const bBp = document.getElementById('btn-backpack');
if (bBp) {
  bBp.addEventListener('touchstart', e => {
    e.preventDefault();
    toggleBackpack();
  }, { passive: false });
}

// ── Vehicle / Interact button (Mobile) ────
const btnVehicle = document.getElementById('btn-vehicle');
if(btnVehicle){
  const onMobileInteractStart = (e) => {
    e.preventDefault();
    keys.holdInteract = true;
    if((isHordeThreatActive() || wavePhase === 'cleared') && gameState === 'world'){
      if(typeof unboxActive !== 'undefined' && unboxActive){ closeUnboxCard(true); return; }
      if(typeof rescueNearestCompanion === 'function' && rescueNearestCompanion()) return;
      if(tryPickupWeaponCrate()) return;
      if(isPlayerNearCabin()){
        if(wavePhase === 'cleared'){
          enterCabinShelter();
        } else {
          startCabinHold();
        }
      } else {
        addBanner('🏃 距离小屋太远！快向左撤回据点小屋门前！');
      }
      return;
    }
    handleInteractAction();
  };
  const onMobileInteractEnd = (e) => {
    e.preventDefault();
    keys.holdInteract = false;
    if(cabinHoldTimer > 0 || cabinHoldActive) cancelCabinHold();
  };
  btnVehicle.addEventListener('touchstart', onMobileInteractStart, { passive: false });
  btnVehicle.addEventListener('touchend', onMobileInteractEnd, { passive: false });
  btnVehicle.addEventListener('touchcancel', onMobileInteractEnd, { passive: false });
  btnVehicle.addEventListener('pointerdown', onMobileInteractStart);
  btnVehicle.addEventListener('pointerup', onMobileInteractEnd);
  btnVehicle.addEventListener('pointercancel', onMobileInteractEnd);
}

// ── Scout view button (mobile) ────────────
const btnScout = document.getElementById('btn-scout');
btnScout.addEventListener('touchstart', e => {
  e.preventDefault();
  scoutView = true;
  btnScout.classList.add('active');
}, { passive: false });
btnScout.addEventListener('touchend', e => {
  e.preventDefault();
  scoutView = false;
  btnScout.classList.remove('active');
}, { passive: false });
btnScout.addEventListener('touchcancel', e => {
  scoutView = false;
  btnScout.classList.remove('active');
}, { passive: false });

// ── Canvas touch = aim ────────────────────
// 放置模式：触摸点击地图放置塔/陷阱
canvas.addEventListener('touchstart', e => {
  if(!gameRunning||shopOpen||cabinUIOpen)return;
  if(placementMode){
    e.preventDefault();
    const r=canvas.getBoundingClientRect(),sx=GW/r.width,sy=GH/r.height;
    const t=e.changedTouches[0];
    const wx=(t.clientX-r.left)*sx+cameraX;
    const wy=(t.clientY-r.top)*sy;
    lastMX=wx; lastMY=wy;
    let placed=false;
    if(placementMode.type==='tower'){placed=placeTower(placementMode.towerType, wx);}
    else if(placementMode.type==='trap'){placed=placeTrap(placementMode.trapType, wx);}
    if(placed) placementMode=null;
    return;
  }
  // 触摸点击塔 → 打开弹窗
  const r=canvas.getBoundingClientRect(),sx=GW/r.width,sy=GH/r.height;
  const t=e.changedTouches[0];
  const wx=(t.clientX-r.left)*sx+cameraX, wy=(t.clientY-r.top)*sy;
  for(let i=0;i<towers.length;i++){
    const tw=towers[i];
    if(Math.abs(wx-tw.x)<22 && Math.abs(wy-tw.y)<30){e.preventDefault();showTowerPopover(i);return;}
  }
  closeTowerPopover();  // 点空白处关闭
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect(), sx = GW / r.width, sy = GH / r.height;
  const t = e.touches[0];
  lastMX = (t.clientX - r.left) * sx + cameraX;
  lastMY = (t.clientY - r.top) * sy;
}, { passive: false });

// ── Mobile weapon strip ───────────────────
function buildMobileWpnStrip() {
  const strip = document.getElementById('wpn-strip');
  if(!strip)return;  // 防御：wpn-strip 不存在时跳过
  strip.innerHTML = '';
  ownedWeapons.forEach((wi, slot) => {
    const w = WEAPONS[wi];
    const rar = WEAPON_RARITY[w.rarity]||WEAPON_RARITY.common;
    const btn = document.createElement('div');
    btn.className = 'wpn-btn' + (wi === curWpnIdx ? ' active-w' : '');
    btn.id = 'mwb' + wi;
    btn.style.borderColor = wi === curWpnIdx ? '#ffe066' : rar.color;
    const mNoAmmo = w.classWeapon && (w.id==='warhorn'||w.id==='quakehammer'||w.id==='bloodblades');
    btn.innerHTML = `<span class="wi2">${w.icon}</span><span class="wa2">${(mNoAmmo || w.id==='minigun') ? '∞' : wAmmo[wi]}</span>`;
    btn.addEventListener('touchstart', e => { e.preventDefault(); switchWeapon(wi); }, { passive: false });
    strip.appendChild(btn);
  });
}
function refreshMobileStrip() {
  ownedWeapons.forEach((wi) => {
    const w = WEAPONS[wi];
    const rar = WEAPON_RARITY[w.rarity]||WEAPON_RARITY.common;
    const btn = document.getElementById('mwb' + wi);
    if (!btn) return;
    btn.className = 'wpn-btn' + (wi === curWpnIdx ? ' active-w' : '');
    btn.style.borderColor = wi === curWpnIdx ? '#ffe066' : rar.color;
    const ammoEl = btn.querySelector('.wa2');
    if (ammoEl) ammoEl.textContent = w.id === 'minigun' ? '∞' : wAmmo[wi];
  });
}

// ── Mobile status bar update ──────────────
function updateMobileStatus() {
  const w = cw();
  document.getElementById('m-ammo').textContent = w.id === 'minigun' ? '∞' : (`${wAmmo[curWpnIdx]}/${weaponMagSize(w)}`);
  document.getElementById('m-wave').textContent = '第 ' + wave + ' 波';
  document.getElementById('m-coins').textContent = '💰 ' + coins;
  document.getElementById('m-rld-bar').style.width = rldF.style.width || '0%';
}

// ── Mobile status tick ────────────────────
let mStatusTimer = 0;
function mobileStatusTick() {
  if (!isMobile()) return;
  mStatusTimer++;
  if (mStatusTimer % 20 === 0) {
    updateMobileStatus();
    document.getElementById('m-wave').textContent = waveTxt.textContent;
    document.getElementById('m-rld-bar').style.width = rldF.style.width || '0%';
  }
}

// ═══════════════════════════════════════════

//  ANTI-STUCK WATCHDOG（防卡死看门狗）
//  如果游戏在某个状态卡太久，自动恢复
// ═══════════════════════════════════════════
let stuckWatchdog = 0;
let lastGameState = '';
function checkStuckWatchdog(){
  if(!gameRunning)return;
  const currentState = gameState + '|' + wavePhase + '|' + (cinActive?'cin':'') + '|' + (shopOpen?'shop':'') + '|' + (cabinUIOpen?'cabin':'');
  if(currentState === lastGameState){
    stuckWatchdog++;
  } else {
    stuckWatchdog = 0;
    lastGameState = currentState;
  }

  // ── 核心守护1：战斗世界等待中（waiting）超时保底 ──
  // 若处于 world + waiting 超过 240 帧 (4秒) 且无全屏剧情和对话进行，自动解除等待开启波次
  if(gameState === 'world' && wavePhase === 'waiting' && !cinActive && !dlgActive && stuckWatchdog > 240){
    console.warn('[WATCHDOG] wavePhase=waiting timeout in world, forcing wave content start');
    stuckWatchdog = 0;
    const cs = document.getElementById('chapter-scr');
    if(cs && cs.style.display === 'flex'){
      dismissChapterCard();
    } else {
      startWaveContent();
    }
    return;
  }

  // ── 核心守护2：第0波滞留保底 ──
  // 若处于 world + wave===0 超过 180 帧 (3秒) 且无剧情无教程，自动进入第1波
  if(gameState === 'world' && wave === 0 && !cinActive && !isTutorialOpen() && stuckWatchdog > 180){
    console.warn('[WATCHDOG] Stuck at wave 0 in world, forcing nextWave');
    stuckWatchdog = 0;
    nextWave();
    return;
  }

  // ── 核心守护3：刷怪阶段（spawning）零怪停滞保底 ──
  // 若正在刷怪阶段但场上 0 怪且队列仍有怪，若超过 90 帧 (1.5秒) 未出怪，强制立即刷新出怪
  if(gameState === 'world' && wavePhase === 'spawning' && zombies.length === 0 && waveSpawnQueue > 0 && stuckWatchdog > 90){
    console.warn('[WATCHDOG] Spawning phase empty field, forcing immediate spawn');
    stuckWatchdog = 0;
    waveSpawnTimer = 0;
    spawnZombie();
    waveSpawnQueue--;
    return;
  }

  // ── 核心守护4：刷怪阶段全清却未结算保底 ──
  // 若已无待刷僵尸且场上僵尸为 0，若超过 90 帧 (1.5秒) 未触发 cleared，强制触发
  if(gameState === 'world' && wavePhase === 'spawning' && zombies.length === 0 && waveSpawnQueue <= 0 && stuckWatchdog > 90){
    console.warn('[WATCHDOG] All zombies cleared but wavePhase not cleared, forcing onWaveCleared');
    stuckWatchdog = 0;
    buildingInteriorZombies = [];
    wavePhase = 'cleared';
    onWaveCleared();
    return;
  }

  // 只在异常状态触发：world+非spawning+非boss+非rest（正常战斗应该spawning，正常清场后应该自动转餐厅）
  // 不在hub/rest/restaurant/shop/cin/cabin触发（这些是正常等待状态）
  // 'waiting' 阶段用于过场动画/章节卡/波间等待，不应判定为卡死
  const isStuckWorld = (gameState === 'world' && !cinActive && wavePhase !== 'spawning' && wavePhase !== 'boss' && wavePhase !== 'rest' && wavePhase !== 'cleared' && wavePhase !== 'waiting' && wavePhase !== 'hub' && wavePhase !== 'shop' && wavePhase !== 'buffer' && wavePhase !== 'horde');
  // cleard状态卡太久（说明onWaveCleared的setTimeout没触发）
  const isStuckCleared = (gameState === 'world' && wavePhase === 'cleared' && stuckWatchdog > 300);  // 5秒
  // restaurant但restLoop没在跑（放宽到10秒，避免误触发）
  const isStuckRestaurant = (gameState === 'restaurant' && !restRafId && !restState && stuckWatchdog > 600);
  
  if(isStuckCleared || isStuckRestaurant || (isStuckWorld && stuckWatchdog > 300)){
    console.warn('[WATCHDOG] Stuck:', currentState, 'frames:', stuckWatchdog);
    addBanner('⚠ 检测到卡顿，自动恢复...');
    stuckWatchdog = 0;
    if(cinActive){ skipCinematic(); }
    if(shopOpen){ closeShop(); }
    if(cabinUIOpen){ closeCabinUpgradeUI(); }
    if(isStuckCleared){
      console.warn('[WATCHDOG] Cleared too long, forcing hub (player chose next action)');
      enterHub();
    }
    if(isStuckRestaurant){
      console.warn('[WATCHDOG] Restaurant loop dead, closing');
      closeRestaurant();
    }
    if(isStuckWorld && !cinActive && zombies.length === 0 && waveSpawnQueue <= 0){
      // v52修：防重入——onWaveCleared 会设 wavePhase='buffer' 并排 startBufferWave 计时器；
      // 若此刻已有缓冲计时器在排队，再补一次 onWaveCleared 会双重结算（进度/掉落错乱）
      if(wavePhase === 'buffer' || window._bufferWaveScheduled){ console.warn('[WATCHDOG] buffer already scheduled, skip'); }
      else{
        console.warn('[WATCHDOG] No zombies + not spawning, forcing cleared');
        wavePhase = 'cleared';
        onWaveCleared();
      }
    }
  }
}

