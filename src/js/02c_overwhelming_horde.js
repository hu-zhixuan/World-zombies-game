// ═══════════════════════════════════════════════════════════════════
//  【v55 核心机制】极夜无敌特大尸潮迫退系统 (Overwhelming Horde System)
// ═══════════════════════════════════════════════════════════════════
let overwhelmingHordeActive = false;

function triggerOverwhelmingHorde(){
  if(!gameRunning || gameState !== 'world') return;
  if(overwhelmingHordeActive || wavePhase === 'horde' || wavePhase === 'hub') return;
  // 若当前天赋选择或剧情对话窗口开启中，顺延等待其选完关闭再触发尸潮警报
  const perkScr = document.getElementById('perk-choice-scr');
  const isPerkOpen = perkChoiceActive || (perkScr && perkScr.style.display === 'flex');
  if(isPerkOpen || cinActive){
    setTimeout(triggerOverwhelmingHorde, 600);
    return;
  }

  overwhelmingHordeActive = true;
  wavePhase = 'horde';
  window.__waveSpecial = 'overwhelming_horde';

  // 1. 全局血红警报频闪与震屏
  redFlash = 1.0;
  addShake(14);
  try {
    const a = getACtx();
    if(a){
      const now = a.currentTime;
      [440, 784, 440, 784, 440, 784].forEach((freq, idx)=>{
        const o = a.createOscillator(), g = a.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, now + idx * 0.22);
        o.frequency.linearRampToValueAtTime(freq === 440 ? 700 : 380, now + idx * 0.22 + 0.2);
        g.gain.setValueAtTime(0.18 * SFX_VOL, now + idx * 0.22);
        g.gain.linearRampToValueAtTime(0.01, now + idx * 0.22 + 0.21);
        o.connect(g); g.connect(a.destination);
        o.start(now + idx * 0.22); o.stop(now + idx * 0.22 + 0.22);
      });
    }
  }catch(e){}

  // 2. 警报横幅
  addBanner('🚨 极端警报：极夜深渊尸潮破土而出！数量不可估量！');
  addBanner('💀 压迫感尸潮逼近，无法正面抗衡！立刻按 [E] 撤回小屋避难！！');

  // 3. 显示屏幕中央紧急撤退 HUD
  showEmergencyRetreatPrompt();

  // 4. 刷新压迫感致命尸潮（数量极大，极快速度，霸体高抗性）
  const hordeCount = 38 + wave * 6;
  for(let i = 0; i < hordeCount; i++){
    const spawnX = Math.max(RIGHT_WALL_X + 150, cameraX + GW + 20 + Math.random() * 600 + i * 22);
    spawnZombieAt(spawnX);
  }
  zombies.forEach(z => {
    z.isHordeZombie = true;
    z.speed = Math.max((z.speed || z.spd || 1.8) * 1.8, 4.2);
    z.spd = z.speed;
    z.hp = Math.max(z.hp * 6, 2500);
    z.maxHp = z.hp;
    z.damage = 999;
    z.knockbackImmune = true;
    z.color = '#aa1122';
  });
}

function updateEmergencyRetreatPrompt(){
  const promptEl = document.getElementById('emergency-retreat-hud');
  if(!promptEl) return;
  if((!isHordeThreatActive() && wavePhase !== 'cleared') || gameState !== 'world'){
    promptEl.style.display = 'none';
    return;
  }
  promptEl.style.display = 'flex';
  const near = isPlayerNearCabin();
  if(cabinHoldActive){
    const leftSecs = ((CABIN_HOLD_MAX - cabinHoldTimer) / 60).toFixed(1);
    const pct = Math.floor((cabinHoldTimer / CABIN_HOLD_MAX) * 100);
    promptEl.style.borderColor = '#777d88';
    promptEl.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6),0 0 14px rgba(119,125,136,0.4)';
    promptEl.innerHTML = `
      <span style="font-size:14px;line-height:1;">🔐</span>
      <span style="font-family:var(--font-display);font-size:12px;font-weight:600;color:#777d88;letter-spacing:1px;white-space:nowrap;">正在闭锁入屋... ${leftSecs}s</span>
      <div style="width:90px;height:6px;background:rgba(255,255,255,0.15);border-radius:3px;overflow:hidden;margin:0 4px;">
        <div style="width:${pct}%;height:100%;background:#777d88;box-shadow:none;"></div>
      </div>
      <span style="font-family:var(--font-num);font-size:11px;font-weight:600;color:#f2a65a;">${pct}%</span>
    `;
  } else if(near){
    promptEl.style.borderColor = 'rgba(46,204,113,0.85)';
    promptEl.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6),0 0 14px rgba(46,204,113,0.35)';
    promptEl.innerHTML = `
      <span style="font-size:14px;line-height:1;">🚪</span>
      <span style="font-family:var(--font-display);font-size:12px;font-weight:600;color:#55ff88;letter-spacing:1px;white-space:nowrap;">已抵达小屋大门</span>
      <span style="font-size:11px;font-weight:700;color:#bbf7d0;padding:2px 10px;background:rgba(46,204,113,0.22);border:1px solid rgba(46,204,113,0.5);border-radius:12px;white-space:nowrap;">按住 [E] 锁门避难 (3秒)</span>
    `;
  } else {
    const cabinCenter = 165;
    const dist = Math.round(Math.abs(player.x + CHAR_W/2 - cabinCenter));
    promptEl.style.borderColor = 'rgba(255,77,109,0.7)';
    promptEl.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6),0 0 12px rgba(255,50,50,0.25)';
    promptEl.innerHTML = `
      <span style="font-size:14px;line-height:1;">🚨</span>
      <span style="font-family:var(--font-display);font-size:12px;font-weight:600;color:#ffffff;letter-spacing:1px;white-space:nowrap;text-shadow:none;">尸潮压境 · 撤回小屋门前避难</span>
      <span style="font-size:11px;color:#fca5a5;padding:2px 8px;background:rgba(255,50,50,0.22);border-radius:12px;border:1px solid rgba(255,80,80,0.35);white-space:nowrap;">⬅ 约 ${dist}px · 门前长按E</span>
    `;
  }
}

function showEmergencyRetreatPrompt(){
  let promptEl = document.getElementById('emergency-retreat-hud');
  if(!promptEl){
    promptEl = document.createElement('div');
    promptEl.id = 'emergency-retreat-hud';
    promptEl.className = 'compact-retreat-hud';
    const gw = document.getElementById('game-wrap') || document.body;
    gw.appendChild(promptEl);
  }
  promptEl.className = 'compact-retreat-hud';
  promptEl.style.cssText = 'display:flex;position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:300;background:rgba(19,20,21,0.92);backdrop-filter:blur(8px);border:1.5px solid rgba(255,77,109,0.7);border-radius:24px;padding:4px 16px;height:38px;box-sizing:border-box;box-shadow:0 4px 16px rgba(0,0,0,0.6);cursor:pointer;animation:pulseRetreat 0.8s infinite alternate;align-items:center;gap:10px;user-select:none;pointer-events:auto;';
  updateEmergencyRetreatPrompt();
  
  if(!promptEl._holdListenersBound){
    promptEl._holdListenersBound = true;
    const onStart = (e) => {
      e.preventDefault();
      keys.holdInteract = true;
      if(isPlayerNearCabin()){
        startCabinHold();
      } else {
        addBanner('🏃 距离小屋太远！快向左撤回据点小屋门前！');
      }
    };
    const onEnd = (e) => {
      keys.holdInteract = false;
      if(cabinHoldActive) cancelCabinHold();
    };
    promptEl.addEventListener('pointerdown', onStart);
    promptEl.addEventListener('pointerup', onEnd);
    promptEl.addEventListener('pointercancel', onEnd);
    promptEl.addEventListener('pointerleave', onEnd);
  }
}

function hideEmergencyRetreatPrompt(){
  const promptEl = document.getElementById('emergency-retreat-hud');
  if(promptEl) promptEl.style.display = 'none';
}

