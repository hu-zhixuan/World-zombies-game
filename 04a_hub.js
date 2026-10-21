// ═══════════════════════════════════════════


/* ═══════════════════════════════════════════════════════════════════════════════
   ══ 04. SHELTER & EXPEDITION ══
   安全屋交互 / 3秒闭锁大门判定 / 小胡战术工坊 / 背包行囊系统 / 旧城区远征
═══════════════════════════════════════════════════════════════════════════════ */


//  【白天模块 A2】HUB WORLD（避难所据点——小屋=餐厅入口）
//  参考潜水员戴夫：白天打僵尸（主世界）↔ 回据点建设经营（Hub世界）
//  每波清场后进缓冲期，玩家在Hub进小屋(餐厅)/升级/睡觉，从出口门进入下一波
// ═══════════════════════════════════════════
const HUB_GROUND_Y = GH - 80;  // Hub世界地面（比战斗世界略高，留空间画装饰）
// Hub站点定义：玩家走到站点旁按E交互
const HUB_STATIONS = [
  { id:'bed',        x:90,  w:60,  name:'床铺与深层梦境', icon:'床', color:'#4a8a4a', desc:'安然入睡回满HP并开启【小胡的潜意识梦境】冥想' },
  { id:'kitchen',    x:230, w:90,  name:'深夜秘密食堂', icon:'餐', color:'#c87862', desc:'推开木门营业！用僵尸肉烹饪废土美味赚金币' },
  { id:'gacha',      x:370, w:60,  name:'扭蛋机',       icon:'🎰', color:'#ff66cc', desc:'花200金币抽随机盲盒' },
  { id:'manage',     x:510, w:100, name:'据点管理',     icon:'管', color:'#88ccff', desc:'升级工事/买塔防/补给' },
  { id:'expedition', x:690, w:80,  name:'旧城区远征看板', icon:'🗺️', color:'#e67e22', desc:'出征探险旧城区副本：废弃诊所/营地/军火工坊' },
  { id:'gate',       x:880, w:70,  name:'出击门',       icon:'出', color:'#ff6644', desc:'出击！迎战下一波防守' },
];
// Hub中NPC站位（已加入的NPC会在Hub里溜达）
let hubNPCs = [];  // {id, x, targetX, walkT, facingR}

// ── v49批4：据点NPC可对话（走近按E弹非模态闲聊；hubNPCs从纯装饰变可交互角色）──
const HUB_NPC_TALK = {
  zhang: [
    '我跟你说，当年在边境，我们一个班守一座桥，守了七天七夜。',
    '你这枪法……还行。缺的是狠劲。打僵尸别犹豫。',
    '围墙那事听阿强的，别听我的。我只会修碉堡。',
    '孙子今年该上小学了……要是还在的话。',
    '别老守着。有机会就出去搜刮。兵马未动粮草先行。',
    '小林那丫头嘴毒，手艺是真行。听她的。',
  ],
  lin: [
    '你这伤口自己包的？拆了重包。现在。',
    '餐厅卫生我每三天查一次。最后一次是昨天。合格。',
    '僵尸肉要全熟。半生不熟的，我可不给你治寄生虫。',
    '阿强的机油味比尸臭还难闻。让他离医疗帐篷远点。',
    '累了就去睡。硬撑的伤员最难治。',
    '……别死在外面。我说真的。',
  ],
  qiang: [
    '围墙建议：石墙抗冲击，铁墙抗啃咬。看第几波换。',
    '机枪塔的散热门每60秒循环一次。过热降频30%。',
    '扭蛋机的概率分布我算过了。期望值是负的。别投太多。',
    '汤的味道……数据上看蛋白质含量不错。',
    '修墙的时候叫我。结构力学不是玄学。',
    '湮灭者？那是军方的实验品。见到别开第一枪——先找掩体。',
  ],
  zhao: [
    '今、今天的信号比昨天清楚。军方还在。',
    '我给机长发过三次坐标。三次都收到了！',
    '频、频率42.7……不对，是42.8。我重新调。',
    '等我活着回去，我要吃一顿真正的早饭。豆浆油条。',
    '张教官说打完这仗教我打靶。我、我先练好发报。',
    '直升机来的时候……我第一个上。不对，你们先上。',
  ],
};
function tryHubNpcTalk(){
  if(!hubNPCs.length)return false;
  const px = player.x + CHAR_W/2;
  for(const npc of hubNPCs){
    if(Math.abs(npc.x + 18 - px) < 60){
      const pool = HUB_NPC_TALK[npc.id];
      if(!pool)continue;
      // 非模态对白条（复用波次对白条样式）
      const line = pool[Math.floor(Math.random()*pool.length)];
      const ch = NPC_CHARACTERS[npc.id] || {name:npc.name, color:npc.color, initial:npc.name[0]};
      let bar = document.getElementById('wave-dlg-bar');
      if(!bar){
        bar = document.createElement('div');
        bar.id = 'wave-dlg-bar';
        gameWrap.appendChild(bar);
      }
      bar.innerHTML = `
        <div class="wd-top-bar">
          <span>💬 据点同伴闲聊</span>
          <span style="color:#ffd875;">[点击 / Esc 关闭]</span>
        </div>
        <div class="wd-main">
          <div class="wd-avatar" style="color:${ch.color};border-color:${ch.color};box-shadow:0 0 10px ${ch.color};">
            ${ch.initial || npc.name[0]}
          </div>
          <div class="wd-body">
            <div class="wd-speaker-row">
              <span class="wd-speaker" style="color:${ch.color};">${npc.name}</span>
              <span class="wd-tag">避难所同伴</span>
            </div>
            <div class="wd-text">${line}</div>
          </div>
          <div class="wd-actions">
            <div class="wd-btn-close" onclick="event.stopPropagation();hideWaveDlg()">✕ 关闭</div>
          </div>
        </div>`;
      bar.style.display = 'flex';
      bar.classList.add('open');
      bar.style.transform = 'translate(-50%,0)';
      window._waveDlgActive = true;
      bar.onclick = (ev)=>{ ev.stopPropagation(); hideWaveDlg(); };
      clearTimeout(window._npcTalkTimer);
      window._npcTalkTimer = setTimeout(()=>{ hideWaveDlg(); }, 4500);
      return true;
    }
  }
  return false;
}

function enterHub(){
  forceDismissAllOverlays();
  resetInputAndInteractionState();
  if(typeof clearFloatTexts === 'function') clearFloatTexts();
  gameState = 'hub';
  hubInteractCooldown = Date.now() + 200; // 防手抖与长按E渗透：进入据点后200ms内不响应站点交互
  keys.holdInteract = false;
  keys.e = false;
  document.body.classList.add('hub-mode');
  document.body.classList.remove('rest-mode');
  if(typeof clearWaveDlg === 'function') clearWaveDlg();
  if(typeof closeDlg === 'function') closeDlg();
  if(typeof skipCinematic === 'function') skipCinematic();
  if(typeof dismissTutorial === 'function') dismissTutorial();
  // 玩家放在据点小屋门廊中立安全区（x=140），在左侧床铺(90)与右侧食堂(230)之间，绝不自动触发任何站点
  player.x = 140;
  player.y = HUB_GROUND_Y - CHAR_H;
  player.vx = 0; player.vy = 0;
  player.onGround = true;
  player.facingRight = true;
  cameraX = 0;  // Hub不滚动
  // 清掉所有残留僵尸（防止从战斗世界带过来）
  zombies.forEach(z=>{if(z.burnTimer){clearInterval(z.burnTimer);}});
  zombies = [];
  bullets = [];
  bossProjList = [];
  overwhelmingHordeActive = false;
  waveSpawnQueue = 0;
  // 生成已加入的NPC（根据wave判断谁已加入）
  hubNPCs = [];
  if(wave >= 2) hubNPCs.push({id:'zhang', name:'老兵张', x:340, targetX:340, walkT:0, facingR:true, color:'#ffaa66', initial:'张'});
  if(wave >= 4) hubNPCs.push({id:'lin', name:'护士小林', x:300, targetX:300, walkT:0, facingR:false, color:'#ff88aa', initial:'林'});
  if(wave >= 6) hubNPCs.push({id:'qiang', name:'工程师阿强', x:460, targetX:460, walkT:0, facingR:true, color:'#88ccff', initial:'强'});
  if(wave >= 8) hubNPCs.push({id:'zhao', name:'通信兵小赵', x:500, targetX:500, walkT:0, facingR:false, color:'#88ffcc', initial:'赵'});
  hubNPCs.forEach(npc => { npc.moveTimer = Math.floor(Math.random()*180)+60; });
  // ── 安全整备期：自动回满血，玩家可从容进餐厅经营或出击下一波 ──
  bufferWaveThreat = 0;
  window.__waveSpecial = 'normal';
  wavePhase = 'hub';
  health = maxHp;
  updateHpUI();
  if(typeof checkClassSignatureDelivery === 'function') checkClassSignatureDelivery();
  const totalMeat = meatInventory.normal + meatInventory.fast + meatInventory.tank + meatInventory.elite;
  addBanner('🏠 已安全撤回秘密小屋！可睡觉回血、升级工事，或前往[深夜食堂]推门营业');
  if(totalMeat > 0){
    addBanner('💡 提示：已收集 ' + totalMeat + ' 块僵尸肉！走向[深夜秘密食堂]按E或按[N]即可开张营业');
  }
  // ── 首次进据点：显示据点教程 ──
  showTutorial('hub', '🏠 据点 · 整备期', [
    '<b>整备期</b>：波次清场后回到据点，这里是你的安全区。',
    '<b>小屋=秘密餐厅</b>（中间带烟囱的房子）：走进门按<b>E</b>或按<b>N</b>进入。',
    '小屋里用僵尸肉做菜赚金币+声望，经营90秒后自动结束。',
    '<b>床铺</b>（左）：按E睡觉回满血。',
    '<b>据点管理</b>（中右）：按E升级围墙、买塔防、买陷阱。',
    '<b>出击门</b>（右）：按E或B出击下一波（白天战斗）。',
    '<b>循环</b>：出击→清场→回据点整备→进餐厅经营→出击下一波。',
  ]);
  // ── 首次进据点：触发"秘密餐厅"剧情 ──
  // Bug修复（静态审查）：①原代码不置 firstOpen 标记→每次进据点都重复弹同一剧情；
  // ②只检查 cinActive 不检查教程是否还开着→剧情盖教程，教程"关不掉"。
  if(!restStoryTriggered.firstOpen && wave >= 1){
    restStoryTriggered.firstOpen = true;
    const tutScrRef = document.getElementById('tutorial-scr');
    setTimeout(()=>{
      if(!gameRunning) return;
      // 等教程先关闭（同餐厅路径的防叠逻辑）：教程开着就轮询等待
      let waited = 0;
      const poll = setInterval(()=>{
        const tutOpen = tutScrRef && tutScrRef.style.display === 'flex';
        if(!gameRunning || !tutOpen || (waited += 100) > 10000){
          clearInterval(poll);
          // 超时兜底：教程挂太久仍要播剧情（firstOpen 只此一次，不能丢）；正常路径是教程已关
          if(gameRunning) showCinematic(REST_STORY_EVENTS.firstOpen, ()=>{});
        }
      }, 100);
    }, 2000);
  }
  // ── NPC 加入剧情（在据点内安全触发，不阻塞缓冲期战斗）──
  // v49批4 join时序修复：原版3秒延迟+轮询——玩家手快出门就永远错过入队剧情。
  // 改为进据点立即弹（0.4s 只等画面稳定）；教程开着才等（原防叠逻辑保留）。
  const joinDlg = (NPC_JOIN_DIALOGUES[wave] && (!window._joinedNPCs || !window._joinedNPCs[wave])) ? NPC_JOIN_DIALOGUES[wave] : null;
  if(joinDlg){
    if(!window._joinedNPCs) window._joinedNPCs = {};
    window._joinedNPCs[wave] = true;
    setTimeout(()=>{
      if(!gameRunning) return;
      let waited2 = 0;
      const poll2 = setInterval(()=>{
        if(!gameRunning || !isTutorialOpen() || (waited2 += 100) > 10000){
          clearInterval(poll2);
          if(!gameRunning || cinActive) return;
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
          });
        }
      }, 100);
    }, 400);  // v49批4：3秒→0.4秒（手快出门不再错过入队剧情）
  }
  sndShopOpen();
}

function exitHub(){
  addBanner('☀️ 黎明破晓 · 出击迎战第 ' + (wave + 1) + ' 波！');
  _doExitHub();
}
function _doExitHub(){
  forceDismissAllOverlays();
  resetInputAndInteractionState();
  if(typeof clearFloatTexts === 'function') clearFloatTexts();
  gameState = 'world';
  document.body.classList.remove('hub-mode');
  document.body.classList.remove('rest-mode');
  timeOfDay = 'day';  // 白天战斗
  updateTodHUD();
  // 清掉缓冲期标记（玩家选择硬刚5倍僵尸）
  bufferWaveThreat = 0;
  overwhelmingHordeActive = false;
  bullets = [];
  bossProjList = [];
  // 玩家回到战斗世界起点
  player.x = 100;
  player.y = PLATFORM_TOP - CHAR_H;
  player.vx = 0; player.vy = 0;
  player.onGround = true;
  player.facingRight = true;
  cameraX = 0;
  // ── v49批3：伙伴实体化——注入即带 HP/血条/战力匹配 Boss 血量/专属台词池 ──
  const beastMul = (playerClass && playerClass.id==='beastmaster') ? 1.5 : 1;  // 驭兽师：伤害+50%
  const beastHp  = (playerClass && playerClass.id==='beastmaster') ? 1.5 : 1;  // 驭兽师：HP+50%
  const mkComp = (base, hpVal) => ({...base, hp:Math.floor(hpVal*beastHp), maxHp:Math.floor(hpVal*beastHp), downed:false, downedT:0, barkCd:0, waveJoin:wave});
  hiredCompanions = hiredCompanions.filter(c => !c.isStoryNpc);
  // 老兵张（第2波后）：步枪手，远程精准射击（批3强化 dmg 8→20）
  if(wave >= 2){
    hiredCompanions.push(mkComp({ type:'sniper', name:'老兵张', x:player.x-50, y:CHAR_GY, walkT:0, facingR:true, timer:0, isStoryNpc:true, color:'#ffaa66', fireRate:144, dmg:Math.round(20*beastMul) }, 120));
  }
  // 护士小林（第4波后）：医疗兵（批3强化 heal 15→30 + 群体回血光环）
  if(wave >= 4){
    hiredCompanions.push(mkComp({ type:'medic', name:'护士小林', x:player.x-90, y:CHAR_GY, walkT:0, facingR:true, timer:0, isStoryNpc:true, color:'#ff88aa', healRate:240, healAmt:30, auraT:0 }, 80));
  }
  // 工程师阿强（第6波后）：机枪手（批3强化 dmg 4→9）
  if(wave >= 6){
    hiredCompanions.push(mkComp({ type:'gunner', name:'工程师阿强', x:player.x-130, y:CHAR_GY, walkT:0, facingR:true, timer:0, isStoryNpc:true, color:'#88ccff', fireRate:80, dmg:Math.round(9*beastMul) }, 100));
  }
  // 通信兵小赵（第8波后）：真·狙击（批3强化 dmg 12→28）
  if(wave >= 8){
    hiredCompanions.push(mkComp({ type:'sniper', name:'通信兵小赵', x:player.x-170, y:CHAR_GY, walkT:0, facingR:true, timer:0, isStoryNpc:true, color:'#88ffcc', fireRate:120, dmg:Math.round(28*beastMul) }, 90));
  }
  sndWave();
  // v49批3：伙伴出击喊话（每次出击，未倒地的随机一位开嗓；首波出击全员报到感）
  const squadAlive = hiredCompanions.filter(c=>!c.downed);
  if(squadAlive.length){
    const shouter = squadAlive[Math.floor(Math.random()*squadAlive.length)];
    setTimeout(()=>{ if(gameRunning) companionBark(shouter, 'sortie'); }, 1400);
  }
  nextWave();
}

// ── v49批3：伙伴战斗台词池（性格化：张军旅腔 / 林毒舌反差萌 / 强工科学究 / 赵结巴紧张）──
const COMPANION_BARKS = {
  '老兵张': {
    sortie:['都听我口令，别乱跑！','这一波，稳住阵脚打。','跟我上，别掉队！'],
    eliteKill:['漂亮！这枪法没白练。','看到没？这就是当兵的手艺。','一枪一个，都是老本行。'],
    playerLow:['小胡！退到我身后！','别硬撑，找掩体！','你要是死了，这摊子谁管？'],
    boss:['都散开！别扎堆！','打腰！腰是弱点！','顶住！咱们打过比这狠的！'],
    downed:['小胡……我腿软了……扶一把……','老……老了，不中用了……'],
    revived:['谢了小子。还能再战！','缓过来了。欠你一条命。'],
  },
  '护士小林': {
    sortie:['伤员优先！别碰我医疗包！','打架可以，血迹别弄到餐厅！'],
    eliteKill:['哼，下手够黑的。','消毒水味比血腥味好闻多了。'],
    playerLow:['退后！我掩护你！','你流血了！别动，包扎！','再逞强就给你打镇静剂！'],
    boss:['那玩意儿违反解剖学！','瞄准关节！我研究过！'],
    downed:['医……医生倒下了……真讽刺……'],
    revived:['哼，轮到你救我了。扯平。','记住这笔账，用晚饭抵。'],
  },
  '工程师阿强': {
    sortie:['我的机枪刚校准过，误差0.02%。','弹道计算完毕，开火。'],
    eliteKill:['命中要害，符合预期。','散热正常，继续输出。'],
    playerLow:['检测到你血量异常！撤退！','我建议战术性撤退，立即！'],
    boss:['质量约为3吨……打承重点！','物理不会骗人，打支撑腿！'],
    downed:['供弹系统……故障……','机械过载……需要支援……'],
    revived:['重启完成。感谢救援。','系统恢复，效率85%。'],
  },
  '通信兵小赵': {
    sortie:['我、我掩护你们！','信号畅通，随时呼叫支援！'],
    eliteKill:['我、我打中了？！打中了！','呼……手没抖，太好了……'],
    playerLow:['你、你流血了！我掩护！','别、别死啊，我还要给你发撤离坐标！'],
    boss:['那、那是什么鬼东西！','军、军方还有三分钟！顶住！'],
    downed:['频、频率……断了……'],
    revived:['谢、谢谢！刚才吓死我了……','信号恢复！我还能打！'],
  },
  '机枪手大壮': {
    sortie:['大壮，碾他们！','让它们见识火力压制！'],
    eliteKill:['轰成渣了！','大壮很满意。'],
    downed:['大壮……卡壳了……'],
    revived:['大壮复活！继续碾！'],
  },
};
// 伙伴喊话（头顶气泡 + 限频；type: sortie/eliteKill/playerLow/boss/downed/revived）
function companionBark(comp, type){
  if(!comp || !comp.name)return false;
  const pool = (COMPANION_BARKS[comp.name]||{})[type];
  if(!pool || !pool.length)return false;
  if(comp.barkCd > 0)return false;
  comp.barkCd = 360;  // 6秒限频
  const line = pool[Math.floor(Math.random()*pool.length)];
  spawnFloatText('💬'+line, comp.x+18, (comp.y||CHAR_GY)-30, comp.color||'#aaccff');
  return true;
}
// v49批3：E 救援倒地伙伴（handleInteractAction 分发；救起回50%HP+revive台词）
function rescueNearestCompanion(){
  for(const c of hiredCompanions){
    if(c.downed && c._rescueReady){
      c.downed = false;
      c.hp = Math.floor(c.maxHp*0.5);
      c.downedT = 0;
      companionBark(c, 'revived');
      addBanner(`❤ 你救起了 ${c.name}！`);
      sndHeal();
      for(let i=0;i<10;i++){mkP({x:c.x+18,y:Z_TOP+20,vx:(Math.random()-.5)*3,vy:-2-Math.random()*2,r:2+Math.random()*2,rDecay:.05,decay:.04,color:'#88ff88',type:'circle',grav:-.02,alpha:.9,blur:true});}
      return true;
    }
  }
  return false;
}

function updateHubPlayer(){
  if(dodgeT > 0){
    dodgeT--;
    player.vx *= 0.94;
    if(dodgeT === 0){
      // 翻滚帧一结束立即衔接当前按键方向与速度，杜绝顿挫/滞留
      const spd = getMoveSpeed();
      if(keys.l){ player.vx = -spd; player.facingRight = false; }
      else if(keys.r){ player.vx = spd; player.facingRight = true; }
      else { player.vx = 0; }
    }
  } else {
    const spd = getMoveSpeed();
    if(keys.l){ player.vx = -spd; player.facingRight = false; }
    else if(keys.r){ player.vx = spd; player.facingRight = true; }
    else player.vx *= .72;
  }
  if(dodgeCd > 0) dodgeCd--;
  if(player.iframes > 0) player.iframes--;
  if(!keys.l && !keys.r && dodgeT <= 0){
    player.facingRight = (lastMX >= player.x + CHAR_W/2);
  }
  if(keys.j && player.onGround){ player.vy = JUMP_V; player.onGround = false; sndJump(); }
  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;
  const curGY = HUB_GROUND_Y - CHAR_H;
  if(player.y >= curGY){ player.y = curGY; player.vy = 0; player.onGround = true; }
  // 墙壁边界阻断：撞墙立即清零水平速度，杜绝吸墙卡死
  if(player.x <= 20){
    player.x = 20;
    if(player.vx < 0) player.vx = 0;
  } else if(player.x >= GW - CHAR_W - 20){
    player.x = GW - CHAR_W - 20;
    if(player.vx > 0) player.vx = 0;
  }
  if((keys.l||keys.r) && player.onGround && dodgeT <= 0) player.walkT += .06;
  if(!player.onGround && !keys.j) player.walkT = 0;
  // NPC随机走动
  hubNPCs.forEach(npc => {
    npc.moveTimer--;
    if(npc.moveTimer <= 0){
      npc.targetX = 80 + Math.random() * (GW - 160);
      npc.moveTimer = Math.floor(Math.random()*240)+120;
    }
    const diff = npc.targetX - npc.x;
    if(Math.abs(diff) > 8){
      const sp = 1.2;
      npc.x += Math.sign(diff) * sp;
      npc.walkT += 0.05;
      npc.facingR = diff > 0;
    } else {
      npc.walkT = 0;
    }
  });
}

function getNearbyHubStation(){
  const px = player.x + CHAR_W/2;
  for(const s of HUB_STATIONS){
    if(Math.abs(px - s.x) < s.w/2 + 25) return s;
  }
  return null;
}

function updateHubPrompt(){
  const s = getNearbyHubStation();
  if(s){
    // 餐厅站点：根据肉块状态显示不同提示
    if(s.id === 'kitchen'){
      const totalMeat = meatInventory.normal + meatInventory.fast + meatInventory.tank + meatInventory.elite;
      if(totalMeat > 0){
        setInteractPrompt('[E] 进入秘密餐厅 (僵尸肉' + totalMeat + ')  [N]快捷');
      } else {
        setInteractPrompt('[秘密餐厅] ❌没僵尸肉！先去出击门打僵尸');
      }
    } else if(s.id === 'expedition'){
      setInteractPrompt('[E] 旧城区远征探险路线图 (废弃诊所/营地/军火工坊)');
    } else if(s.id === 'gate'){
      setInteractPrompt('[E] 出击！迎战防守波次 (或点击右上"出击▶")');
    } else {
      setInteractPrompt('[E] ' + s.name + ' — ' + s.desc);
    }
  } else {
    // 若不在站点旁，检测是否在同伴NPC旁
    let nearNpc = null;
    if(hubNPCs && hubNPCs.length){
      const px = player.x + CHAR_W/2;
      nearNpc = hubNPCs.find(n => Math.abs(n.x + 18 - px) < 50);
    }
    if(nearNpc){
      setInteractPrompt(`[E] 与「${nearNpc.name}」交谈 💬`);
    } else {
      setInteractPrompt(null);
    }
  }
}

function triggerHubInteraction(){
  const s = getNearbyHubStation();
  if(!s) return;
  if(s.id === 'bed'){
    openDreamModal();
  } else if(s.id === 'kitchen'){
    const totalMeat = meatInventory.normal + meatInventory.fast + meatInventory.tank + meatInventory.elite;
    if(totalMeat > 0){
      addBanner('推开餐厅门，迎接夜晚营业...');
      // 戴夫式减压舱过渡：玩家走向门 → 黑屏 → 餐厅内部展现
      playDaveTransition(() => {
        startRestaurant();
      });
    } else {
      addBanner('❌ 没肉块无法营业！走到出击门按 E 或按 B 打下一波，僵尸会掉肉块');
    }
  } else if(s.id === 'gacha'){
    playGachaMachine();
  } else if(s.id === 'manage'){
    openManageUI();
  } else if(s.id === 'expedition'){
    openExpeditionModal();
  } else if(s.id === 'gate'){
    exitHub();
  }
}

function drawHubWorld(){
  // 背景：温暖的避难所室内（与战斗世界的冷色调形成对比）
  // 墙壁渐变
  const wallGrad = ctx.createLinearGradient(0, 0, 0, HUB_GROUND_Y);
  wallGrad.addColorStop(0, '#2a1d12');
  wallGrad.addColorStop(0.5, '#3a2818');
  wallGrad.addColorStop(1, '#1a1208');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, GW, HUB_GROUND_Y);
  // 室内火把与多余光晕已彻底移除，保持现代暗黑战术纯净质感
  // 地面（木地板）
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(0, HUB_GROUND_Y, GW, GH - HUB_GROUND_Y);
  ctx.fillStyle = '#3a2818';
  ctx.fillRect(0, HUB_GROUND_Y, GW, 4);
  // 木地板纹理
  ctx.strokeStyle = 'rgba(0,0,0,.3)';
  ctx.lineWidth = 1;
  for(let x=0; x<GW; x+=40){
    ctx.beginPath();
    ctx.moveTo(x, HUB_GROUND_Y+4);
    ctx.lineTo(x, GH);
    ctx.stroke();
  }
  for(let y=HUB_GROUND_Y+20; y<GH; y+=20){
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GW, y);
    ctx.stroke();
  }
  // 背景装饰：窗户（透出夜色）
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(120, 80, 80, 50);
  ctx.fillRect(640, 80, 80, 50);
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 3;
  ctx.strokeRect(120, 80, 80, 50);
  ctx.strokeRect(640, 80, 80, 50);
  // 窗户十字格
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(160, 80); ctx.lineTo(160, 130);
  ctx.moveTo(120, 105); ctx.lineTo(200, 105);
  ctx.moveTo(680, 80); ctx.lineTo(680, 130);
  ctx.moveTo(640, 105); ctx.lineTo(720, 105);
  ctx.stroke();
  // 月光
  ctx.fillStyle = 'rgba(180,200,255,.15)';
  ctx.fillRect(122, 82, 76, 46);
  ctx.fillRect(642, 82, 76, 46);

  // 绘制站点
  HUB_STATIONS.forEach(s => {
    const sx = s.x;
    const isNear = getNearbyHubStation() === s;

    // ── 餐厅站点：画成小屋（屋顶+墙体+门+窗户+灯笼），让"走进小屋=进餐厅"直观 ──
    if(s.id === 'kitchen'){
      const houseW = 76, houseH = 56;
      const houseX = sx - houseW/2;
      const houseY = HUB_GROUND_Y - houseH;
      // 屋顶（三角形）
      ctx.fillStyle = isNear ? '#8a4a2a' : '#5a3a1a';
      ctx.beginPath();
      ctx.moveTo(houseX - 8, houseY + 8);
      ctx.lineTo(sx, houseY - 16);
      ctx.lineTo(houseX + houseW + 8, houseY + 8);
      ctx.closePath();
      ctx.fill();
      // 屋顶阴影
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.moveTo(sx, houseY - 16);
      ctx.lineTo(houseX + houseW + 8, houseY + 8);
      ctx.lineTo(sx + 4, houseY + 4);
      ctx.closePath();
      ctx.fill();
      // 墙体
      ctx.fillStyle = isNear ? '#6a4a32' : '#4a3220';
      ctx.fillRect(houseX, houseY + 8, houseW, houseH - 8);
      // 墙体木纹
      ctx.strokeStyle = 'rgba(0,0,0,.2)';
      ctx.lineWidth = 1;
      for(let y = houseY + 14; y < houseY + houseH; y += 10){
        ctx.beginPath(); ctx.moveTo(houseX, y); ctx.lineTo(houseX + houseW, y); ctx.stroke();
      }
      // 门（玩家走进门=进餐厅）
      const doorW = 22, doorH = 32;
      const doorX = sx - doorW/2;
      const doorY = HUB_GROUND_Y - doorH;
      // 门框
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
      // 门板（靠近时半开，露出暖光）
      const doorOpen = isNear ? 8 : 0;
      ctx.fillStyle = isNear ? '#3a2818' : '#5a3a20';
      ctx.fillRect(doorX, doorY, doorW, doorH);
      // 门缝光线（靠近时门开一条缝，暖光漏出）
      if(isNear){
        const glowGrad = ctx.createLinearGradient(doorX, doorY, doorX + doorW, doorY);
        glowGrad.addColorStop(0, 'rgba(255,180,80,.6)');
        glowGrad.addColorStop(0.5, 'rgba(255,220,140,.9)');
        glowGrad.addColorStop(1, 'rgba(255,180,80,.6)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(doorX + doorW/2 - 2, doorY, 4, doorH);
        // 门口光晕
        const pulse = 0.6 + 0.4 * Math.sin(frameT * 0.15);
        ctx.fillStyle = `rgba(255,200,100,${0.15 * pulse})`;
        ctx.beginPath();
        ctx.ellipse(sx, HUB_GROUND_Y, 40, 8, 0, 0, Math.PI*2);
        ctx.fill();
      }
      // 门把手
      ctx.fillStyle = '#aa8844';
      ctx.fillRect(doorX + doorW - 5, doorY + doorH/2 - 1, 2, 2);
      // 窗户（左右各一）
      ctx.fillStyle = isNear ? '#ffcc66' : '#2a3a4a';
      ctx.fillRect(houseX + 8, houseY + 18, 14, 12);
      ctx.fillRect(houseX + houseW - 22, houseY + 18, 14, 12);
      // 窗户十字格
      ctx.strokeStyle = '#3a2818';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(houseX + 15, houseY + 18); ctx.lineTo(houseX + 15, houseY + 30);
      ctx.moveTo(houseX + 8, houseY + 24); ctx.lineTo(houseX + 22, houseY + 24);
      ctx.moveTo(houseX + houseW - 15, houseY + 18); ctx.lineTo(houseX + houseW - 15, houseY + 30);
      ctx.moveTo(houseX + houseW - 22, houseY + 24); ctx.lineTo(houseX + houseW - 8, houseY + 24);
      ctx.stroke();
      // 烟囱+炊烟（表示餐厅在营业）
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(houseX + houseW - 18, houseY - 8, 8, 12);
      for(let i = 0; i < 3; i++){
        const smokeT = (frameT * 0.5 + i * 20) % 60;
        const smokeX = houseX + houseW - 14 + Math.sin(smokeT * 0.1) * 4;
        const smokeY = houseY - 10 - smokeT * 0.5;
        const smokeR = 3 + smokeT * 0.1;
        ctx.fillStyle = `rgba(200,200,200,${0.4 * (1 - smokeT/60)})`;
        ctx.beginPath();
        ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI*2);
        ctx.fill();
      }
      // 招牌（餐厅图标+名字）
      ctx.save();
      ctx.font = 'bold 16px Microsoft YaHei UI,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffcc66';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = isNear ? 14 : 6;
      ctx.fillText('餐', sx, houseY - 22);
      ctx.shadowBlur = 0;
      ctx.restore();
      // 站点名字
      ctx.save();
      ctx.font = '11px Microsoft YaHei UI,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isNear ? '#ffcc66' : '#c8a878';
      ctx.fillText(s.name + (isNear ? '  [E] 进入' : ''), sx, HUB_GROUND_Y + 14);
      ctx.restore();
      // 靠近时高亮提示框
      if(isNear){
        const pulse = 0.5 + 0.5*Math.sin(frameT*0.12);
        ctx.save();
        ctx.strokeStyle = '#ffaa44';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4 + pulse*0.4;
        ctx.setLineDash([6,4]);
        ctx.strokeRect(houseX - 6, houseY - 22, houseW + 12, houseH + 30);
        ctx.setLineDash([]);
        ctx.restore();
      }
      return;  // 餐厅站点用小屋画法，跳过下面的通用站台画法
    }

    // ── 其他站点：专属建筑画法（美术重构：原为通用色块站台+一个字，玩家看不懂是什么）──
    if(s.id === 'bed'){
      // 床铺：军用帐篷屋（帆布棚+床头+枕头+月亮标志）
      const w=64, h=52, bx=sx-w/2, by=HUB_GROUND_Y-h;
      // 帐篷主体（军绿帆布，梯形）
      ctx.fillStyle = isNear ? '#4a6a44' : '#3a5236';
      ctx.beginPath();
      ctx.moveTo(bx, HUB_GROUND_Y); ctx.lineTo(bx+6, by+6); ctx.lineTo(bx+w-6, by+6); ctx.lineTo(bx+w, HUB_GROUND_Y);
      ctx.closePath(); ctx.fill();
      // 帆布褶皱
      ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=1;
      for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(bx+i*w/4, by+8);ctx.lineTo(bx+i*w/4-3, HUB_GROUND_Y);ctx.stroke();}
      // 门帘（掀开，暖光）
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(sx-14, by+18, 28, 34);
      const bedGlow = ctx.createLinearGradient(sx-14, by+18, sx+14, by+18);
      bedGlow.addColorStop(0,'rgba(255,190,90,.25)');bedGlow.addColorStop(.5,'rgba(255,220,150,.5)');bedGlow.addColorStop(1,'rgba(255,190,90,.25)');
      ctx.fillStyle=bedGlow;ctx.fillRect(sx-12, by+20, 24, 30);
      // 里面画一张床（枕头+被子）
      ctx.fillStyle='#e8e0d0';ctx.fillRect(sx-10, by+42, 20, 6);   // 枕头
      ctx.fillStyle=isNear?'#c8785a':'#a05a40';ctx.fillRect(sx-10, by+34, 20, 8); // 被子
      // 门口月亮标志（睡觉恢复）
      ctx.fillStyle='#ffdd88';ctx.beginPath();ctx.arc(sx, by-4, 6, 0, Math.PI*2);ctx.fill();
      ctx.fillStyle='#3a5236';ctx.beginPath();ctx.arc(sx+2.5, by-4-2, 5, 0, Math.PI*2);ctx.fill();
    } else if(s.id === 'gacha'){
      // 扭蛋机：实体自动贩卖机（机身+玻璃窗里扭蛋球+投币口+出奖口）
      const w=40, h=64, bx=sx-w/2, by=HUB_GROUND_Y-h;
      // 机身（粉紫金属渐变）
      const bodyGrad = ctx.createLinearGradient(bx, 0, bx+w, 0);
      bodyGrad.addColorStop(0,'#b05a9a');bodyGrad.addColorStop(.5,'#8a3a7a');bodyGrad.addColorStop(1,'#6a2a5a');
      ctx.fillStyle=bodyGrad;ctx.fillRect(bx, by, w, h);
      ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1.5;ctx.strokeRect(bx, by, w, h);
      // 玻璃窗（上半，里面彩色扭蛋球堆）
      ctx.fillStyle='rgba(220,240,255,.35)';
      ctx.fillRect(bx+4, by+6, w-8, 26);
      ctx.strokeStyle='#ddd';ctx.strokeRect(bx+4, by+6, w-8, 26);
      // 扭蛋球（彩色圆堆，随机闪亮）
      const eggColors=['#ff6688','#ffcc44','#66ccff','#88ee66','#cc88ff'];
      for(let i=0;i<6;i++){
        const ex=bx+8+(i%3)*10, ey=by+26-Math.floor(i/3)*8-4;
        ctx.fillStyle=eggColors[i%5];
        ctx.beginPath();ctx.arc(ex,ey,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.5)';
        ctx.beginPath();ctx.arc(ex-1.5,ey-1.5,1.2,0,Math.PI*2);ctx.fill();
      }
      // 顶部灯牌（闪烁）
      const lp=0.5+0.5*Math.sin(frameT*0.15);
      ctx.fillStyle=`rgba(255,120,220,${.5+lp*.5})`;
      ctx.fillRect(bx+6, by-6, w-12, 5);
      // 投币口+旋钮
      ctx.fillStyle='#332';ctx.fillRect(sx-4, by+38, 8, 5);
      ctx.fillStyle='#ddd';ctx.beginPath();ctx.arc(sx+7, by+42, 2.5, 0, Math.PI*2);ctx.fill();
      // 出奖口
      ctx.fillStyle='#221';ctx.fillRect(bx+6, by+48, w-12, 10);
      if(isNear){  // 出奖口偶尔掉个蛋
        const drop=(frameT*0.04)%3;
        if(drop<1){ctx.fillStyle='#ffcc44';ctx.beginPath();ctx.arc(sx, by+54+drop*4, 3, 0, Math.PI*2);ctx.fill();}
      }
    } else if(s.id === 'manage'){
      // 据点管理：木工工作台（工具架+图纸+木料堆+砧台）
      const w=76, bx=sx-w/2;
      const by=HUB_GROUND_Y-46;
      // 背板工具架
      ctx.fillStyle='#4a3220';ctx.fillRect(bx, by, w, 34);
      ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1;
      for(let y=by+8;y<by+34;y+=9){ctx.beginPath();ctx.moveTo(bx,y);ctx.lineTo(bx+w,y);ctx.stroke();}
      // 挂着的工具（锤/扳手/锯）
      ctx.fillStyle='#999';ctx.fillRect(bx+8, by+4, 3, 12);       // 锤柄
      ctx.fillStyle='#ccc';ctx.fillRect(bx+6, by+2, 7, 4);        // 锤头
      ctx.fillStyle='#aa8844';ctx.fillRect(bx+22, by+4, 3, 12);   // 扳手柄
      ctx.fillStyle='#aa8844';ctx.fillRect(bx+18, by+2, 11, 3);  // 扳手头
      ctx.strokeStyle='#b0b0b0';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(bx+40, by+3);ctx.lineTo(bx+52, by+13);ctx.stroke(); // 锯
      // 图纸（蓝图，钉在架上）
      ctx.fillStyle='#4466aa';ctx.fillRect(sx-10, by+6, 22, 16);
      ctx.strokeStyle='#aaccee';ctx.lineWidth=.8;
      ctx.strokeRect(sx-10, by+6, 22, 16);
      ctx.beginPath();ctx.moveTo(sx-6,by+18);ctx.lineTo(sx-6,by+10);ctx.lineTo(sx+2,by+10);ctx.lineTo(sx+2,by+16);ctx.stroke();
      ctx.beginPath();ctx.moveTo(sx+6,by+16);ctx.lineTo(sx+6,by+9);ctx.lineTo(sx+10,by+9);ctx.stroke();
      // 砧台（工作台面）
      ctx.fillStyle=isNear?'#6a4a30':'#5a3e28';
      ctx.fillRect(sx-34, HUB_GROUND_Y-14, 68, 14);
      ctx.fillStyle='#7a5a3a';ctx.fillRect(sx-34, HUB_GROUND_Y-14, 68, 3);
      // 台上木料
      ctx.fillStyle='#8a6a44';ctx.fillRect(sx-30, HUB_GROUND_Y-20, 18, 6);
      ctx.fillStyle='#a0805a';ctx.fillRect(sx-12, HUB_GROUND_Y-20, 14, 6);
      // 台上台灯（暖光照图纸，靠近时更亮）
      // 移除地面大范围暖色光斑
    } else if(s.id === 'expedition'){
      // 旧城区远征探险看板：大型战术沙盘木架 + 钉挂区域地图 + 铜制航海罗盘 + 悬挂防风马灯
      const w = 68, bx = sx - w/2;
      const by = HUB_GROUND_Y - 56;
      // 双木桩立柱
      ctx.fillStyle = '#3a2412';
      ctx.fillRect(bx + 4, by + 12, 6, 44);
      ctx.fillRect(bx + w - 10, by + 12, 6, 44);
      ctx.fillStyle = '#22150a';
      ctx.fillRect(bx + 3, by + 12, 8, 3);
      ctx.fillRect(bx + w - 11, by + 12, 8, 3);
      // 看板底座横撑
      ctx.fillStyle = '#4a2f18';
      ctx.fillRect(bx, HUB_GROUND_Y - 8, w, 8);
      ctx.strokeStyle = '#22150a'; ctx.lineWidth = 1;
      ctx.strokeRect(bx, HUB_GROUND_Y - 8, w, 8);

      // 大看板主体（暖黄羊皮纸旧地图钉在厚木板上）
      ctx.fillStyle = isNear ? '#613f24' : '#4e331c';
      ctx.fillRect(bx, by, w, 38);
      ctx.strokeStyle = '#8a5c32'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, w, 38);

      // 钉在木板上的泛黄地图
      ctx.fillStyle = '#d8c292';
      ctx.fillRect(bx + 4, by + 4, w - 8, 30);
      ctx.strokeStyle = '#9e8556'; ctx.lineWidth = 1;
      ctx.strokeRect(bx + 4, by + 4, w - 8, 30);

      // 地图路线与区域标点（旧城区街道、医院红十字、军火库、营地）
      ctx.strokeStyle = '#a63e26'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + 8, by + 26);
      ctx.lineTo(bx + 20, by + 14);
      ctx.lineTo(bx + 36, by + 22);
      ctx.lineTo(bx + 52, by + 12);
      ctx.stroke();

      // 路线点点（红、金、蓝大头针）
      ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(bx + 20, by + 14, 2.5, 0, Math.PI*2); ctx.fill(); // 诊所
      ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.arc(bx + 36, by + 22, 2.5, 0, Math.PI*2); ctx.fill(); // 营地
      ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.arc(bx + 52, by + 12, 2.5, 0, Math.PI*2); ctx.fill(); // 军火库

      // 铜制罗盘指针
      ctx.save();
      ctx.translate(bx + w - 14, by + 24);
      ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.restore();

      // 悬挂暖光铜防风马灯（看板上方）
      const lampP = 0.5 + 0.5 * Math.sin(frameT * 0.15);
      const lanternX = sx;
      const lanternY = by - 8;
      // 铁吊钩
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(lanternX, by); ctx.lineTo(lanternX, lanternY); ctx.stroke();
      // 灯体
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(lanternX - 4, lanternY - 4, 8, 8);
      // 灯芯发光
      ctx.fillStyle = `rgba(255, 200, 80, ${0.7 + lampP * 0.3})`;
      ctx.beginPath(); ctx.arc(lanternX, lanternY, 3, 0, Math.PI*2); ctx.fill();
      // 灯光光晕投射在地图上
      const expGlow = ctx.createRadialGradient(lanternX, lanternY, 2, lanternX, lanternY, isNear ? 45 : 28);
      expGlow.addColorStop(0, 'rgba(255, 210, 110, 0.45)');
      expGlow.addColorStop(1, 'rgba(255, 180, 70, 0)');
      ctx.fillStyle = expGlow;
      ctx.fillRect(bx - 10, by - 14, w + 20, 54);
    } else if(s.id === 'gate'){
      // 出击门：木质城门（门塔+尖刺路障+红色警示灯+箭头指示出击方向）
      const w=64, bx=sx-w/2;
      const by=HUB_GROUND_Y-60;
      // 门框双塔（石柱）
      for(const px of [bx, bx+w-10]){
        const pg = ctx.createLinearGradient(px,0,px+10,0);
        pg.addColorStop(0,'#7a7a82');pg.addColorStop(.5,'#5a5a62');pg.addColorStop(1,'#44444c');
        ctx.fillStyle=pg;ctx.fillRect(px, by, 10, 60);
        ctx.fillStyle='#6a6a72';ctx.fillRect(px, by, 10, 3);
      }
      // 门楣
      ctx.fillStyle='#4a3220';ctx.fillRect(bx-4, by-8, w+8, 12);
      ctx.fillStyle='#5a4230';ctx.fillRect(bx-4, by-8, w+8, 3);
      // 门内战场（暗色+远处火光，出击=回到战场）
      ctx.fillStyle='#1a1218';
      ctx.fillRect(bx+10, by+8, w-20, 52);
      const fireP=0.5+0.5*Math.sin(frameT*0.1);
      ctx.fillStyle=`rgba(255,100,30,${.25+fireP*.3})`;
      ctx.beginPath();ctx.arc(sx+4, by+40, 8+fireP*3, 0, Math.PI*2);ctx.fill();
      // 尖刺路障（左右各一排，战地感）
      ctx.fillStyle='#8a8a92';
      for(let i=0;i<3;i++){
        ctx.beginPath();ctx.moveTo(bx+12+i*14, HUB_GROUND_Y-4);ctx.lineTo(bx+16+i*14, HUB_GROUND_Y-14);ctx.lineTo(bx+20+i*14, HUB_GROUND_Y-4);ctx.closePath();ctx.fill();
      }
      // 红色警示灯（门楣上，脉冲）
      const warn=0.5+0.5*Math.sin(frameT*0.2);
      ctx.fillStyle=`rgba(255,60,40,${.5+warn*.5})`;
      ctx.beginPath();ctx.arc(sx, by-14, 3, 0, Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(255,60,40,${warn*.2})`;
      ctx.beginPath();ctx.arc(sx, by-14, 10, 0, Math.PI*2);ctx.fill();
      // 出击箭头（→）
      ctx.fillStyle=isNear?'#ff8844':'#cc6633';
      ctx.font='bold 14px Microsoft YaHei UI,sans-serif';ctx.textAlign='center';
      ctx.fillText('▶▶', sx, by+34);
    }
    // ── 通用：站点名字+悬浮图标牌（所有站点统一，走近高亮）──
    {
      const signY = HUB_GROUND_Y - 78 - (s.id==='kitchen' ? 46 : 0);  // 餐厅小屋高，牌位更高
      const pulse = 0.5 + 0.5*Math.sin(frameT*0.08 + sx);
      // 悬浮图标牌：圆底+图标+微浮动
      ctx.save();
      const bobY = signY + Math.sin(frameT*0.06 + sx)*3;
      // 牌底光晕
      const halo = ctx.createRadialGradient(sx, bobY, 2, sx, bobY, isNear?26:18);
      halo.addColorStop(0, s.color+'66'); halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.fillRect(sx-28, bobY-28, 56, 56);
      // 圆牌
      ctx.fillStyle = '#1a1410';
      ctx.beginPath(); ctx.arc(sx, bobY, isNear?14:12, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = s.color; ctx.lineWidth = 2;
      ctx.globalAlpha = isNear ? 1 : (.65+pulse*.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 图标
      ctx.font = 'bold 13px Microsoft YaHei UI,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color; ctx.shadowBlur = isNear ? 8 : 3;
      ctx.fillText(s.icon, sx, bobY+1);
      ctx.shadowBlur = 0;
      ctx.restore();
      // 站点名+一句话用途（走近才显示用途，平时只显名字——不挡视线）
      ctx.save();
      ctx.font = 'bold 11px Microsoft YaHei UI,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isNear ? '#ffe088' : '#b0a284';
      ctx.fillText(s.name, sx, signY + (s.id==='kitchen'?0:0) - 20);
      if(isNear){
        ctx.font = '10px Microsoft YaHei UI,sans-serif';
        ctx.fillStyle = '#c8b090';
        ctx.fillText(s.desc, sx, HUB_GROUND_Y + 16);
        ctx.fillStyle = '#88ffcc';
        ctx.fillText('[E] 使用', sx, HUB_GROUND_Y + 30);
      }
      ctx.restore();
    }
    // 靠近时高亮提示框
    if(isNear && s.id !== 'kitchen'){
      const pulse = 0.5 + 0.5*Math.sin(frameT*0.12);
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + pulse*0.4;
      ctx.setLineDash([6,4]);
      ctx.strokeRect(sx - s.w/2 - 6, HUB_GROUND_Y - 62, s.w + 12, 66);
      ctx.setLineDash([]);
      ctx.restore();
    }
  });

  // 绘制NPC（精美化：按角色绘制专属服装）
  hubNPCs.forEach(npc => {
    ctx.save();
    ctx.translate(npc.x, HUB_GROUND_Y);
    if(!npc.facingR) ctx.scale(-1, 1);
    // 影子
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const legA = Math.sin(npc.walkT * Math.PI * 2) * 18;
    // 腿（带裤管+靴子）
    ctx.fillStyle = '#2a2a3a';
    ctx.save(); ctx.translate(-5, -14); ctx.rotate(-legA*Math.PI/180);
    ctx.fillRect(-3, 0, 6, 12);
    ctx.fillStyle='#1a1208'; ctx.fillRect(-4, 10, 8, 4);  // 靴子
    ctx.restore();
    ctx.save(); ctx.translate(5, -14); ctx.rotate(legA*Math.PI/180);
    ctx.fillStyle='#2a2a3a'; ctx.fillRect(-3, 0, 6, 12);
    ctx.fillStyle='#1a1208'; ctx.fillRect(-4, 10, 8, 4);
    ctx.restore();
    // 身体（带衣襟+腰带）
    ctx.fillStyle = npc.color;
    ctx.fillRect(-9, -34, 18, 22);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-9, -34, 3, 22);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(6, -34, 3, 22);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-1, -34, 1, 22);  // 衣襟
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-9, -16, 18, 3);  // 腰带
    // 角色专属装饰
    if(npc.id === 'zhang'){
      // 老兵张：军装+步枪+勋章
      ctx.fillStyle='#aa6633'; ctx.fillRect(-9, -32, 18, 3);  // 肩章
      ctx.fillStyle='#ffcc00'; ctx.fillRect(-3, -30, 2, 2); ctx.fillRect(1, -30, 2, 2);  // 勋章
      ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(10, -30); ctx.lineTo(18, -26); ctx.stroke();  // 步枪
      ctx.fillStyle='#222'; ctx.fillRect(16, -27, 4, 3);
    } else if(npc.id === 'lin'){
      // 护士小林：白大褂+十字+针筒
      ctx.fillStyle='#f5f5f5'; ctx.fillRect(-9, -32, 18, 18);  // 白大褂
      ctx.fillStyle='#cc3333'; ctx.fillRect(-2, -28, 4, 4);  // 红十字
      ctx.fillStyle='#cc3333'; ctx.fillRect(-1, -27, 2, 2);
      ctx.fillStyle='#88ccff'; ctx.fillRect(10, -26, 3, 8);  // 针筒
      ctx.fillStyle='#aaa'; ctx.fillRect(13, -24, 2, 4);
    } else if(npc.id === 'qiang'){
      // 工程师阿强：工装+工具带+安全帽
      ctx.fillStyle='#ffaa00'; ctx.fillRect(-7, -47, 14, 4);  // 安全帽
      ctx.fillStyle='#cc8800'; ctx.fillRect(-7, -47, 14, 2);
      ctx.fillStyle='#556677'; ctx.fillRect(-9, -32, 18, 16);  // 工装
      ctx.fillStyle='#334455'; ctx.fillRect(-1, -32, 2, 16);  // 拉链
      // 工具带
      ctx.fillStyle='#3a2a1a'; ctx.fillRect(-9, -20, 18, 3);
      ctx.fillStyle='#888'; ctx.fillRect(-6, -19, 2, 2); ctx.fillRect(4, -19, 2, 2);  // 工具
    } else if(npc.id === 'zhao'){
      // 通信兵小赵：军装+背包+天线
      ctx.fillStyle='#4a5a4a'; ctx.fillRect(-9, -32, 18, 18);  // 迷彩
      ctx.fillStyle='#3a4a3a'; ctx.fillRect(-6, -30, 3, 14);  // 背包
      ctx.strokeStyle='#888'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(-6, -34); ctx.lineTo(-12, -44); ctx.stroke();  // 天线
      ctx.fillStyle='#ff4444'; ctx.fillRect(-13, -45, 2, 2);  // 天线红灯
    }
    // 头（带耳朵+头发）
    ctx.fillStyle = '#c8855a';
    ctx.fillRect(-6, -46, 12, 12);
    ctx.fillStyle='#3a2818'; ctx.fillRect(-6, -46, 12, 3);  // 头发
    // 眼睛
    ctx.fillStyle='#1a0e06'; ctx.fillRect(-3, -42, 2, 2); ctx.fillRect(1, -42, 2, 2);
    // 嘴
    ctx.fillStyle='#5a2a1a'; ctx.fillRect(-2, -38, 4, 1);
    // 名字标签（带背景）
    ctx.font = '9px Microsoft YaHei UI,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(-npc.name.length*3.5-2, -56, npc.name.length*7+4, 10);
    ctx.fillStyle = npc.color;
    ctx.fillText(npc.name, 0, -48);
    ctx.restore();
  });

  // ── 据点底部战备状态条（现代战术半透明浮条，不遮挡顶部HUD）──
  const totalMeat = meatInventory.normal + meatInventory.fast + meatInventory.tank + meatInventory.elite;
  ctx.save();
  const panelX = 16, panelY = GH - 42, panelW = 340, panelH = 32;
  ctx.fillStyle = 'rgba(10,15,26,0.85)';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = 'rgba(0,240,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  ctx.font = 'bold 11px Microsoft YaHei UI,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('🏠 秘密避难所基地', panelX + 10, panelY + 20);
  ctx.fillStyle = totalMeat > 0 ? '#4ade80' : '#94a3b8';
  ctx.fillText('🥩 食材肉块: ' + totalMeat, panelX + 125, panelY + 20);
  ctx.fillStyle = '#ffcc00';
  ctx.fillText('✨ 建设/食堂/梦境', panelX + 230, panelY + 20);
  ctx.restore();
}

// ═══════════════════════════════════════════

//  CABIN KITCHEN SYSTEM（厨房经营系统，参考潜水员戴夫的夜晚餐厅）
//  击杀僵尸掉落肉块 → 带回小屋烹饪成菜肴 → 出售换金币
// ═══════════════════════════════════════════
let cabinActiveTab = 'upgrade';

// 肉块库存：4种僵尸对应4种肉
// normal=普通僵尸肉, fast=快速僵尸肉(瘦), tank=巨型僵尸肉(厚), elite=精英僵尸肉(异变)
let meatInventory = { normal: 0, fast: 0, tank: 0, elite: 0 };

// 肉块定义
const MEAT_TYPES = {
  normal: { name: '普通肉块', icon: '肉', color: '#c87862', desc: '最常见的僵尸肉，口感一般' },
  fast:   { name: '瘦肉',     icon: '瘦', color: '#d89878', desc: '快速僵尸的肉，低脂高蛋白' },
  tank:   { name: '厚肉',     icon: '厚', color: '#a85838', desc: '巨型僵尸的肉，分量足' },
  elite:  { name: '异变肉',   icon: '异', color: '#aa44cc', desc: '精英僵尸的异变肉，稀有食材' },
};


