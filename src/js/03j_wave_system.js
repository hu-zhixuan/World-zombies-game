// ═══════════════════════════════════════════

//  【白天模块 A9】WAVE SYSTEM（波次系统+缓冲期2/3/5/10倍僵尸）
// ═══════════════════════════════════════════
function nextWave(){
  // v52修：波数护栏——TOTAL_WAVES=15 的战役，任何边缘路径双重触发 nextWave 时不再滚进第16波
  if(wave >= CAMPAIGN_WAVES){
    console.log('[nextWave] 已到最终波，拒绝继续推进 (wave=' + wave + ')');
    if(!bossActive && zombies.length === 0 && !endingTriggered && gameRunning){ showEnding(); }
    return;
  }
  wave++;waveTxt.textContent='第 '+wave+' 波';
  wavePhase='waiting'; // 防止章节卡/对话期间误判清场
  safehouseRestUsed = false;
  safehouseCraftUsed = false;
  // ── 经营→战斗联动：应用菜品增益（上一夜餐厅上菜品质good+入队的增益）──
  if(queuedBattleBuffs.length > 0){
    // v52两界互锁：完美品质增益——效果×1.5（层数向上取整）、持续+50%
    activeBattleBuffs = queuedBattleBuffs.map(b => {
      const boostMul = b.boosted ? 1.5 : 1;
      const dur = Math.round(60*60 * (b.boosted ? 1.5 : 1));
      return {...b, stacks: Math.max(1, Math.ceil(b.stacks*boostMul)), timeLeft: dur};
    });
    const names = activeBattleBuffs.map(b => {
      const def=BATTLE_BUFF_DEFS[b.id];
      const qTag = b.boosted ? '✨' : '';
      return def ? def.icon+def.name+qTag : b.id;
    }).join(' ');
    addBanner('🍲 美味增益生效：' + names + (activeBattleBuffs.some(b=>b.boosted) ? '（含完美强化）' : ''));
    // v52肉鸽·餐厅线：余味悠长——增益本波结束后保留一半层数进队列（不再单波清零）
    if(playerPerks.buffextend){
      queuedBattleBuffs = queuedBattleBuffs.map(b => ({id:b.id, stacks:Math.max(1, Math.ceil(b.stacks/2))}));
      addBanner('⏳ 余味悠长：增益层数减半延续至下一波');
    }else{
      queuedBattleBuffs = [];  // 消耗队列（每夜菜品只强化下一波）
    }
  }else{
    activeBattleBuffs = [];  // 无新增益则清空（不无限续）
  }
  // ── VIP 兑现：狂牙的看门兽（传说品质时 _freeTowerPending+1，这里兑现为免费机枪塔）──
  if(window._freeTowerPending > 0){
    let placed = 0;
    while(window._freeTowerPending > 0 && towers.length < getTowerMaxCount()){
      const slot = findNearestEmptySlot(RIGHT_WALL_X - 120);  // 优先放平台右侧（靠墙）
      if(slot.slotIdx < 0) break;
      towers.push({x:slot.slotX, y:PLATFORM_TOP-40, level:1, cooldown:0, angle:-Math.PI/4, type:'turret', recoil:0, slotIdx:0});
      placed++;
      window._freeTowerPending--;
    }
    if(placed > 0) addBanner('🐺 看门兽就位！免费机枪塔 ×' + placed);
    window._freeTowerPending = 0;
  }
  // 每波开始时战术补充弹药（基准补给+20%且保底25%，建立资源策略感与稀缺度，杜绝无脑溢出）
  wAmmo = WEAPONS.map((w, i) => {
    const maxA = weaponMagSize(w);
    const cur = (wAmmo && wAmmo[i] !== undefined) ? wAmmo[i] : maxA;
    return Math.min(maxA, Math.max(Math.ceil(maxA * 0.25), cur + Math.ceil(maxA * 0.20)));
  });
  isReloading = false;
  if(rldW) rldW.style.display='none';
  clearInterval(reloadTimer);
  updateAmmoUI();
  refreshWBar();
  // ── v52肉鸽：波始天赋 ──
  // 回春之风：波次开始回复25%生命/层
  if(playerPerks.secondwind && health<maxHp){
    const healAmt=Math.floor(maxHp*0.25*playerPerks.secondwind);
    health=Math.min(maxHp,health+healAmt);updateHpUI();
    spawnFloatText('🌬 +'+healAmt+' HP', player.x+CHAR_W/2, player.y-30, '#88ffaa');
  }
  // 围城大师（传说）：随机1座塔回满耐久并+10%伤害（本波）
  if(playerPerks.siegebreed && towers.length>0){
    const pick=towers[Math.floor(Math.random()*towers.length)];
    if(pick.hp!==undefined){
      pick.hp=pick.hpMax;
      pick._siegeBoost=1.10;  // updateTowers 读取（波清时清除）
      const tt=TOWER_TYPES[pick.type];
      addBanner(`👑 围城大师：${tt.icon}${tt.name} 耐久回满+火力强化！`);
      mkP({x:pick.x,y:pick.y-10,r:14,rDecay:-.7,decay:.08,color:'rgba(255,215,0,.8)',type:'ring',alpha:.9,grav:0});
    }
  }
  towers.forEach(t=>{ if(t._siegeBoost===undefined) t._siegeBoost=1; });  // 缺省1倍
  // damageBuffActive 保留——肉鸽永久buff不随波次消失
  // hiredCompanions 保留——伙伴永久保留
  
  // Reset building clearances
  buildingInteriorCleared.clinic = false;
  buildingInteriorCleared.tavern = false;
  buildingInteriorCleared.armory = false;
  buildingInteriorCleared.safehouse = false;
  buildingInteriorCleared.cabin = true;
  
  buildingInteriorLooted.clinic = false;
  buildingInteriorLooted.armory = false;
  buildingInteriorLooted.safehouse = false;
  buildingInteriorLooted.clinicPerk = false;   // 诊所天赋注入每波重置
  buildingInteriorLooted.armoryTower = false;  // 军火库塔防每波重置
  safehouseRestBoost = false;                  // 安全屋休息延长每波重置
  
  // 旧小镇资源每波刷新（参考潜水员戴夫的"每日潜水"循环：探索→搜刮→升级→再探索）
  if(wave > 1){
    hiddenChests.forEach(c => c.found = false);
    oldTownEvents.forEach(ev => ev.triggered = false);
    addBanner('🗺️ 旧小镇资源已刷新，可再次探索');
  }
  // Cabin supply crate updates
  if (cabinUpgrades.supplier >= 1) cabinCrates.ammoSpawned = true;
  if (cabinUpgrades.supplier >= 2) cabinCrates.medkitSpawned = true;
  // 农场资源产出
  if(cabinUpgrades.farm>=1){woodPlanks+=2;scrapMetal+=1;}
  if(cabinUpgrades.farm>=2){woodPlanks+=2;scrapMetal+=1;}
  if(cabinUpgrades.farm>=3){woodPlanks+=2;scrapMetal+=1;coins+=20;updateCoinUI();}
  if(cabinUpgrades.farm>=1){addBanner(`🌾 农场产出：${cabinUpgrades.farm>=2?4:2}木头 ${cabinUpgrades.farm>=2?2:1}废铁${cabinUpgrades.farm>=3?' +20金币':''}`);}
  if(ownedWeaponsSet.has(minigunIdx())){const mg=getMinigun();if(mg){mg.heat=0;mg.overheated=false;updateWeaponHeat();}}

  // ── 章节卡：每章首波（1/5/10/15）显示章节卡 ──
  const chapterIdx = wave<=4 ? 0 : wave<=9 ? 1 : wave<=14 ? 2 : 3;
  if(wave===1 || wave===5 || wave===10 || wave===15){
    showChapterCard(chapterIdx, ()=>{
      startWaveContent();
    });
    return;
  }
  startWaveContent();
}

// 章节卡显示/关闭（阶段二-4）
let chapterCardCallback=null;
let chapterCardTimer=null;
function showChapterCard(idx, onDone){
  const c = CHAPTER_CARDS[idx];
  if(!c){ if(onDone)onDone(); return; }
  document.getElementById('chapter-label').textContent = c.chapter;
  document.getElementById('chapter-title').textContent = c.title;
  document.getElementById('chapter-sub').textContent = c.sub;
  document.getElementById('chapter-text').textContent = c.text;
  const scr = document.getElementById('chapter-scr');
  scr.style.display = 'flex';
  scr.classList.add('show');
  chapterCardCallback = onDone;
  sndWave();
  // 5秒自动关闭保底（防玩家未点击或误触导致波次卡死）
  clearTimeout(chapterCardTimer);
  chapterCardTimer = setTimeout(()=>{
    dismissChapterCard();
  }, 5000);
}
function dismissChapterCard(){
  clearTimeout(chapterCardTimer);
  const scr = document.getElementById('chapter-scr');
  if(scr){
    scr.style.display = 'none';
    scr.classList.remove('show');
  }
  const cb = chapterCardCallback; chapterCardCallback = null;
  if(cb) cb();
}

// 波次正文：对话 + 刷怪计划 + Boss调度
function startWaveContent(){
  // 天色阶段切换提示（仅阶段切换的波次附带，与波次开始横幅合并显示）
  const dayHint=getDayPhaseHint(wave);
  addBanner(`⚡ 第 ${wave} 波开始！${dayHint?' · '+dayHint:''}`);sndWave();
  // ── v49批1：波次随机变异掷骰（W2起 20%，肉鸽局内随机性）──
  rollWaveMutation();
  // ── 一天的开头：刷新今日热搜并告诉玩家"白天该打什么、今晚什么菜好卖"（晚上开张沿用，不再重掷）──
  rollDailyTrend();
  announceDailyGoal();
  // ── v49批4：波次对白复活（非模态，不阻塞操作）──
  if(typeof queueWaveDialogue === 'function') queueWaveDialogue(wave);
  // ── 行囊被动：温暖羊毛羽绒毯 开局附赠30点坚固护盾 ──
  if(typeof backpackInventory !== 'undefined' && backpackInventory.cozy_blanket > 0){
    window._cozyShield = Math.max(window._cozyShield || 0, 30);
    spawnFloatText('🛋️ 保暖毛毯: +30 护盾!', player.x + CHAR_W / 2, player.y - 30, '#5be4ff');
  }

  // ── Boss 波（每5波：第5/10/15波）：不刷普通怪，直接召唤Boss ──
  if(wave%5===0){
    wavePhase='boss';
    addBanner(`💀 终极警报：第 ${wave} 波 BOSS 决战即将来临！做好准备！`);
    setTimeout(()=>{ if(gameRunning) spawnBoss(); }, 2000);
    return;
  }

  // ── 普通波：成批刷怪 ──
  // 波次特殊机制：每波有特殊类型（非Boss波）
  let waveSpecialType = 'normal';
  if (wave === 2 || wave === 8 || wave === 13) waveSpecialType = 'horde';      // 尸潮波：数量x1.6但全是普通
  else if (wave === 4 || wave === 11) waveSpecialType = 'elite';               // 精英波：全是精英
  else if (wave === 7 || wave === 14) waveSpecialType = 'fog';                 // 迷雾波：视野缩小
  else if (wave === 3 || wave === 9 || wave === 12) waveSpecialType = 'night'; // 夜袭波：速度+50%
  window.__waveSpecial = waveSpecialType;
  const specialBanners = {horde:'🌊 尸潮波！数量激增至1.6倍！', elite:'💀 精英波！全是精英僵尸！', fog:'🌫️ 迷雾波！视野受限！', night:'🌑 夜袭波！僵尸速度+50%！'};
  if (specialBanners[waveSpecialType]) addBanner(specialBanners[waveSpecialType]);
  // 特殊波次提示已改为横幅（不再用showTutorial阻塞游戏）
  // 基础数量（降低前期难度）：第1波11只，每波+5只
  let baseCount = 6 + wave * 5;
  if (waveSpecialType === 'horde') baseCount = Math.floor(baseCount * 1.6);
  // ── v49批1：变异「蝗群」——数量×1.4 ──
  if(waveMutation && waveMutation.id==='swarm') baseCount = Math.floor(baseCount * 1.4);
  waveTotalThisWave = baseCount;
  waveKilledThisWave = 0;
  waveSpawnQueue = waveTotalThisWave;
  waveSpawnTimer = 0;
  wavePhase='spawning';
  addBanner(`🧟 尸潮来袭：${waveTotalThisWave} 只僵尸，全清后进入下一波`);
}

// 每帧推进波次刷怪（在 gameLoop 世界分支调用）
function updateWaveSpawning(){
  if(wavePhase!=='spawning')return;
  // 实时显示剩余僵尸数
  const remaining = waveSpawnQueue + zombies.length;
  if(waveTxt) waveTxt.textContent = '第 ' + wave + ' 波 · 剩余 ' + remaining + ' 只';
  if(waveSpawnQueue<=0){
    // 已生成完毕，等玩家清场
    if(zombies.length===0 && (gameState !== 'world' ? buildingInteriorZombies.length===0 : true)){
      wavePhase='cleared';
      onWaveCleared();
    }
    return;
  }
  // 零怪立刷保底：若场上 0 怪且队列有怪，立刻拉起计时器刷怪，杜绝空场发呆
  if(zombies.length === 0 && waveSpawnQueue > 0 && waveSpawnTimer > 6){
    waveSpawnTimer = 0;
  }
  // 节拍生成：间隔随波次缩短，但保证同屏不爆量
  waveSpawnTimer--;
  if(waveSpawnTimer<=0){
    const onScreen = zombies.length;
    // 缓冲期（夜晚尸潮）：同屏上限大幅提高，让僵尸"超级多"
    let cap, batch, interval;
    if(window.__waveSpecial === 'buffer'){
      cap = 60;  // 缓冲期同屏60只（超级多）
      batch = 3 + Math.floor(wave / 3);  // 一次刷3-7只
      interval = Math.max(6, Math.floor(300 / 16.67));  // 300ms间隔
    } else {
      cap = Math.min(28, 16 + Math.floor(wave*1.0));
      batch = wave>=5 ? (Math.random()<0.5?2:1) : 1;
      interval = Math.max(12, Math.floor((1100 - (wave-1)*50) / 16.67));
    }
    if(onScreen < cap){
      for(let i=0;i<batch && waveSpawnQueue>0;i++){
        spawnZombie();
        waveSpawnQueue--;
      }
    }
    waveSpawnTimer = interval;
  }
}

// ═══════════════════════════════════════════
//  【做减法：战后全图强磁吸】全场肉块与金币瞬间吸入背包，免去跑图扫地
// ═══════════════════════════════════════════
function vacuumAllLoot(){
  if(!lootDrops || lootDrops.length === 0) return;
  let meatCollected = 0, coinsCollected = 0;
  for(let i = lootDrops.length - 1; i >= 0; i--){
    const item = lootDrops[i];
    if(item.type === 'weapon_crate') continue; // 武器箱保留手动开启以确保仪式感与可选择性
    collectLoot(item);
    if(item.type === 'coin') coinsCollected += (item.value || 1);
    else if(item.type.startsWith('meat_')) meatCollected += (item.value || 1);
    lootDrops.splice(i, 1);
  }
  if(meatCollected > 0 || coinsCollected > 0){
    sndCoin();
    spawnFloatText(`🧲 全图强力磁吸: +${coinsCollected}💰 +${meatCollected}🥩`, player.x + CHAR_W/2, player.y - 40, '#ffd700');
  }
}

let bufferWaveLevel = 0;

function onWaveCleared(){
  // 防重入守护
  if(window._waveClearing){ console.warn('[onWaveCleared] re-entry blocked'); return; }
  window._waveClearing = true;
  setTimeout(()=>{ window._waveClearing = false; }, 4000);
  towers.forEach(t=>{ t._siegeBoost=1; });
  autoSaveToStorage();

  // 正常波清场
  addBanner(`✅ 第 ${wave} 波大捷！击杀 ${waveKilledThisWave} 只`);
  if(typeof activeTacticalMeal !== 'undefined' && activeTacticalMeal){
    addBanner(`🍲 战备特餐「${activeTacticalMeal.name}」效力已耗尽。回据点可重新烹制！`);
    activeTacticalMeal = null;
    if(typeof updateTacticalMealHUD === 'function') updateTacticalMealHUD();
  }
  
  // ── 【做减法：战后强磁吸】全场肉块与金币瞬间吸入背包 ──
  vacuumAllLoot();

  if(typeof clearWaveDlg === 'function') clearWaveDlg();

  // ── 美术C：CLEAR 大字卡（缩放弹入0.5s，波次爽点结算仪式）──
  {
    const d=document.createElement('div');
    d.style.cssText='position:absolute;top:34%;left:50%;transform:translateX(-50%) scale(0.3);font-family:var(--font-display);font-weight:800;font-size:3.4rem;color:#ffe088;letter-spacing:8px;z-index:60;pointer-events:none;text-shadow:0 0 30px rgba(255,200,80,.9),0 4px 10px rgba(0,0,0,.8);transition:transform .28s cubic-bezier(.2,1.6,.4,1),opacity .5s ease .35s;opacity:1;';
    d.textContent='⚔ CLEAR ⚔';
    gameWrap.appendChild(d);
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{d.style.transform='translateX(-50%) scale(1)';});});
    setTimeout(()=>{d.style.opacity='0';},700);
    setTimeout(()=>{d.remove();},1300);
  }
  coins += 25 + wave * 8; updateCoinUI();  // 更加丰厚合理的波次清场奖励

  // ── 波次结算：武器是珍稀军备，拒绝无脑满地乱送；仅在第 5、10 波重大防线胜利整备时提供 1 次核心军械空投 ──
  if((wave === 5 || wave === 10) && !window._crateDroppedThisWave){
    const poolIdx = rollWeaponDrop();
    if(poolIdx >= 0){
      const cx = RIGHT_WALL_X + 100;
      const crate = createLootItem(cx, GROUND_Y-30, 'weapon_crate', poolIdx);
      crate.life = 3600;
      lootDrops.push(crate);
      const rarTag = WEAPON_RARITY[WEAPONS[poolIdx].rarity] || WEAPON_RARITY.epic;
      addBanner(`🎖️ 阶段防线大捷！前线战备库空投了「${rarTag.cn}军火箱」！（城门前走近按 [E] 查验开启）`);
      for(let i=0;i<8;i++){mkP({x:cx,y:GROUND_Y-24,vx:(Math.random()-.5)*3,vy:-2-Math.random()*2,r:1.5+Math.random()*1.5,rDecay:.05,decay:.04,color:rarTag.color,type:'spark',grav:.18,alpha:.9});}
    }
  }
  window._crateDroppedThisWave = false;

  // ── 肉鸽节奏核心：波清保底天赋三选一 ──
  perkPendingLevels++;
  setTimeout(()=>{ if(gameRunning) triggerPerkChoice(); }, 1200);

  if(mingToughness < 15){
    mingToughness++;
    if(mingToughness % 5 === 0){
      addBanner(`💪 硬汉本能：累计减伤 ${mingToughness}%（越战越硬）`);
    }
  }

  if(playerPerks.deathpact){
    coins -= 10; updateCoinUI();
    if(coins < 0){
      coins = 0; updateCoinUI();
      homeHp = Math.max(0, homeHp - 20);
      addBanner('⚰️ 死亡契约反噬！家园 -20 血');
      if(homeHp<=0 && gameRunning){addBanner('🏚️ 家园被攻破！');endGame();}
    }else{
      addBanner('⚰️ 死亡契约：扣除 10 金币');
    }
  }

  // ── 【做减法核心：消除惩罚性缓冲尸潮与长按E 3秒陷阱】──
  // 借鉴《潜水员戴夫》傍晚归航模式：白天战斗清场后，顺畅进入黄昏并自动过渡至安全的据点与夜间餐厅
  wavePhase = 'cleared';
  const joinDlg = NPC_JOIN_DIALOGUES[wave];
  if(joinDlg && (!window._joinedNPCs || !window._joinedNPCs[wave])){
    if(!window._joinedNPCs) window._joinedNPCs = {};
    window._joinedNPCs[wave] = true;
    setTimeout(()=>{
      if(!gameRunning) return;
      showCinematic(joinDlg, ()=>{
        const joinRewards = {
          2: {coins:30, msg:'老兵张加入！获得 30 金币'},
          4: {health:30, msg:'护士小林加入！恢复 30 生命'},
          6: {wood:5, scrap:5, msg:'工程师阿强加入！获得 5 木材 + 5 废铁'},
          8: {coins:50, msg:'通信兵小赵加入！获得 50 金币'},
        };
        const r = joinRewards[wave];
        if(r){
          if(r.coins){coins += r.coins; updateCoinUI();}
          if(r.health){health = Math.min(maxHp, health + r.health); updateHpUI();}
          if(r.wood){woodPlanks += r.wood;}
          if(r.scrap){scrapMetal += r.scrap;}
          addBanner('🎉 ' + r.msg);
        }
        // 对话结束后让在场伙伴喊话并快步跑入安全小屋避难
        hiredCompanions.forEach(c => { if(c){ c._retreatBarked = false; } });
        // NPC加入后触发致命大波尸潮迫退
        setTimeout(()=>{
          if(gameRunning && gameState === 'world'){
            triggerOverwhelmingHorde();
          }
        }, 1500);
      });
    }, 700);
  } else {
    // 波清后给玩家 2.8 秒清点战利品与选择天赋，随后触发压迫感极夜特大尸潮！
    setTimeout(()=>{
      if(!gameRunning || gameState !== 'world') return;
      triggerOverwhelmingHorde();
    }, 2800);
  }
}

// 缓冲期僵尸波（递增倍数：2/3/5/10，夜晚尸潮）—— 玩家在据点内选择"硬刚"时触发
function startBufferWave(multiplier){
  if(!gameRunning) return;
  multiplier = multiplier || 2;
  let bufferCount = (6 + wave * 5) * multiplier;
  waveTotalThisWave = bufferCount;
  waveKilledThisWave = 0;
  waveSpawnQueue = bufferCount;
  waveSpawnTimer = 0;
  wavePhase='spawning';
  window.__waveSpecial = 'buffer';
  if(multiplier >= 10){
    addBanner('💀💀💀 10倍夜晚尸潮！不进小屋必死！！');
    addBanner('💀💀💀 10倍夜晚尸潮！不进小屋必死！！');
  } else if(multiplier >= 5){
    addBanner('💀 5倍夜晚尸潮！立刻进小屋避难！！');
  } else if(multiplier >= 3){
    addBanner('🧟 3倍夜晚尸潮！进小屋按E或N避难！！');
  } else {
    addBanner('🧟 2倍夜晚尸潮来袭！回小屋按E或N避难！！');
  }
}

// 击杀计数 hook（在 onKill/killZombie 里调用）
function notifyWaveKill(){
  waveKilledThisWave++;
}

// 环境旁白检测（阶段二-7）：玩家在世界中走过特定x触发
function checkEnvNarration(){
  if(gameState!=='world')return;
  while(envNarratedIdx < ENV_NARRATIONS.length){
    const n = ENV_NARRATIONS[envNarratedIdx];
    if(player.x >= n.x){
      addBanner('📜 '+n.text);
      envNarratedIdx++;
    } else break;
  }
}

