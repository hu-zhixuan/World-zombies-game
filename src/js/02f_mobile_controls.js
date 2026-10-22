// ═══════════════════════════════════════════
//  MOBILE TOUCH CONTROLS（手机操控层）
//  布局：左下浮动摇杆；右下一个大攻击键（按住开火，按住拖动 = 调枪口）+ 弧形副键；商店/行囊/侦察/菜单在右上角。
//  所有按键统一走 Pointer 事件：触屏、窄窗口里的鼠标都能点，也不会一次点击触发两次。
// ═══════════════════════════════════════════
// 与 CSS 里的手机媒体查询保持同一个条件：窄屏，或「粗指针(触屏)且宽度不超过 1100」
const MOBILE_MQ = '(max-width: 840px), (pointer: coarse) and (max-width: 1100px)';
const isMobile = ()=> window.innerWidth <= 840 || (window.matchMedia && window.matchMedia(MOBILE_MQ).matches) || ('ontouchstart' in window);

// body.phone：整套手机界面（HUD / 操控键 / 菜单面板）的总开关，样式见 style_phone.css
function syncPhoneClass(){
  const on = !!(window.matchMedia && window.matchMedia(MOBILE_MQ).matches);
  try{ if(document.body && document.body.classList) document.body.classList.toggle('phone', on); }catch(e){}
  return on;
}
const isPhoneUI = ()=>{ try{ return !!(document.body && document.body.classList && document.body.classList.contains('phone')); }catch(e){ return false; } };

// 手机：画布在整块屏幕里等比放大（不用 object-fit，避免触点换算偏移）
function layoutMobile(){
  const cv = document.getElementById('gc'), wrap = document.getElementById('game-wrap');
  if(!cv || !wrap) return;
  if(!syncPhoneClass()){ cv.style.width = ''; cv.style.height = ''; return; }
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if(!w || !h) return;
  const k = Math.min(w / 1100, h / 500);
  cv.style.width = Math.floor(1100 * k) + 'px';
  cv.style.height = Math.floor(500 * k) + 'px';
}
window.addEventListener('resize', layoutMobile);
window.addEventListener('orientationchange', () => setTimeout(layoutMobile, 150));
window.addEventListener('load', layoutMobile);
layoutMobile();
setTimeout(layoutMobile, 0);

// 按住类按键：pointerdown → down()，pointerup/cancel → up()。多指同时按各自独立。
function bindPress(el, down, up){
  if(!el) return;
  const ids = new Set();
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
    ids.add(e.pointerId);
    if(el.classList) el.classList.add('pressed');
    down(e);
  });
  const end = e => {
    if(!ids.delete(e.pointerId)) return;
    if(ids.size === 0 && el.classList) el.classList.remove('pressed');
    if(up) up(e);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
}

// ── 摇杆（浮动式）──────────────────────────
// 手指落在左下摇杆区的任何位置，底盘就以落点为中心；松手后回到原位。
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
let joyActive = false;
let joyId = -1;
let joyOx = 0, joyOy = 0, joyR = 36;   // 本次触摸的中心点 / 旋钮最大位移

function joyPlace(e){
  const dx = e.clientX - joyOx, dy = e.clientY - joyOy;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const clamp = Math.min(dist, joyR);
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 0;
  joyKnob.style.transform = `translate(calc(-50% + ${nx*clamp}px), calc(-50% + ${ny*clamp}px))`;
  // 只用水平方向（竖直方向向上滑 = 跳）
  keys.l = nx < -0.35 && clamp > joyR * 0.22;
  keys.r = nx >  0.35 && clamp > joyR * 0.22;
  if(ny < -0.5 && clamp > joyR * 0.6 && player.onGround) keys.j = true;
  else if(ny >= -0.3) keys.j = false;
}
if(joyZone){
  joyZone.addEventListener('pointerdown', e => {
    e.preventDefault();
    if(joyActive) return;
    try{ joyZone.setPointerCapture(e.pointerId); }catch(_){}
    joyId = e.pointerId;
    const z = joyZone.getBoundingClientRect(), half = (joyBase.offsetWidth || 120) / 2;
    // 底盘整个留在摇杆区内
    joyOx = Math.min(z.right - half, Math.max(z.left + half, e.clientX));
    joyOy = Math.min(z.bottom - half, Math.max(z.top + half, e.clientY));
    joyBase.style.left = (joyOx - z.left) + 'px';
    joyBase.style.top  = (joyOy - z.top) + 'px';
    joyR = (joyBase.offsetWidth || 120) * 0.3;
    joyActive = true;
    joyZone.classList.add('on');
    joyPlace(e);
  });
  joyZone.addEventListener('pointermove', e => { if(joyActive && e.pointerId === joyId){ e.preventDefault(); joyPlace(e); } });
  const joyEnd = e => {
    if(!joyActive || e.pointerId !== joyId) return;
    joyActive = false; joyId = -1;
    keys.l = false; keys.r = false; keys.j = false;
    joyKnob.style.transform = 'translate(-50%,-50%)';
    joyBase.style.left = ''; joyBase.style.top = '';
    joyZone.classList.remove('on');
  };
  joyZone.addEventListener('pointerup', joyEnd);
  joyZone.addEventListener('pointercancel', joyEnd);
  joyZone.addEventListener('lostpointercapture', joyEnd);
}

// ── 瞄准（手机）──────────────────────────────
// 参考《元气骑士》《荒野乱斗》《弓箭传说》：
// · 自动锁定：只锁屏幕里的僵尸，优先面朝/走动方向那一侧；锁住后不乱跳（别的目标要明显更近才换）
// · 锁定目标脚下画红圈，枪口一直指着它——还没开火就知道要打谁；没目标时枪口朝正前方
// · 按住攻击键拖动 = 手动瞄准，拖动方向 ±30° 内有僵尸就吸附过去；拖回中心 = 回到自动锁定
const btnFire = document.getElementById('btn-fire');
const fireNub = document.getElementById('fire-nub');
let fireTouchInterval = null;
let fireId = -1, fireOx = 0, fireOy = 0;
let aimLock = null;            // 当前锁定的目标（僵尸对象或 boss）
let touchAim = null;           // 手动瞄准方向（单位向量，屏幕方向 = 世界方向）；null = 自动锁定
const AIM_REACH = 420;         // 没目标/手动瞄准时，准星放在角色前方多远（世界坐标）
const AIM_SNAP_COS = Math.cos(30 * Math.PI / 180);  // 角色站在高台上、僵尸在地面，水平拖本来就有 20° 左右的俯角

// 目标的瞄准点（身体中心）和脚下红圈的位置/大小
function aimPoint(t) {
  if (t === boss) return { x: boss.x + 40, y: GROUND_Y - 80, fx: boss.x + 40, fy: GROUND_Y - 2, r: 46 };
  return { x: t.x + 22, y: Z_TOP + 28, fx: t.x + 22, fy: GROUND_Y - 2, r: 24 };
}
// 能锁的目标：活着、在屏幕里（建筑内没有镜头，全算）
function aimCandidates() {
  const inBuilding = gameState === 'building';
  const list = [];
  (inBuilding ? buildingInteriorZombies : zombies).forEach(z => {
    if (!z.alive) return;
    if (!inBuilding && (z.x + 22 < cameraX - 10 || z.x + 22 > cameraX + GW + 10)) return;
    list.push(z);
  });
  if (!inBuilding && boss && boss.alive && boss.x + 40 > cameraX - 20 && boss.x + 40 < cameraX + GW + 20) list.push(boss);
  return list;
}
function pickAutoTarget(cands) {
  const px = player.x + CHAR_W / 2, py = player.y + CHAR_H / 2;
  const dir = keys.r ? 1 : keys.l ? -1 : (player.facingRight ? 1 : -1);
  let best = null, bestScore = Infinity;
  cands.forEach(c => {
    const p = aimPoint(c), dx = p.x - px, dy = p.y - py;
    let score = Math.sqrt(dx * dx + dy * dy);
    if (Math.sign(dx) !== dir && Math.abs(dx) > 30) score *= 1.8;  // 身后的降权
    if (c === aimLock) score *= 0.7;                                // 粘住当前目标
    if (score < bestScore) { bestScore = score; best = c; }
  });
  return best;
}
// 手动瞄准时的吸附：拖动方向 ±30° 内最近的那只
function snapTarget(cands, ax, ay) {
  const px = player.x + CHAR_W / 2, py = player.y + CHAR_H / 2;
  let best = null, bestD = Infinity;
  cands.forEach(c => {
    const p = aimPoint(c), dx = p.x - px, dy = p.y - py, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if ((dx * ax + dy * ay) / d >= AIM_SNAP_COS && d < bestD) { bestD = d; best = c; }
  });
  return best;
}
// 每帧刷新锁定目标，并把准星（lastMX/lastMY）放到该打的地方
function updateAim() {
  if (gameState !== 'world' && gameState !== 'building') { aimLock = null; return; }
  const cands = aimCandidates();
  aimLock = touchAim ? snapTarget(cands, touchAim.x, touchAim.y) : pickAutoTarget(cands);
  if (aimLock) {
    const p = aimPoint(aimLock);
    lastMX = p.x; lastMY = p.y;
    return;
  }
  const dx = touchAim ? touchAim.x : (player.facingRight ? 1 : -1), dy = touchAim ? touchAim.y : 0;
  lastMX = player.x + CHAR_W / 2 + dx * AIM_REACH;
  lastMY = player.y + CHAR_H / 2 + dy * AIM_REACH;
}
function fireAimMove(e) {
  const dx = e.clientX - fireOx, dy = e.clientY - fireOy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const R = (btnFire.offsetWidth || 96) / 2;
  const reach = Math.min(dist, R * 0.62);
  // 死区：手指只是按着没怎么动 / 拖回了中心 = 自动锁定
  if (dist < R * 0.28) {
    touchAim = null;
    btnFire.classList.remove('aiming');
    if (fireNub) fireNub.style.transform = 'translate(-50%,-50%)';
  } else {
    touchAim = { x: dx / dist, y: dy / dist };
    btnFire.classList.add('aiming');
    if (fireNub) fireNub.style.transform = `translate(calc(-50% + ${touchAim.x * reach}px), calc(-50% + ${touchAim.y * reach}px))`;
  }
  updateAim();
}

// 右下操作键盖住的区域从画布的哪个 x 开始（画布坐标）。僵尸从屏幕右边进场，正好在攻击键底下
let _coverX = GW, _coverAt = -999;
function controlsCoverX() {
  if (frameT - _coverAt < 30) return _coverX;
  _coverAt = frameT;
  const cv = canvas.getBoundingClientRect(), keys_ = ['btn-fire', 'btn-dodge', 'btn-reload'];
  let left = Infinity;
  keys_.forEach(id => { const el = document.getElementById(id); if (el && el.offsetParent !== null) left = Math.min(left, el.getBoundingClientRect().left); });
  _coverX = (left === Infinity || !cv.width) ? GW : Math.max(GW * 0.5, (left - cv.left) * GW / cv.width);
  return _coverX;
}

// 锁定标记（脚下红圈 + 头顶小箭头）和手动瞄准虚线；只在战场画（建筑内没有镜头偏移，不画）
// 目标被右下操作键挡住时，在操作键左边缘画一个指向它的红箭头
function drawAimMarker() {
  if (!isPhoneUI() || gameState !== 'world') return;
  ctx.save();
  if (touchAim) {
    const sx = player.x + CHAR_W / 2 - cameraX, sy = player.y + CHAR_H / 2 - 4;
    const tx = lastMX - cameraX, ty = lastMY;
    const len = Math.min(190, Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2));
    const ang = Math.atan2(ty - sy, tx - sx), ax = Math.cos(ang), ay = Math.sin(ang);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(sx + ax * 28, sy + ay * 28); ctx.lineTo(sx + ax * len, sy + ay * len); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (aimLock) {
    const p = aimPoint(aimLock), x = p.fx - cameraX, pulse = 1 + 0.08 * Math.sin(frameT * 0.25);
    ctx.strokeStyle = 'rgba(255,72,60,.95)';
    ctx.fillStyle = 'rgba(255,72,60,.18)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, p.fy, p.r * pulse, p.r * 0.32 * pulse, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 头顶小箭头
    const hy = p.y - (aimLock === boss ? 70 : 44);
    ctx.fillStyle = 'rgba(255,72,60,.95)';
    ctx.beginPath(); ctx.moveTo(x - 6, hy - 8); ctx.lineTo(x + 6, hy - 8); ctx.lineTo(x, hy); ctx.closePath(); ctx.fill();
    const cover = controlsCoverX();
    if (x > cover - 6) {
      const ex = cover - 16 + 3 * Math.sin(frameT * 0.25), ey = p.y;
      ctx.fillStyle = 'rgba(255,72,60,.95)';
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ex + 11, ey); ctx.lineTo(ex - 5, ey - 10); ctx.lineTo(ex - 1, ey); ctx.lineTo(ex - 5, ey + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

function touchFire() {
  if (!gameRunning || shopOpen || cabinUIOpen) return;
  const w0 = cw();
  // 弹匣空了自动装填：手机上没有"按 R"的习惯，别让玩家对着空枪干按
  if (!isReloading && w0.id !== 'minigun' && !w0.noRefill && !w0.meleeWeapon && wAmmo[curWpnIdx] <= 0) { reloadWeapon(); return; }
  mouseHeld = true;
  updateAim();
  fireWeapon(lastMX, lastMY);
}
function stopFireLoop(){
  mouseHeld = false;
  if (fireTouchInterval) { clearInterval(fireTouchInterval); fireTouchInterval = null; }
  stopAuto();
}
function endFireAim(){
  fireId = -1;
  touchAim = null;
  if (btnFire) btnFire.classList.remove('aiming');
  if (fireNub) fireNub.style.transform = 'translate(-50%,-50%)';
}
if (btnFire) btnFire.addEventListener('pointermove', e => { if (e.pointerId === fireId) { e.preventDefault(); fireAimMove(e); } });
bindPress(btnFire, e => {
  const r = btnFire.getBoundingClientRect();
  fireId = e.pointerId; fireOx = r.left + r.width / 2; fireOy = r.top + r.height / 2;
  fireAimMove(e);
  touchFire();
  // v52修：清旧间隔防堆叠；近战自动武器不建循环（同黑屏根因）
  if (fireTouchInterval) { clearInterval(fireTouchInterval); fireTouchInterval = null; }
  // 近战不建循环（连击会把角色推出世界边界，见桌面版同处注释）；
  // 自动武器按射速连发；点射武器按住时按"手速"连发（间隔不低于 280ms）——手机上不用狂点
  const w = cw();
  if (!w.meleeWeapon) {
    const iv = (w.autofire || w.id === 'minigun') ? getFireInterval() : Math.max(getFireInterval(), 280);
    fireTouchInterval = setInterval(() => { if (gameRunning && !shopOpen && !cabinUIOpen) touchFire(); }, iv);
  }
}, () => { stopFireLoop(); endFireAim(); });

// ── 跳 / 翻滚 / 装填 / 流派技能 / 换枪 ─────────
bindPress(document.getElementById('btn-jump'), () => { keys.j = true; }, () => { keys.j = false; });
bindPress(document.getElementById('btn-dodge'), () => { tryDodge(); });
bindPress(document.getElementById('btn-reload'), () => { reloadWeapon(); });
bindPress(document.getElementById('btn-skill'), () => { tryClassSkill(); });
bindPress(document.getElementById('btn-swap'), () => {
  if (!ownedWeapons || ownedWeapons.length < 2) return;
  const i = ownedWeapons.indexOf(curWpnIdx);
  switchWeapon(ownedWeapons[(i + 1) % ownedWeapons.length]);
});

// ── 右上角：商店 / 行囊 / 侦察 ───────────────
bindPress(document.getElementById('btn-shop-m'), () => { if (shopOpen) closeShop(); else openShop(); });
bindPress(document.getElementById('btn-backpack'), () => { toggleBackpack(); });
// 菜单：弹出面板；点黑色遮罩关闭（刚打开的 350ms 内忽略遮罩点击，避免同一次点按立刻把它关掉）
bindPress(document.getElementById('mh-menu'), () => {
  const h = document.getElementById('header');
  window._menuOpenedAt = Date.now();
  if(h) h.classList.toggle('menu-open');
});
bindPress(document.getElementById('btn-scout'), () => { scoutView = true; }, () => { scoutView = false; });

// ── 交互键（救人 / 进屋 / 拾取 / 建造…）────────
bindPress(document.getElementById('btn-vehicle'), () => {
  keys.holdInteract = true;
  if((isHordeThreatActive() || wavePhase === 'cleared') && gameState === 'world'){
    if(typeof unboxActive !== 'undefined' && unboxActive){ closeUnboxCard(true); return; }
    if(typeof rescueNearestCompanion === 'function' && rescueNearestCompanion()) return;
    if(rescueNearestSurvivor()) return;
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
}, () => {
  keys.holdInteract = false;
  if(cabinHoldTimer > 0 || cabinHoldActive) cancelCabinHold();
});

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

// ── 手机 HUD：把游戏状态写进 #mhud（只在值变了才碰 DOM）──────
const _phCache = {}, _phEl = {};
function phEl(id){ return _phEl[id] || (_phEl[id] = document.getElementById(id)); }
function phText(id, v){ const k = 't' + id; if(_phCache[k] === v) return; _phCache[k] = v; const el = phEl(id); if(el) el.textContent = v; }
function phPct(id, ratio){
  const r = Math.max(0, Math.min(1, ratio)), v = (r * 100).toFixed(1) + '%', k = 'w' + id;
  if(_phCache[k] === v) return; _phCache[k] = v;
  const el = phEl(id); if(el) el.style.width = v;
}
function phClass(id, cls, on){ const k = 'c' + id + cls; if(_phCache[k] === !!on) return; _phCache[k] = !!on; const el = phEl(id); if(el) el.classList.toggle(cls, !!on); }
function phHref(id, href){ const k = 'h' + id; if(_phCache[k] === href) return; _phCache[k] = href; const el = phEl(id); const u = el && el.querySelector('use'); if(u) u.setAttribute('href', href); }

function updatePhoneHud(){
  if(!isPhoneUI()) return;
  // 左上：血量 / 等级 / 围墙 + 家园
  phText('mh-hp-val', Math.max(0, Math.ceil(health)));
  phPct('mh-hp-fill', health / maxHp);
  phClass('mh-hp-fill', 'low', health / maxHp < 0.3);
  phText('mh-lv-val', 'Lv.' + playerLevel);
  phPct('mh-xp-fill', playerXp / Math.max(1, playerXpNeed));
  const showDef = gameState === 'world';
  phClass('mhud', 'no-def', !showDef);
  if(showDef){
    const wallMax = WALL_HP_PER_LEVEL[wallLevel] || 1, wr = wallHp / wallMax, hr = homeHp / HOME_HP_MAX;
    phPct('mh-wall-fill', wallLevel > 0 ? wr : 0);
    phClass('mh-wall-fill', 'low', wallLevel > 0 && wr < 0.3);
    phPct('mh-home-fill', hr);
    phClass('mh-home-fill', 'low', hr < 0.25);
    phClass('mh-home-fill', 'mid', hr >= 0.25 && hr <= 0.5);
  }
  // 顶部居中：波次
  const info = getWaveHudInfo();
  phText('mh-wave-title', info.title);
  phText('mh-wave-right', info.right);
  phClass('mh-wave-title', 'danger', info.tone === 'danger');
  phClass('mh-wave-title', 'ok', info.tone === 'ok');
  phClass('mhud', 'no-prog', info.ratio === null);
  if(info.ratio !== null) phPct('mh-wave-fill', info.ratio);
  phClass('mh-wave-fill', 'danger', info.barTone === 'danger');
  phText('mh-sub', info.sub);
  phHref('mh-tod', timeOfDay === 'night' ? '#i-moon' : '#i-sun');
  phClass('mh-tod', 'night', timeOfDay === 'night');
  // 标签行：热搜 / 昨晚的饭 / 士气 / 连杀
  const tags = getHudTags();
  const tk = tags.map(t => t.text).join('|');
  if(_phCache.tags !== tk){
    _phCache.tags = tk;
    const box = phEl('mh-tags');
    if(box){
      box.textContent = '';
      tags.forEach(t => { const d = document.createElement('span'); d.className = 'mh-tag' + (t.hot ? ' hot' : ''); d.textContent = t.text; box.appendChild(d); });
    }
  }
  // 右上：金币
  phText('mh-coin-val', coins);
  // 右下：弹药 / 装填环 / 换枪
  const w = cw();
  const noAmmo = w.id === 'minigun' || w.meleeWeapon || (w.classWeapon && (w.id === 'warhorn' || w.id === 'quakehammer' || w.id === 'bloodblades'));
  const cur = wAmmo[curWpnIdx];
  phText('fire-ammo', (noAmmo || cur === 9999) ? '∞' : cur);
  phClass('btn-fire', 'low', !noAmmo && cur !== 9999 && cur <= Math.max(1, Math.floor(weaponMagSize(w) * 0.25)));
  phText('swap-icon', w.icon);
  phClass('btn-swap', 'solo', !ownedWeapons || ownedWeapons.length < 2);
  const ring = phEl('fire-ring-c');
  if(ring){
    const p = isReloading ? Math.min(1, Math.max(0, parseFloat(rldF.style.width) / 100 || 0)) : 0;
    const v = isReloading ? (295.3 * (1 - p)).toFixed(1) : '295.3';
    if(_phCache.ring !== v){ _phCache.ring = v; ring.style.strokeDashoffset = v; }
    phClass('btn-fire', 'reloading', isReloading);
  }
}

// 弹药/武器变化时刷新（旧的武器条已并入攻击键和换枪键，函数名沿用以免改动调用方）
function buildMobileWpnStrip(){ updatePhoneHud(); }
function refreshMobileStrip(){ updatePhoneHud(); }
function updateMobileStatus(){ updatePhoneHud(); }

// ── 每帧调用，约每 4 帧刷新一次 HUD ──
let mStatusTimer = 0;
function mobileStatusTick() {
  if (!isPhoneUI()) return;
  updateAim();
  mStatusTimer++;
  if (mStatusTimer % 4 === 0) updatePhoneHud();
}

// ═══════════════════════════════════════════

//  ANTI-STUCK WATCHDOG（防卡死看门狗）
//  如果游戏在某个状态卡太久，自动恢复
// ═══════════════════════════════════════════
let stuckWatchdog = 0;
let lastGameState = '';
function checkStuckWatchdog(){
  if(!gameRunning)return;
  // 选流派/天赋三选一/梦境（gamePaused）或教程开着 = 玩家在看面板，不是卡死；开关面板和换波都重新计时
  const panelOpen = gamePaused || isTutorialOpen();
  const currentState = gameState + '|' + wave + '|' + wavePhase + '|' + (cinActive?'cin':'') + '|' + (shopOpen?'shop':'') + '|' + (cabinUIOpen?'cabin':'') + '|' + (panelOpen?'panel':'');
  if(currentState === lastGameState){
    stuckWatchdog++;
  } else {
    stuckWatchdog = 0;
    lastGameState = currentState;
  }

  // ── 核心守护1：战斗世界等待中（waiting）超时保底 ──
  // 若处于 world + waiting 超过 240 帧 (4秒) 且无全屏剧情和对话进行，自动解除等待开启波次
  // 第 0 波归守护2管：在这里 startWaveContent 会把 0%5===0 当成 Boss 波
  if(gameState === 'world' && wave > 0 && wavePhase === 'waiting' && !cinActive && !dlgActive && !panelOpen && stuckWatchdog > 240){
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
  if(gameState === 'world' && wave === 0 && !cinActive && !panelOpen && stuckWatchdog > 180){
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
  const isStuckCleared = (gameState === 'world' && wavePhase === 'cleared' && !panelOpen && stuckWatchdog > 300);  // 5秒；在选天赋时不算
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

