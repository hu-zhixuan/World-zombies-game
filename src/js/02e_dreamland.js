// ═══════════════════════════════════════════════════════════════════
//  【梦境系统】小胡的潜意识梦境 · 深层冥想 (Dreamland Meditation)
// ═══════════════════════════════════════════════════════════════════
// 梦里的收获不带上战场（战斗增益只来自食堂的饭），而是落在小屋里：情报、修缮、食材、人气、材料。
// 每个梦立即生效；每天（每个 wave）只能做一次梦。
const DREAM_INSIGHTS = [
  { id:'foresight', icon:'🔮', name:'预知之梦', desc:'梦见明天的热搜——提前知道明天什么菜好卖，白天该打什么',
    apply:()=>{ const t = previewTomorrowTrend(); addBanner('🔮 梦见明天的热搜：' + t.text); } },
  { id:'ironwill',  icon:'🛡️', name:'钢铁之梦', desc:'梦里把城墙一砖一瓦重砌了一遍，围墙耐久 +350',
    apply:()=>{ const mHp = (typeof WALL_HP_PER_LEVEL !== "undefined" && WALL_HP_PER_LEVEL[wallLevel]) || 600; wallHp = Math.min(mHp, wallHp + 350); updateHpUI(); } },
  { id:'bountiful', icon:'🍲', name:'丰饶之梦', desc:'梦见满满一仓的肉，醒来真的摸到了——普通肉 +3、瘦肉 +1',
    apply:()=>{ meatInventory.normal += 3; meatInventory.fast += 1; } },
  { id:'regulars',  icon:'👥', name:'老顾客之梦', desc:'梦见老顾客们排着队夸你的菜——粉丝 +40、声望 +2',
    apply:()=>{ wastegramFans += 40; restRep = Math.min(60, restRep + 2); if(typeof updateWastegramRank === 'function') updateWastegramRank(); } },
  { id:'scrap',     icon:'🔧', name:'旧物之梦', desc:'梦见翻出一堆旧木料和废铁——木材 +4、废铁 +4',
    apply:()=>{ woodPlanks += 4; scrapMetal += 4; } },
  { id:'recipe',    icon:'📖', name:'妈妈的菜谱之梦', desc:'梦里妈妈在灶台前教你火候——声望 +3、金币 +30',
    apply:()=>{ restRep = Math.min(60, restRep + 3); coins += 30; updateCoinUI(); } },
];
let dreamPickedWave = 0;  // 最近一次做梦是第几天（同一天不能再做梦）

function openDreamModal(){
  const modal = document.getElementById('dream-modal');
  if(!modal) return;
  if(dreamPickedWave === wave){
    health = maxHp;
    updateHpUI();
    addBanner('🛏️ 今天已经做过梦了，这回只是睡了一觉——生命值已完全恢复');
    return;
  }

  const shuffled = [...DREAM_INSIGHTS].sort(() => 0.5 - Math.random());
  const picks = shuffled.slice(0, 3);

  const container = document.getElementById('dream-cards-container');
  if(container){
    container.innerHTML = '';
    picks.forEach(p => {
      const card = document.createElement('div');
      card.className = 'dream-card';
      card.style.cssText = 'background:rgba(14,20,34,0.92);border:1.5px solid rgba(0,240,255,0.3);border-radius:10px;padding:16px;cursor:pointer;display:flex;flex-direction:column;align-items:center;text-align:center;transition:all .2s ease;box-shadow:0 4px 15px rgba(0,0,0,0.5);';
      card.innerHTML = `
        <div style="font-size:2.8rem;margin-bottom:8px;filter:drop-shadow(0 0 12px rgba(0,240,255,0.6));">${p.icon}</div>
        <div style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:#e0f2fe;letter-spacing:1px;margin-bottom:6px;">${p.name}</div>
        <div style="font-size:0.8rem;color:#94a3b8;line-height:1.45;margin-bottom:14px;flex:1;">${p.desc}</div>
        <button class="tactical-btn" style="width:100%;padding:7px;background:linear-gradient(90deg,rgba(0,240,255,0.25),rgba(0,180,255,0.45));border:1px solid #00f0ff;color:#e0f7fa;border-radius:6px;font-weight:800;font-size:0.85rem;cursor:pointer;">
          悟入此梦
        </button>
      `;
      card.onmouseenter = () => {
        card.style.borderColor = '#00f0ff';
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = '0 8px 25px rgba(0,240,255,0.45)';
      };
      card.onmouseleave = () => {
        card.style.borderColor = 'rgba(0,240,255,0.3)';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
      };
      card.onclick = () => selectDreamInsight(p);
      container.appendChild(card);
    });
  }

  modal.style.display = 'flex';
  gamePaused = true;
}

function selectDreamInsight(insight){
  dreamPickedWave = wave;
  if(insight.apply) insight.apply();

  health = maxHp;
  updateHpUI();

  spawnFloatText('✨ ' + insight.name, player.x + CHAR_W/2, player.y - 30, '#00f0ff');
  addBanner('🌙 小胡于沉睡中做了【' + insight.name + '】！' + insight.desc);

  closeDreamModal(true);
}

function closeDreamModal(hadPick){
  const modal = document.getElementById('dream-modal');
  if(modal) modal.style.display = 'none';
  gamePaused = false;
  if(!hadPick){
    health = maxHp;
    updateHpUI();
    addBanner('🛏️ 你在床铺上睡了一觉，生命值已完全恢复！');
    spawnFloatText('HP 满', player.x + CHAR_W/2, player.y - 30, '#2ecc71');
  }
}

// ── 阶段里程碑：第 3 波狂暴尸潮撤退进小屋后，触发【小胡专属神兵战备交付】──
let _signatureDeliveredThisRun = false;
function checkClassSignatureDelivery(){
  if(_signatureDeliveredThisRun) return;
  if(wave < 3) return;
  if(!playerClass || !playerClass.classWeapon) return;
  _signatureDeliveredThisRun = true;

  const wIdx = WEAPONS.findIndex(w => w.id === playerClass.classWeapon);
  if(wIdx < 0) return;
  const w = WEAPONS[wIdx];

  // 装备至武器槽位（最多持2把）
  if(ownedWeapons.length < MAX_OWNED_WEAPONS && !ownedWeaponsSet.has(wIdx)){
    ownedWeapons.push(wIdx);
  } else if(!ownedWeaponsSet.has(wIdx)){
    const replaceIdx = ownedWeapons.findIndex(i => WEAPONS[i].id !== 'pistol');
    if(replaceIdx >= 0) ownedWeapons[replaceIdx] = wIdx;
    else ownedWeapons[ownedWeapons.length - 1] = wIdx;
  }
  refreshOwnedSet();
  wAmmo[wIdx] = WEAPONS[wIdx].maxAmmo;
  curWpnIdx = wIdx; // 自动切换至新神兵
  buildWeaponBar();
  refreshWBar();
  updateAmmoUI();

  // 弹出专属神兵战备交付华丽仪式
  showSignatureDeliveryModal(w);
}

function showSignatureDeliveryModal(w){
  try { sndLevelUp(); } catch(e){}
  if(typeof addShake === 'function') addShake(4);

  let modal = document.getElementById('signature-delivery-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'signature-delivery-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(4,6,10,0.88);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fadeIn .25s ease;';
    document.body.appendChild(modal);
  }

  const clsName = playerClass ? playerClass.name : '当代大学生小胡';
  const clsTitle = playerClass ? (playerClass.title || playerClass.name) : '战术装扮';

  modal.innerHTML = `
    <div style="background:linear-gradient(180deg,#1c1214,#0a0c10);border:2px solid #f85149;border-radius:16px;box-shadow:0 0 40px rgba(248,81,73,0.55),0 8px 32px rgba(0,0,0,0.85);max-width:530px;width:92%;padding:26px 24px;text-align:center;position:relative;color:#f0f6fc;font-family:var(--font-display);">
      <div style="font-size:0.75rem;font-weight:800;letter-spacing:3px;color:#f85149;text-transform:uppercase;">
        ★ 阶段里程碑 · 避难所战备空投 ★
      </div>
      <div style="font-size:1.45rem;font-weight:900;color:#fff;margin:8px 0 4px;text-shadow:0 0 16px rgba(248,81,73,0.8);">
        小胡专属神兵战备交付！
      </div>
      <div style="font-size:0.8rem;color:#8b949e;line-height:1.5;margin-bottom:18px;">
        坚守完成第 3 波狂暴尸潮，成功撤退避难所！<br>
        帅气勇敢的大学生 <b style="color:#5be4ff;">${clsName}</b> 战备空投解封，正式装备红色神兵！
      </div>

      <div style="background:linear-gradient(180deg,rgba(248,81,73,0.14),rgba(0,0,0,0.45));border:1px solid rgba(248,81,73,0.4);border-radius:12px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:16px;text-align:left;">
        <span style="font-size:3rem;line-height:1;filter:drop-shadow(0 0 12px rgba(248,81,73,0.6));background:rgba(0,0,0,0.5);padding:10px;border-radius:10px;border:1px solid rgba(248,81,73,0.3);">${w.icon}</span>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.15rem;font-weight:800;color:#f85149;">${w.name}</span>
            <span style="font-size:0.62rem;background:#f85149;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700;">🔴 神兵专属</span>
          </div>
          <div style="font-size:0.72rem;color:#c9d1d9;margin-top:5px;line-height:1.4;">
            ${w.trait}
          </div>
          <div style="font-size:0.66rem;color:#5be4ff;margin-top:6px;font-weight:700;">
            ✔ 已配发至 2 号武器槽 · 满弹药就绪
          </div>
        </div>
      </div>

      <button id="btn-claim-signature" style="background:linear-gradient(180deg,#f85149,#b91c1c);color:#fff;border:none;border-radius:8px;padding:12px 36px;font-size:0.95rem;font-weight:800;cursor:pointer;box-shadow:0 0 18px rgba(248,81,73,0.5);font-family:var(--font-display);letter-spacing:1px;" onclick="document.getElementById('signature-delivery-modal').style.display='none';addBanner('🔥 已装备🔴神兵专属「${w.name}」！尽情倾泻火力！');">
        提枪迎战 · 继续出击
      </button>
    </div>
  `;
  modal.style.display = 'flex';

  for(let i=0; i<24; i++){
    const ang = Math.random() * Math.PI * 2;
    mkP({
      x: player.x + CHAR_W/2,
      y: player.y + 20,
      vx: Math.cos(ang) * 4.5,
      vy: Math.sin(ang) * 4.5 - 2,
      r: 3 + Math.random() * 2,
      rDecay: .06,
      decay: .03,
      color: Math.random() > 0.5 ? '#f85149' : '#ffd700',
      type: 'spark',
      grav: .15,
      alpha: 1
    });
  }
}

function enterCabinShelter(){
  if(gameState !== 'world') return;
  console.log('[enterCabinShelter] player retreating into safe cabin refuge');

  keys.holdInteract = false;
  cabinHoldActive = false;
  cabinHoldTimer = 0;
  hideEmergencyRetreatPrompt();
  overwhelmingHordeActive = false;
  bufferWaveThreat = 0;
  window.__waveSpecial = 'normal';
  wavePhase = 'hub';
  waveSpawnQueue = 0;
  zombies.forEach(z => { if(z.burnTimer) clearInterval(z.burnTimer); });
  zombies = []; bullets = []; bossProjList = [];

  // 重铁门关闭锁死音效
  try {
    const a = getACtx();
    if(a){
      const now = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(150, now);
      o.frequency.exponentialRampToValueAtTime(35, now + 0.25);
      g.gain.setValueAtTime(0.3 * SFX_VOL, now);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      o.connect(g); g.connect(a.destination);
      o.start(now); o.stop(now + 0.26);
    }
  }catch(e){}

  addBanner('🚪 铁门紧闭锁死！成功撤回避难所秘密小屋！');

  // 安全流畅过渡入据点，永不黑屏
  playTacticalDoorTransition(() => {
    enterHub();
    checkClassSignatureDelivery();
  });
}

// 兼容 window 级合成事件分发
window.addEventListener('keydown', e => {
  if (e._fromWinForward) return;
  if (e.target === window) {
    const evt = new KeyboardEvent(e.type, {
      code: e.code,
      key: e.key,
      keyCode: e.keyCode,
      which: e.which,
      bubbles: true,
      cancelable: true
    });
    evt._fromWinForward = true;
    document.dispatchEvent(evt);
  }
});
window.addEventListener('keyup', e => {
  if (e._fromWinForward) return;
  if (e.target === window) {
    const evt = new KeyboardEvent(e.type, {
      code: e.code,
      key: e.key,
      keyCode: e.keyCode,
      which: e.which,
      bubbles: true,
      cancelable: true
    });
    evt._fromWinForward = true;
    document.dispatchEvent(evt);
  }
});
window.addEventListener('blur', () => {
  keys.l = false; keys.r = false; keys.j = false;
  keys.holdInteract = false;
  if(cabinHoldActive) cancelCabinHold();
});

document.addEventListener('keydown',e=>{
  // 章节卡开启期间：按下任意键立即开始战斗，绝不阻塞玩家
  const chapScr = document.getElementById('chapter-scr');
  if(chapScr && chapScr.style.display === 'flex'){
    e.preventDefault();
    dismissChapterCard();
    return;
  }
  // Escape 键优先关闭全局弹窗（教程/工坊/特餐/背包）
  if(e.code==='Escape'||e.key==='Escape'){
    if(isTutorialOpen()){
      e.preventDefault();
      dismissTutorial();
      return;
    }
    if(typeof isDuffWorkshopOpen === 'function' && isDuffWorkshopOpen()){
      e.preventDefault();
      closeDuffWorkshop();
      return;
    }
  }
  // M 键：全局快速开关小胡军备改造台（仅在游戏运行且非剧情/主菜单/结算时响应）
  if(e.code==='KeyM'||e.key==='m'||e.key==='M'){
    e.preventDefault();
    const menuScr = document.getElementById('main-menu-scr');
    const isMenuVisible = menuScr && menuScr.style.display !== 'none';
    const overScr = document.getElementById('over-scr');
    const isOverVisible = overScr && overScr.style.display !== 'none';
    if(gameRunning && !cinActive && !isMenuVisible && !isOverVisible){
      if(typeof toggleDuffWorkshop === 'function') toggleDuffWorkshop();
    }
    return;
  }
  // Enter 键：剧情/对话推进（全局生效，不受 gameRunning 限制）
  if(e.code==='Enter'||e.key==='Enter'){
    // -1) 教程（Bug修复：原键盘优先级链漏了教程——按钮被盖住时教程无法关闭）
    if(isTutorialOpen()){
      e.preventDefault();
      const okBtn=document.getElementById('tutorial-ok-btn');
      const nextBtn=document.getElementById('tut-next-btn');
      if(nextBtn){nextBtn.click();}          // 多步教程：走"下一步"
      else if(okBtn){okBtn.click();}          // 单页教程：走"明白了"
      else{dismissTutorial();}                 // 按钮丢失兜底
      return;
    }
    // 0) 全屏剧情对话（最优先）
    if(cinActive){
      e.preventDefault();
      advanceCinematic();
      return;
    }
    // 1) 序章剧情
    const storyScr=document.getElementById('story-intro-scr');
    if(storyScr && storyScr.style.display!=='none'){
      e.preventDefault();
      storyNext();
      return;
    }
    // 2) 章节卡
    const chapScr=document.getElementById('chapter-scr');
    if(chapScr && chapScr.style.display==='flex'){
      e.preventDefault();
      dismissChapterCard();
      return;
    }
    // 3) 游戏内对话
    if(dlgActive){
      e.preventDefault();
      advanceDlg();
      return;
    }
  }
  if(!gameRunning)return;
  // ── 戴夫式过渡期间屏蔽所有游戏快捷键（避免过渡的 setTimeout 与 shop/cabin/pause 冲突）──
  const _daveOv=document.getElementById('dave-transition');
  if(_daveOv && _daveOv.classList.contains('active')){
    if(e.code==='KeyP'||e.code==='Escape'){ e.preventDefault(); togglePause(); return; }
    e.preventDefault();
    return;
  }
  switch(e.code){
    case'KeyP':case'Escape':
      e.preventDefault();
      if(typeof isDuffWorkshopOpen === 'function' && isDuffWorkshopOpen()){closeDuffWorkshop();break;}
      if(typeof isExpeditionOpen === 'function' && isExpeditionOpen()){closeExpeditionModal();break;}
      if(isBackpackOpen()){closeBackpack();break;}
      if(typeof unboxActive !== 'undefined' && unboxActive){ closeUnboxCard(false); break; }
      if(window._waveDlgActive){clearWaveDlg();break;}
      if(typeof dlgActive !== 'undefined' && dlgActive){closeDlg();break;}
      if(isTutorialOpen()){dismissTutorial();break;}  // Bug修复：Esc也能直接关教程
      if(cinActive){skipCinematic();}
      else if(scoutView){scoutView=false;addBanner('已退出侦察');}
      else if(placementMode){placementMode=null;addBanner('已取消放置');}
      else if(shopOpen)closeShop();
      else if(cabinUIOpen)closeCabinUpgradeUI();
      else togglePause();
      break;
    case'KeyA':case'ArrowLeft': keys.l=true;break;
    case'KeyD':case'ArrowRight':keys.r=true;break;
    case'KeyW':case'ArrowUp':keys.j=true;e.preventDefault();break;
    case'Space':
      if(typeof dlgActive !== 'undefined' && dlgActive){e.preventDefault();advanceDlg();break;}
      if(gameState === 'hub' || gameState === 'building'){
        e.preventDefault();
        tryDodge();
        break;
      }
      keys.j=true;e.preventDefault();break;
    case'KeyT':case'Enter':case'NumpadEnter':
      if(window._waveDlgActive){e.preventDefault();advWaveDlg();break;}
      break;
    case'ShiftLeft':case'ShiftRight':case'ControlLeft':tryDodge();break;
    case'KeyR':reloadWeapon();break;
    case'KeyX':
      // v53流派觉醒：专属主动技能
      e.preventDefault();tryClassSkill();break;
    case'KeyQ':e.preventDefault();
      if(typeof unboxActive !== 'undefined' && unboxActive){ closeUnboxCard(false); break; }
      if(ownedWeapons.length >= 2){
        const curSlot = ownedWeapons.indexOf(curWpnIdx);
        switchWeaponBySlot(curSlot === 0 ? 1 : 0);
        addBanner(`🔄 切枪: [${ownedWeapons.indexOf(curWpnIdx)+1}] ${cw().name}`);
      }
      break;
    case'Tab':e.preventDefault();if(scoutView){scoutView=false;addBanner('已退出侦察');}else if(shopOpen)closeShop();else openShop();break;
    case'KeyE':
      e.preventDefault();
      if(e.repeat && (gameState === 'hub' || gameState === 'building')) break;
      if(typeof tryInteractTowerBase === 'function' && tryInteractTowerBase()) break;
      keys.holdInteract = true;
      if((isHordeThreatActive() || wavePhase === 'cleared') && gameState === 'world'){
        if(typeof unboxActive !== 'undefined' && unboxActive){ closeUnboxCard(true); break; }
        if(typeof rescueNearestCompanion === 'function' && rescueNearestCompanion()) break;
        if(tryPickupWeaponCrate()) break;
        if(isPlayerNearCabin()){
          if(wavePhase === 'cleared'){
            enterCabinShelter();
          } else {
            startCabinHold();
          }
        } else {
          if(!e.repeat) addBanner('🏃 距离小屋太远！快向左撤回据点小屋门前！');
        }
        break;
      }
      handleInteractAction();
      break;
    case'KeyF':
      e.preventDefault();
      if(!isCharging){startCharge();setTimeout(()=>releaseCharge(),50);}
      break;
    case'KeyN':
      if(e.repeat) break;
      if(gameState==='world' && !cinActive && !shopOpen && !cabinUIOpen){
        if(isPlayerNearCabin() && wavePhase === 'cleared'){
          e.preventDefault();
          enterCabinShelter();
          break;
        }
        if(isHordeThreatActive() || wavePhase === 'cleared'){
          e.preventDefault();
          keys.holdInteract = true;
          if(isPlayerNearCabin()){
            startCabinHold();
          } else {
            if(!e.repeat) addBanner('🏃 距离小屋太远！快向左撤回据点小屋门前！');
          }
          break;
        } else if(wavePhase === 'spawning' && window.__waveSpecial !== 'buffer'){
          addBanner('🔒 波次进行中，小屋门锁着！清完这波后撤回据点小屋');
        } else {
          addBanner('🏠 请先撤回据点小屋！在小屋内推开食堂木门或按 [N] 营业');
        }
      } else if(gameState==='hub' && !cinActive && !shopOpen && !cabinUIOpen){
        if(typeof hubInteractCooldown !== 'undefined' && Date.now() < hubInteractCooldown) break;
        e.preventDefault();
        const totalMeat = meatInventory.normal + meatInventory.fast + meatInventory.tank + meatInventory.elite;
        if(totalMeat > 0){
          addBanner('推开餐厅门，迎接夜晚营业... [N]');
          playDaveTransition(() => { startRestaurant(); });
        } else {
          addBanner('❌ 没僵尸肉！先出击打僵尸收集肉块');
        }
      }
      break;
    case'KeyB':case'KeyI':
      e.preventDefault();
      toggleBackpack();
      break;
    case'Digit1':case'Numpad1':
      e.preventDefault();
      if(typeof unboxActive !== 'undefined' && unboxActive){ closeUnboxCardWithSlot(0); break; }
      switchWeaponBySlot(0);
      break;
    case'Digit2':case'Numpad2':
      e.preventDefault();
      if(typeof unboxActive !== 'undefined' && unboxActive){ closeUnboxCardWithSlot(1); break; }
      switchWeaponBySlot(1);
      break;
    default:const n=parseInt(e.key);if(n===1||n===2)switchWeaponBySlot(n-1);
  }
});
// 鼠标滚轮上下滚动无缝切换武器
window.addEventListener('wheel',e=>{
  if(!gameRunning||gamePaused||shopOpen||cabinUIOpen||gameState!=='world')return;
  if(ownedWeapons.length<=1)return;
  const curSlot=ownedWeapons.indexOf(curWpnIdx);
  const cs=curSlot>=0?curSlot:0;
  if(e.deltaY>0){
    switchWeaponBySlot((cs+1)%ownedWeapons.length);
  }else if(e.deltaY<0){
    switchWeaponBySlot((cs-1+ownedWeapons.length)%ownedWeapons.length);
  }
},{passive:true});
document.addEventListener('keyup',e=>{
  switch(e.code){
    case'KeyA':case'ArrowLeft': keys.l=false;break;
    case'KeyD':case'ArrowRight':keys.r=false;break;
    case'KeyW':case'ArrowUp':case'Space':keys.j=false;break;
    case'KeyQ':scoutView=false;break;  // 释放Q返回跟随
    case'KeyE':
    case'KeyN':
      // 释放E/N：取消长按进小屋
      keys.holdInteract = false;
      if(cabinHoldActive){
        cancelCabinHold();
      }
      break;
  }
});
canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect(),sx=GW/r.width,sy=GH/r.height;lastMX=(e.clientX-r.left)*sx+cameraX;lastMY=(e.clientY-r.top)*sy;});
canvas.addEventListener('mousedown',e=>{
  if(!gameRunning||shopOpen||cabinUIOpen||(typeof isDuffWorkshopOpen==='function'&&isDuffWorkshopOpen())||(typeof isBackpackOpen==='function'&&isBackpackOpen())||(typeof isExpeditionOpen==='function'&&isExpeditionOpen()))return;
  // 放置模式：左键确认放置，不射击
  if(placementMode){
    if(e.button===0){
      const r=canvas.getBoundingClientRect(),sx=GW/r.width;
      const wx=(e.clientX-r.left)*sx+cameraX;
      let placed=false;
      if(placementMode.type==='tower'){placed=placeTower(placementMode.towerType, wx);}
      else if(placementMode.type==='trap'){placed=placeTrap(placementMode.trapType, wx);}
      if(placed) placementMode=null;  // 成功放置才退出模式，失败保留让玩家重选
    }
    return;
  }
  // 右键点击塔 → 打开升级/出售弹窗
  if(e.button===2){
    const r=canvas.getBoundingClientRect(),sx=GW/r.width,sy=GH/r.height;
    const wx=(e.clientX-r.left)*sx+cameraX, wy=(e.clientY-r.top)*sy;
    for(let i=0;i<towers.length;i++){
      const t=towers[i];
      if(Math.abs(wx-t.x)<22 && Math.abs(wy-t.y)<30){showTowerPopover(i);return;}
    }
    closeTowerPopover();  // 点空白处关闭
    if(!placementMode) startCharge();  // 未点中塔：右键开始蓄力近战
    return;
  }
  // 左键点击塔 → 打开弹窗（不射击）
  if(e.button===0){
    const r=canvas.getBoundingClientRect(),sx=GW/r.width,sy=GH/r.height;
    const wx=(e.clientX-r.left)*sx+cameraX, wy=(e.clientY-r.top)*sy;
    for(let i=0;i<towers.length;i++){
      const t=towers[i];
      if(Math.abs(wx-t.x)<22 && Math.abs(wy-t.y)<30){showTowerPopover(i);return;}
    }
    closeTowerPopover();  // 点空白处关闭
  }
  mouseHeld=true;
  if(vehicle.entered){vehicleFire();return;}
  const r=canvas.getBoundingClientRect(),sx=GW/r.width,sy=GH/r.height;
  fireWeapon((e.clientX-r.left)*sx+cameraX,(e.clientY-r.top)*sy);
  // v52修：新建自动开火间隔前先清旧的（快速点击曾导致间隔堆叠泄漏）；
  // 近战武器（如狂战士血肉双刃）不建自动间隔——自动循环反复触发近战突进/连击，
  // 连击加成曾把角色推出世界边界导致黑屏，改为点按一刀。
  stopAuto();
  if(cw().autofire && !cw().meleeWeapon)autoInterval=setInterval(()=>{
    if(!mouseHeld||!gameRunning){stopAuto();return;}
    if(vehicle.entered){vehicleFire();return;}
    fireWeapon(lastMX,lastMY);
  },getFireInterval());
});
// 计算实际射击间隔（含狼化攻速×2）
function getFireInterval(){
  let iv = cw().fireInterval||80;
  if(window._berserkActive) iv = Math.max(15, Math.floor(iv*0.5));  // 狼化攻速×2
  if(frenzyT>0) iv = Math.floor(iv*0.8);  // 小改：连杀狂热射速+20%
  // ── v49批1：修复死天赋「连发 rapidfire」——每层射速间隔-12%（乘算，max4=×0.61）──
  if(playerPerks.rapidfire) iv = Math.max(12, Math.floor(iv*(1-0.12*playerPerks.rapidfire)));
  // v52肉鸽·武器线：暴击节奏——暴击后2秒攻速+25%/层
  if(playerPerks.critflow && window._critFlowT>0) iv = Math.max(10, Math.floor(iv*(1-0.25*playerPerks.critflow)));
  // ── v53/v54 回旋镖接镖加速：接住回旋镖后 1.5 秒内攻速+30% ──
  if(window._catchBuffT > 0) iv = Math.max(10, Math.floor(iv * 0.70));
  // ── v49批1：实现「贯穿 pierce」的代价（描述一直写着射速-25%但从未生效）──
  if(playerPerks.pierce) iv = Math.floor(iv*1.25);
  // ── v53流派觉醒：战地大餐（厨神）攻速+25% ──
  if(window._classSkillT>0 && playerClass && playerClass.id==='chef') iv = Math.max(10, Math.floor(iv*0.75));
  return iv;
}
// 右键取消放置模式
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(placementMode){placementMode=null;addBanner('已取消放置');return;}});
// 右键蓄力已合并到上面的 mousedown 监听器（避免重复触发）
canvas.addEventListener('mouseup',e=>{if(e.button===2){releaseCharge();}else{mouseHeld=false;stopAuto();}});
canvas.addEventListener('mouseleave',()=>{mouseHeld=false;stopAuto();if(isCharging)releaseCharge();});
function stopAuto(){if(autoInterval){clearInterval(autoInterval);autoInterval=null;}}

