// ═══════════════════════════════════════════


/* ═══════════════════════════════════════════════════════════════════════════════
   ══ 06. UI & PERSISTENCE ══
   HUD绘制 / 战术胶囊弹窗 / 设置暂停 / 图鉴教程界面 / 本地 LocalStorage 存档读档
═══════════════════════════════════════════════════════════════════════════════ */


//  COMBO & CRIT SYSTEM (共享帮助函数)
// ═══════════════════════════════════════════
// [combo, COMBO_TIMEOUT, hitstop, CRIT_CHANCE 等战斗全局常量已统一定义于 Section 01 顶层]

// ═══════════════════════════════════════════

//  FLOATING TEXT (隐患2修复: 已统一纳入 Canvas 2D 对象池渲染，彻底消除 DOM 重排与节点积压)
// ═══════════════════════════════════════════
// 注：spawnFloatText 与 drawFloatTexts 已由 Canvas 对象池驱动，实现零 DOM 节点创建与零 GC 抖动。

let bannerTimer=null, lastBannerText='', lastBannerTime=0;
function addBanner(txt){
  if(!txt) return;
  const now = Date.now();
  if(txt === lastBannerText && now - lastBannerTime < 1200) return; // 抑制重复刷屏
  lastBannerText = txt; lastBannerTime = now;
  // 彻底清除所有旧横幅，绝不发生层叠遮挡
  gameWrap.querySelectorAll('.banner-msg').forEach(el => el.remove());
  const d=document.createElement('div');d.className='banner-msg';
  const isRest = document.body.classList.contains('rest-mode') || gameState==='restaurant';
  const hasDlg = (window._waveDlgActive || (document.getElementById('wave-dlg-bar') && document.getElementById('wave-dlg-bar').classList.contains('open')) || (document.getElementById('dialogue-box') && document.getElementById('dialogue-box').style.display !== 'none'));
  const tutOpen = (document.getElementById('tutorial-scr') || {}).classList && document.getElementById('tutorial-scr').classList.contains('show');
  const topPos = isRest ? 36 : tutOpen ? 10 : (hasDlg ? 128 : 58);
  d.style.cssText=`position:absolute;top:${topPos}px;left:50%;transform:translateX(-50%);font-family:var(--font-display);font-size:.86rem;font-weight:500;color:var(--text-1);background:rgba(12,13,15,0.92);padding:7px 16px;border:1px solid var(--line-hi);border-radius:8px;pointer-events:none;z-index:150;box-shadow:0 8px 24px rgba(0,0,0,0.5);white-space:nowrap;transition:opacity .25s ease, transform .25s ease;`;
  d.textContent=txt;gameWrap.appendChild(d);
  clearTimeout(bannerTimer);
  bannerTimer=setTimeout(()=>{
    if(d.parentNode){
      d.style.opacity='0';
      d.style.transform='translateX(-50%) translateY(-6px)';
      setTimeout(()=>d.remove(), 260);
    }
  }, 2400);
}

// 根据波次返回天色阶段切换提示（仅在阶段切换的波次返回非空字符串）
function getDayPhaseHint(w){
  if(w===1)return '🌙 深夜降临';
  if(w===4)return '🌅 黎明破晓';
  if(w===6)return '☀️ 白昼降临';
  if(w===9)return '🌇 黄昏余晖';
  if(w===11)return '🌙 深夜再临';
  if(w===14)return '🌅 黎明·最终决战';
  return '';
}

// ═══════════════════════════════════════════

//  UI UPDATES
// ═══════════════════════════════════════════
function buildWeaponBar(){
  const bar=document.getElementById('weapon-bar');bar.innerHTML='';
  // 仅渲染已拥有的武器（按拾取顺序）
  ownedWeapons.forEach((wi,slot)=>{
    const w=WEAPONS[wi];
    const rar=WEAPON_RARITY[w.rarity]||WEAPON_RARITY.common;
    const c=document.createElement('div');c.id='wc'+wi;
    c.className='wcard'+(wi===curWpnIdx?' active':'');
    c.style.borderLeftColor=rar.color;  // 稀有度只用左边一条色标识
    const maxA=Math.floor(w.maxAmmo*(1+upgrades.ammo*.5));
    // v50修：专属武器的UI显示——近战/号令类武器不显示弹药数，显示流派角标
    const isClassW = !!w.classWeapon;
    const noAmmoW = isClassW && (w.id==='warhorn'||w.id==='quakehammer'||w.id==='bloodblades');
    const ammoTxt = noAmmoW ? '∞' : (wAmmo[wi]===9999?'∞':wAmmo[wi]+'/'+maxA);
    const classTag = isClassW ? `<span style="font-size:.62rem;color:${(START_CLASSES.find(c=>c.id===w.classWeapon)||{}).color||'#f2a65a'};">专属</span>` : '';
    c.innerHTML=`<div class="wi">${w.icon}</div>`+
      `<div class="wmeta"><div class="wn">${w.name}</div>`+
      `<div class="wrow"><span class="wa" id="wa${wi}" style="color:${aC(wAmmo[wi],maxA)}">${ammoTxt}</span><span class="wt ${w.tagClass}">${w.tag}</span>${classTag}</div>`+
      (w.id==='minigun'?`<div class="wheat"><div class="wheatfill" id="wh5" style="width:${(w.heat/w.maxHeat*100).toFixed(0)}%"></div></div>`:'')+`</div>`+
      `<span class="wk">${slot+1}</span>`;
    c.onclick=()=>switchWeapon(wi);
    c.title=`${rar.cn} · ${w.tag}`;
    bar.appendChild(c);
  });
  if(isMobile()) buildMobileWpnStrip();
}
function aC(a,max){const r=a/max;return r>.5?'#9aa0a8':r>.2?'#f2a65a':'#e5594f';}
function refreshWBar(){
  ownedWeapons.forEach((wi,slot)=>{
    const w=WEAPONS[wi];
    const rar=WEAPON_RARITY[w.rarity]||WEAPON_RARITY.common;
    const c=document.getElementById('wc'+wi);if(!c)return;
    // 进化/超武觉醒武器整框用强调色；常规武器保持左侧稀有度色条，选中为强调色边框
    const rec=weaponLevels[w.id];
    const evolved = !!(rec && (rec.isSuperEvolved || rec.evoBranch));
    c.className='wcard'+(wi===curWpnIdx?' active':'')+(evolved?' evolved':'');
    c.querySelector('.wk').textContent=slot+1;
    const ae=document.getElementById('wa'+wi);if(!ae)return;
    const maxA=weaponMagSize(w);
    // v50修：近战/号令类专属武器显示∞
    const noAmmoW2 = w.classWeapon && (w.id==='warhorn'||w.id==='quakehammer'||w.id==='bloodblades');
    ae.textContent = noAmmoW2 ? '∞' : (wAmmo[wi]===9999?'∞':`${wAmmo[wi]}/${maxA}`);
    if(!noAmmoW2) ae.style.color=aC(wAmmo[wi],maxA);
    // 武器名角标：仅真实进化/觉醒后展示金色标识，普通武器不显示假MAX
    const wn=c.querySelector('.wn');
    if(wn){
      let tag='';
      if(evolved) tag=` <span style="color:#f2a65a;font-size:.62rem;" title="${(rec&&rec.evoName)||'已进化'}">${(rec&&rec.evoName)||'已进化'}</span>`;
      wn.innerHTML=w.name+tag;
    }
  });
  if(isMobile()) refreshMobileStrip();
}
function updateWeaponHeat(){const minigunDef=WEAPONS.find(w=>w.id==='minigun');const el=document.getElementById('wh5');if(el&&minigunDef)el.style.width=(minigunDef.heat/minigunDef.maxHeat*100)+'%';}
function updateAmmoUI(){
  const w=cw(),cur=wAmmo[curWpnIdx],maxA=Math.floor(w.maxAmmo*(1+upgrades.ammo*.5));
  const d=document.getElementById('ammo-wrap');d.innerHTML='';
  if(w.id==='minigun'){
    const s=document.createElement('span');
    s.style.cssText="font-size:1.15rem;color:var(--yellow);font-family:var(--font-display);";
    s.textContent='∞';
    d.appendChild(s);
    if(isMobile()){refreshMobileStrip();updateMobileStatus();}
    return;
  }
  const show=Math.min(maxA,20);
  for(let i=0;i<show;i++){const b=document.createElement('div');b.className='bi'+(i>=cur?' e':'');d.appendChild(b);}
  if(maxA>20){const s=document.createElement('span');s.style.cssText='font-size:.65rem;color:var(--dim);margin-left:3px;';s.textContent='×'+cur;d.appendChild(s);}
  if(isMobile()){refreshMobileStrip();updateMobileStatus();}
}
function updateHpUI(){
  hpvEl.textContent=Math.max(0,health);
  document.getElementById('hpb').style.width=(health/maxHp*100)+'%';
}
// 更新昼夜HUD指示器
function updateTodHUD(){
  const icon = document.getElementById('tod-icon');
  const label = document.getElementById('tod-label');
  if(!icon || !label) return;
  if(timeOfDay === 'night'){
    icon.textContent = '☾';
    icon.style.color = '#a2a6af';
    label.textContent = '夜晚';
    label.style.color = '#a2a6af';
  } else {
    icon.textContent = '☀';
    icon.style.color = '#f2a65a';
    label.textContent = '白天';
    label.style.color = '#f2a65a';
  }
}
// ═══════════════════════════════════════════

//  WAVE HUD（画布上的波次HUD，始终可见）
// ═══════════════════════════════════════════
// ── 画布 HUD：扁平深灰面板，一个强调色，不用 emoji/渐变/发光 ──
const HUD = {
  bg:'rgba(12,13,15,.86)', line:'rgba(255,255,255,.12)', track:'rgba(255,255,255,.09)',
  t1:'#e8eaed', t2:'#9aa0a8', t3:'#6b7280',
  accent:'#f2a65a', danger:'#e5594f', ok:'#6fbf8b', neutral:'#aeb4bd',
  font:"'PingFang SC','Microsoft YaHei UI','Segoe UI',sans-serif",
};
function hudFont(px, weight){ return (weight || 400) + ' ' + px + 'px ' + HUD.font; }
function hudRoundRect(x, y, w, h, r){
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}
function hudPanel(x, y, w, h){
  hudRoundRect(x, y, w, h, 8);
  ctx.fillStyle = HUD.bg; ctx.fill();
  ctx.strokeStyle = HUD.line; ctx.lineWidth = 1; ctx.stroke();
}
function hudBar(x, y, w, h, ratio, color){
  ratio = Math.max(0, Math.min(1, ratio));
  hudRoundRect(x, y, w, h, h/2); ctx.fillStyle = HUD.track; ctx.fill();
  if(ratio > 0){ hudRoundRect(x, y, Math.max(h, w*ratio), h, h/2); ctx.fillStyle = color; ctx.fill(); }
}
// 一行「左文字 ... 右文字」
function hudRow(x, y, w, left, right, leftColor, rightColor, px){
  ctx.font = hudFont(px || 12, 400);
  ctx.textAlign = 'left'; ctx.fillStyle = leftColor || HUD.t2;
  ctx.fillText(left, x, y);
  if(right !== undefined && right !== ''){
    ctx.textAlign = 'right'; ctx.fillStyle = rightColor || HUD.t1;
    ctx.fillText(right, x + w, y);
    ctx.textAlign = 'left';
  }
}
// 文字超出宽度时用省略号截断（调用前先设好 ctx.font）
function fitText(str, maxW){
  if(ctx.measureText(str).width <= maxW) return str;
  while(str.length > 1 && ctx.measureText(str + '…').width > maxW) str = str.slice(0, -1);
  return str + '…';
}

// 右侧状态栈：士气 / 「昨晚吃了什么」（食堂是唯一的备战饭来源）/ 今日热搜目标
function drawFoodStatusStack(x, y, w){
  if(gameState !== 'world') return;
  const pad = 12, iw = w - pad * 2;
  if(moraleBuff > 0){
    hudPanel(x, y, w, 28);
    hudRow(x + pad, y + 18, iw, '士气', '伤害 +' + (moraleBuff * 5) + '%', HUD.t2, HUD.accent);
    y += 28 + 8;
  }
  const buffs = activeBattleBuffs.filter(b => BATTLE_BUFF_DEFS[b.id]);
  if(lastMealLog.length > 0 || activeSignature || buffs.length > 0){
    const rows = [];
    buffs.forEach(b => {
      const d = BATTLE_BUFF_DEFS[b.id];
      rows.push({ left: d.desc + (b.stacks > 1 ? ' ×' + b.stacks : ''), tag: b.boosted ? '强化' : '', right: Math.ceil(b.timeLeft/60) + 's' });
    });
    if(activeSignature) rows.push({ left: activeSignature.badge, tag: '留饭', right: '本波', color: activeSignature.color });
    const h = 30 + rows.length * 19 + 4;
    hudPanel(x, y, w, h);
    ctx.font = hudFont(11, 400); ctx.textAlign = 'left'; ctx.fillStyle = HUD.t3;
    ctx.fillText('昨晚吃了', x + pad, y + 19);
    const lw = ctx.measureText('昨晚吃了  ').width;
    ctx.font = hudFont(12, 500); ctx.fillStyle = HUD.t1;
    const names = lastMealLog.map(m => m.name + (m.family ? '（留饭）' : '')).join('、') || '—';
    ctx.fillText(fitText(names, iw - lw), x + pad + lw, y + 19);
    rows.forEach((r, i) => {
      const ry = y + 42 + i * 19;
      ctx.font = hudFont(12, 400);
      ctx.fillStyle = r.color || HUD.t1;
      ctx.textAlign = 'left';
      let tagW = 0;
      if(r.tag){
        ctx.font = hudFont(10, 500); tagW = ctx.measureText(r.tag).width + 10;
        hudRoundRect(x + pad, ry - 10, tagW, 14, 3); ctx.fillStyle = 'rgba(242,166,90,.16)'; ctx.fill();
        ctx.fillStyle = HUD.accent; ctx.fillText(r.tag, x + pad + 5, ry);
        tagW += 6;
      }
      ctx.font = hudFont(12, 400); ctx.fillStyle = r.color || HUD.t1;
      ctx.fillText(fitText(r.left, iw - 40 - tagW), x + pad + tagW, ry);
      ctx.fillStyle = HUD.t3; ctx.textAlign = 'right';
      ctx.fillText(r.right, x + w - pad, ry);
      ctx.textAlign = 'left';
    });
    y += h + 8;
  }
  if(currentTrend){
    const info = getTrendHuntInfo();
    const kindTxt = info && info.kinds.length ? info.kinds.map(k => MEAT_TYPES[k].name).join('/') : '';
    hudPanel(x, y, w, 30);
    ctx.font = hudFont(12, 400);
    const lbl = '热搜 #' + currentTrend.tag + '#';
    ctx.fillStyle = HUD.t2; ctx.textAlign = 'left';
    ctx.fillText(lbl, x + pad, y + 19);
    ctx.textAlign = 'right'; ctx.fillStyle = trendMeatToday > 0 ? HUD.accent : HUD.t3;
    ctx.fillText(kindTxt + ' ×' + trendMeatToday, x + w - pad, y + 19);
    ctx.textAlign = 'left';
  }
}

// 手机上画布被缩小（约 0.65×），HUD 面板放大补偿，保证字号可读
function hudScale(){ return (typeof isMobile === 'function' && isMobile()) ? 1.35 : 1; }
function drawWaveHUD(){
  ctx.save();
  // ── 连杀狂热：角标 ──
  if(frenzyT>0 && gameState==='world'){
    hudPanel(10, GH-38, 150, 28);
    hudRow(22, GH-20, 126, '连杀狂热', '射速+20%  ' + Math.ceil(frenzyT/60) + 's', HUD.accent, HUD.t1, 12);
  }
  const isBuffer = window.__waveSpecial === 'buffer';
  const isHub = gameState === 'hub';
  const isBufferWaiting = wavePhase === 'buffer' && !isBuffer;
  const remaining = waveSpawnQueue + zombies.length;
  const total = waveTotalThisWave || 1;

  // ── 右上：波次面板（标题 / 进度条 / 一行提示）──
  const hk = hudScale();
  ctx.save(); ctx.translate(GW, 0); ctx.scale(hk, hk); ctx.translate(-GW, 0);
  const pw = 200, px = GW - pw - 10, py = 10, pad = 12, iw = pw - pad * 2;
  let title, titleColor = HUD.t1, right = '', ratio = null, barColor = HUD.accent, sub = '';
  if(isHub){
    title = '据点整备'; titleColor = HUD.ok; right = '第 ' + (wave + 1) + ' 波前';
    sub = '进食堂 N · 出击 B';
  }else if(isBufferWaiting){
    title = '夜晚尸潮将至'; titleColor = HUD.danger;
    sub = '进小屋避难（长按 E）';
  }else if(isBuffer){
    title = '夜晚尸潮 ×' + ([2,3,5,10][bufferWaveLevel] || 2); titleColor = HUD.danger;
    right = '剩 ' + remaining; ratio = 1 - remaining/total; barColor = HUD.danger;
    sub = '进小屋按 E 或 N 避难';
  }else if(wavePhase === 'boss'){
    title = 'BOSS 战'; titleColor = HUD.danger; right = '第 ' + wave + ' 波';
    sub = '击败 Boss 进入下一阶段';
  }else if(wavePhase === 'spawning'){
    title = '第 ' + wave + ' 波'; right = '剩 ' + remaining + ' / ' + total; ratio = 1 - remaining/total;
  }else{
    title = '第 ' + wave + ' 波'; right = wavePhase || '';
  }
  const ph = 14 + 20 + (ratio !== null ? 12 : 0) + (sub ? 20 : 0) + 8;
  hudPanel(px, py, pw, ph);
  ctx.font = hudFont(14, 600); ctx.textAlign = 'left'; ctx.fillStyle = titleColor;
  ctx.fillText(title, px + pad, py + 26);
  if(right){ ctx.font = hudFont(12, 400); ctx.textAlign = 'right'; ctx.fillStyle = HUD.t2; ctx.fillText(right, px + pw - pad, py + 26); ctx.textAlign = 'left'; }
  let cy = py + 34;
  if(ratio !== null){ hudBar(px + pad, cy, iw, 4, ratio, barColor); cy += 12; }
  if(sub){ ctx.font = hudFont(11, 400); ctx.fillStyle = HUD.t2; ctx.fillText(sub, px + pad, cy + 12); }
  drawFoodStatusStack(px, py + ph + 8, pw);
  ctx.restore();

  // ── 左上：防御面板（围墙 + 家园 + 塔防，全游戏只在这里显示一份）──
  if(gameState === 'world' && !isHub){
    ctx.save(); ctx.scale(hk, hk);
    const dpX = 10, dpY = 10, dpW = 172, dpH = 82, ip = 12, iw2 = dpW - ip * 2;
    hudPanel(dpX, dpY, dpW, dpH);
    const wallNames = ['无围墙','木墙','石墙','铁墙'];
    const wallMax = WALL_HP_PER_LEVEL[wallLevel]||1;
    const wallRatio = wallHp/wallMax;
    hudRow(dpX + ip, dpY + 20, iw2, wallNames[wallLevel] || '无围墙', Math.round(wallRatio*100) + '%', HUD.t2, HUD.t1);
    hudBar(dpX + ip, dpY + 26, iw2, 4, wallRatio, wallRatio < .3 ? HUD.danger : HUD.neutral);
    const homeRatio = homeHp/HOME_HP_MAX;
    hudRow(dpX + ip, dpY + 48, iw2, '家园', Math.round(homeHp) + ' / ' + HOME_HP_MAX, HUD.t2, HUD.t1);
    hudBar(dpX + ip, dpY + 54, iw2, 4, homeRatio, homeRatio > .5 ? HUD.ok : homeRatio > .25 ? HUD.accent : HUD.danger);
    hudRow(dpX + ip, dpY + 74, iw2, '防御塔', towers.length + ' / ' + getTowerMaxCount(), HUD.t2, HUD.t1);
    ctx.restore();
  }
  ctx.restore();
}

function updateCoinUI(){
  coinDisp.textContent=coins;
  if(isMobile()){const m=document.getElementById('m-coins');if(m)m.textContent='💰 '+coins;}
  const wEl = document.getElementById('hud-wood');
  const sEl = document.getElementById('hud-scrap');
  if (wEl) wEl.textContent = '木材 ' + woodPlanks;
  if (sEl) sEl.textContent = '废料 ' + scrapMetal;
  updateTodHUD();
}

// ═══════════════════════════════════════════

//  CROSSHAIR
// ═══════════════════════════════════════════
function drawCrosshair(x,y){
  if(typeof cw !== 'function') return;
  const w = cw();
  if(!w) return;
  ctx.save();
  const isStill = (!keys.l && !keys.r && player.onGround);

  // 基础准星间距（静止紧凑3.5px，移动微散布5.5px）
  const baseGap = isStill ? 3.5 : 5.5;
  const lineLen = 4.5;
  const col = 'rgba(240, 246, 252, 0.88)';
  const shadowCol = 'rgba(0, 0, 0, 0.75)';

  // 换弹中：外围环绕一圈纤细低饱和度圆弧进度，干净利落无杂乱文字
  if(isReloading){
    const rProg = Math.min(1, Math.max(0, (100 - (typeof reloadAnimT !== 'undefined' ? reloadAnimT : 0)) / 100));
    ctx.strokeStyle = 'rgba(255, 216, 64, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffd840';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + rProg * Math.PI * 2);
    ctx.stroke();
  }

  // 现代战术十字：中心微型实心瞄准点 + 4向利落微刻线（彻底移除刺眼红括号、连斩字样与锁框）
  ctx.shadowColor = shadowCol;
  ctx.shadowBlur = 2;

  // 中心点
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 4向刻线
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x - baseGap - lineLen, y);
  ctx.lineTo(x - baseGap, y);
  ctx.moveTo(x + baseGap, y);
  ctx.lineTo(x + baseGap + lineLen, y);
  ctx.moveTo(x, y - baseGap - lineLen);
  ctx.lineTo(x, y - baseGap);
  ctx.moveTo(x, y + baseGap);
  ctx.lineTo(x, y + baseGap + lineLen);
  ctx.stroke();

  ctx.restore();
}

// ═══════════════════════════════════════════

//  SHOP SYSTEM
// ═══════════════════════════════════════════
const BASE_SHOP_ITEMS=[
  {id:'hp_restore',   icon:'💉', name:'紧急医疗包',    desc:'立即恢复 40 生命值',          cost:25,  stacks:false, available:()=>health<maxHp,         buy:()=>{health=Math.min(maxHp,health+40);updateHpUI();}},
  {id:'damage_up',    icon:'💢', name:'火力强化',       desc:'全武器伤害 +25%（3层上限）',  cost:40,  stacks:3,     available:()=>upgrades.damage<3,    buy:()=>upgrades.damage++},
  {id:'speed_up',     icon:'👟', name:'战术移速',       desc:'移动速度 +0.7（3层上限）',    cost:30,  stacks:3,     available:()=>upgrades.speed<3,     buy:()=>upgrades.speed++},
  {id:'armor_up',     icon:'🛡', name:'护甲强化',       desc:'受到伤害 -20%（3层上限）',   cost:45,  stacks:3,     available:()=>upgrades.armor<3,     buy:()=>upgrades.armor++},
  {id:'maxhp_up',     icon:'❤️', name:'强化体魄',       desc:'最大生命 +30（3层上限）',    cost:40,  stacks:3,     available:()=>upgrades.maxHp<3,     buy:()=>{upgrades.maxHp++;maxHp+=30;health=Math.min(maxHp,health+30);updateHpUI();}},
  {id:'ammo_up',      icon:'🔋', name:'大容量弹夹',     desc:'全武器弹药 +50%（2层上限）', cost:35,  stacks:2,     available:()=>upgrades.ammo<2,      buy:()=>{upgrades.ammo++;rebuildAmmo();}},
  {id:'sprite',       icon:'✨', name:'召唤光灵',       desc:'伴侣精灵：自动攻击+治疗',    cost:60,  stacks:false, available:()=>!sprite.exists,       buy:()=>{sprite.exists=true;sprite.x=player.x+50;sprite.y=player.y-30;}},
  {id:'sprite_up',    icon:'🌟', name:'光灵进化',       desc:'光灵获得护盾技能（20s冷却）',cost:70,  stacks:false, available:()=>sprite.exists&&sprite.level<2,buy:()=>sprite.level++},
  {id:'vehicle',      icon:'🚗', name:'装甲战车',       desc:'召唤可驾驶装甲车，碾压僵尸', cost:80,  stacks:false, available:()=>!vehicle.exists,      buy:()=>{vehicle.exists=true;vehicle.x=Math.min(WORLD_W-130,player.x+150);vehicle.hp=vehicle.maxHp;}},
  // ── 家园塔防部署项 ──
  {id:'deploy_turret',icon:'🗼',name:'部署机枪塔',  desc:'物理速射单体·克无甲脆皮（点城堡平台放置）',  cost:60,  stacks:false, placement:true, available:()=>towers.length<getTowerMaxCount(), buy:()=>deployTower('turret')},
  {id:'deploy_freeze',icon:'🧊',name:'部署冰霜塔',  desc:'能量减速·控场（点城堡平台放置）',           cost:70,  stacks:false, placement:true, available:()=>towers.length<getTowerMaxCount(), buy:()=>deployTower('freeze')},
  {id:'deploy_cannon',icon:'💥',name:'部署炮击塔',  desc:'爆炸AoE·无视50%护甲·克扎堆（点城堡平台放置）',cost:110, stacks:false, placement:true, available:()=>towers.length<getTowerMaxCount(), buy:()=>deployTower('cannon')},
  {id:'deploy_tesla', icon:'⚡',name:'部署电弧塔',  desc:'能量链电·克高护甲（点城堡平台放置）',        cost:100, stacks:false, placement:true, available:()=>towers.length<getTowerMaxCount(), buy:()=>deployTower('tesla')},
  {id:'deploy_repair',icon:'🔧',name:'部署维修塔',  desc:'修复围墙+微治疗·守家核心（点城堡平台放置）', cost:80,  stacks:false, placement:true, available:()=>towers.length<getTowerMaxCount(), buy:()=>deployTower('repair')},
  {id:'trap_spikes',  icon:'🌵',name:'布置地刺',    desc:'点击地图选择放置位置(5次)',         cost:30,  stacks:false, placement:true, available:()=>true, buy:()=>deployTrap('spikes')},
  {id:'trap_mine',    icon:'💣',name:'布置地雷',    desc:'点击地图选择放置位置(1次)',        cost:45,  stacks:false, placement:true, available:()=>true, buy:()=>deployTrap('mine')},
  {id:'repair_home',  icon:'🏠',name:'修复家园',    desc:'家园生命恢复50',             cost:40,  stacks:false, available:()=>homeHp<HOME_HP_MAX, buy:()=>{homeHp=Math.min(HOME_HP_MAX,homeHp+50);addBanner('🏠 家园修复+50！');}},
  {id:'upgrade_wall', icon:'🧱',name:'升级围墙',    desc:'升级围墙(木→石→铁)，满血', cost:40,  stacks:false, available:()=>wallLevel<3, buy:()=>upgradeWall(true)},
  {id:'repair_wall',  icon:'🔧',name:'修复围墙',    desc:'围墙修复至满血',                cost:25,  stacks:false, available:()=>wallLevel>0&&wallHp<WALL_HP_PER_LEVEL[wallLevel], buy:()=>repairWall(true)},
];

let SHOP_ITEMS = [];
function getShopItems(){
  const items = [...BASE_SHOP_ITEMS];
  // ── 军火商现货采购（按波次与未拥有武器动态上架3把枪械，拒绝小怪乱爆垃圾，强化主动军备构筑）──
  const unowned = WEAPONS.map((w,i)=>({w,i})).filter(x=>!x.w.superWeapon && !x.w.classWeapon && !ownedWeaponsSet.has(x.i));
  const priceOf = r => ({common:55, rare:120, epic:240, legendary:420}[r]||80);
  const seededRand = n => { const s = Math.sin((wave||1)*97.3 + n*41.7)*43758.5; return s - Math.floor(s); };
  const picks = [];
  const poolCopy = [...unowned];
  for(let k=0; k<3 && poolCopy.length; k++){
    const idx = Math.floor(seededRand(k+1)*poolCopy.length);
    picks.push(poolCopy.splice(idx,1)[0]);
  }
  picks.forEach(x => {
    items.push({
      id:'buywpn_'+x.w.id,
      cat:'军备军火',
      icon:x.w.icon, name:'购买 '+x.w.name,
      desc:(x.w.trait||'').split('：')[0]+'（'+({common:'普通',rare:'稀有',epic:'史诗',legendary:'传说'})[x.w.rarity]+'级武器，末世稀缺战略资产）',
      cost:priceOf(x.w.rarity),
      stacks:false,
      available:()=>!ownedWeaponsSet.has(x.i),
      buy:()=>{
        if(ownedWeapons.length>=MAX_OWNED_WEAPONS){
          const replaceIdx = ownedWeapons.findIndex(wi=>wi!==curWpnIdx);
          const target = replaceIdx>=0?replaceIdx:0;
          ownedWeapons[target]=x.i;
        }else{
          ownedWeapons.push(x.i);
        }
        refreshOwnedSet();
        wAmmo[x.i]=weaponMagSize(x.w);
        ensureWeaponLevel(x.w.id);
        addBanner(`${x.w.icon} 成功从军火商处购得「${x.w.name}」！`);
        buildWeaponBar();refreshWBar();updateAmmoUI();
        if(typeof buildShopUI==='function') buildShopUI();
        if(typeof buildManageShopUI==='function') buildManageShopUI();
      }
    });
  });
  SHOP_ITEMS = items;
  return items;
}
getShopItems();

function buildShopUI(){
  const grid=document.getElementById('shop-grid');
  grid.innerHTML='';
  const items = getShopItems();
  items.forEach(item=>{
    const avail=item.available();
    const canAfford=coins>=item.cost;
    const enabled=avail&&canAfford;
    const div=document.createElement('div');
    div.className='si'+(enabled?'':' si-disabled');
    const stackInfo=item.stacks?` (${upgrades[item.id.replace('_up','')]||0}/${item.stacks})` : '';
    let finalDesc=item.desc;
    if(item.requiredWave && wave<item.requiredWave){
      finalDesc=`<span style="color:#ff6666;font-weight:bold;">(第 ${item.requiredWave} 波解锁)</span> `+item.desc;
    }
    div.innerHTML=`<div class="si-icon">${item.icon}</div><div class="si-name">${item.name}${stackInfo}</div><div class="si-desc">${finalDesc}</div><div class="si-cost ${canAfford&&avail?'can-buy':'cant-buy'}">💰 ${item.cost}</div>`;
    if(enabled) div.onclick=()=>{
      if(coins<item.cost||!item.available())return;
      // 部署/陷阱类：不在此扣费，进入放置模式后实际放置时才扣费（placeTower/placeTrap）
      if(item.placement){
        // Hub世界：让玩家自己选择塔位（弹出塔位选择面板）
        if(gameState === 'hub' && item.id.startsWith('deploy_')){
          const towerType = item.id.replace('deploy_','');
          if(towers.length >= getTowerMaxCount()){addBanner('⚠ 塔位已满！');return;}
          if(coins < TOWER_TYPES[towerType].cost){addBanner('💰 金币不足！');return;}
          // 弹出塔位选择面板
          showTowerPlacementPanel(towerType);
          return;
        }
        // 战斗世界：进入放置模式，玩家点击地图放置
        const ok=item.buy();
        if(ok){
          buildShopUI();
          closeShop();  // 自动关闭商店，让玩家在地图上放置
        }
        return;
      }
      coins-=item.cost; item.buy();
      updateCoinUI(); buildShopUI();
    };
    grid.appendChild(div);
  });
  document.getElementById('shop-coins').textContent=`💰 ${coins} 硬币`;
}

let shopTimerInterval=null;
function openShop(){
  if(!gameRunning)return;
  shopOpen=true;
  buildShopUI();
  document.getElementById('shop-scr').classList.add('open');
  sndShopOpen();
  // Hub世界中商店无时间限制（玩家可慢慢逛）；战斗世界有20秒限时
  if(gameState === 'hub'){
    shopTimerVal=999;
    document.getElementById('shop-timer-fill').style.width='100%';
    document.getElementById('shop-timer-fill').style.display='none';
    return;
  }
  document.getElementById('shop-timer-fill').style.display='block';
  // 20s timer
  shopTimerVal=20;
  document.getElementById('shop-timer-fill').style.width='100%';
  shopTimerInterval=setInterval(()=>{
    shopTimerVal--;
    document.getElementById('shop-timer-fill').style.width=(shopTimerVal/20*100)+'%';
    if(shopTimerVal<=0)closeShop();
  },1000);
}
function closeShop(){
  if(!shopOpen)return;
  shopOpen=false;
  document.getElementById('shop-scr').classList.remove('open');
  clearInterval(shopTimerInterval);
  sndShopClose();
  // Hub世界中关商店不做任何推进（玩家仍在Hub里自由活动）
  if(gameState === 'hub') return;
  // 战斗世界：关商店后不进入休息期，直接回到当前波次状态
  // （波次进行中继续打，清场后自动进入缓冲期尸潮）
}
// [已废弃] 休息期系统——按用户要求移除，打完一波直接进入缓冲期尸潮
// 保留空函数避免引用错误
function startRest(){
  // 不再使用休息期，直接进入缓冲期
  if(gameRunning && wavePhase !== 'spawning' && wavePhase !== 'boss'){
    onWaveCleared();
  }
}
function updateRest(){
  // 已废弃（v52：不再每帧隐藏餐厅倒计时，保留空函数避免旧引用报错）
  return;
}
function endRest(){
  // 已废弃：休息期系统移除
  wavePhase='waiting';
  return;
}
// 跳过当前阶段直接进入下一波
function skipToNextWave(){
  if(!gameRunning)return;
  // Hub世界：直接出击进下一波
  if(gameState === 'hub'){
    exitHub();
    addBanner('▶ 出击！进入下一波');
    return;
  }
  if(wavePhase==='waiting'){
    // 章节卡/对话期间：关闭对话/章节卡/全屏剧情
    if(dlgActive){closeDlg();}
    if(cinActive){skipCinematic();}
    const cs=document.getElementById('chapter-scr');
    if(cs && cs.style.display==='flex'){dismissChapterCard();}
    addBanner('▶ 跳过等待！');
  }else if(wavePhase==='cleared' && shopOpen){
    // 商店等待期：关闭商店
    closeShop();
    addBanner('▶ 跳过商店，继续推进！');
  }else{
    addBanner('⚠ 当前阶段无法跳过（战斗中/缓冲期尸潮中）');
  }
}
// 刷新"下一波"按钮显示状态（在 gameLoop 调用）
function updateNextWaveBtn(){
  const btn=document.getElementById('next-wave-btn');
  if(!btn)return;
  // 波次文字由 updateWaveSpawning (spawning阶段) 和 drawWaveHUD 负责更新
  // 这里只在非spawning阶段补充显示状态文字
  if(waveTxt && wavePhase !== 'spawning'){
    let txt;
    if(wave < 1){
      // 序章剧情期间不显示"第0波"，避免误导玩家
      txt = '🌙 序章剧情中...';
    } else {
      txt = '第 ' + wave + ' 波';
      if(wavePhase==='buffer'){
        txt = '🌙 第 ' + wave + ' 波 · 夜晚尸潮缓冲期';
      } else if(wavePhase==='cleared'){
        txt += ' · ✅已清场';
      } else if(wavePhase==='waiting'){
        txt += ' · 准备中...';
      } else if(wavePhase==='boss'){
        txt += ' · BOSS战';
      } else if(wavePhase==='hub'){
        txt += ' · 🏠据点整备';
      }
    }
    waveTxt.textContent = txt;
  }
  // Hub世界始终显示"下一波"（出击）
  if(gameState === 'hub'){
    btn.style.display = 'inline-block';
    btn.textContent = '出击 ▶';
    return;
  }
  btn.textContent = '▶ 下一波';
  // 仅在可跳过阶段显示：商店等待 / 章节卡 / 对话 / 全屏剧情对话
  const chapScr=document.getElementById('chapter-scr');
  const show = (wavePhase==='cleared'&&shopOpen) || (wavePhase==='waiting'&&(dlgActive||cinActive||(chapScr&&chapScr.style.display==='flex')));
  btn.style.display = show ? 'inline-block' : 'none';
}

// [cabinUIOpen 已统一定义于 Section 01 顶层]

// ── 战备工事升级项 CABIN_UPGRADE_ITEMS 已集中归拢至 Section 01 CONFIG & REGISTRIES ──
function openCabinUpgradeUI() {
  openManageUI();
}

// 统一管理界面：升级工事 + 军备商店 + 厨房 三合一
function openManageUI() {
  if (!gameRunning) return;
  cabinUIOpen = true;
  cabinActiveTab = 'upgrade';
  document.querySelectorAll('.cabin-tab').forEach((t, i) => {
    if(i === 0) t.classList.add('active');
    else t.classList.remove('active');
  });
  document.getElementById('cabin-upgrade-panel').style.display = 'block';
  document.getElementById('cabin-kitchen-panel').classList.remove('active');
  const shopPanel = document.getElementById('cabin-shop-panel');
  if(shopPanel) shopPanel.style.display = 'none';
  buildCabinUpgradeUI();
  updateCabinResources();
  document.getElementById('cabin-scr').classList.add('open');
  sndShopOpen();
}

function closeCabinUpgradeUI() {
  if (!cabinUIOpen) return;
  cabinUIOpen = false;
  document.getElementById('cabin-scr').classList.remove('open');
  sndShopClose();
}

// ═══════════════════════════════════════════

// ── 4. 主菜单背景动态粒子与看板 ──
let menuCanvasAnim = null;
let menuParticles = [];

function initMenuCanvas(){
  const canvas = document.getElementById('menu-bg-canvas');
  if(!canvas) return;
  canvas.width = window.innerWidth || 1100;
  canvas.height = window.innerHeight || 600;

  menuParticles = [];
  // 余烬粒子
  for(let i=0; i<45; i++){
    menuParticles.push({
      type: 'ember',
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.6 - Math.random() * 1.5,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.2 + Math.random() * 0.8,
      life: Math.random() * 200,
      maxLife: 200 + Math.random() * 150
    });
  }
  // 细雨微雾粒子
  for(let i=0; i<50; i++){
    menuParticles.push({
      type: 'rain',
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: -1.5,
      vy: 6 + Math.random() * 4,
      len: 8 + Math.random() * 8,
      alpha: 0.15 + Math.random() * 0.25
    });
  }
}

function runMenuCanvasFrame(){
  const scr = document.getElementById('main-menu-scr');
  if(!scr || scr.style.display === 'none'){
    menuCanvasAnim = null;
    return;
  }
  const canvas = document.getElementById('menu-bg-canvas');
  if(!canvas){ menuCanvasAnim = null; return; }
  const ctx2 = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx2.clearRect(0, 0, w, h);

  // 夜空渐变
  const skyGrad = ctx2.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#06080e');
  skyGrad.addColorStop(0.5, '#0a0e1a');
  skyGrad.addColorStop(0.85, '#121824');
  skyGrad.addColorStop(1, '#080a10');
  ctx2.fillStyle = skyGrad;
  ctx2.fillRect(0, 0, w, h);

  const now = performance.now() * 0.001;

  // 探照灯
  const drawSearchlight = (baseX, baseY, angleCenter, swingRange, swingSpeed, col) => {
    ctx2.save();
    const ang = angleCenter + Math.sin(now * swingSpeed) * swingRange;
    const beamLen = Math.max(w, h) * 1.2;
    const beamSpread = 0.16;

    ctx2.translate(baseX, baseY);
    ctx2.rotate(ang);

    const grad = ctx2.createRadialGradient(0, 0, 20, beamLen * 0.5, 0, beamLen);
    grad.addColorStop(0, col);
    grad.addColorStop(0.5, col.replace(/[\d\.]+\)$/, '0.08)'));
    grad.addColorStop(1, 'transparent');

    ctx2.fillStyle = grad;
    ctx2.beginPath();
    ctx2.moveTo(0, 0);
    ctx2.lineTo(beamLen, -Math.tan(beamSpread) * beamLen);
    ctx2.lineTo(beamLen, Math.tan(beamSpread) * beamLen);
    ctx2.closePath();
    ctx2.fill();
    ctx2.restore();
  };

  drawSearchlight(w * 0.18, h * 0.72, -0.6, 0.45, 0.4, 'rgba(120, 210, 255, 0.22)');
  drawSearchlight(w * 0.82, h * 0.70, -2.5, 0.5, 0.35, 'rgba(255, 200, 100, 0.18)');

  // 要塞剪影
  const groundY = h * 0.74;
  ctx2.fillStyle = '#06080d';
  for(let bx = 0; bx < w; bx += 48){
    const bHeight = 40 + Math.sin(bx * 0.05) * 30 + (bx % 37) * 2;
    ctx2.fillRect(bx, groundY - bHeight, 40, bHeight);
  }

  // 要塞高墙
  ctx2.fillStyle = '#0d1017';
  ctx2.fillRect(0, groundY, w, h - groundY);
  for(let x = 0; x < w; x += 36){
    ctx2.fillRect(x, groundY - 14, 20, 14);
  }

  // 哨塔
  ctx2.fillRect(w * 0.16, groundY - 80, 48, 80);
  ctx2.fillRect(w * 0.14, groundY - 96, 68, 16);
  ctx2.fillRect(w * 0.80, groundY - 75, 46, 75);
  ctx2.fillRect(w * 0.78, groundY - 90, 62, 15);

  // 食堂小屋暖光与炊烟
  const hutX = w * 0.46, hutY = groundY - 50, hutW = 90, hutH = 50;
  ctx2.fillStyle = '#161214';
  ctx2.fillRect(hutX, hutY, hutW, hutH);

  const winGlow = ctx2.createRadialGradient(hutX + 45, hutY + 28, 5, hutX + 45, hutY + 28, 45);
  winGlow.addColorStop(0, 'rgba(255, 170, 50, 0.8)');
  winGlow.addColorStop(0.5, 'rgba(255, 120, 20, 0.35)');
  winGlow.addColorStop(1, 'transparent');
  ctx2.fillStyle = winGlow;
  ctx2.fillRect(hutX + 20, hutY + 12, 50, 32);
  ctx2.fillStyle = '#ffe090';
  ctx2.fillRect(hutX + 32, hutY + 18, 26, 20);

  ctx2.fillStyle = '#221a18';
  ctx2.fillRect(hutX + 68, hutY - 24, 14, 24);

  // 炊烟
  for(let sm = 0; sm < 4; sm++){
    const st = (now * 1.5 + sm * 1.2) % 4;
    const smY = hutY - 24 - st * 32;
    const smX = hutX + 75 + Math.sin(now + sm) * (8 + st * 10);
    const smR = 6 + st * 10;
    const smAlpha = Math.max(0, (1 - st / 4) * 0.35);
    ctx2.fillStyle = `rgba(255, 210, 160, ${smAlpha})`;
    ctx2.beginPath();
    ctx2.arc(smX, smY, smR, 0, Math.PI * 2);
    ctx2.fill();
  }

  // 粒子更新与渲染
  for(let i = 0; i < menuParticles.length; i++){
    const p = menuParticles[i];
    if(p.type === 'ember'){
      p.x += p.vx + Math.sin(now + i) * 0.5;
      p.y += p.vy;
      p.life++;
      if(p.y < -10 || p.life > p.maxLife){
        p.x = Math.random() * w;
        p.y = h + 10;
        p.life = 0;
      }
      const alphaRatio = Math.sin((p.life / p.maxLife) * Math.PI) * p.alpha;
      ctx2.fillStyle = `rgba(255, ${Math.floor(130 + Math.random()*70)}, 30, ${alphaRatio})`;
      ctx2.shadowBlur = 8;
      ctx2.shadowColor = '#ff6600';
      ctx2.beginPath();
      ctx2.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.shadowBlur = 0;
    } else if(p.type === 'rain'){
      p.x += p.vx;
      p.y += p.vy;
      if(p.y > h + 20 || p.x < -20){
        p.x = Math.random() * w + 50;
        p.y = -20;
      }
      ctx2.strokeStyle = `rgba(180, 215, 255, ${p.alpha})`;
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(p.x, p.y);
      ctx2.lineTo(p.x + p.vx * (p.len / p.vy), p.y + p.len);
      ctx2.stroke();
    }
  }

  menuCanvasAnim = requestAnimationFrame(runMenuCanvasFrame);
}

function startMenuBgAnimation(){
  initMenuCanvas();
  if(!menuCanvasAnim){
    menuCanvasAnim = requestAnimationFrame(runMenuCanvasFrame);
  }
}

function stopMenuBgAnimation(){
  if(menuCanvasAnim){
    cancelAnimationFrame(menuCanvasAnim);
    menuCanvasAnim = null;
  }
}

function updateMainMenuSaveDossier(){
  const content = document.getElementById('save-intel-content');
  const badge = document.getElementById('save-status-badge');
  const continueBtn = document.getElementById('continue-btn');
  const continueHint = document.getElementById('continue-hint');
  const saveInfo = document.getElementById('save-info');
  if(!content) return;

  const saveStr = localStorage.getItem('zombie_game_autosave');
  if(saveStr){
    try{
      const save = JSON.parse(saveStr);
      if(badge){
        badge.textContent = '🟢 战局就绪';
        badge.style.color = '#88ffaa';
        badge.style.borderColor = '#27ae60';
        badge.style.background = 'rgba(39,174,96,0.2)';
      }
      if(continueBtn){
        continueBtn.style.display = 'block';
        continueBtn.style.opacity = '1';
        continueBtn.style.pointerEvents = 'auto';
      }
      if(continueHint){
        continueHint.textContent = `第 ${save.wave || 1} 波 · 💰${save.coins || 0}`;
      }
      if(saveInfo){
        saveInfo.textContent = `📂 存档: 第${save.wave||1}波 · 击杀${save.killCount||0} · 💰${save.coins||0}`;
      }

      const waveVal = Math.min(15, Math.max(1, save.wave || 1));
      const wavePct = Math.round((waveVal / 15) * 100);
      const meat = save.meatInventory || { normal: 0, fast: 0, tank: 0, elite: 0 };

      // Equipped weapons preview
      const owned = (save.ownedWeapons && Array.isArray(save.ownedWeapons)) ? save.ownedWeapons : [0];
      const wCardsHtml = owned.slice(0, 2).map((idx, sIdx) => {
        const w = WEAPONS[idx];
        if(!w) return '';
        const lv = (save.weaponLevels && save.weaponLevels[w.id]) ? save.weaponLevels[w.id].lv : 1;
        const isEvo = (save.weaponLevels && save.weaponLevels[w.id] && save.weaponLevels[w.id].isSuperEvolved);
        const name = isEvo ? (save.weaponLevels[w.id].evoName || w.name) : w.name;
        const tag = isEvo ? '🌟超武' : `Lv.${lv}`;
        const borderCol = isEvo ? '#ffd700' : (WEAPON_RARITY[w.rarity]?.color || '#888');
        return `
          <div style="flex:1;background:rgba(13,14,15,0.7);border:1.5px solid ${borderCol};border-radius:8px;padding:6px 8px;display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.4rem;">${w.icon}</span>
            <div style="overflow:hidden;flex:1;">
              <div style="font-size:0.75rem;font-weight:700;color:#f5deb3;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">[${sIdx+1}] ${name}</div>
              <div style="font-size:0.6rem;color:${borderCol};font-weight:700;">${tag}</div>
            </div>
          </div>
        `;
      }).join('');

      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;font-family:var(--font-body);">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;margin-bottom:4px;">
              <span style="color:#f0c060;font-weight:700;">🏰 防线进度: 第 ${waveVal} 波 / 15</span>
              <span style="color:#88ffaa;font-weight:700;">${wavePct}%</span>
            </div>
            <div style="height:7px;background:rgba(0,0,0,0.5);border:1px solid #5a381e;border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${wavePct}%;background:#e67e22;border-radius:4px;box-shadow:none;"></div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.75rem;background:rgba(15,16,17,0.6);padding:8px 10px;border-radius:8px;border:1px solid rgba(143,148,157,0.15);">
            <div style="color:#ffd700;font-weight:700;">💰 军费储备: <span style="color:#ffffff;">${save.coins || 0}</span></div>
            <div style="color:#ff8866;font-weight:700;">💀 击杀总数: <span style="color:#ffffff;">${save.killCount || 0}</span></div>
            <div style="color:#f5deb3;">🪵 防御木材: <span style="color:#ffffff;">${save.woodPlanks || 0}</span></div>
            <div style="color:#f2a65a;">⚙️ 机械零件: <span style="color:#ffffff;">${save.scrapMetal || 0}</span></div>
          </div>

          <div style="background:rgba(20,12,10,0.6);border:1px solid rgba(200,100,80,0.25);border-radius:8px;padding:8px 10px;">
            <div style="font-size:0.68rem;color:#f0a080;font-weight:700;margin-bottom:4px;">🥩 秘密食堂食材储备:</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:0.7rem;color:#ffd8a8;">
              <span style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;">普通×${meat.normal||0}</span>
              <span style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;">瘦肉×${meat.fast||0}</span>
              <span style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;">厚肉×${meat.tank||0}</span>
              <span style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;color:#dd88ff;">异变×${meat.elite||0}</span>
            </div>
          </div>

          <div>
            <div style="font-size:0.68rem;color:#f2a65a;margin-bottom:4px;">⚔️ 当前双持武装配装:</div>
            <div style="display:flex;gap:8px;">
              ${wCardsHtml || '<span style="font-size:0.7rem;color:#888888;">配装载入中...</span>'}
            </div>
          </div>
        </div>
      `;
      return;
    }catch(e){
      console.warn('解析存档失败:', e);
    }
  }

  // 无存档简报
  if(badge){
    badge.textContent = '⚪ 等待开局';
    badge.style.color = '#aaaeb6';
    badge.style.borderColor = '#53575f';
    badge.style.background = 'rgba(83,87,95,0.2)';
  }
  if(continueBtn){
    continueBtn.style.display = 'none';
  }
  if(saveInfo){
    saveInfo.style.display = 'none';
  }

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;font-family:var(--font-body);color:#d3d5d9;font-size:0.75rem;line-height:1.6;background:rgba(17,18,19,0.6);border:1px solid rgba(153,158,167,0.2);padding:14px;border-radius:10px;">
      <div style="font-family:var(--font-display);font-size:0.85rem;color:#f0c060;font-weight:700;display:flex;align-items:center;gap:6px;">
        <span>📜</span> 作战总指挥部·生存指南
      </div>
      <div>
        <b>白天防守与探索</b>：坚守高台防线，瞄准头部精准爆头歼敌，搜集肉块食材与工程零件。
      </div>
      <div>
        <b>夜幕降临·秘密食堂</b>：推开木门经营深夜食堂，用战利品烹制料理招待幸存者，赚取海量军资。
      </div>
      <div>
        <b>小胡改造台·超武觉醒</b>：将收益投入武器威力、弹夹、装填与战术改装，享用战前特餐，觉醒全屏天灾超武！
      </div>
      <div style="margin-top:4px;padding:6px 10px;background:rgba(39,174,96,0.15);border-left:3px solid #27ae60;border-radius:4px;color:#88ffaa;font-size:0.7rem;">
        👉 点击左侧 <b>[🆕 新游戏]</b> 立即上膛出击！
      </div>
    </div>
  `;
}

function sndBtnHover(){
  try{
    const a = getACtx();
    if(a && settingsSfx){
      const o = a.createOscillator(), g = a.createGain();
      const now = a.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(600, now);
      o.frequency.exponentialRampToValueAtTime(900, now + 0.03);
      g.gain.setValueAtTime(0.04, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      o.connect(g); g.connect(a.destination);
      o.start(now); o.stop(now + 0.035);
    }
  }catch(e){}
}

function sndBtnClick(){
  try{
    sndClick(850, 0.05, 0.25, 'triangle');
  }catch(e){}
}

// ── 菜谱定义 RECIPES 已集中归拢至 Section 01 CONFIG & REGISTRIES ──
function switchCabinTab(tab){
  cabinActiveTab = tab;
  document.querySelectorAll('.cabin-tab').forEach(t => t.classList.remove('active'));
  if(event && event.target) event.target.classList.add('active');
  const upgPanel = document.getElementById('cabin-upgrade-panel');
  const kitPanel = document.getElementById('cabin-kitchen-panel');
  const shopPanel = document.getElementById('cabin-shop-panel');
  const workPanel = document.getElementById('cabin-workshop-panel');
  if(upgPanel) upgPanel.style.display = 'none';
  if(kitPanel) kitPanel.classList.remove('active');
  if(shopPanel) shopPanel.style.display = 'none';
  if(workPanel) workPanel.style.display = 'none';

  if(tab === 'upgrade'){
    if(upgPanel) upgPanel.style.display = 'block';
    buildCabinUpgradeUI();
  } else if(tab === 'shop'){
    if(shopPanel) shopPanel.style.display = 'flex';
    buildManageShopUI();
  } else if(tab === 'workshop'){
    if(workPanel) workPanel.style.display = 'flex';
    renderCabinWorkshopUI();
  } else {
    if(kitPanel) kitPanel.classList.add('active');
    buildKitchenUI();
  }
}

// 在管理界面内构建商店
function buildManageShopUI(){
  const grid = document.getElementById('cabin-shop-grid');
  if(!grid) return;
  grid.innerHTML = '';
  const coinsEl = document.getElementById('cabin-shop-coins');
  if(coinsEl) coinsEl.textContent = '💰 ' + coins;
  const items = (typeof getShopItems === 'function' ? getShopItems() : SHOP_ITEMS);
  items.forEach(item => {
    const avail = item.available();
    const canAfford = coins >= item.cost;
    const enabled = avail && canAfford;
    const div = document.createElement('div');
    div.className = 'si' + (enabled ? '' : ' si-disabled');
    const stackInfo = item.stacks ? ` (${upgrades[item.id.replace('_up','')]||0}/${item.stacks})` : '';
    div.innerHTML = `<div class="si-cat">${item.cat||''}</div><div class="si-icon">${item.icon}</div><div class="si-name">${item.name}${stackInfo}</div><div class="si-desc">${item.desc}</div><div class="si-cost ${canAfford&&avail?'can-buy':'cant-buy'}">💰 ${item.cost}</div>`;
    if(enabled) div.onclick = () => {
      if(coins < item.cost || !item.available()) return;
      if(item.placement){
        if(gameState === 'hub' && item.id.startsWith('deploy_')){
          const towerType = item.id.replace('deploy_','');
          if(towers.length >= TOWER_MAX_COUNT){addBanner('⚠ 塔位已满！');return;}
          if(coins < TOWER_TYPES[towerType].cost){addBanner('💰 金币不足！');return;}
          // 弹出塔位选择面板（让玩家自己选位置）
          showTowerPlacementPanel(towerType);
          return;
        }
        item.buy();
        return;
      }
      coins -= item.cost; item.buy();
      updateCoinUI(); buildManageShopUI();
    };
    grid.appendChild(div);
  });
}

function buildKitchenUI(){
  // 更新肉块库存显示
  const meatDiv = document.getElementById('meat-inventory');
  meatDiv.innerHTML = '';
  Object.keys(MEAT_TYPES).forEach(key => {
    const m = MEAT_TYPES[key];
    const chip = document.createElement('div');
    chip.className = 'meat-chip';
    chip.innerHTML = `<span class="meat-icon" style="color:${m.color}">${m.icon}</span><span class="meat-count">${meatInventory[key]}</span>`;
    chip.title = m.name + '：' + m.desc;
    meatDiv.appendChild(chip);
  });

  // ── 经营重做：菜单注册面板（替代旧"秒变金币"菜谱网格）──
  // 顾客只点注册过的菜；注册什么菜=决定今晚的生意方向
  const menuGrid = document.getElementById('menu-reg-grid');
  if(menuGrid){
    buildMenuRegistrationUI(menuGrid);
  }

  // ── 肉块出售卡片：把多余肉块换成金币（肉块经济循环，保留）──
  const grid = menuGrid || document.createElement('div');
  const sellCard = document.createElement('div');
  sellCard.className = 'recipe-card';
  sellCard.style.borderColor = '#8a6a3a';
  sellCard.style.width = '100%';
  sellCard.style.marginTop = '4px';
  let sellHtml = '<div class="recipe-header"><span class="recipe-name" style="color:#f0c060">💰 出售肉块</span><span class="recipe-price">换金币</span></div>';
  sellHtml += '<div class="recipe-desc">把多余的肉块卖给黑市商人（普通3金/瘦5金/厚8金/异15金）</div>';
  sellHtml += '<div class="recipe-cost">';
  const meatSellPrices = {normal:3, fast:5, tank:8, elite:15};
  let totalMeat = 0;
  Object.keys(meatSellPrices).forEach(m => {
    sellHtml += `<span style="color:#f0c060">${MEAT_TYPES[m].icon}${meatInventory[m]} (${meatSellPrices[m]}金/个)</span>`;
    totalMeat += meatInventory[m];
  });
  sellHtml += '</div>';
  const totalSellValue = meatInventory.normal*3 + meatInventory.fast*5 + meatInventory.tank*8 + meatInventory.elite*15;
  sellCard.innerHTML = sellHtml;
  if(totalMeat > 0){
    sellCard.style.cursor = 'pointer';
    sellCard.onclick = () => {
      if(totalMeat === 0) return;
      coins += totalSellValue;
      updateCoinUI();
      sndCoin();
      addBanner('💰 出售全部肉块 +' + totalSellValue + ' 金币！');
      meatInventory = {normal:0, fast:0, tank:0, elite:0};
      buildKitchenUI();
      updateCabinResources();
    };
  } else {
    sellCard.classList.add('recipe-unavailable');
  }
  // v52修：先移除旧出售卡再追加——buildKitchenUI 每次调用都新建卡片，
  // 旧代码appendChild到父节点导致反复打开厨房时卡片无限堆叠
  const oldSell = document.getElementById('meat-sell-card');
  if(oldSell) oldSell.remove();
  sellCard.id = 'meat-sell-card';
  grid.parentNode.appendChild(sellCard);

  const log = document.getElementById('kitchen-log');
  if(log && tonightMenu.length > 0){
    const names = tonightMenu.map(id => (REST_RECIPES.find(r=>r.id===id)||{}).name).join('、');
    log.innerHTML = `今晚菜单：${names}。夜晚顾客会从这些菜里点单。`;
  }
}

function updateCabinResources(){
  document.getElementById('cabin-res-wood').textContent = '木材: ' + woodPlanks;
  document.getElementById('cabin-res-scrap').textContent = '金属废料: ' + scrapMetal;
  document.getElementById('cabin-res-coins').textContent = '硬币: ' + coins;
}

// ═══════════════════════════════════════════

//  【系统模块 C1】TUTORIAL SYSTEM（教程引导：战斗/据点/餐厅/特殊波）
// ═══════════════════════════════════════════
let tutorialSeen = {};  // {combat: true, hub: true, restaurant: true, horde: true, ...}

function showTutorial(key, title, lines){
  if(tutorialSeen[key]) return;
  // Bug修复（静态审查①：多步新手教程进行中时，单页教程会覆盖内容并丢失 next/skip 按钮绑定，
  // 导致 _tutorialCompleteCb（开局=nextWave）永不触发→游戏卡死。多步教程优先，单页顺延。
  // ②tutorialSeen 必须在实际显示时才置位——顺延期间置位会导致教程永久丢失）
  // 活跃判据：多步教程的 next 按钮还挂在 DOM 上且屏开着
  if(document.getElementById('tut-next-btn') && isTutorialOpen()){
    const _pend = () => {
      if(!(document.getElementById('tut-next-btn') && isTutorialOpen())){ showTutorial(key, title, lines); return; }
      setTimeout(_pend, 400);
    };
    setTimeout(_pend, 400);
    return;
  }
  tutorialSeen[key] = true;
  // 用对话框形式显示教程
  const tutScr = document.getElementById('tutorial-scr');
  if(!tutScr) return;
  document.getElementById('tutorial-title').textContent = title;
  const bodyEl = document.getElementById('tutorial-body');
  bodyEl.innerHTML = lines.map(l => `<div class="tutorial-line">${l}</div>`).join('');
  tutScr.style.display = 'flex';
  tutScr.classList.add('show');
  gameWrap.querySelectorAll('.banner-msg').forEach(el => { el.style.top = '10px'; });  // 已显示的横幅挪到卡片上方，别盖住标题
  sndShopOpen();
}

function dismissTutorial(){
  const tutScr = document.getElementById('tutorial-scr');
  if(tutScr){
    tutScr.style.display = 'none';
    tutScr.classList.remove('show');
  }
  // 核心修复：若开局多步教程正在等待完成回调（即 () => nextWave()），
  // 玩家按 ESC/Enter/跳过等任何方式关闭教程均必须可靠触发回调，杜绝卡死在第0波不出怪
  if(_tutorialCompleteCb){
    const cb = _tutorialCompleteCb;
    _tutorialCompleteCb = null;
    cb();
  }
}
// 教程是否开着（剧情/弹窗触发前检查，防止面板叠加把教程"压死"）
function isTutorialOpen(){
  const t = document.getElementById('tutorial-scr');
  return !!(t && t.style.display === 'flex');
}

// 特殊波次提示已统一为横幅提示（不再使用历史弹窗说明）

// ═══════════════════════════════════════════

//  【系统模块 C2】ACHIEVEMENTS（成就/挑战系统）
// ═══════════════════════════════════════════
let achievements={
  firstBlood:{name:'一血',desc:'第1波前击杀10只',unlocked:false,check:()=>killCount>=10&&wave<=1,reward:()=>{coins+=20;updateCoinUI();}},
  ironWall:{name:'铁壁',desc:'一波内围墙0损伤',unlocked:false,check:()=>false,reward:()=>{coins+=30;updateCoinUI();}}, // 在onWaveCleared中手动检查
  sharpshooter:{name:'神枪手',desc:'连续暴击5次',unlocked:false,check:()=>critComboCount>=5,reward:()=>{upgrades.damage++;rebuildAmmo();}},
  collector:{name:'收藏家',desc:'拥有5种不同武器',unlocked:false,check:()=>false,reward:()=>{coins+=50;updateCoinUI();}}, // 在collectWeaponCrate中检查
  survivor:{name:'幸存者',desc:'活到第10波',unlocked:false,check:()=>wave>=10,reward:()=>{maxHp+=20;health=Math.min(maxHp,health+20);updateHpUI();}},
  bossSlayer:{name:'屠龙者',desc:'击败第一个Boss',unlocked:false,check:()=>false,reward:()=>{coins+=40;updateCoinUI();}},
};
let critComboCount=0;
function checkAchievements(){
  Object.keys(achievements).forEach(k=>{
    const a=achievements[k];
    if(!a.unlocked&&a.check()){
      a.unlocked=true;
      a.reward();
      addBanner(`🏆 成就解锁：${a.name}！${a.desc}`);
      sndWave();
      spawnFloatText('🏆'+a.name,player.x+CHAR_W/2,player.y-20,'#ffee44');
    }
  });
}

// ═══════════════════════════════════════════

//  ZOMBIE CODEX（僵尸图鉴系统）
// ═══════════════════════════════════════════
// 击杀记录：每种僵尸的击杀数（key → count）
let codexKillCounts = {};
try {
  const saved = localStorage.getItem('zombie_codex_kills');
  if(saved) codexKillCounts = JSON.parse(saved);
} catch(e){ codexKillCounts = {}; }

// 记录击杀（在 killZombie 中调用）
function recordCodexKill(z){
  const key = z.zType || (z.elite ? ('old_elite_'+z.elite) : ('legacy_'+z.type));
  const wasFirstKill = !codexKillCounts[key];
  codexKillCounts[key] = (codexKillCounts[key]||0) + 1;
  try { localStorage.setItem('zombie_codex_kills', JSON.stringify(codexKillCounts)); } catch(e){}
  // 首次击杀：弹窗介绍新僵尸
  if(wasFirstKill){
    let arch = ZOMBIE_DEX_MAP[key];
    if(!arch && key.startsWith('old_elite_')){
      const eid = parseInt(key.split('_')[2]);
      arch = getEliteDexData(eid);
    }
    if(arch){
      // 延迟弹窗，避免在战斗中打断
      setTimeout(() => {
        if(!gameRunning) return;
        showNewZombieDiscovered(arch);
      }, 300);
    }
  }
}

// 新僵尸发现弹窗
function showNewZombieDiscovered(arch){
  const tutScr = document.getElementById('tutorial-scr');
  if(!tutScr) return;
  document.getElementById('tutorial-title').innerHTML = '🧟 <span style="color:#ff6644;">发现新僵尸！</span>';
  const bodyEl = document.getElementById('tutorial-body');
  bodyEl.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
      <canvas id="new-zombie-portrait" width="60" height="70" style="background:rgba(40,20,10,.6);border-radius:6px;border:2px solid ${arch.color1||'#c8a878'};"></canvas>
      <div style="text-align:left;">
        <div style="font-family:var(--font-display);font-size:1.1rem;color:${arch.color1||'#c8a878'};letter-spacing:1px;">${arch.name}</div>
        <div style="font-size:.7rem;color:#b0a284;">类型: ${arch.tier||'普通'} · 首次出现: 第${arch.firstWave||1}波</div>
      </div>
    </div>
    <div style="background:rgba(60,63,70,.3);padding:6px 10px;border-radius:4px;border-left:3px solid #f2a65a;font-size:.72rem;color:#a4a8b0;margin-bottom:6px;text-align:left;">
      <b>⚡ 机制：</b>${arch.mechanicDesc||'无特殊能力'}
    </div>
    <div style="font-size:.7rem;color:#c8c0a8;line-height:1.6;text-align:left;font-style:italic;">${arch.desc||''}</div>
    <div style="font-size:.65rem;color:#b0a284;margin-top:6px;">已记录到僵尸图鉴（顶部 🧟图鉴 按钮可查看）</div>
  `;
  tutScr.style.display = 'flex';
  tutScr.classList.add('show');
  sndBossAppear();
  // 绘制僵尸头像
  setTimeout(() => {
    const cv = document.getElementById('new-zombie-portrait');
    if(cv){
      const c = cv.getContext('2d');
      drawCodexPortrait(c, arch, cv.width, cv.height);
    }
  }, 50);
}

// 获取旧精英数据（用于图鉴显示）
function getEliteDexData(eliteId){
  const et = ELITE_TYPES[eliteId-1];
  if(!et) return null;
  return {
    key: 'old_elite_'+eliteId,
    name: et.name,
    tier: '特殊',
    firstWave: 4 + eliteId,
    baseHp: et.hp,
    baseSpeed: et.speed,
    coins: et.coins,
    pts: et.pts,
    color1: et.color1,
    color2: et.color2,
    hair: '#3a2010',
    mechanicDesc: ['远距离抛投毒液','高速冲撞玩家','铁盾正面格挡','召唤小型感染者'][eliteId-1] || '特殊精英',
    desc: ['喉咙变异的感染者，会从远处抛掷毒液球，落地形成毒沼。',
           '生前是搬家工人，感染后保留搬箱习惯，会高速冲撞玩家。',
           '强迫症发作的保洁阿姨，举着铁盾挡住正面所有子弹。',
           '庆祝狂人，会从远处召唤小型感染者增援。'][eliteId-1] || '特殊精英感染者。',
    isElite: true,
    eliteId,
  };
}

// 打开图鉴
function openCodex(){
  // 修复：之前的守卫 if(!gameRunning && gameState !== 'menu') return; 会阻止在主菜单打开
  // 实际 gameState 永远不会是 'menu'，且 gameRunning 在主菜单为 false → 永远 return
  // 现在只在游戏结束界面阻止打开
  const overScr = document.getElementById('over-scr');
  if(overScr && overScr.style.display === 'flex') return;
  const scr = document.getElementById('codex-scr');
  if(!scr) return;
  // 暂停游戏（如果在战斗中）
  if(gameRunning && !gamePaused && (gameState === 'world' || gameState === 'combat')){ togglePause(); }
  buildCodexGrid();
  scr.classList.add('open');
  sndShopOpen();
}

function closeCodex(){
  const scr = document.getElementById('codex-scr');
  if(scr) scr.classList.remove('open');
  sndShopClose();
  // 恢复游戏（如果之前被暂停）
  // v52修：gameState 从不存在 'combat' 值（只有 world/building/hub/restaurant），
  // 图鉴在战斗中打开会暂停，关闭却永远不恢复——改为检查真实状态
  if((gameState === 'world' || gameState === 'building') && gamePaused){ togglePause(); }
}

// 构建图鉴卡片网格
function buildCodexGrid(){
  const grid = document.getElementById('codex-grid');
  const statsEl = document.getElementById('codex-stats');
  if(!grid) return;
  grid.innerHTML = '';
  // 收集所有条目：新原型 + 旧精英
  const entries = [];
  for(const d of ZOMBIE_DEX){ entries.push(d); }
  for(let i=1;i<=4;i++){ entries.push(getEliteDexData(i)); }
  // 按 firstWave 排序
  entries.sort((a,b)=>(a.firstWave||0)-(b.firstWave||0));
  let discovered = 0;
  let totalKills = 0;
  for(const entry of entries){
    if(!entry) continue;
    const kills = codexKillCounts[entry.key] || 0;
    if(kills > 0) discovered++;
    totalKills += kills;
    const card = document.createElement('div');
    card.className = 'codex-card' + (kills===0 ? ' codex-locked' : '');
    const tierClass = 'codex-tier-' + (entry.tier||'普通');
    card.innerHTML = `
      <div class="codex-card-header">
        <div class="codex-card-icon"><canvas width="36" height="42" data-key="${entry.key}"></canvas></div>
        <div class="codex-card-info">
          <div class="codex-card-name ${tierClass}" style="color:${entry.color1||'#c8a878'}">${kills>0?entry.name:'???'}</div>
          <div class="codex-card-tier ${tierClass}">${entry.tier||'普通'} · 第${entry.firstWave||1}波起</div>
        </div>
      </div>
      <div class="codex-card-mech">⚡ ${kills>0?(entry.mechanicDesc||'无'):'未发现'}</div>
      <div class="codex-card-stats">
        <span>❤️HP ${entry.baseHp||'?'}</span>
        <span>👟速度 ${entry.baseSpeed||'?'}</span>
        <span>💰${entry.coins||'?'}</span>
        <span>📊${entry.pts||'?'}分</span>
      </div>
      <div class="codex-card-stats">
        <span style="color:${(entry.armorPct||0)>=0.5?'#ff9955':'#999999'};">🗡️护甲${kills>0?Math.round((entry.armorPct||0)*100)+'%':'?'}</span>
        <span style="color:${(entry.resistPct||0)>=0.5?'#f2a65a':'#999999'};">⚡抗性${kills>0?Math.round((entry.resistPct||0)*100)+'%':'?'}</span>
      </div>
      ${kills>0 ? `<div class="codex-card-desc">${entry.desc||''}</div>` : ''}
      <div class="codex-card-stats" style="margin-top:6px;">
        <span style="color:#88ff88;">击杀: ${kills}</span>
      </div>
      ${kills===0 ? `<div class="codex-card-wavelock"><div class="lock-icon">🔒</div><div>第${entry.firstWave||1}波解锁</div><div style="font-size:.6rem;margin-top:4px;color:#5a4a3a;">击杀后显示详情</div></div>` : ''}
    `;
    grid.appendChild(card);
  }
  // 更新统计
  if(statsEl) statsEl.textContent = `已发现: ${discovered} / ${entries.length} · 击杀总数: ${totalKills}`;
  // 绘制每个卡片的缩略图
  setTimeout(()=>{ drawCodexIcons(); }, 10);
}

// 绘制图鉴卡片缩略图
function drawCodexIcons(){
  const canvases = document.querySelectorAll('#codex-grid canvas');
  canvases.forEach(cv => {
    const key = cv.dataset.key;
    const c = cv.getContext('2d');
    c.clearRect(0,0,cv.width,cv.height);
    const kills = codexKillCounts[key] || 0;
    if(kills === 0){
      // 未发现：画问号
      c.fillStyle = '#3a2a20';
      c.fillRect(8,8,20,28);
      c.fillStyle = '#5a4a3a';
      c.font = 'bold 16px sans-serif';
      c.textAlign = 'center';
      c.fillText('?', 18, 28);
      return;
    }
    // 找到对应数据
    let arch = ZOMBIE_DEX_MAP[key];
    if(!arch && key.startsWith('old_elite_')){
      const eid = parseInt(key.split('_')[2]);
      arch = getEliteDexData(eid);
    }
    if(!arch) return;
    // 绘制简化版僵尸头像
    drawCodexPortrait(c, arch, cv.width, cv.height);
  });
}

// 图鉴头像绘制（简化版）
function drawCodexPortrait(c, arch, W, H){
  const cx = W/2, gy = H-4;
  // 阴影
  c.fillStyle = 'rgba(0,0,0,.4)';
  c.beginPath(); c.ellipse(cx, gy, 10, 2, 0, 0, Math.PI*2); c.fill();
  // 腿
  c.fillStyle = '#3a3a4a';
  c.fillRect(cx-5, gy-10, 4, 10);
  c.fillRect(cx+1, gy-10, 4, 10);
  // 身体
  c.fillStyle = arch.color2 || '#4a4a5a';
  c.fillRect(cx-8, gy-22, 16, 14);
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.fillRect(cx-8, gy-22, 3, 14);
  // 头
  c.fillStyle = arch.color1 || '#c8a878';
  c.fillRect(cx-7, gy-34, 14, 13);
  // 头发
  c.fillStyle = arch.hair || '#3a2818';
  c.fillRect(cx-7, gy-34, 14, 4);
  // 眼睛
  c.fillStyle = '#1a0e06';
  c.fillRect(cx-4, gy-28, 2, 2);
  c.fillRect(cx+2, gy-28, 2, 2);
  // 嘴
  c.fillRect(cx-2, gy-24, 4, 1.5);
  // 原型专属标识
  const zt = arch.key;
  if(zt === 'coneblock'){
    c.fillStyle = '#ff7722';
    c.beginPath(); c.moveTo(cx-6,gy-34); c.lineTo(cx,gy-42); c.lineTo(cx+6,gy-34); c.closePath(); c.fill();
  } else if(zt === 'buckethead'){
    c.fillStyle = '#888';
    c.fillRect(cx-8, gy-38, 16, 8);
    c.fillStyle = '#666';
    c.fillRect(cx-8, gy-38, 16, 2);
  } else if(zt === 'screendoor'){
    c.fillStyle = '#9a9a9a';
    c.fillRect(cx-12, gy-20, 4, 16);
  } else if(zt === 'flagbearer'){
    c.strokeStyle = '#5a3a1a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx+8, gy-30); c.lineTo(cx+8, gy-40); c.stroke();
    c.fillStyle = '#cc2222';
    c.beginPath(); c.moveTo(cx+8,gy-40); c.lineTo(cx+14,gy-37); c.lineTo(cx+8,gy-34); c.closePath(); c.fill();
  } else if(zt === 'exploder'){
    c.fillStyle = 'rgba(204,68,34,.7)';
    c.beginPath(); c.arc(cx, gy-15, 6, 0, Math.PI*2); c.fill();
  } else if(zt === 'spawner'){
    c.fillStyle = 'rgba(204,68,136,.6)';
    c.beginPath(); c.arc(cx, gy-15, 5, 0, Math.PI*2); c.fill();
  } else if(zt === 'ranged'){
    c.fillStyle = 'rgba(255,100,30,.6)';
    c.beginPath(); c.arc(cx-3, gy-30, 3, 0, Math.PI*2); c.fill();
  } else if(zt === 'gargantuar'){
    c.fillStyle = 'rgba(85,34,34,.5)';
    c.fillRect(cx-10, gy-24, 20, 16);
    c.fillStyle = '#ff0000';
    c.fillRect(cx-4, gy-30, 2, 2);
    c.fillRect(cx+2, gy-30, 2, 2);
  } else if(arch.isElite){
    // 旧精英：画对应标识
    c.strokeStyle = arch.color1; c.lineWidth = 1.5;
    c.strokeRect(cx-9, gy-35, 18, 30);
  }
}

