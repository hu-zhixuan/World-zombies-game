// ═══════════════════════════════════════════
//  TRANSITION RESILIENCE SYSTEM（防黑屏与交互重置）
// ═══════════════════════════════════════════
function forceDismissAllOverlays(){
  try{
    const to = document.getElementById('transition-overlay');
    if(to){
      to.className = '';
      to.classList.remove('fade-in', 'fade-out');
      to.style.display = 'none';
      to.style.opacity = '0';
      to.style.pointerEvents = 'none';
    }
    const dt = document.getElementById('dave-transition');
    if(dt){
      dt.className = '';
      dt.style.display = 'none';
      dt.style.opacity = '0';
      dt.style.pointerEvents = 'none';
    }
    const cScr = document.getElementById('cinematic-scr');
    if(cScr){
      cScr.classList.remove('open');
      cScr.style.display = 'none';
      cScr.style.opacity = '0';
      cScr.style.pointerEvents = 'none';
    }
    const tdw = document.getElementById('tactical-door-wipe');
    if(tdw){
      tdw.style.display = 'none';
      tdw.style.opacity = '0';
      tdw.style.pointerEvents = 'none';
    }
  }catch(e){}

  cinActive = false;
  cinQueue = [];

  resetInputAndInteractionState();
}
window.forceDismissAllOverlays = forceDismissAllOverlays;

function resetInputAndInteractionState(){
  // 1. Reset keys dictionary
  if(typeof keys !== 'undefined' && keys){
    keys.l = false;
    keys.r = false;
    keys.j = false;
    keys.holdInteract = false;
    for(let k in keys){ keys[k] = false; }
  }
  // 2. Reset mouse and weapon states
  mouseHeld = false;
  if(typeof stopAuto === 'function') stopAuto();
  if(typeof isCharging !== 'undefined') isCharging = false;
  if(typeof chargeTimer !== 'undefined') chargeTimer = 0;
  // 3. Reset cabin hold & emergency retreat
  if(typeof cabinHoldActive !== 'undefined') cabinHoldActive = false;
  if(typeof cabinHoldTimer !== 'undefined') cabinHoldTimer = 0;
  if(typeof hideEmergencyRetreatPrompt === 'function') hideEmergencyRetreatPrompt();
  // 4. Close all floating modals & popovers
  if(typeof isBackpackOpen === 'function' && isBackpackOpen()) closeBackpack();
  if(typeof isDuffWorkshopOpen === 'function' && isDuffWorkshopOpen()) closeDuffWorkshop();
  if(typeof isExpeditionOpen === 'function' && isExpeditionOpen()) closeExpeditionModal();
  if(typeof closeShop === 'function' && typeof shopOpen !== 'undefined' && shopOpen) closeShop();
  if(typeof closeCabinUpgradeUI === 'function' && typeof cabinUIOpen !== 'undefined' && cabinUIOpen) closeCabinUpgradeUI();
  if(typeof dismissTutorial === 'function' && typeof isTutorialOpen === 'function' && isTutorialOpen()) dismissTutorial();
  if(typeof closeTowerPopover === 'function') closeTowerPopover();
  // 5. Clear stray combat entities & horde threat flags
  if(typeof bullets !== 'undefined') bullets = [];
  if(typeof bossProjList !== 'undefined') bossProjList = [];
  if(typeof particles !== 'undefined' && Array.isArray(particles)) particles.length = 0;
  if(typeof overwhelmingHordeActive !== 'undefined') overwhelmingHordeActive = false;
  if(typeof bufferWaveThreat !== 'undefined') bufferWaveThreat = 0;
  if(typeof waveSpawnQueue !== 'undefined') waveSpawnQueue = 0;
  if(typeof dodgeT !== 'undefined') dodgeT = 0;
  if(typeof dodgeCd !== 'undefined') dodgeCd = 0;
  if(typeof player !== 'undefined' && player){
    player.vx = 0; player.vy = 0;
    player.onGround = true;
    player.iframes = 0;
  }
}
window.resetInputAndInteractionState = resetInputAndInteractionState;

// ═══════════════════════════════════════════
//  【夜晚模块 B6】TRANSITION SYSTEM（戴夫式过渡动画：进/出餐厅）
// ═══════════════════════════════════════════
function playTransition(type, title, subtitle, icon, onMid, duration){
  duration = duration || 1200;
  const ov = document.getElementById('transition-overlay');
  if(!ov){ if(onMid) onMid(); return; }
  const bg = ov.querySelector('.trans-bg');
  const iconEl = ov.querySelector('.trans-icon');
  const titleEl = ov.querySelector('.trans-title');
  const subEl = ov.querySelector('.trans-sub');
  const stars = ov.querySelector('.trans-stars');

  bg.className = 'trans-bg ' + type;
  if(iconEl) iconEl.textContent = icon || '';
  if(titleEl) titleEl.textContent = title || '';
  if(subEl) subEl.textContent = subtitle || '';

  if(stars){
    if(type === 'day-night' || type === 'night-day'){
      stars.innerHTML = '';
      for(let i = 0; i < 20; i++){
        const s = document.createElement('div');
        s.className = 'trans-star';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 60 + '%';
        s.style.animationDelay = Math.random() * 2 + 's';
        s.style.width = s.style.height = (1 + Math.random() * 2) + 'px';
        stars.appendChild(s);
      }
    } else {
      stars.innerHTML = '';
    }
  }

  ov.classList.remove('fade-out');
  ov.style.display = ''; ov.style.opacity = '';  // 上次收尾/强制清场留下的行内 display:none、opacity:0 会让这次过渡整个看不见
  ov.classList.add('fade-in');
  ov.style.pointerEvents = 'auto';

  setTimeout(() => {
    try{ if(onMid) onMid(); }catch(e){ console.error(e); }
  }, duration / 2);

  setTimeout(() => {
    ov.classList.remove('fade-in');
    ov.classList.add('fade-out');
    ov.style.pointerEvents = 'none';
  }, Math.max(100, duration - 400));

  setTimeout(() => {
    ov.classList.remove('fade-out');
    ov.style.display = 'none';
    ov.style.opacity = '0';
    ov.style.pointerEvents = 'none';
  }, duration);

  // 1.5 秒硬性兜底看门狗（绝不许黑屏滞留或阻断交互）
  setTimeout(() => {
    forceDismissAllOverlays();
  }, Math.min(1500, duration + 200));
}

// ═══════════════════════════════════════════
//  DAVE-STYLE TRANSITION（戴夫式减压舱过渡）
//  模仿潜水员戴夫：玩家从战场/据点走向餐厅门 → 门开 → 黑屏 → 餐厅内部展现
//  分阶段：
//   1. 走廊场景出现，玩家剪影在左 (0~0.4s)
//   2. 玩家走向门 (0.4~1.8s)
//   3. 门开光线溢出 (1.8~2.6s)
//   4. 玩家进门消失 (2.6~3.2s)
//   5. 黑屏 (3.2~3.7s)
//   6. 餐厅内部展示+标题 (3.7~5.2s)
//   7. 调用回调进入餐厅 (5.2s)
//  期间在地面随机出现顾客剪影排队走向门，营造"客人们在等开门"的氛围
// ═══════════════════════════════════════════
function playDaveTransition(onComplete){
  const ov = document.getElementById('dave-transition');
  if(!ov){ if(onComplete) onComplete(); return; }

  if(typeof resetInputAndInteractionState === 'function') resetInputAndInteractionState();
  keys.l = false; keys.r = false; keys.j = false;
  if(mouseHeld){ mouseHeld = false; stopAuto(); }

  // 确保最长1.5秒内必定完成并彻底清理，绝不黑屏
  let completed = false;
  const finish = () => {
    if(completed) return;
    completed = true;
    try { if(onComplete) onComplete(); } catch(e){ console.error(e); }
    forceDismissAllOverlays();
  };

  ov.className = '';
  ov.classList.add('active');
  ov.style.display = 'block';
  ov.style.opacity = '1';
  ov.style.pointerEvents = 'auto';

  setTimeout(() => { ov.classList.add('walking'); }, 200);
  setTimeout(() => { ov.classList.add('door-opening'); }, 500);
  setTimeout(() => { ov.classList.add('entering'); }, 800);
  setTimeout(() => { ov.classList.add('revealing'); }, 1100);
  setTimeout(finish, 1400);
  // 1.5 秒硬性兜底看门狗（绝不许黑屏滞留或阻断交互）
  setTimeout(finish, 1500);
}

function buildCabinUpgradeUI() {
  const panel = document.getElementById('cabin-upgrade-panel');
  if(!panel) return;
  panel.innerHTML = '';

  // 1. 顶部资源统计条
  const resBar = document.createElement('div');
  resBar.style.cssText = 'width:100%;display:flex;justify-content:space-between;align-items:center;background:rgba(15,23,42,0.85);border:1px solid rgba(56,189,248,0.25);border-radius:10px;padding:8px 16px;margin-bottom:12px;font-size:0.88rem;';
  const curWallMax = (typeof WALL_HP_PER_LEVEL !== 'undefined' && WALL_HP_PER_LEVEL[wallLevel]) ? WALL_HP_PER_LEVEL[wallLevel] : 180;
  resBar.innerHTML = `
    <div style="display:flex;gap:16px;font-weight:700;color:#e2e8f0;">
      <span>🪵 木材: <b style="color:#f59e0b;">${woodPlanks}</b></span>
      <span>⚙️ 金属废料: <b style="color:#94a3b8;">${scrapMetal}</b></span>
      <span>💰 硬币: <b style="color:#ffd700;">${coins}</b></span>
    </div>
    <div style="font-size:0.78rem;color:#38bdf8;">🏰 要塞生命: ${Math.round(homeHp)}/${HOME_HP_MAX} | 🛡️ 城墙: ${Math.round(wallHp)}/${curWallMax}</div>
  `;
  panel.appendChild(resBar);

  // 2. 模块 A：基地核心工程与主堡防御
  const secA = document.createElement('div');
  secA.style.cssText = 'width:100%;margin-bottom:16px;';
  secA.innerHTML = `
    <div style="font-family:var(--font-display);font-size:.95rem;font-weight:800;color:#38bdf8;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <span>🏛️</span><span>基地防线核心工程 (科技要塞扩建 · 城垛重型炮台 · 围墙加固)</span>
    </div>
  `;
  const gridA = document.createElement('div');
  gridA.id = 'cabin-grid';
  gridA.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;';
  
  CABIN_UPGRADE_ITEMS.forEach(item => {
    const lvl = cabinUpgrades[item.id] || 0;
    const cost = item.getCost(lvl);
    const maxed = lvl >= item.maxLevel;
    
    let canAfford = false;
    let enabled = false;
    let costText = "";
    
    if (maxed) {
      costText = "已满级 MAX";
    } else {
      const woodOk = woodPlanks >= cost.wood;
      const scrapOk = scrapMetal >= cost.scrap;
      const coinsOk = coins >= cost.coins;
      canAfford = woodOk && scrapOk && coinsOk;
      enabled = canAfford;
      costText = `🪵:${cost.wood} ⚙️:${cost.scrap} 💰:${cost.coins}`;
    }
    
    const div = document.createElement('div');
    div.className = 'ci' + (enabled ? '' : ' ci-disabled');
    const levelInfo = ` (Lv.${lvl}/${item.maxLevel})`;
    const desc = item.getDesc(lvl);
    
    div.innerHTML = `
      <div class="ci-icon">${item.icon}</div>
      <div class="ci-name">${item.name}${levelInfo}</div>
      <div class="ci-desc">${desc}</div>
      <div class="ci-cost ${enabled ? 'can-buy' : 'cant-buy'}">${costText}</div>
    `;
    
    if (enabled && !maxed) {
      div.onclick = () => {
        const costVal = item.getCost(lvl);
        if (woodPlanks < costVal.wood || scrapMetal < costVal.scrap || coins < costVal.coins) return;
        
        woodPlanks -= costVal.wood;
        scrapMetal -= costVal.scrap;
        coins -= costVal.coins;
        
        cabinUpgrades[item.id]++;
        
        if (item.id === 'turret') {
          addBanner(`🗼 城垛重型近防炮已升至 Lv.${cabinUpgrades.turret}，战力与外观全方位升级！`);
        } else if (item.id === 'barricade') {
          if (wallLevel === 0) wallLevel = 1;
          const curMax = WALL_HP_PER_LEVEL[wallLevel] || 180;
          const boost = 100 + cabinUpgrades.barricade * 60;
          WALL_HP_PER_LEVEL[wallLevel] = curMax + boost;
          wallHp = Math.min(WALL_HP_PER_LEVEL[wallLevel], wallHp + boost);
          addBanner(`🏰 花岗岩城垛加固！主城墙上限 +${boost} HP（当前 ${Math.round(wallHp)}/${WALL_HP_PER_LEVEL[wallLevel]}）！`);
        } else if (item.id === 'fortify') {
          const fortLvl = cabinUpgrades.fortify;
          const hpBoost = fortLvl === 1 ? 50 : fortLvl === 2 ? 50 : 100;
          HOME_HP_MAX += hpBoost;
          homeHp = Math.min(HOME_HP_MAX, homeHp + hpBoost);
          if (fortLvl >= 3 && wallLevel > 0) { wallHp = WALL_HP_PER_LEVEL[wallLevel]; }
          addBanner(`🏛️ 主城避难要塞扩建！外观已升级为 ${fortLvl===1?'[防空要塞]':fortLvl===2?'[指挥堡垒]':'[宙斯盾要塞]'}，生命上限+${hpBoost}！`);
        } else {
          addBanner(`🏰 城堡防线 [${item.name}] 研发完成，升至 Lv.${cabinUpgrades[item.id]}！`);
        }
        
        sndCoin();
        updateCoinUI();
        buildCabinUpgradeUI();
      };
    }
    gridA.appendChild(div);
  });
  secA.appendChild(gridA);
  panel.appendChild(secA);

  // 3. 模块 B：战术防御哨塔部署 (融合塔防系统 · 支持一键就近部署与前线自由落位)
  const secB = document.createElement('div');
  secB.style.cssText = 'width:100%;margin-top:10px;';
  const deployedCount = (typeof towers !== 'undefined' && Array.isArray(towers)) ? towers.length : 0;
  const maxTowers = (typeof getTowerMaxCount === 'function') ? getTowerMaxCount() : 8;
  secB.innerHTML = `
    <div style="font-family:var(--font-display);font-size:.95rem;font-weight:800;color:#f59e0b;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;width:100%;">
      <span style="display:flex;align-items:center;gap:6px;"><span>🗼</span><span>战术防御哨塔部署 (要塞高台城垛 · 自动索敌歼灭)</span></span>
      <span style="font-size:.78rem;color:#94a3b8;font-weight:600;">已部署哨塔: <b style="color:#ffd700;">${deployedCount}</b> / ${maxTowers} 座</span>
    </div>
  `;

  const gridB = document.createElement('div');
  gridB.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:100%;margin-bottom:12px;';

  const tKeys = ['turret', 'freeze', 'cannon', 'tesla', 'repair'];
  tKeys.forEach(key => {
    const tt = TOWER_TYPES[key];
    if(!tt) return;
    const count = (typeof towers !== 'undefined' && Array.isArray(towers)) ? towers.filter(t => t.type === key).length : 0;
    const buildCost = Math.round(tt.cost * (typeof defenseCostMul==='function'?defenseCostMul():1));
    const canAfford = coins >= buildCost;
    const canBuild = canAfford && (deployedCount < maxTowers);

    const dmgInfo = TOWER_DMG_TYPES[tt.dmgType] || {name:'物理', icon:'🗡️', color:'#ccc'};

    const card = document.createElement('div');
    card.style.cssText = `background:linear-gradient(180deg, rgba(20,28,44,0.92) 0%, rgba(12,16,26,0.98) 100%);
      border:1.5px solid ${canBuild ? (tt.color||'rgba(56,189,248,0.3)') : 'rgba(100,116,139,0.25)'};
      padding:10px 8px;border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:4px;
      box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:all .18s;`;

    card.innerHTML = `
      <div style="font-size:1.6rem;line-height:1;margin-bottom:2px;">${tt.icon}</div>
      <div style="font-family:var(--font-display);font-size:.84rem;font-weight:800;color:#f1f5f9;text-align:center;">${tt.name}</div>
      <div style="font-size:.65rem;color:${dmgInfo.color};background:rgba(0,0,0,0.45);padding:1px 6px;border-radius:4px;border:1px solid ${dmgInfo.color}44;">
        ${dmgInfo.icon} ${dmgInfo.name}
      </div>
      <div style="font-size:.64rem;color:#94a3b8;text-align:center;line-height:1.35;height:38px;display:flex;align-items:center;margin:2px 0;">
        ${tt.desc.split('。')[0]}
      </div>
      <div style="font-size:.68rem;color:#cbd5e1;font-weight:600;">已部署: <b style="color:${count>0?'#38bdf8':'#64748b'};">${count}</b> 座</div>
      <div style="font-family:var(--font-display);font-size:.78rem;font-weight:700;color:${canAfford?'#ffd700':'#64748b'};margin-top:2px;">
        💰 ${buildCost}
      </div>
      <div style="display:flex;gap:4px;width:100%;margin-top:4px;">
        <button class="btn-fast-deploy" style="flex:1;padding:5px 0;font-family:var(--font-display);font-size:.70rem;font-weight:800;
          border-radius:6px;cursor:${canBuild?'pointer':'not-allowed'};
          background:${canBuild?'linear-gradient(180deg, #38bdf8, #0284c7)':'rgba(51,65,85,0.5)'};
          color:${canBuild?'#0f172a':'#64748b'};border:none;transition:all .15s;">
          ${deployedCount >= maxTowers ? '塔位已满' : canAfford ? '🚀 快速建造' : '金币不足'}
        </button>
        ${gameState==='world'?`<button class="btn-place-deploy" style="padding:5px 6px;font-family:var(--font-display);font-size:.68rem;font-weight:700;border-radius:6px;cursor:${canBuild?'pointer':'not-allowed'};background:rgba(30,41,59,0.85);color:${canBuild?'#38bdf8':'#64748b'};border:1px solid ${canBuild?'rgba(56,189,248,0.4)':'rgba(71,85,105,0.3)'};">🎯选位</button>`:''}
      </div>
    `;

    if(canBuild){
      const fastBtn = card.querySelector('.btn-fast-deploy');
      if(fastBtn){
        fastBtn.onclick = (e) => {
          e.stopPropagation();
          const ok = autoBuildTower(key);
          if(ok){
            buildCabinUpgradeUI();
          }
        };
      }
      const placeBtn = card.querySelector('.btn-place-deploy');
      if(placeBtn){
        placeBtn.onclick = (e) => {
          e.stopPropagation();
          closeCabinUpgradeUI();
          deployTower(key);
        };
      }
    }
    gridB.appendChild(card);
  });
  secB.appendChild(gridB);
  panel.appendChild(secB);

  // 4. 模块 C：基地城防掩体与地雷陷阱 (城墙筑造 · 快速修复 · 战术陷阱)
  const secC = document.createElement('div');
  secC.style.cssText = 'width:100%;margin-top:6px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);';
  secC.innerHTML = `
    <div style="font-family:var(--font-display);font-size:.95rem;font-weight:800;color:#38bdf8;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;width:100%;">
      <span style="display:flex;align-items:center;gap:6px;"><span>🛡️</span><span>基地防线掩体与防御陷阱 (阻截冲击 · 护甲维修 · 前沿阻击)</span></span>
      <span style="font-size:.78rem;color:#94a3b8;font-weight:600;">防线耐久: <b style="color:${wallHp>0?'#22c55e':'#ef4444'};">${Math.round(wallHp)}</b> / ${curWallMax} HP</span>
    </div>
  `;

  const gridC = document.createElement('div');
  gridC.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;margin-bottom:10px;';

  // C1: 升级围墙
  const wallNextLvl = wallLevel + 1;
  const wallMaxed = wallLevel >= 3;
  const wallUpgCost = !wallMaxed ? WALL_UPGRADE_COST[wallLevel] : 0;
  const canAffordWallUpg = !wallMaxed && coins >= wallUpgCost;
  const wallCard = document.createElement('div');
  wallCard.style.cssText = `background:linear-gradient(180deg, rgba(20,28,44,0.92) 0%, rgba(12,16,26,0.98) 100%);
    border:1.5px solid ${canAffordWallUpg ? '#22c55e' : 'rgba(100,116,139,0.25)'};
    padding:10px 8px;border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:4px;`;
  wallCard.innerHTML = `
    <div style="font-size:1.6rem;line-height:1;margin-bottom:2px;">🧱</div>
    <div style="font-family:var(--font-display);font-size:.84rem;font-weight:800;color:#f1f5f9;text-align:center;">
      ${wallLevel===0?'筑造木质栅栏':wallLevel===1?'升级石质城墙':wallLevel===2?'升级重装铁墙':'精钢要塞城墙'}
    </div>
    <div style="font-size:.66rem;color:#94a3b8;text-align:center;line-height:1.3;height:34px;display:flex;align-items:center;">
      ${wallMaxed?'城墙防线已达顶级MAX！耐久度与减伤均达峰值':`升级至Lv.${wallNextLvl}，城墙血量上限大幅跃升并完全回满`}
    </div>
    <div style="font-family:var(--font-display);font-size:.78rem;font-weight:700;color:${canAffordWallUpg?'#ffd700':'#64748b'};margin-top:2px;">
      ${wallMaxed?'已满级':`💰 ${wallUpgCost}`}
    </div>
    <button style="margin-top:4px;width:100%;padding:4px 0;font-family:var(--font-display);font-size:.72rem;font-weight:800;
      border-radius:6px;cursor:${canAffordWallUpg?'pointer':'not-allowed'};
      background:${canAffordWallUpg?'linear-gradient(180deg, #22c55e, #15803d)':'rgba(51,65,85,0.5)'};
      color:${canAffordWallUpg?'#fff':'#64748b'};border:none;transition:all .15s;">
      ${wallMaxed?'防线完备':canAffordWallUpg?'🧱 立即升级':'金币不足'}
    </button>
  `;
  if(canAffordWallUpg){
    wallCard.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      coins -= wallUpgCost;
      wallLevel++;
      wallHp = WALL_HP_PER_LEVEL[wallLevel];
      updateCoinUI();
      sndCoin();
      addBanner(`🧱 基地防线城墙已升级为 Lv.${wallLevel}（${wallLevel===1?'木质栅栏':wallLevel===2?'花岗岩石墙':'重装精钢要塞'}）！`);
      buildCabinUpgradeUI();
    };
  }
  gridC.appendChild(wallCard);

  // C2: 修复围墙
  const needRepair = (wallLevel > 0 && wallHp < curWallMax);
  const repairCost = 30;
  const canAffordRepair = needRepair && coins >= repairCost;
  const repCard = document.createElement('div');
  repCard.style.cssText = `background:linear-gradient(180deg, rgba(20,28,44,0.92) 0%, rgba(12,16,26,0.98) 100%);
    border:1.5px solid ${canAffordRepair ? '#38bdf8' : 'rgba(100,116,139,0.25)'};
    padding:10px 8px;border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:4px;`;
  repCard.innerHTML = `
    <div style="font-size:1.6rem;line-height:1;margin-bottom:2px;">🔧</div>
    <div style="font-family:var(--font-display);font-size:.84rem;font-weight:800;color:#f1f5f9;text-align:center;">防线快速修缮</div>
    <div style="font-size:.66rem;color:#94a3b8;text-align:center;line-height:1.3;height:34px;display:flex;align-items:center;">
      ${!wallLevel?'需先升级筑造基础城墙':!needRepair?'防线城墙当前状态完好，无需维修':`调集纳米维修工程队，将城墙耐久直接恢复至100%`}
    </div>
    <div style="font-family:var(--font-display);font-size:.78rem;font-weight:700;color:${canAffordRepair?'#ffd700':'#64748b'};margin-top:2px;">
      ${!needRepair?'无需修理':`💰 ${repairCost}`}
    </div>
    <button style="margin-top:4px;width:100%;padding:4px 0;font-family:var(--font-display);font-size:.72rem;font-weight:800;
      border-radius:6px;cursor:${canAffordRepair?'pointer':'not-allowed'};
      background:${canAffordRepair?'linear-gradient(180deg, #38bdf8, #0284c7)':'rgba(51,65,85,0.5)'};
      color:${canAffordRepair?'#0f172a':'#64748b'};border:none;transition:all .15s;">
      ${!needRepair?'耐久完好':canAffordRepair?'🔧 立即修缮':'金币不足'}
    </button>
  `;
  if(canAffordRepair){
    repCard.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      coins -= repairCost;
      wallHp = curWallMax;
      updateCoinUI();
      sndReload();
      addBanner('🔧 基地城墙防线已完全修缮至满血状态！');
      buildCabinUpgradeUI();
    };
  }
  gridC.appendChild(repCard);

  // C3: 尖刺地刺陷阱
  const spikeDef = TRAP_TYPES.spikes;
  const canAffordSpikes = coins >= spikeDef.cost;
  const spikeCard = document.createElement('div');
  spikeCard.style.cssText = `background:linear-gradient(180deg, rgba(20,28,44,0.92) 0%, rgba(12,16,26,0.98) 100%);
    border:1.5px solid ${canAffordSpikes ? '#eab308' : 'rgba(100,116,139,0.25)'};
    padding:10px 8px;border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:4px;`;
  spikeCard.innerHTML = `
    <div style="font-size:1.6rem;line-height:1;margin-bottom:2px;">🌵</div>
    <div style="font-family:var(--font-display);font-size:.84rem;font-weight:800;color:#f1f5f9;text-align:center;">${spikeDef.name}</div>
    <div style="font-size:.66rem;color:#94a3b8;text-align:center;line-height:1.3;height:34px;display:flex;align-items:center;">
      前沿拒马地刺，僵尸踏过造成强力刺伤穿刺，可承受5次碾压
    </div>
    <div style="font-family:var(--font-display);font-size:.78rem;font-weight:700;color:${canAffordSpikes?'#ffd700':'#64748b'};margin-top:2px;">
      💰 ${spikeDef.cost}
    </div>
    <div style="display:flex;gap:4px;width:100%;margin-top:4px;">
      <button class="btn-fast-trap" style="flex:1;padding:5px 0;font-family:var(--font-display);font-size:.70rem;font-weight:800;
        border-radius:6px;cursor:${canAffordSpikes?'pointer':'not-allowed'};
        background:${canAffordSpikes?'linear-gradient(180deg, #eab308, #ca8a04)':'rgba(51,65,85,0.5)'};
        color:${canAffordSpikes?'#0f172a':'#64748b'};border:none;transition:all .15s;">
        ${canAffordSpikes?'🚀 部署':'金币不足'}
      </button>
      ${gameState==='world'?`<button class="btn-place-trap" style="padding:5px 6px;font-family:var(--font-display);font-size:.68rem;font-weight:700;border-radius:6px;cursor:${canAffordSpikes?'pointer':'not-allowed'};background:rgba(30,41,59,0.85);color:${canAffordSpikes?'#facc15':'#64748b'};border:1px solid ${canAffordSpikes?'rgba(250,204,21,0.4)':'rgba(71,85,105,0.3)'};">🎯选位</button>`:''}
    </div>
  `;
  if(canAffordSpikes){
    spikeCard.querySelector('.btn-fast-trap').onclick = (e) => {
      e.stopPropagation();
      coins -= spikeDef.cost;
      updateCoinUI();
      const tx = RIGHT_WALL_X + 60 + (traps.length * 55) % 450;
      traps.push({x: tx, y: GROUND_Y, type: 'spikes', charges: spikeDef.charges});
      sndReload();
      addBanner(`🌵 战术地刺已直接部署至前线战场 x=${Math.round(tx)}！`);
      buildCabinUpgradeUI();
    };
    const placeBtn = spikeCard.querySelector('.btn-place-trap');
    if(placeBtn){
      placeBtn.onclick = (e) => {
        e.stopPropagation();
        closeCabinUpgradeUI();
        placementMode = {type:'trap', trapType:'spikes', cost:spikeDef.cost, icon:spikeDef.icon, name:spikeDef.name};
        addBanner('🌵 点击战场地面部署地刺陷阱');
      };
    }
  }
  gridC.appendChild(spikeCard);

  // C4: 高爆地雷陷阱
  const mineDef = TRAP_TYPES.mine;
  const canAffordMine = coins >= mineDef.cost;
  const mineCard = document.createElement('div');
  mineCard.style.cssText = `background:linear-gradient(180deg, rgba(20,28,44,0.92) 0%, rgba(12,16,26,0.98) 100%);
    border:1.5px solid ${canAffordMine ? '#f97316' : 'rgba(100,116,139,0.25)'};
    padding:10px 8px;border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:4px;`;
  mineCard.innerHTML = `
    <div style="font-size:1.6rem;line-height:1;margin-bottom:2px;">💣</div>
    <div style="font-family:var(--font-display);font-size:.84rem;font-weight:800;color:#f1f5f9;text-align:center;">${mineDef.name}</div>
    <div style="font-size:.66rem;color:#94a3b8;text-align:center;line-height:1.3;height:34px;display:flex;align-items:center;">
      埋设高爆感应雷，群体踩雷触发超大范围毁灭烈性爆轰 (80px AoE)
    </div>
    <div style="font-family:var(--font-display);font-size:.78rem;font-weight:700;color:${canAffordMine?'#ffd700':'#64748b'};margin-top:2px;">
      💰 ${mineDef.cost}
    </div>
    <div style="display:flex;gap:4px;width:100%;margin-top:4px;">
      <button class="btn-fast-trap" style="flex:1;padding:5px 0;font-family:var(--font-display);font-size:.70rem;font-weight:800;
        border-radius:6px;cursor:${canAffordMine?'pointer':'not-allowed'};
        background:${canAffordMine?'linear-gradient(180deg, #f97316, #c2410c)':'rgba(51,65,85,0.5)'};
        color:${canAffordMine?'#fff':'#64748b'};border:none;transition:all .15s;">
        ${canAffordMine?'🚀 部署':'金币不足'}
      </button>
      ${gameState==='world'?`<button class="btn-place-trap" style="padding:5px 6px;font-family:var(--font-display);font-size:.68rem;font-weight:700;border-radius:6px;cursor:${canAffordMine?'pointer':'not-allowed'};background:rgba(30,41,59,0.85);color:${canAffordMine?'#fb923c':'#64748b'};border:1px solid ${canAffordMine?'rgba(251,146,60,0.4)':'rgba(71,85,105,0.3)'};">🎯选位</button>`:''}
    </div>
  `;
  if(canAffordMine){
    mineCard.querySelector('.btn-fast-trap').onclick = (e) => {
      e.stopPropagation();
      coins -= mineDef.cost;
      updateCoinUI();
      const tx = RIGHT_WALL_X + 110 + (traps.length * 65) % 450;
      traps.push({x: tx, y: GROUND_Y, type: 'mine', charges: mineDef.charges});
      sndReload();
      addBanner(`💣 高爆地雷已直接埋设至前沿阵地 x=${Math.round(tx)}！`);
      buildCabinUpgradeUI();
    };
    const placeBtn = mineCard.querySelector('.btn-place-trap');
    if(placeBtn){
      placeBtn.onclick = (e) => {
        e.stopPropagation();
        closeCabinUpgradeUI();
        placementMode = {type:'trap', trapType:'mine', cost:mineDef.cost, icon:mineDef.icon, name:mineDef.name};
        addBanner('💣 点击战场地面埋设高爆地雷');
      };
    }
  }
  gridC.appendChild(mineCard);

  secC.appendChild(gridC);
  panel.appendChild(secC);

  const resWood = document.getElementById('cabin-res-wood');
  const resScrap = document.getElementById('cabin-res-scrap');
  const resCoins = document.getElementById('cabin-res-coins');
  if(resWood) resWood.textContent = `🪵 木材: ${woodPlanks}`;
  if(resScrap) resScrap.textContent = `⚙️ 金属废料: ${scrapMetal}`;
  if(resCoins) resCoins.textContent = `💰 硬币: ${coins}`;
}

function rebuildAmmo(){
  wAmmo=WEAPONS.map((w,i)=>Math.floor(w.maxAmmo*(1+upgrades.ammo*.5)));
  updateAmmoUI();
}
function getDamage(base){
  let dmg = base*(1+upgrades.damage*.25);
  // 军火库枪械改装
  if (upgrades.armoryDamageBoost > 0) {
    dmg *= (1 + upgrades.armoryDamageBoost * 0.15);
  }
  // ── 小胡武器改造台：当前武器威力改装加成 (+15%/级) ──
  if(WEAPONS[curWpnIdx] && typeof getWeaponMod === 'function'){
    const dMod = getWeaponMod(WEAPONS[curWpnIdx].id, 'damage');
    if(dMod > 0) dmg *= (1 + dMod * 0.15);
  }
  // ── 战前特餐：龙息炙烤盛宴 全伤害+35% ──
  if(activeSignature && activeSignature.id === 'dragon'){
    dmg *= 1.35;
  }
  // ── v51模块四：武器改装台——当前武器每改装+10%（与军火库全局加成叠乘）──
  if(window._weaponMods && WEAPONS[curWpnIdx]){
    const mc = window._weaponMods[WEAPONS[curWpnIdx].id] || 0;
    if(mc > 0) dmg *= (1 + mc * 0.10);
  }
  // ── v52肉鸽·武器线：双持（切枪后3秒内伤害+40%）──
  if(playerPerks.dualwield && window._dualwieldT>0) dmg *= 1.4;
  // ── v52肉鸽·武器线：烈焰弹道——火/燃烧系武器伤害+30%/层 ──
  if(playerPerks.fireforce){
    const cw2=WEAPONS[curWpnIdx];
    if(cw2 && (cw2.burn || cw2.id==='flame' || cw2.id==='napalm' || cw2.id==='chiliflamer')){
      dmg *= (1 + playerPerks.fireforce*0.3);
    }
  }
  // 肉鸽天赋：狂暴 +30%/层
  if(playerPerks.berserk) dmg *= (1+playerPerks.berserk*0.3);
  // 肉鸽天赋：先锋 守墙反击buff +50%/层
  if(playerPerks.vanguard && window._vanguardBuffT>0) dmg *= (1+playerPerks.vanguard*0.5);
  if (damageBuffActive) {
    dmg *= 1.3;
  }
  // 肉鸽天赋：血腥狂热 血越低伤害越高（每损失10%血+8%伤害）
  if(playerPerks.bloodfrenzy){
    const lossRatio = 1 - health/maxHp;
    dmg *= (1 + lossRatio*0.8);
  }
  // 肉鸽天赋：连锁处决 连击内每杀+10%伤害(最高+80%)
  if(playerPerks.chainkill && window._chainkillBuff>0){
    dmg *= (1 + Math.min(0.8, window._chainkillBuff*0.10));
  }
  // 肉鸽天赋：玻璃大炮 伤害×2.2
  if(playerPerks.glasscannon) dmg *= 2.2;
  // ── v53流派觉醒技能窗口 ──
  if(window._classSkillT>0 && playerClass){
    if(playerClass.id==='marksman') dmg *= 1.15;              // 鹰眼：全弹小幅增伤（主收益是暴击+40%在hitZombie）
    if(playerClass.id==='berserker') dmg *= 1.25;              // 血怒：全伤+25%（近战另有doMeleeAttack×2）
  }
  // 餐厅士气加成：每点士气+5%伤害
  if(moraleBuff > 0) dmg *= (1 + moraleBuff * 0.05);
  // ── 经营→战斗联动：菜品增益（伤害类）──
  const buffStacks = id => (activeBattleBuffs.find(b => b.id === id)?.stacks) || 0;
  let foodDmgBonus = 0;
  foodDmgBonus += 0.10 * buffStacks('dmg_small');
  foodDmgBonus += 0.20 * buffStacks('dmg_med');
  foodDmgBonus += 0.30 * buffStacks('berserk');
  foodDmgBonus += 0.20 * buffStacks('all_buff');
  if(foodDmgBonus > 0) dmg *= (1 + foodDmgBonus);
  return dmg;
}
function getMoveSpeed(){
  let s = BASE_SPEED+upgrades.speed*.7;
  if(playerPerks.swift) s *= (1+playerPerks.swift*0.15);  // 疾风 +15%/层
  if(window._berserkActive) s *= 1.5;  // 狼化移速×1.5
  // ── v53流派觉醒：血怒移速+40% / 战地大餐移速+15% ──
  if(window._classSkillT>0 && playerClass){
    if(playerClass.id==='berserker') s *= 1.4;
    else if(playerClass.id==='chef') s *= 1.15;
  }
  // ── v53/v54 冲锋枪跑射机动性加成+15% ──
  if(window._smgSprintT > 0) s *= 1.15;
  // 餐厅士气加成：每点士气+3%移速
  if(moraleBuff > 0) s *= (1 + moraleBuff * 0.03);
  // v50近战：连斩追击移速 +2%/层（近战流的追击感）；v52封顶×1.6——曾无上限叠加把角色推出世界
  if(meleeCombo > 0) s *= Math.min(1 + meleeCombo*0.02, 1.6);
  return s;
}

// 等级系统（任务7）：击杀获得经验，升级提升属性
function gainXp(amt){
  playerXp+=amt;
  while(playerXp>=playerXpNeed){
    playerXp-=playerXpNeed;
    playerLevel++;
    playerXpNeed=Math.floor(playerXpNeed*1.35);  // v49批1：曲线放缓(1.55→1.35)，三选一更频繁
    onLevelUp();
  }
  updateXpBar();
}
function onLevelUp(){
  // 肉鸽天赋系统：升级不再自动加属性，而是弹三选一天赋卡片
  levelUpFlash=1;
  addBanner(`⭐ 升级！Lv.${playerLevel} · 选择天赋`);
  sndWave();
  // ── 升级华丽特效 ──
  const px=player.x+CHAR_W/2, py=player.y+CHAR_H/2;
  // 金色光环扩散
  mkP({x:px,y:py,r:20,rDecay:-2.5,decay:.04,color:'#ffee44',type:'ring',alpha:.9,grav:0});
  mkP({x:px,y:py,r:10,rDecay:-1.5,decay:.06,color:'#ffffff',type:'ring',alpha:1,grav:0});
  // 上升光柱（20个金色粒子向上喷射）
  for(let i=0;i<24;i++){
    const a = -Math.PI/2 + (Math.random()-.5)*1.2;
    const sp = 3 + Math.random()*4;
    mkP({x:px+(Math.random()-.5)*20,y:py,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:3+Math.random()*3,rDecay:.05,decay:.04,color:Math.random()>.4?'#ffee44':'#ffaa00',type:'spark',grav:.05,alpha:1});
  }
  // 星星粒子环绕
  for(let i=0;i<12;i++){
    const a = i/12*Math.PI*2;
    mkP({x:px,y:py,vx:Math.cos(a)*4,vy:Math.sin(a)*4-1,r:4,rDecay:.06,decay:.05,color:'#ffffff',type:'spark',grav:.1,alpha:.95});
  }
  // 屏幕震动 + 金色闪光强化
  addShake(6);
  orangeFlash = Math.min(1, (orangeFlash||0) + 0.5);
  // 升级文字飘字
  spawnFloatText('⭐ LEVEL UP!', px, py-30, '#ffee44');
  // 升级音效（上升音阶）
  sndLevelUp();
  perkPendingLevels++;
  // 延迟触发，避免在 onKill 循环中立即暂停
  setTimeout(()=>{ if(!perkChoiceActive) triggerPerkChoice(); }, 100);
}

// 升级音效：上升音阶（do-mi-sol-do）
function sndLevelUp(){
  try{
    const ac = getACtx(); if(!ac) return;
    const now = ac.currentTime;
    const notes = [523, 659, 784, 1047];  // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + i * 0.08;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t); osc.stop(t + 0.25);
    });
    // 闪光音
    const osc2 = ac.createOscillator();
    const g2 = ac.createGain();
    osc2.type = 'sine'; osc2.frequency.value = 2000;
    g2.gain.setValueAtTime(0.1, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc2.connect(g2); g2.connect(ac.destination);
    osc2.start(now); osc2.stop(now + 0.3);
  }catch(e){}
}
function updateXpBar(){
  const el=document.getElementById('xp-fill');if(!el)return;
  el.style.width=(playerXp/playerXpNeed*100)+'%';
  const lvEl=document.getElementById('lv-display');if(lvEl)lvEl.textContent='Lv.'+playerLevel;
}

