// ════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  【夜晚经营重构】Dave the Diver 级模拟经营系统 v2.0
//  模块: EventBus / RecipeSystem / QTE / AudioManager / VFX / FSM
// ═══════════════════════════════════════════════════════════

// ── Module 5: EventBus（全局事件总线，解耦UI与逻辑）──
const RestEventBus = {
  _listeners: {},
  on(event, cb) {
    (this._listeners[event] = this._listeners[event] || []).push(cb);
    return () => this.off(event, cb);
  },
  off(event, cb) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(c => c !== cb);
  },
  emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => { try { cb(data); } catch(e){ console.error('EventBus cb error:', e); } });
  },
};
// 核心事件常量
const EVT = {
  DISH_ENHANCED: 'dish_enhanced',
  QTE_PERFECT: 'qte_perfect',
  QTE_GOOD: 'qte_good',
  QTE_FAIL: 'qte_fail',
  COIN_COLLECTED: 'coin_collected',
  WASTEGRAM_LEVELUP: 'wastegram_levelup',
  CUSTOMER_SERVED: 'customer_served',
  CUSTOMER_ANGRY: 'customer_angry',
  STAFF_ACTION: 'staff_action',
  NIGHT_END: 'night_end',
};

// ── Module 1: RecipeSystem（废土食谱 + 强化系统）──
// IRecipe 接口：食材需求、等级、售价、味道评分、为明日塔防提供的 Buff ID
const ENHANCE_COST = { normal: 2, fast: 1 };  // 强化消耗额外食材
let restEnhancedDishes = {};  // {recipeId: enhanceLevel} 本夜强化记录

function enhanceRecipe(recipe) {
  // 检查食材是否足够
  for (const m in ENHANCE_COST) {
    if ((meatInventory[m] || 0) < ENHANCE_COST[m]) {
      addBanner('❌ 强化食材不足！需要 普通×2 + 瘦×1');
      return false;
    }
  }
  // 扣除食材
  for (const m in ENHANCE_COST) meatInventory[m] -= ENHANCE_COST[m];
  // 记录强化等级
  restEnhancedDishes[recipe.id] = (restEnhancedDishes[recipe.id] || 0) + 1;
  const enhanceLv = restEnhancedDishes[recipe.id];
  // 触发夸张全屏强化动画
  playEnhanceAnimation(recipe, enhanceLv);
  // 播放ASMR级强化音效
  RestAudio.playEnhanceSound();
  // 派发事件
  RestEventBus.emit(EVT.DISH_ENHANCED, { recipe, level: enhanceLv });
  addBanner(`✨ ${recipe.name} 强化至 Lv.${enhanceLv}！售价+${enhanceLv * 15}% 味道+${enhanceLv * 10}！`);
  return true;
}

// 获取强化后的菜品属性
function getEnhancedRecipe(recipe) {
  const lv = restEnhancedDishes[recipe.id] || 0;
  const spiceBonus = (typeof getBackpackDishPriceBonus === 'function' ? getBackpackDishPriceBonus() : 0);
  return {
    ...recipe,
    enhanceLevel: lv,
    price: Math.floor(recipe.price * (1 + lv * 0.15) * (1 + spiceBonus)),
    tasteScore: (recipe.tasteScore || 50) + lv * 10,
    buffId: recipe.buffId || null,
  };
}

// ── 夸张全屏强化动画（参考班乔拔刀切鱼）──
function playEnhanceAnimation(recipe, level) {
  const ov = document.createElement('div');
  ov.id = 'enhance-anim-overlay';
  ov.style.cssText = 'position:absolute;inset:0;z-index:200;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;pointer-events:none;animation:enhanceFade .6s ease-out;';
  ov.innerHTML = `
    <div style="text-align:center;transform:scale(0);animation:enhanceBurst .8s cubic-bezier(.34,1.56,.64,1) forwards;">
      <div style="font-size:4rem;margin-bottom:10px;filter:drop-shadow(0 0 20px gold);">${recipe.icon}</div>
      <div style="font-family:var(--font-display);font-weight:800;font-size:2rem;color:#FFD45E;text-shadow:0 0 30px gold,0 4px 8px #000;letter-spacing:3px;">强化 Lv.${level}！</div>
      <div style="color:#f5deb3;font-size:.9rem;margin-top:8px;">${recipe.name} · 售价+${level*15}%</div>
    </div>
  `;
  document.getElementById('restaurant-scr').appendChild(ov);
  // 全屏闪光
  const flash = document.createElement('div');
  flash.style.cssText = 'position:absolute;inset:0;z-index:199;background:radial-gradient(circle,gold,transparent);opacity:0;animation:enhanceFlash .5s ease-out;';
  document.getElementById('restaurant-scr').appendChild(flash);
  // 粒子爆发
  if (window._restParticles) {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      window._restParticles.push({
        x: 420, y: 190,
        vx: Math.cos(a) * (3 + Math.random() * 5),
        vy: Math.sin(a) * (3 + Math.random() * 5),
        r: 3 + Math.random() * 3, life: 40,
        color: ['#FFD45E', '#FFA033', '#fff', '#FF6B6B'][i % 4],
      });
    }
  }
  setTimeout(() => { ov.remove(); flash.remove(); }, 800);
}

// ── Module 3: QTE 系统（3种QTE + 辅助功能）──
let qteActive = null;  // 当前活跃的QTE对象
let qteSimplify = false;  // 简化QTE（辅助功能）

function startQTE(type, options, onComplete) {
  if (qteActive) return;  // 已有QTE在进行
  const qte = { type, options, onComplete, startTime: performance.now(), result: null };
  qteActive = qte;
  if (qteSimplify) {
    // 简化模式：自动完美完成
    setTimeout(() => {
      qte.result = 'perfect';
      finishQTE();
    }, 600);
    return;
  }
  // 根据类型启动
  if (type === 'beer') startBeerQTE(qte);
  else if (type === 'rhythm') startRhythmQTE(qte);
}

function finishQTE() {
  const q = qteActive;
  if (!q) return;
  qteActive = null;
  const overlay = document.getElementById('qte-overlay');
  if (overlay) overlay.remove();
  if (q.onComplete) q.onComplete(q.result);
  // 派发事件
  if (q.result === 'perfect') {
    RestEventBus.emit(EVT.QTE_PERFECT, { type: q.type });
    RestAudio.playQTEPerfect();
  } else if (q.result === 'good') {
    RestEventBus.emit(EVT.QTE_GOOD, { type: q.type });
    RestAudio.playQTEGood();
  } else {
    RestEventBus.emit(EVT.QTE_FAIL, { type: q.type });
    RestAudio.playQTEFail();
  }
}

// QTE 1: 液氮扎啤（Hold & Release）
function startBeerQTE(qte) {
  const ov = document.createElement('div');
  ov.id = 'qte-overlay';
  ov.style.cssText = 'position:absolute;inset:0;z-index:180;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);';
  ov.innerHTML = `
    <div style="text-align:center;">
      <div style="font-family:var(--font-display);font-weight:800;font-size:1.2rem;color:#88ccff;margin-bottom:12px;">🍺 液氮扎啤 — 长按至绿色区间松手！</div>
      <div id="qte-beer-bar" style="width:200px;height:280px;background:rgba(255,255,255,.1);border:2px solid #88ccff;border-radius:12px;overflow:hidden;position:relative;margin:0 auto;">
        <div id="qte-beer-fill" style="position:absolute;bottom:0;left:0;right:0;height:0%;background:linear-gradient(0deg,#FFD45E,#FFA033);transition:none;"></div>
        <div style="position:absolute;left:0;right:0;bottom:90%;height:10%;background:rgba(136,255,136,.3);border-top:2px solid #88ff88;border-bottom:2px solid #88ff88;"></div>
      </div>
      <div id="qte-hint" style="color:#88ccff;font-size:.8rem;margin-top:10px;">按住任意位置充酒...</div>
    </div>
  `;
  document.getElementById('restaurant-scr').appendChild(ov);
  let filling = false;
  let fillLevel = 0;
  const fillEl = ov.querySelector('#qte-beer-fill');
  const hintEl = ov.querySelector('#qte-hint');
  let rafId;
  function update() {
    if (!qteActive || qteActive !== qte) return;
    if (filling) {
      fillLevel += 1.5;
      if (fillLevel >= 100) { fillLevel = 100; filling = false; }
      fillEl.style.height = fillLevel + '%';
    }
    rafId = requestAnimationFrame(update);
  }
  update();
  const startFill = (e) => {
    e.preventDefault();
    filling = true;
    hintEl.textContent = '松手！';
    hintEl.style.color = '#FFD45E';
  };
  const releaseFill = (e) => {
    e.preventDefault();
    if (!qteActive || qteActive !== qte) return;
    filling = false;
    // 判定：90-100% = perfect, 75-90% = good, 其他 = fail
    if (fillLevel >= 90 && fillLevel <= 100) qte.result = 'perfect';
    else if (fillLevel >= 75) qte.result = 'good';
    else qte.result = 'fail';
    finishQTE();
  };
  ov.addEventListener('mousedown', startFill);
  ov.addEventListener('mouseup', releaseFill);
  ov.addEventListener('touchstart', startFill, { passive: false });
  ov.addEventListener('touchend', releaseFill, { passive: false });
}

// QTE 2: 节奏切肉（Rhythm Tap — 收缩光圈）
function startRhythmQTE(qte) {
  const ov = document.createElement('div');
  ov.id = 'qte-overlay';
  ov.style.cssText = 'position:absolute;inset:0;z-index:180;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);';
  ov.innerHTML = `
    <div style="text-align:center;">
      <div style="font-family:var(--font-display);font-weight:800;font-size:1.2rem;color:#ff6666;margin-bottom:15px;">🔪 节奏切肉 — 光圈重合时点击！</div>
      <div id="qte-rhythm-area" style="position:relative;width:200px;height:200px;margin:0 auto;cursor:pointer;">
        <div style="position:absolute;inset:0;border-radius:50%;border:3px solid #ff6666;"></div>
        <div id="qte-rhythm-ring" style="position:absolute;border-radius:50%;border:3px solid #FFD45E;width:180px;height:180px;top:10px;left:10px;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2rem;">🥩</div>
      </div>
      <div id="qte-count" style="color:#FFD45E;font-size:1rem;margin-top:10px;">第 1 / 3 刀</div>
    </div>
  `;
  document.getElementById('restaurant-scr').appendChild(ov);
  let hits = 0;
  let currentSize = 180;
  let shrinking = true;
  const ringEl = ov.querySelector('#qte-rhythm-ring');
  const countEl = ov.querySelector('#qte-count');
  let rafId;
  function update() {
    if (!qteActive || qteActive !== qte) return;
    if (shrinking) {
      currentSize -= 2;
      if (currentSize <= 40) { shrinking = false; }
    } else {
      currentSize += 2;
      if (currentSize >= 180) { shrinking = true; }
    }
    ringEl.style.width = currentSize + 'px';
    ringEl.style.height = currentSize + 'px';
    ringEl.style.top = (100 - currentSize / 2) + 'px';
    ringEl.style.left = (100 - currentSize / 2) + 'px';
    rafId = requestAnimationFrame(update);
  }
  update();
  const onTap = (e) => {
    e.preventDefault();
    if (!qteActive || qteActive !== qte) return;
    hits++;
    // 完美区间：40-60px（最小附近）
    if (currentSize >= 40 && currentSize <= 60) {
      // perfect
      countEl.textContent = 'PERFECT! 第 ' + hits + ' / 3 刀';
      countEl.style.color = '#88ff88';
    } else if (currentSize >= 30 && currentSize <= 80) {
      // good
      countEl.textContent = 'GOOD! 第 ' + hits + ' / 3 刀';
      countEl.style.color = '#FFD45E';
    } else {
      // fail
      qte.result = 'fail';
      finishQTE();
      return;
    }
    if (hits >= 3) {
      qte.result = currentSize >= 40 && currentSize <= 60 ? 'perfect' : 'good';
      finishQTE();
    }
  };
  ov.querySelector('#qte-rhythm-area').addEventListener('click', onTap);
  ov.querySelector('#qte-rhythm-area').addEventListener('touchstart', onTap, { passive: false });
}

// ── Module 4: AudioManager（ASMR音效 + 乱码语音 + Lofi BGM）──
const RestAudio = {
  ctx: null,
  sfxEnabled: true,
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  // ASMR: 烤肉滋滋声
  playSizzle() {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.25;
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 2500;
    const gain = this.ctx.createGain(); gain.gain.value = 0.15;
    src.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    src.start(now); src.stop(now + 0.2);
  },
  // ASMR: 啤酒气泡破裂
  playBubble() {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600 + Math.random() * 400;
      g.gain.setValueAtTime(0.06, now + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.08);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(now + i * 0.04); osc.stop(now + i * 0.04 + 0.08);
    }
  },
  // ASMR: 收银机叮当声（柏青哥式）
  playCoinDing() {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [880, 1320, 1760].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.08, now + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.15);
    });
  },
  // 强化音效
  playEnhanceSound() {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [400, 600, 800, 1200].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + i * 0.08 + 0.2);
      g.gain.setValueAtTime(0.1, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.25);
    });
  },
  // QTE 音效
  playQTEPerfect() {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.12, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(now + i * 0.05); osc.stop(now + i * 0.05 + 0.2);
    });
  },
  playQTEGood() {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 550].forEach((freq, i) => {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.1, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.2);
    });
  },
  playQTEFail() {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = 150;
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.3);
  },
  // 乱码语音生成器（动物森友会式嘟嘟巴拉）
  playGibberish(text, pitch) {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const syllables = Math.max(3, Math.min(12, Math.ceil(text.length / 4)));
    const baseFreq = pitch || (180 + Math.random() * 120);
    for (let i = 0; i < syllables; i++) {
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = ['sine', 'triangle', 'square'][Math.floor(Math.random() * 3)];
      osc.frequency.value = baseFreq * (0.8 + Math.random() * 0.4);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.08);
    }
  },
};

// ── Module 4b: VFXManager（金币物理抛物线 + 钱包膨胀回弹）──
const RestVFX = {
  coinParticles: [],
  // 生成金币物理抛物线飞向钱包UI
  spawnCoinBurst(fromX, fromY, amount) {
    const targetEl = document.getElementById('rest-earnings') || document.getElementById('rest-rep');
    if (!targetEl) return;
    const targetRect = targetEl.getBoundingClientRect();
    const restScr = document.getElementById('restaurant-scr');
    const restRect = restScr.getBoundingClientRect();
    const targetX = targetRect.left - restRect.left + targetRect.width / 2;
    const targetY = targetRect.top - restRect.top + targetRect.height / 2;
    const count = Math.min(8, Math.max(3, Math.floor(amount / 10)));
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.style.cssText = `position:absolute;width:14px;height:14px;background:radial-gradient(circle,#FFD45E,#B8860B);border-radius:50%;border:1px solid #FFA033;z-index:170;pointer-events:none;left:${fromX}px;top:${fromY}px;`;
      restScr.appendChild(coin);
      const delay = i * 50;
      const duration = 600 + Math.random() * 200;
      // 抛物线动画
      const peakY = fromY - 60 - Math.random() * 40;
      coin.animate([
        { left: fromX + 'px', top: fromY + 'px', transform: 'scale(1)', offset: 0 },
        { left: (fromX + targetX) / 2 + 'px', top: peakY + 'px', transform: 'scale(1.3)', offset: 0.5 },
        { left: targetX + 'px', top: targetY + 'px', transform: 'scale(0.5)', offset: 1 },
      ], { duration, delay, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'forwards' });
      setTimeout(() => {
        coin.remove();
        if (i === count - 1) {
          // 钱包膨胀回弹
          targetEl.style.transition = 'transform .15s ease-out';
          targetEl.style.transform = 'scale(1.3)';
          setTimeout(() => { targetEl.style.transform = 'scale(1)'; }, 150);
          RestAudio.playCoinDing();
        }
      }, delay + duration);
    }
  },
};

// ── Module 6: Wasteland-gram（废土社媒评级系统）──
let wastegramFans = 0;  // 粉丝数（跨夜保留）
let wastegramRank = 'E';  // 评级 E/D/C/B/A/S（跨夜保留）

function updateWastegramRank() {
  const ranks = [
    { name: 'E', minFans: 0,    label: '路边摊' },
    { name: 'D', minFans: 50,   label: '小有名气' },
    { name: 'C', minFans: 200,  label: '废土网红店' },
    { name: 'B', minFans: 1000, label: '幸存者食堂' },
    { name: 'A', minFans: 5000, label: '末日米其林' },
    { name: 'S', minFans: 15000,label: '传奇据点餐厅' },
  ];
  let newRank = 'E';
  for (const r of ranks) {
    if (wastegramFans >= r.minFans) newRank = r.name;
  }
  if (newRank !== wastegramRank) {
    const oldRank = wastegramRank;
    wastegramRank = newRank;
    RestEventBus.emit(EVT.WASTEGRAM_LEVELUP, { oldRank, newRank });
    addBanner(`📱 废土社媒升级！${oldRank} → ${newRank}！粉丝 ${wastegramFans}！`);
    // 检查是否有新VIP解锁
    checkNewVIPUnlocks();
  }
}

function getWastegramRankLabel() {
  const labels = { E: '路边摊', D: '小有名气', C: '废土网红店', B: '幸存者食堂', A: '末日米其林', S: '传奇据点餐厅' };
  return labels[wastegramRank] || '路边摊';
}

// ── 检查新解锁的VIP并弹窗提示 ──
function checkNewVIPUnlocks(){
  VIP_CUSTOMERS.forEach(vip => {
    if(wastegramFans >= vip.unlockFans){
      const known = vipCompendium[vip.id] && vipCompendium[vip.id].unlocked;
      if(!known){
        if(!vipCompendium[vip.id]) vipCompendium[vip.id] = { met:false, meetCount:0, bestQuality:null, lastVisit:0 };
        vipCompendium[vip.id].unlocked = true;
        const tierInfo = VIP_TIERS[vip.tier];
        addBanner(`${tierInfo.icon} 新VIP解锁！${tierInfo.name} · ${vip.name} —— 粉丝数 ${wastegramFans}！`);
        // 触发一段提示音
        sndLevelUp();
      }
    }
  });
}

// ── EventBus 监听器（连接UI与逻辑）──
RestEventBus.on(EVT.COIN_COLLECTED, (data) => {
  RestVFX.spawnCoinBurst(data.x, data.y, data.amount);
});
RestEventBus.on(EVT.CUSTOMER_SERVED, (data) => {
  // 每服务一个顾客 +5~25 粉丝（根据满意度 + 顾客类型）
  let fanGain = data.satisfaction > 0.8 ? 15 : data.satisfaction > 0.5 ? 8 : 3;
  // VIP/评论家/网红带来更多粉丝
  if(data.customer && data.customer.ctype){
    if(data.customer.isVIP) fanGain *= 3;
    else if(data.customer.ctype.id === 'critic') fanGain *= 2;
    else if(data.customer.ctype.id === 'influencer') fanGain *= 2.5;
  }
  // 热搜匹配额外涨粉（爆款效应）
  if(data.customer && data.customer._trendMatched){
    fanGain *= 2;
  }
  fanGain = Math.floor(fanGain);
  wastegramFans += fanGain;
  updateWastegramRank();
  checkSocialMediaRankUp();  // 检查社媒等级提升
});
RestEventBus.on(EVT.CUSTOMER_ANGRY, () => {
  wastegramFans = Math.max(0, wastegramFans - 1);
});

// ── Module 2: 顾客啤酒QTE恢复耐心 ──
function serveBeerToCustomer(customer) {
  // 检查饮料存量
  if (restDrinks <= 0) {
    addBanner('❌ 酒柜空了！');
    return;
  }
  // 启动啤酒QTE
  startQTE('beer', { customer }, (result) => {
    if (result === 'perfect') {
      restDrinks--;
      customer.patience = customer.maxPatience;  // 完美恢复满耐心
      customer.satisfaction = 1.0;
      addRestFloatText('完美扎啤！耐心满！', customer.walkX, customer.seat.y - 40, '#88ff88');
      RestAudio.playGibberish('干杯！', 300);
      RestEventBus.emit(EVT.STAFF_ACTION, { type: 'beer_perfect' });
    } else if (result === 'good') {
      restDrinks--;
      customer.patience = Math.min(customer.maxPatience, customer.patience + customer.maxPatience * 0.5);
      addRestFloatText('不错！+50%耐心', customer.walkX, customer.seat.y - 40, '#FFD45E');
      RestAudio.playGibberish('谢谢', 250);
    } else {
      restDrinks--;
      addRestFloatText('洒了...浪费一杯', customer.walkX, customer.seat.y - 40, '#ff6666');
      RestAudio.playGibberish('啊...', 150);
    }
  });
}

// ── Module 2b: 员工特长系统 ──
function getStaffSpecialty(staff) {
  if (staff.level >= 3) {
    if (staff.type === 'cook') return 'MasterPourer';  // 自动完美倒酒
    if (staff.type === 'server') return 'NinjaServer';  // 瞬移送餐
  }
  return null;
}

function applyStaffSpecialty(staff, task) {
  const spec = getStaffSpecialty(staff);
  if (spec === 'MasterPourer' && task === 'cook') {
    // 厨师3级特长：烹饪时间减半
    return 0.5;
  }
  if (spec === 'NinjaServer' && task === 'serve') {
    // 服务员3级特长：瞬送达（无延迟）
    return 0;
  }
  return null;
}

// ── 餐厅菜谱（扩展版，含解锁声望要求 + 味道评分 + Buff ID） ──
// v52两界互锁：菜谱的战斗增益描述（厨房登记菜单时明示"做这道菜=买这个Buff"）
function recipeBuffDesc(buffId){
  const def = BATTLE_BUFF_DEFS[buffId];
  return def ? `${def.icon}${def.desc}` : '';
}
const REST_RECIPES = [
  { id:'grilled_meat',  name:'烤肉串',     unlockRep:0,  unlockWave:1, cost:{normal:2}, price:8, cookTime:2,
    icon:'烤', color:'#c87862', desc:'入门菜，快速出餐', tasteScore:50, buffId:'dmg_small', signatureId:'spicy' },
  { id:'meat_soup',     name:'僵尸浓汤',   unlockRep:5,  unlockWave:2, cost:{normal:3, fast:1}, price:15, cookTime:3,
    icon:'汤', color:'#d89878', desc:'暖身汤品', tasteScore:60, buffId:'hp_regen', signatureId:'stew' },
  { id:'steak',         name:'铁板厚肉',   unlockRep:10, unlockWave:3, cost:{tank:2}, price:22, cookTime:4,
    icon:'铁', color:'#a85838', desc:'厚肉铁板烧', tasteScore:70, buffId:'armor', signatureId:'frost' },
  { id:'mixed_grill',   name:'混合烤拼盘', unlockRep:15, unlockWave:4, cost:{normal:2, fast:2, tank:1}, price:32, cookTime:5,
    icon:'拼', color:'#aa8855', desc:'三种肉混烤', tasteScore:75, buffId:'dmg_med', signatureId:'thunder' },
  { id:'elite_hotpot',  name:'异变火锅',   unlockRep:25, unlockWave:5, cost:{elite:1, normal:3}, price:50, cookTime:6,
    icon:'锅', color:'#aa44cc', desc:'异变肉火锅——只有击杀精英僵尸才掉异变肉！', tasteScore:85, buffId:'berserk' },
  { id:'feast',         name:'末日大餐',   unlockRep:35, unlockWave:7, cost:{normal:4, fast:3, tank:2, elite:1}, price:90, cookTime:8,
    icon:'宴', color:'#ffee44', desc:'终极盛宴——需要异变肉的顶级Buff菜', tasteScore:100, buffId:'all_buff', signatureId:'dragon' },
  { id:'king_feast',    name:'霸王末日能量煲', unlockRep:0,  unlockWave:1, isSecret:true, cost:{normal:3, fast:2, tank:2, elite:1}, price:180, cookTime:8,
    icon:'👑', color:'#ffa033', desc:'绝密古卷秘传大菜！全属性极限增益与超高客单价', tasteScore:130, buffId:'all_buff', signatureId:'dragon' },
];

// ── 可雇佣员工 ──
const STAFF_POOL = [
  { id:'cook1', type:'cook',    name:'学徒厨师', color:'#c87862', skill:0.6, hireCost:80,  desc:'自动烹饪，速度60%' },
  { id:'cook2', type:'cook',    name:'大厨老王', color:'#a85838', skill:1.0, hireCost:150, desc:'自动烹饪，速度100%' },
  { id:'cook3', type:'cook',    name:'米其林大厨', color:'#ffdd44', skill:1.5, hireCost:250, desc:'自动烹饪，速度150%+菜品加价20%' },
  { id:'serve1',type:'server',  name:'勤快小妹', color:'#ff88aa', skill:0.7, hireCost:60,  desc:'自动上菜+送饮料，速度70%' },
  { id:'serve2',type:'server',  name:'金牌侍应', color:'#88ccff', skill:1.0, hireCost:120, desc:'自动上菜+送饮料，速度100%' },
  { id:'serve3',type:'server',  name:'管家老周', color:'#aa88ff', skill:1.5, hireCost:200, desc:'自动上菜+送饮料+清桌，速度150%' },
];

// 桌位和灶眼（动态生成，根据升级等级）
let restTables = [];
let restStoves = [];
let restReadyDishes = [];

function buildRestLayout(){
  // 根据升级等级生成桌位（按画布宽度自适应）
  restTables = [];
  const tableCount = restUpgradeLevel.tables;
  const tableAreaW = REST_CANVAS_W * 0.72;  // 桌位区域宽度
  const tableStartX = REST_CANVAS_W * 0.15;  // 桌位起始x
  const tableY = Math.floor(REST_CANVAS_H * 0.55);
  const spacing = tableAreaW / tableCount;
  for(let i = 0; i < tableCount; i++){
    const tx = tableStartX + i * spacing;
    restTables.push({
      x: tx, y: tableY,
      seats: [{x:tx-32, y:tableY-5, occupied:null}, {x:tx+32, y:tableY-5, occupied:null}]
    });
  }
  // 根据升级等级生成灶眼
  restStoves = [];
  const stoveCount = restUpgradeLevel.stoves;
  const stoveAreaW = REST_CANVAS_W * 0.48;
  const stoveStartX = REST_CANVAS_W * 0.14;
  const stoveY = Math.floor(REST_CANVAS_H * 0.25);
  const stoveSpacing = stoveAreaW / stoveCount;
  for(let i = 0; i < stoveCount; i++){
    restStoves.push({ x: stoveStartX + i * stoveSpacing, y: stoveY, recipe:null, progress:0, totalTime:0 });
  }
}

function getUnlockedRecipes(){
  return REST_RECIPES.filter(r => (r.isSecret ? window._secretRecipeUnlocked : (wave >= r.unlockWave && restRep >= r.unlockRep)));
}

function startRestaurant(){
  // 严格守护：必须先在小屋据点内，才能推门进入餐厅营业
  if(gameState !== 'hub'){
    console.warn('[startRestaurant] Rejected: Must be inside hub cabin first!');
    addBanner('🏠 必须先回小屋据点，才能推开餐厅门营业！');
    return;
  }
  const totalMeat = meatInventory.normal + meatInventory.fast + meatInventory.tank + meatInventory.elite;
  console.log('[startRestaurant] meat=' + totalMeat + ' wave=' + wave + ' wavePhase=' + wavePhase + ' ws=' + window.__waveSpecial);
  if(totalMeat === 0){
    addBanner('❌ 没有僵尸肉块，今晚餐厅不营业！可去出击门打下一波获取肉块。');
    return;
  }
  // 直接启动餐厅（戴夫式过渡动画已在调用方触发，这里不再叠加旧式过渡）
  _doStartRestaurant();
}

function _doStartRestaurant(){
  forceDismissAllOverlays();
  resetInputAndInteractionState();
  console.log('[_doStartRestaurant] starting restaurant');
  window._restNightEnding = false;  // v52：复位打烊防重入标志（新一夜）
  // v52修：倒计时初始 display:none（HTML 内联），开夜时主动显示——
  // restLoop 只更新文字从不改 display，之前整夜看不见计时器
  const rtEl = document.getElementById('rest-timer');
  if (rtEl) rtEl.style.display = 'block';
  // ── v51模块一：切餐厅必清对白条（原clearWaveDlg只在波清场调用——
  // 战斗中途进餐厅时波次对白条残留在餐厅画面顶部与HUD叠着，即用户反馈的UI问题）──
  if(typeof clearWaveDlg === 'function') clearWaveDlg();
  clearTimeout(window._npcTalkTimer);  // 据点NPC闲聊计时器一并清
  // ── 经营重做：菜单兜底——玩家没注册菜单时自动选性价比菜单（防卡死）──
  if(tonightMenu.length === 0){
    const unlocked = getUnlockedRecipes();
    const slots = getMenuSlots();
    // 按"肉够做的次数"排序，选最能做出来的菜谱填槽
    const ranked = unlocked.map(r => {
      let batches = 99;
      for(const m of Object.keys(r.cost)){
        batches = Math.min(batches, Math.floor((meatInventory[m]||0) / r.cost[m]));
      }
      return {r, batches};
    }).filter(x => x.batches > 0)
      .sort((a,b) => (b.batches*b.r.price) - (a.batches*a.r.price));
    tonightMenu = ranked.slice(0, Math.max(1, slots)).map(x => x.r.id);
    if(tonightMenu.length > 0){
      addBanner('📋 未注册菜单，已按库存自动配菜：' + tonightMenu.map(id=>(REST_RECIPES.find(r=>r.id===id)||{}).name).join('、'));
    }
  }
  gameState = 'restaurant';
  document.body.classList.add('rest-mode');
  document.body.classList.remove('hub-mode');
  timeOfDay = 'night';
  updateTodHUD();
  buildRestLayout();
  restState = {
    timeLeft: REST_NIGHT_DURATION,
    customers: [],
    customerIdCounter: 0,
    earnings: 0,
    served: 0,
    angry: 0,
    vipServed: 0,
    spawnTimer: 2,
    lastFrame: performance.now(),
    staff: restHiredStaff.map(s => ({...s, timer:0, target:null, serveFlash:0})),
    floatTexts: [],
    influencerBoost: restPendingInfluencerBoost,  // 从上一夜继承的网红好评加成（影响本夜客流）
    influencerBoostNew: 0,  // 本夜新产生的网红好评（本夜也生效，并继承到下一夜）
    hudTimer: 0,  // HUD更新节流计时器
    vipVisitedThisNight: [],  // 本夜已来访的VIP列表
    cookSpeedBuff: 1,  // 七姐的烹饪速度加成
    godModeActive: false,  // 观测者的上帝模式
    perfectCount: 0,  // 完美/传说菜品计数（每日任务用）
    drinksServed: 0,  // 饮料送出计数（每日任务用）
  };
  vipActiveInRestaurant = null;  // 重置VIP占位
  generateDailyTasks();  // 生成本夜每日任务（Kairosoft 式）
  if(!currentTrend) rollDailyTrend();  // 热搜已在白天第一波刷新；仅读档等缺失时补掷
  checkNewVIPUnlocks();  // 同步VIP解锁状态（加载存档后可能粉丝已够解锁）
  checkSocialMediaRankUp();  // 检查社媒等级提升
  // 显示今日热搜提示（白天已公布过一次，这里是开张时的提醒，并告诉玩家白天攒了多少目标肉）
  if(currentTrend){
    setTimeout(() => {
      addBanner('📱 今日热搜：' + currentTrend.text + ' (' + currentTrend.desc + ')' + (trendMeatToday > 0 ? ' · 白天已备目标肉×' + trendMeatToday : ''));
    }, 2000);
  }
  restPendingInfluencerBoost = 0;  // 加载后清零
  restReadyDishes = [];
  restWasabi = 100;  // 重置芥末
  restDrinks = 6;    // 重置酒柜
  // 确保restaurant-scr存在
  const restScr = document.getElementById('restaurant-scr');
  if(!restScr){
    console.error('[_doStartRestaurant] restaurant-scr element NOT FOUND!');
    addBanner('错误：餐厅界面丢失，跳过餐厅。');
    enterHub();
    return;
  }
  restScr.classList.add('open');
  const endScr = document.getElementById('rest-end-scr');
  if(endScr) endScr.classList.remove('open');
  buildRestControls();
  const rc = document.getElementById('rest-canvas');
  if(rc) rc.onclick = restCanvasClick;
  // 餐厅有自己的计时/暂停体系；若上一波战斗遗留了 gamePaused（如天赋选择的暂停标记没被消费），
  // 会把整夜餐厅冻在计时90秒。这里强制解除。
  gamePaused = false;
  if(restRafId) cancelAnimationFrame(restRafId);
  restRafId = requestAnimationFrame(restLoop);
  addBanner('夜幕降临，餐厅营业！雇佣员工、烹饪美食、服务顾客。');
  // 切换到餐厅BGM（轻松爵士，参考戴夫）——重置玩家手动选择
  restMusicManual = false;
  restMusicIdx = 0;
  if(bgmMuted){ toggleRestMute(); }  // 进入餐厅自动取消静音
  switchBGMTrack('restaurant');
  updateRestMusicBtn();
  console.log('[_doStartRestaurant] restaurant started, restRafId=' + restRafId);
  // ── 餐厅剧情触发 ──
  // Bug修复（静态审查）：原代码教程弹出后 800ms 无条件弹剧情——剧情面板(z-140)直接盖住教程(z-115)，
  // 玩家点完剧情发现教程还压在下面/或两者叠着"关不掉"。现在剧情等教程关闭后再触发。
  const _tutScrRef = document.getElementById('tutorial-scr');
  const _tutIsOpen = () => _tutScrRef && _tutScrRef.style.display === 'flex';
  function _queueRestStory(storyLines, delay){
    setTimeout(()=>{
      if(!gameRunning) return;
      if(_tutIsOpen()){
        // 教程还开着：等玩家关教程（dismissTutorial 后下一帧再试，最多再等10秒后强制播，防剧情丢失）
        let waited = 0;
        const poll = setInterval(()=>{
          if(!gameRunning || !_tutIsOpen() || (waited += 100) > 10000){
            clearInterval(poll);
            if(gameRunning) showCinematic(storyLines, ()=>{});
          }
        }, 100);
      }else{
        showCinematic(storyLines, ()=>{});
      }
    }, delay);
  }
  // 首次开张
  if(!restStoryTriggered.firstOpen){
    restStoryTriggered.firstOpen = true;
    _queueRestStory(REST_STORY_EVENTS.firstOpen, 800);
  }
  // 声望里程碑
  const repMilestones = [
    {key:'rep10', rep:10},
    {key:'rep25', rep:25},
    {key:'rep40', rep:40},
  ];
  for(const ms of repMilestones){
    if(!restStoryTriggered[ms.key] && restRep >= ms.rep){
      restStoryTriggered[ms.key] = true;
      const storyLines = REST_STORY_EVENTS[ms.key];
      _queueRestStory(storyLines, 1200);
      break;  // 一次只触发一个
    }
  }
  // ── 首次进餐厅：显示餐厅教程（经营重做：点单机制） ──
  showTutorial('restaurant', '🏠 秘密餐厅 · 点单经营', [
    '欢迎！顾客现在会<b>点具体的菜</b>——看头顶气泡里写的菜名。',
    '<b>注册菜单</b>：白天在据点厨房"📋规划今晚菜单"。顾客只点注册过的菜（槽位2起步，涨粉丝扩容）。',
    '<b>做菜</b>：底部「🍳烹饪台」选菜单里的菜谱 → QTE 节奏点击定品质（完美/传说卖价翻倍）。',
    '<b>上菜</b>：菜做好后<b>点击点单的顾客</b>端对应的菜。上错菜会被摇头拒绝（菜退回不浪费），但他会不耐烦！',
    '<b>芥末台</b>：每道菜耗5芥末，<b>点灶台旁芥末台</b>花10金补满。<b>酒柜</b>：点想喝饮料的顾客送🥤赚小费。',
    '<b>顾客偏好</b>：美食家/评论家爱点贵菜，急躁顾客爱点快手菜——规划菜单时留一快一贵最稳。',
    '<b>特殊客人</b>：VIP(金边)/评论家(蓝边)/网红(粉边)给好评大涨声望涨粉。',
    '<b>战斗增益</b>：品质好的菜会给下一波战斗加buff（伤害/减伤/回血）——餐厅经营喂饱前线！',
    '<b>目标</b>：90秒内按单上菜。声望解锁菜谱，粉丝解锁菜单槽位和VIP。',
  ]);
}

// Bug修复：提前打烊原来直接 closeRestaurant 跳过结算（士气/网红加成全部丢失）
// 现在先走 endRestaurantNight 结算流程，再由结算面板正常关闭
function earlyCloseRestaurant(){
  if(!restState || restState.ended){ closeRestaurant(); return; }
  // 没服务的顾客算生气离场（提前打烊的代价）
  const unserved = restState.customers.filter(c => c.state === 'seated' || c.state === 'queuing' || c.state === 'walking');
  if(unserved.length > 0){
    restState.angry += unserved.length;
    restRep = Math.max(-50, restRep - 2);
    addBanner('🌙 提前打烊：' + unserved.length + ' 位顾客没吃上饭，声望 -2');
  }
  endRestaurantNight();
}

function closeRestaurant(){
  forceDismissAllOverlays();
  resetInputAndInteractionState();
  const restScr = document.getElementById('restaurant-scr');
  if(restScr) restScr.classList.remove('open');
  const endScr = document.getElementById('rest-end-scr');
  if(endScr) endScr.classList.remove('open');
  if(restRafId){ cancelAnimationFrame(restRafId); restRafId = null; }
  if(restState) restState.ended = true;
  document.body.classList.remove('rest-mode');
  stopSynthBGM();
  timeOfDay = 'day';
  updateTodHUD();
  enterHub();
  addBanner('🌅 餐厅经营结束！回到据点整备。升级工事/远征搜刮后前往出击门迎战下一波');
  switchBGMTrack('calm');
}

// 兼容接口：支持自动化测试套件与外部调用
Object.defineProperty(window, 'restaurantCustomers', {
  get() { return restState ? restState.customers : []; },
  set(v) { if(restState) restState.customers = v; },
  configurable: true
});
Object.defineProperty(window, 'restaurantTimer', {
  get() { return restState ? restState.timeLeft : 0; },
  set(v) { if(restState) restState.timeLeft = v; },
  configurable: true
});
window.spawnCustomer = function(){
  if(typeof spawnRestCustomer === 'function') return spawnRestCustomer();
};
window.updateRestaurant = function(){
  if(restState && restState.timeLeft <= 0){
    closeRestaurant();
  }
};

// 结束夜晚营业（结算面板后用），回到据点
function finishRestaurantNight(){
  closeRestaurant();
}

function finishRestaurantToWorkshop(){
  closeRestaurant();
  setTimeout(() => { if(typeof openDuffWorkshop === 'function') openDuffWorkshop(); }, 250);
}

// 每日任务面板折叠/展开（布局修复：避免常驻面板遮挡酒柜点击区）
function toggleDailyTasksPanel(){
  const p = document.getElementById('daily-tasks-panel');
  const t = document.getElementById('daily-tasks-title');
  if(!p) return;
  p.classList.toggle('collapsed');
  if(t) t.textContent = p.classList.contains('collapsed') ? '🎯 今夜任务 ▸' : '🎯 今夜任务 ▾';
}
function buildRestControls(){
  const ctrl = document.getElementById('rest-controls');
  ctrl.innerHTML = '';
  // v52修：营业结束后 buildRestControls 重建时若 closingShown 已置位，重挂"打烊结算"按钮
  // ——旧逻辑只在标志翻转那一刻挂一次，之后签名变化重建控制栏会把按钮清掉，
  // 玩家被迫走"提前打烊"被扣声望
  if(restState && restState.closingShown) showCloseButton();
  // 第零行：食材库存面板（加class方便轻量更新）
  const stockRow = document.createElement('div');
  stockRow.className = 'rest-stock-row';
  stockRow.style.cssText = 'display:flex;gap:10px;justify-content:center;align-items:center;width:100%;margin-bottom:4px;font-family:Microsoft YaHei UI,sans-serif;font-size:.7rem;color:#c8a878;';
  const meatTypes = [
    {key:'normal', icon:'🥩', name:'普通肉', color:'#c87862'},
    {key:'fast', icon:'🍗', name:'瘦肉', color:'#d89878'},
    {key:'tank', icon:'🥩', name:'厚肉', color:'#a85838'},
    {key:'elite', icon:'💜', name:'异变肉', color:'#aa44cc'},
  ];
  stockRow.innerHTML = '<span style="color:#b0a284;">食材:</span>' + meatTypes.map(m =>
    `<span style="color:${m.color}">${m.icon}${meatInventory[m.key]||0}</span>`
  ).join('');
  ctrl.appendChild(stockRow);
  // ── v52布局：菜谱+管理全部按钮合成一排（用户要求：不要分两排）──
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;justify-content:center;align-items:stretch;width:100%;';
  // ── 菜谱按钮（直点=QTE烹饪；顾客在等的金色高亮脉冲）──
  const recipeRow = btnRow;  // 同一行
  // 当前顾客正在等的菜谱 id 集（高亮用）
  const waitingOrders = new Set(restState.customers.filter(c=>c.state==='seated'&&c.order).map(c=>c.order));
  const menuIds = tonightMenu.length > 0 ? tonightMenu : getUnlockedRecipes().map(r=>r.id);
  const cookable = menuIds.map(id=>REST_RECIPES.find(r=>r.id===id)).filter(r=>r);
  cookable.forEach(recipe=>{
    const canCook = Object.keys(recipe.cost).every(m=>meatInventory[m] >= recipe.cost[m]);
    // 可做次数角标
    let batches = Infinity;
    for(const m of Object.keys(recipe.cost)) batches = Math.min(batches, Math.floor((meatInventory[m]||0)/recipe.cost[m]));
    const wanted = waitingOrders.has(recipe.id);
    const btn = document.createElement('button');
    btn.className = 'dish-btn';
    btn.style.minWidth = '62px';
    // v52美术：菜品色顶边条（--dish-c 驱动 ::before）
    btn.style.setProperty('--dish-c', recipe.color);
    if(wanted) btn.style.borderColor = 'var(--accent)';  // 有客在等这道菜：描边变强调色
    btn.innerHTML = `<div class="dish-btn-icon" style="color:${recipe.color};font-size:1.2rem;">${recipe.icon}</div>
      <div class="dish-btn-name" style="color:${wanted?'var(--accent)':'var(--text-1)'};">${recipe.name}</div>
      <div class="dish-btn-cost" style="color:${canCook?'var(--text-2)':'var(--danger)'};">${Object.keys(recipe.cost).map(m=>`${MEAT_TYPES[m].icon}${recipe.cost[m]}`).join('')}${isFinite(batches)&&batches<9?' ×'+batches:''}</div>
      ${wanted?'<div style="font-size:.6rem;color:var(--accent);">有客在等</div>':''}`;
    if(canCook){
      btn.onclick = () => {
        // v50：直点=立即QTE→进灶（去掉弹窗流程）
        startCookingQTE(recipe);
      };
    }
    recipeRow.appendChild(btn);
  });
  // ── 管理按钮（同一行续排，不再单独起一行）──
  const mgmtRow = btnRow;  // 同一行
  mgmtRow.style.rowGap = '3px';
  // 管理按钮：全部同一种灰阶卡片，不再每个一种颜色
  const mkMgmt = (icon, name, sub, onclick) => {
    const b = document.createElement('button');
    b.className = 'dish-btn';
    b.style.minWidth = '72px';
    b.innerHTML = `<div class="dish-btn-icon">${icon}</div><div class="dish-btn-name">${name}</div>` + (sub ? `<div class="dish-btn-cost">${sub}</div>` : '');
    b.onclick = onclick;
    mgmtRow.appendChild(b);
    return b;
  };
  // 一键上菜（兜底小按钮——主交互是点顾客/出餐口）
  mkMgmt('🍽️', '一键上菜', '', () => serveAllReadyDishes());
  // 扎啤：对耐心低的顾客使用啤酒QTE恢复耐心
  mkMgmt('🍺', '扎啤', '恢复耐心', () => {
    const seated = restState.customers.filter(c => c.state === 'seated');
    if(seated.length === 0){ addBanner('没有就座的顾客'); return; }
    seated.sort((a,b) => a.patience - b.patience);
    serveBeerToCustomer(seated[0]);
  });
  mkMgmt('👥', '雇佣员工', '管理', () => openStaffHireUI());
  mkMgmt('⬆️', '餐厅升级', '管理', () => openRestUpgradeUI());
  const metCount = Object.keys(vipCompendium || {}).filter(k => vipCompendium[k] && vipCompendium[k].met).length;
  mkMgmt('📖', '顾客图鉴', '相遇 ' + metCount + '/' + (VIP_CUSTOMERS ? VIP_CUSTOMERS.length : 15), () => openVIPCompendium());
  // 状态文字：粉丝 / 员工 / 设施，一行淡色文字，不做成按钮样子
  const info = document.createElement('div');
  info.style.cssText = 'align-self:center;margin-left:8px;font-size:.74rem;color:var(--text-2);line-height:1.7;';
  info.innerHTML = '粉丝 ' + wastegramFans + '（' + wastegramRank + '）<br>员工 ' + restHiredStaff.length + '/' + STAFF_POOL.length + ' · 灶 ' + restUpgradeLevel.stoves + ' · 桌 ' + restUpgradeLevel.tables + ' · 装修 ' + restUpgradeLevel.decor;
  mgmtRow.appendChild(info);
  ctrl.appendChild(mgmtRow);
}

// ── 强化菜品UI（模态面板，列出可强化的菜品） ──
function openEnhanceUI(){
  const modal = document.getElementById('rest-modal');
  const title = document.getElementById('rest-modal-title');
  const coinsEl = document.getElementById('rest-modal-coins');
  const list = document.getElementById('rest-modal-list');
  if(!modal) return;
  title.textContent = '✨ 强化菜品';
  coinsEl.textContent = '🪵 普通×' + meatInventory.normal + ' 瘦×' + meatInventory.fast + ' (强化消耗 普通×2 瘦×1)';
  list.innerHTML = '';
  const recipes = getUnlockedRecipes();
  if(recipes.length === 0){
    list.innerHTML = '<div class="rest-modal-empty">没有可强化的菜品</div>';
  } else {
    for(const r of recipes){
      const enhanced = getEnhancedRecipe(r);
      const lv = enhanced.enhanceLevel;
      const item = document.createElement('div');
      item.className = 'rest-modal-item rmi-afford';
      item.innerHTML = `
        <div class="rest-modal-icon" style="color:${r.color};font-size:1.6rem;">${r.icon}</div>
        <div class="rest-modal-info">
          <div class="rest-modal-name">${r.name} ${lv > 0 ? '<span style="color:#ff66cc">★'+lv+'</span>' : ''}</div>
          <div class="rest-modal-desc">强化后: 售价 ${r.price}→${enhanced.price}金 | 味道 ${r.tasteScore||50}→${enhanced.tasteScore}</div>
        </div>
        <div class="rest-modal-cost can-buy">普通×2 瘦×1</div>
      `;
      item.onclick = () => {
        if(enhanceRecipe(r)){
          // 刷新UI
          openEnhanceUI();
          buildRestControls();
        }
      };
      list.appendChild(item);
    }
  }
  modal.classList.add('open');
}

// ── 雇佣员工UI（模态面板，列出所有可雇佣员工） ──
function openStaffHireUI(){
  const modal = document.getElementById('rest-modal');
  const title = document.getElementById('rest-modal-title');
  const coinsEl = document.getElementById('rest-modal-coins');
  const list = document.getElementById('rest-modal-list');
  if(!modal) return;
  title.textContent = '👥 雇佣员工';
  coinsEl.textContent = '💰 ' + coins + ' 金币';
  list.innerHTML = '';
  const avail = STAFF_POOL.filter(s => !restHiredStaff.find(h => h.id === s.id));
  if(avail.length === 0){
    list.innerHTML = '<div class="rest-modal-empty">所有员工已雇佣！<br>你已拥有全部团队成员。</div>';
  } else {
    for(const s of avail){
      const canAfford = coins >= s.hireCost;
      const icon = s.type === 'cook' ? '👨‍🍳' : '🤵';
      const item = document.createElement('div');
      item.className = 'rest-modal-item' + (canAfford ? ' rmi-afford' : ' rmi-disabled');
      item.innerHTML = `
        <div class="rest-modal-icon">${icon}</div>
        <div class="rest-modal-info">
          <div class="rest-modal-name">${s.name}</div>
          <div class="rest-modal-desc">${s.desc} · 雇佣费 ${s.hireCost}金</div>
        </div>
        <div class="rest-modal-cost ${canAfford?'can-buy':'cant-buy'}">${s.hireCost}金</div>
      `;
      if(canAfford){
        item.style.cursor = 'pointer';
        item.onclick = () => {
          coins -= s.hireCost;
          updateCoinUI();
          restHiredStaff.push({...s});
          addBanner('✅ 雇佣了 ' + s.name + '！');
          sndCoin();
          buildRestControls();
          openStaffHireUI();  // 刷新面板
        };
      }
      list.appendChild(item);
    }
  }
  modal.classList.add('open');
  sndShopOpen();
}

// ── 餐厅升级UI（模态面板，列出所有可升级项） ──
function openRestUpgradeUI(){
  const modal = document.getElementById('rest-modal');
  const title = document.getElementById('rest-modal-title');
  const coinsEl = document.getElementById('rest-modal-coins');
  const list = document.getElementById('rest-modal-list');
  if(!modal) return;
  title.textContent = '⬆️ 餐厅升级';
  coinsEl.textContent = '💰 ' + coins + ' 金币';
  list.innerHTML = '';
  const upgrades = [
    { key:'stoves', name:'增加灶眼', icon:'🔥', max:5, baseCost:100, desc:'同时烹饪更多菜，提升出餐效率' },
    { key:'tables', name:'增加桌位', icon:'🪑', max:6, baseCost:80,  desc:'容纳更多顾客，提升翻台率' },
    { key:'decor',  name:'装修升级', icon:'✨', max:3, baseCost:120, desc:'提升顾客耐心和小费比例' },
  ];
  let anyAvailable = false;
  for(const u of upgrades){
    const lvl = restUpgradeLevel[u.key];
    if(lvl >= u.max){
      const item = document.createElement('div');
      item.className = 'rest-modal-item rmi-disabled';
      item.innerHTML = `
        <div class="rest-modal-icon">${u.icon}</div>
        <div class="rest-modal-info">
          <div class="rest-modal-name">${u.name} <span style="color:#88ff88;font-size:.7rem;">[满级]</span></div>
          <div class="rest-modal-desc">${u.desc} · 当前 Lv.${lvl}/${u.max}</div>
        </div>
        <div class="rest-modal-cost cant-buy">MAX</div>
      `;
      list.appendChild(item);
      continue;
    }
    anyAvailable = true;
    const cost = u.baseCost * (lvl + 1);
    const canAfford = coins >= cost;
    const item = document.createElement('div');
    item.className = 'rest-modal-item' + (canAfford ? ' rmi-afford' : ' rmi-disabled');
    item.innerHTML = `
      <div class="rest-modal-icon">${u.icon}</div>
      <div class="rest-modal-info">
        <div class="rest-modal-name">${u.name} <span style="color:#d2b48c;font-size:.7rem;">Lv.${lvl} → Lv.${lvl+1}</span></div>
        <div class="rest-modal-desc">${u.desc}</div>
      </div>
      <div class="rest-modal-cost ${canAfford?'can-buy':'cant-buy'}">${cost}金</div>
    `;
    if(canAfford){
      item.style.cursor = 'pointer';
      item.onclick = () => {
        coins -= cost;
        restUpgradeLevel[u.key]++;
        addBanner('⬆️ ' + u.name + ' → Lv.' + restUpgradeLevel[u.key] + '！（-' + cost + '金）');
        sndCoin();
        buildRestLayout();
        buildRestControls();
        openRestUpgradeUI();  // 刷新面板
      };
    }
    list.appendChild(item);
  }
  if(!anyAvailable){
    list.innerHTML = '<div class="rest-modal-empty">所有升级已满级！<br>你的餐厅已是顶级配置。</div>';
  }
  modal.classList.add('open');
  sndShopOpen();
}

function closeRestModal(){
  const modal = document.getElementById('rest-modal');
  if(modal) modal.classList.remove('open');
  sndShopClose();
}

// ── 烹饪 ──
