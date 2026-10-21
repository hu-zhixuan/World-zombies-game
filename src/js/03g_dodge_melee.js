// ═══════════════════════════════════════════
// 闪避翻滚（任务3）：Shift/Ctrl键，无敌帧20帧，冷却40帧，向移动方向翻滚
function tryDodge(){
  if(!gameRunning||shopOpen||cabinUIOpen||gamePaused||(typeof isDuffWorkshopOpen==='function'&&isDuffWorkshopOpen()))return;
  if(gameState !== 'world' && gameState !== 'hub' && gameState !== 'building') return;
  if(typeof cinActive !== 'undefined' && cinActive) return;
  if(typeof scoutView !== 'undefined' && scoutView) return;
  if(typeof isBackpackOpen === 'function' && isBackpackOpen()) return;
  if(typeof isExpeditionOpen === 'function' && isExpeditionOpen()) return;
  if(dodgeT>0||dodgeCd>0)return;
  if(vehicle.entered)return;
  const dir = keys.r ? 1 : keys.l ? -1 : (player.facingRight?1:-1);
  dodgeT=28;  // 翻滚持续时间延长（原20→28）
  // 肉鸽天赋：疾风 冷却-25%/层
  dodgeCd=Math.floor(35*(1-(playerPerks.swift||0)*0.25));  // 冷却缩短（原40→35）
  player.vx=dir*11;  // 翻滚速度提升（原9→11）
  player.iframes=Math.max(player.iframes,30);  // 无敌帧延长（原22→30）
  sndJump();
  const py = (gameState === 'hub') ? (HUB_GROUND_Y - CHAR_H/2) : (player.y + CHAR_H/2);
  const gy = (gameState === 'hub') ? HUB_GROUND_Y : (gameState === 'building' ? GROUND_Y : (typeof groundYAt === 'function' ? groundYAt(player.x + CHAR_W/2) : GROUND_Y));
  // ── 战前特餐：麻辣爆烤（翻滚烈焰火墙，仅战斗世界）──
  if(gameState === 'world' && activeSignature && activeSignature.id === 'spicy'){
    if(!window._groundFires) window._groundFires = [];
    window._groundFires.push({ x: player.x + CHAR_W/2, y: Z_TOP+50, life: 280, dmg: 35, tickT: 45 });
    for(let i=0; i<8; i++){
      mkP({x:player.x+CHAR_W/2, y:gy-4, vx:(Math.random()-.5)*3, vy:-2-Math.random()*2, r:3+Math.random()*2, rDecay:.05, decay:.04, color:Math.random()>.5?'#ff3300':'#ff9900', type:'spark', grav:-0.05, alpha:1});
    }
  }
  // 翻滚残影粒子（增强视觉反馈）
  for(let i=0;i<12;i++){
    mkP({x:player.x+CHAR_W/2,y:py,vx:-dir*(1+Math.random()*3),vy:(Math.random()-.5)*3,r:3+Math.random()*3,rDecay:.05,decay:.03,color:'rgba(150,200,255,.7)',type:'circle',grav:0,alpha:.8,blur:true});
  }
  // 翻滚光环
  mkP({x:player.x+CHAR_W/2,y:py,r:20,rDecay:-1,decay:.06,color:'rgba(150,200,255,.5)',type:'ring',alpha:.8,grav:0});
  // 翻滚提示
  spawnFloatText('🤸 翻滚', player.x+CHAR_W/2, py-20, '#88ccff');
}

// ═══════════════════════════════════════════
//  CHARGE MELEE ATTACK（蓄力近战攻击）
//  右键按住蓄力，松开释放范围横扫；F键快速轻击
// ═══════════════════════════════════════════
let chargeMelee = 0;
let chargeMeleeMax = 45;
let chargeMeleeCd = 0;
let isCharging = false;

function startCharge(){
  if(!gameRunning||shopOpen||cabinUIOpen||gamePaused)return;
  if(vehicle.entered)return;
  if(chargeMeleeCd > 0)return;
  isCharging = true;
  chargeMelee = 0;
}
function releaseCharge(){
  if(!isCharging)return;
  isCharging = false;
  if(chargeMelee < 8){
    doMeleeAttack(1.0, 60);
  } else {
    const pct = Math.min(1, chargeMelee / chargeMeleeMax);
    const dmgMul = 2.0 + pct * 3.0;
    const range = 60 + pct * 80;
    doMeleeAttack(dmgMul, range);
    if(pct >= 0.8){
      addShake(8);
      for(let i=0;i<16;i++){
        const a = (i/16)*Math.PI*2;
        mkP({x:player.x+CHAR_W/2,y:player.y+CHAR_H/2,vx:Math.cos(a)*6,vy:Math.sin(a)*6,r:4,rDecay:.05,decay:.03,color:'#ffaa00',type:'ring',grav:0,alpha:.8});
      }
    }
  }
  chargeMelee = 0;
  chargeMeleeCd = 25;
}

// ═══════════════════════════════════════════
//  【v50 模块一】近战全套打击感（动作/分级命中/处决/连击/音效组）
// ═══════════════════════════════════════════
// ── 近战连击状态 ──
let meleeCombo = 0;          // 连斩数（3秒窗口内）
let meleeComboTimer = 0;    // 连斩窗口帧
let meleeSpinCd = 0;        // 旋风斩冷却

// ── 近战音效组（Web Audio 合成，无文件依赖）──
function sndMeleeSwing(big){
  // 挥空"呼——"刀风：带通滤波扫频（快挥高频短促，重挥低频悠长）
  try{
    const a=getACtx(); if(!a)return;
    const now=a.currentTime;
    const bufferSize=Math.floor(a.sampleRate*(big?0.22:0.12));
    const buffer=a.createBuffer(1,bufferSize,a.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){ data[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/bufferSize); }
    const src=a.createBufferSource();src.buffer=buffer;
    const filter=a.createBiquadFilter();filter.type='bandpass';
    filter.frequency.setValueAtTime(big?600:1400,now);
    filter.frequency.exponentialRampToValueAtTime(big?150:400,now+(big?0.2:0.1));
    filter.Q.value=2.5;
    const gain=a.createGain();
    gain.gain.setValueAtTime(big?0.22:0.14,now);
    gain.gain.exponentialRampToValueAtTime(0.001,now+(big?0.22:0.12));
    src.connect(filter);filter.connect(gain);gain.connect(a.destination);
    src.start(now);
  }catch(e){}
}
function sndMeleeHitFlesh(){
  // 命中肉体"噗嗒"：低频短噪+体腔共鸣（130Hz 低音鼓点感）
  try{
    const a=getACtx(); if(!a)return;
    const now=a.currentTime;
    noise(0.06,120,'sine',0.3,0,0,60);
    const osc=a.createOscillator(),g=a.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(180,now);
    osc.frequency.exponentialRampToValueAtTime(70,now+0.08);
    g.gain.setValueAtTime(0.25,now);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.1);
    osc.connect(g);g.connect(a.destination);osc.start(now);osc.stop(now+0.11);
  }catch(e){}
}
function sndMeleeHeadSlam(){
  // 爆头斩"咔嚓-锵"双段：碎骨高频瞬态→收锋金属泛音
  try{
    const a=getACtx(); if(!a)return;
    const now=a.currentTime;
    whiteNoiseBurst(0.05,0.25,3200);          // 咔嚓
    setTimeout(()=>{
      noiseFreqRamp(0.1,1800,900,'square',0.16);  // 锵
    },55);
    noise(0.08,90,'sine',0.3,0,0,50);        // 低频垫
  }catch(e){}
}
function sndMeleeArmorClang(){
  // 命中护甲"铛"：高频瞬态+衰减泛音+火花
  try{
    const a=getACtx(); if(!a)return;
    const now=a.currentTime;
    const osc=a.createOscillator(),g=a.createGain();
    osc.type='square';osc.frequency.setValueAtTime(2600,now);
    osc.frequency.exponentialRampToValueAtTime(1600,now+0.09);
    g.gain.setValueAtTime(0.13,now);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
    osc.connect(g);g.connect(a.destination);osc.start(now);osc.stop(now+0.13);
    whiteNoiseBurst(0.03,0.08,5000);
  }catch(e){}
}
function sndMeleeExecute(){
  // 处决重低音"咚-沙"：低频冲击+肢体散落沙声
  try{
    noise(0.15,50,'sine',0.45,0,0,120);   // 咚
    setTimeout(()=>{ whiteNoiseBurst(0.18,0.16,700); },100);  // 沙
  }catch(e){}
}
function sndMeleeChargeFull(){
  // 蓄力满"嗡→锵"：充能嗡鸣收锋
  try{
    noiseFreqRamp(0.25,300,900,'sine',0.12);
    setTimeout(()=>noiseFreqRamp(0.08,2200,1400,'square',0.18),220);
  }catch(e){}
}
function sndMeleeComboNote(n){
  // 连斩节奏音：每刀音高递增半音（连击听感成"旋律"——细节爽点）
  try{
    const a=getACtx(); if(!a)return;
    const now=a.currentTime;
    const base=520*Math.pow(1.0595,Math.min(n,12));  // 半音阶上行
    const osc=a.createOscillator(),g=a.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(base,now);
    osc.frequency.exponentialRampToValueAtTime(base*1.4,now+0.07);
    g.gain.setValueAtTime(0.1,now);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.09);
    osc.connect(g);g.connect(a.destination);osc.start(now);osc.stop(now+0.1);
  }catch(e){}
}

function doMeleeAttack(dmgMul, range, opts){
  const px = player.x + CHAR_W/2;
  const py = player.y + CHAR_H/2;
  const dir = player.facingRight ? 1 : -1;
  const big = dmgMul >= 3;
  const isSpin = opts && opts.spin;  // 旋风斩（360°）

  // ── 动作表现①：前冲刺步（lunge）——出招瞬间朝向突进 ──
  if(!isSpin && player.onGround){
    player.vx = dir * (big ? 6.5 : 4.5);
  }
  // ── 动作表现②：挥砍弧形轨迹残影（白弧扫过扇形可见）──
  const swingR = range;
  for(let i=0;i<14;i++){
    const t = i/14;
    const a = (isSpin ? t*Math.PI*2 : (-Math.PI/3 + t*(Math.PI*2/3))*dir);
    const rr = swingR*(0.55+0.45*Math.sin(t*Math.PI));
    mkP({x:px+Math.cos(a)*rr, y:py+Math.sin(a)*rr*0.8, vx:Math.cos(a)*2.2, vy:Math.sin(a)*2.2,
      r:big?4:2.5, rDecay:.22, decay:.12,
      color: big ? '#ffdd88' : '#eef',
      type:'circle', grav:0, alpha:.75, blur:false});
  }
  // 挥空音
  sndMeleeSwing(big);

  const targetZombies = (gameState === 'building') ? buildingInteriorZombies : zombies;
  let hitCount = 0;
  targetZombies.forEach(z => {
    if(!z.alive)return;
    const dx = (z.x + 22) - px;
    const dy = (Z_TOP + 28) - py;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const inArc = isSpin || (dir > 0 ? dx > -range*0.3 : dx < range*0.3);
    if(dist < range && inArc){
      hitCount++;
      const zx = z.x + 22, zy = Z_TOP + 28;
      // ── 近战命中分级（v50核心打击感）──
      const isExec = z.hp < z.maxHp * 0.25;             // 处决：目标血量<25%
      const isHead = (zy - Z_TOP) < 18 && Math.random() < (playerClass&&playerClass.id==='marksman'?0.9:0.45);  // 爆头斩（近战命中头部判定带概率）
      // 伤害：狂战士近战+100% × 分级倍率
      let dmg = getDamage(8) * dmgMul;
      if(playerClass && playerClass.id==='berserker') dmg *= 2.0;
      // ── v53流派觉醒：血怒（狂战士）技能窗口近战再×2 ──
      if(window._classSkillT>0 && playerClass && playerClass.id==='berserker') dmg *= 2.0;
      if(isHead) dmg *= 2.0;
      if(isExec) dmg = z.hp + 10;   // 处决=直接斩杀

      if(isExec){
        // ── 处决：对半劈开（专属死亡表现）+慢动作+重低音 ──
        const arch = (z.zType && ZOMBIE_DEX_MAP[z.zType]) || null;
        const skin = arch ? arch.color1 : '#c8a878';
        const cloth = arch ? arch.color2 : '#6a6a7a';
        z.hp = 0; z.hitFlash = 2;
        hitZombie(z, zx, zy, dmg, px, py);   // 走击杀管线（掉落/经验/连击结算）
        sndMeleeExecute();
        addShake(9);
        hitstop = Math.max(hitstop, 7);  // 0.12s慢动作
        spawnFloatText('处决!', zx, Z_TOP-34, '#ff2244');
        // 对半劈开视觉：上半身块向击退方向飞旋+下半身碎块塌落
        const kdir = dir;
        mkP({x:zx,y:Z_TOP+8,vx:kdir*4.5,vy:-5,r:16,rDecay:.1,decay:.02,color:skin,type:'shard',angle:0,spin:.3*kdir,grav:.4,alpha:.95});
        mkP({x:zx,y:Z_TOP+30,vx:kdir*2,vy:-1.5,r:12,rDecay:.08,decay:.025,color:cloth,type:'shard',angle:0,spin:.2*kdir,grav:.45,alpha:.95});
        for(let i=0;i<8;i++){
          mkP({x:zx,y:Z_TOP+20+(Math.random()-.5)*24,vx:(Math.random()-.5)*4,vy:-1-Math.random()*2.5,r:2.5+Math.random()*2.5,rDecay:.05,decay:.035,color:i%2?'#8a1111':'#5a0a0a',type:'circle',grav:.14,alpha:.85,blur:true});
        }
        // 处决回血（狂战士8% / 血刃7刀触发同样适用；v53血怒窗口内吸血10%）
        let healPct = playerPerks.bloodfeast ? 0.08 : (playerClass && playerClass.id==='berserker' ? 0.08 : 0.02);
        if(window._classSkillT>0 && playerClass && playerClass.id==='berserker') healPct = Math.max(healPct, 0.10);
        const heal = Math.max(1, Math.round(maxHp*healPct));
        health = Math.min(maxHp, health+heal); updateHpUI();
        spawnFloatText('❤+'+heal, px, py-40, '#ff6688');
      }else{
        // 普通/爆头斩：走常规命中管线
        hitZombie(z, zx, zy, dmg, px, py);
        if(isHead){
          sndMeleeHeadSlam();
          z.knockback = (z.knockback||0) + dir * dmgMul * 6;   // 爆头击退翻倍
          z.hitStun = Math.max(z.hitStun||0, Math.floor(dmgMul*6));
          hitstop = Math.max(hitstop, 4);  // 0.07s顿帧
          addShake(5);
          // 竖劈金痕+碎骨白粒子
          for(let i=0;i<5;i++){
            mkP({x:zx,y:zy-14+i*6,vx:(Math.random()-.5)*1.5,vy:-1,r:2.5,rDecay:.15,decay:.14,color:'#ffee99',type:'spark',grav:.05,alpha:.95});
          }
          spawnFloatText('爆头斩!', zx, Z_TOP-28, '#ffcc44');
        }else{
          sndMeleeHitFlesh();
          hitstop = Math.max(hitstop, 2);  // 0.03s微顿帧
        }
        z.knockback = (z.knockback||0) + dir * (dmgMul * 3);
        z.hitStun = Math.max(z.hitStun||0, Math.floor(dmgMul * 3));
        vfxHit(zx, zy, px, py);
        // 命中护甲（装甲怪）：金属弹开音+火花
        if(z.armorPct >= 0.5 && z.armorHp > 0){
          sndMeleeArmorClang();
          for(let i=0;i<4;i++){
            mkP({x:zx,y:zy,vx:(Math.random()-.5)*5,vy:-1-Math.random()*2,r:1.5,rDecay:.1,decay:.12,color:'#ffd080',type:'spark',grav:.15,alpha:.95});
          }
        }
      }
    }
  });
  // ── 连击系统：命中累计连斩（3秒窗口），连斩音高上行 ──
  if(hitCount > 0){
    meleeCombo += hitCount;
    meleeComboTimer = 180;
    sndMeleeComboNote(meleeCombo);
    // 连斩移速加成提示（每层+2%，在 getMoveSpeed 接入）
    if(meleeCombo >= 3 && meleeCombo % 3 === 0){
      spawnFloatText('连斩×'+meleeCombo, px, py-52, '#ffaa44');
    }
    // ── 旋风斩：7连斩触发（360°红色圆弧重击）──
    const spinAt = 7;
    if(meleeCombo >= spinAt && meleeSpinCd <= 0){
      meleeSpinCd = 300;
      // 红色圆弧视觉
      mkP({x:px,y:py,r:range*1.3,rDecay:-2.2,decay:.09,color:'rgba(255,60,40,.85)',type:'ring',alpha:.9,grav:0});
      mkP({x:px,y:py,r:range*0.9,rDecay:-1.6,decay:.09,color:'rgba(255,120,60,.6)',type:'ring',alpha:.7,grav:0});
      sndMeleeExecute();
      addShake(10);
      setTimeout(()=>{ if(gameRunning) doMeleeAttack(2.2, range*1.4, {spin:true}); }, 40);
      spawnFloatText(spinAt===5?'🩸 血刃风暴!':'⚔ 旋风斩!', px, py-64, '#ff4422');
    }
  }
  if(boss && boss.alive && bossActive && gameState !== 'building'){
    const dx = (boss.x + 40) - px;
    const dy = (GROUND_Y - 80) - py;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist < range + 40){
      let dmg = getDamage(8) * dmgMul;
      if(playerClass && playerClass.id==='berserker') dmg *= 2.0;
      hitBoss(dmg, boss.x + 40, GROUND_Y - 80, px, py);
      addShake(dmgMul >= 3 ? 6 : 3);
      sndMeleeHitFlesh();
    }
  }
}
function updateCharge(){
  if(isCharging){
    chargeMelee++;
    if(chargeMelee > chargeMeleeMax) chargeMelee = chargeMeleeMax;
    // v50近战：蓄力满瞬间"嗡→锵"充能收锋音（一次性触发+角色微颤）
    if(chargeMelee >= chargeMeleeMax && !window._chargeFullPing){
      window._chargeFullPing = true;
      sndMeleeChargeFull();
      addShake(2);
    }
    if(chargeMelee < chargeMeleeMax) window._chargeFullPing = false;
    if(frameT % 3 === 0){
      const pct = chargeMelee / chargeMeleeMax;
      const px = player.x + CHAR_W/2, py = player.y + CHAR_H/2;
      for(let i=0;i<2;i++){
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 15;
        mkP({x:px+Math.cos(a)*r,y:py+Math.sin(a)*r,vx:-Math.cos(a)*1.5,vy:-Math.sin(a)*1.5,r:2+Math.random()*2,rDecay:.04,decay:.05,color:pct>=0.8?'#ff4400':'#ffaa00',type:'circle',grav:0,alpha:.6});
      }
    }
  }
  if(chargeMeleeCd > 0) chargeMeleeCd--;
  // ── v50近战：连击窗口/旋风冷却衰减 ──
  if(meleeComboTimer > 0){ meleeComboTimer--; if(meleeComboTimer === 0) meleeCombo = 0; }
  if(meleeSpinCd > 0) meleeSpinCd--;
}

function updatePlayer(){
  if(vehicle.entered)return;
  // 侦察视角：冻结玩家移动（玩家查看战场时不能走）
  if(scoutView){player.vx=0;player.vy+=GRAVITY;player.y=Math.min(player.y+player.vy,CHAR_GY);if(player.y>=CHAR_GY){player.y=CHAR_GY;player.vy=0;player.onGround=true;}return;}
  if(dodgeT > 0){
    dodgeT--;
    player.vx *= 0.94;
    if(dodgeT === 0){
      const spd = getMoveSpeed();
      if(keys.l){ player.vx = -spd; player.facingRight = false; }
      else if(keys.r){ player.vx = spd; player.facingRight = true; }
      else { player.vx = 0; }
    }
  } else {
    const spd=getMoveSpeed();
    if(keys.l){player.vx=-spd;player.facingRight=false;}
    else if(keys.r){player.vx=spd;player.facingRight=true;}
    else player.vx*=.72;
  }
  if(dodgeCd > 0) dodgeCd--;
  if(player.iframes > 0) player.iframes--;
  if(!keys.l&&!keys.r){const px=player.x+(player.facingRight?CHAR_W*.85:CHAR_W*.15);player.facingRight=lastMX>=px;}
  if(keys.j&&player.onGround){player.vy=JUMP_V;player.onGround=false;sndJump();}
  player.vy+=GRAVITY;player.x+=player.vx;player.y+=player.vy;
  const wasAir=!player.onGround;
  // 家园塔防：玩家在家园区站平台顶面，战场区站地面（室内场景始终用普通地面，不套用家园平台逻辑）
  const curGroundY = (gameState === 'building') ? GROUND_Y : groundYAt(player.x + CHAR_W/2);  // 按玩家中心判定
  const curCharGY = curGroundY - CHAR_H;
  if(player.y>=curCharGY){player.y=curCharGY;if(wasAir&&player.vy>3)sndLand();player.vy=0;player.onGround=true;}
  // 平台边缘跌落：从平台走到边缘时自然落到地面（不阻挡移动）
  const minX = (gameState === 'building') ? 20 : 0;
  const maxX = (gameState === 'building') ? (GW - CHAR_W - 20) : (WORLD_W - CHAR_W);
  if(player.x <= minX){
    player.x = minX;
    if(player.vx < 0) player.vx = 0;
  } else if(player.x >= maxX){
    player.x = maxX;
    if(player.vx > 0) player.vx = 0;
  }
  if (gameState === 'building') {
    cameraX = 0;
    if((keys.l||keys.r)&&player.onGround&&dodgeT<=0)player.walkT+=.06;
    if(!player.onGround&&!keys.j)player.walkT=0;
    return;
  }
  // 相机跟随：紧凑跟随玩家，玩家保持在屏幕中央；侦察模式(Q)时相机平移到战场
  if(scoutView){
    // 侦察：平滑平移到战场最右端，玩家可见家园+战场
    const targetCamX=840;  // 平移到战场（中屏），不显示旧小镇
    cameraX += (targetCamX-cameraX)*0.08;  // 缓动
  }else{
    // 跟随玩家：小死区防抖，玩家居中
    const screenX=player.x-cameraX;
    const lead = player.facingRight ? GW*0.50 : GW*0.50; // 居中跟随
    const dead = GW*0.03; // 小死区（25px）防抖，相机更跟手
    if(screenX > lead+dead) cameraX += (screenX-(lead+dead))*0.22;
    else if(screenX < lead-dead) cameraX -= ((lead-dead)-screenX)*0.22;
  }
  cameraX=Math.max(0,Math.min(cameraX,WORLD_W-GW));
  if((keys.l||keys.r)&&player.onGround&&dodgeT<=0)player.walkT+=.06;
  if(!player.onGround&&!keys.j)player.walkT=0;
  if(player.onGround&&(keys.l||keys.r)&&Math.random()<.22)mkP({x:player.x+CHAR_W/2+(Math.random()-.5)*10,y:CHAR_GY+CHAR_H,vx:(Math.random()-.5)*.8,vy:-(Math.random()*.5+.15),r:1.5+Math.random()*2,rDecay:.03,decay:.028,color:'rgba(130,105,48,.5)',type:'circle',grav:-.005,alpha:.45});
}

