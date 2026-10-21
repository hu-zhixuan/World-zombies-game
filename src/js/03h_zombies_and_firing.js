// ═══════════════════════════════════════════
//  【白天模块 A8】ZOMBIE SPAWNING（僵尸生成+难度曲线）
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// ── 僵尸图鉴 ZOMBIE_DEX 注册表已集中归拢至 Section 01 CONFIG & REGISTRIES ──
function spawnZombie(archKeyOverride){
  if(!gameRunning)return;
  const ws=window.__waveSpecial||'normal';
  // ── 选择僵尸原型（按波次解锁+权重） ──
  let arch;
  if(archKeyOverride && ZOMBIE_DEX_MAP[archKeyOverride]){
    arch = ZOMBIE_DEX_MAP[archKeyOverride];
  } else {
    // 构建可用原型池（firstWave <= wave）
    const pool = ZOMBIE_DEX.filter(d => d.firstWave <= wave);
    // 权重：普通高、装甲中、特殊低、精英极低
    const weightByTier = { '普通':10, '装甲':6, '特殊':3, '精英':1 };
    // 缓冲期/尸潮波：提高装甲和特殊权重（更有压迫感）
    if(ws==='buffer' || ws==='horde'){
      weightByTier['装甲'] = 8;
      weightByTier['特殊'] = 5;
      weightByTier['精英'] = wave>=10 ? 2 : 1;
    }
    // 精英波：全是特殊/精英
    if(ws==='elite'){
      weightByTier['普通'] = 0;
      weightByTier['装甲'] = 3;
    }
    // ── v49批1：变异「钢铁潮」——装甲权重×2 ──
    if(waveMutation && waveMutation.id==='ironwave'){
      weightByTier['装甲'] *= 2;
    }
    let weighted = [];
    for(const d of pool){
      const w = weightByTier[d.tier] || 1;
      for(let i=0;i<w;i++) weighted.push(d);
    }
    if(weighted.length === 0){ arch = ZOMBIE_DEX[0]; }
    else arch = weighted[Math.floor(Math.random()*weighted.length)];
  }
  // 城堡塔防制（v47回退）：僵尸从镜头右缘刷出，直奔玩家/城墙
  let sx;
  if(ws === 'buffer'){
    sx = cameraX + GW + 20 + Math.random()*100;  // 屏幕右侧边缘外
  } else {
    sx = cameraX + GW + 40 + Math.random()*80;  // 屏幕右侧边缘外（让玩家立刻看到来袭）
  }
  // 速度成长曲线（塔防行军制：压平速度成长——行军距离长了，别让后期怪跑得没法反应）
  let spd=(arch.baseSpeed)*(1+(wave-1)*.08);
  if(ws==='night') spd*=1.3;
  // ── v49批1：变异速度修正（亡命徒+20% / 血月+15%）──
  if(waveMutation){
    if(waveMutation.id==='frenzy') spd*=1.2;
  else if(waveMutation.id==='bloodmoon') spd*=1.15;
  else if(waveMutation.id==='feast') spd*=0.9;   // v52饕餮盛宴：移速-10%
  else if(waveMutation.id==='thunder') spd*=1.05; // v52雷暴：轻微加速补偿落雷威胁
  }
  // ── HP 曲线（塔防重平衡）──
  // 原曲线 1.6/3.5/6.5/11/16 与塔 DPS 脱节（W10 游荡者1760血 vs L1机枪10DPS）
  // 新曲线压平到塔阵可拦截、玩家+塔协作能清的水平
  // v52塔防强化：W5 起整体再抬一档（塔从"可选挂件"变成"必需投资"——不建塔 W6-8 起明显吃紧）
  // 强化僵尸HP曲线与压迫感（响应用户反馈：现在僵尸有点弱了）
  const hpMul = wave>=13 ? 8.5 : wave>=10 ? 6.5 : wave>=7 ? 4.8 : wave>=5 ? 3.4 : wave>=3 ? 2.3 : (wave === 1 ? 1.14 : 1.6);
  // 装甲/坦克型僵尸额外血量加成（真正体现肉盾威慑）
  let tierHpBonus = 1.0;
  if(arch.tier === '装甲') tierHpBonus = 1.6;
  else if(arch.tier === '特殊') tierHpBonus = 1.35;
  else if(arch.tier === '精英') tierHpBonus = 1.8;
  // 缓冲期尸潮：血量随缓冲层级递增（1.3x → 1.5x → 1.7x → 1.9x）
  const bufMul = ws==='buffer' ? (1.3 + bufferWaveLevel * 0.2) : 1.0;
  // ── v49批1：变异血量修正（goldrush+15% / swarm-15%）──
  const mutHp = waveMutation ? (waveMutation.id==='goldrush'?1.15 : waveMutation.id==='swarm'?0.85 : 1) : 1;
  const hp=Math.floor((arch.baseHp+Math.floor(wave*8))*hpMul*tierHpBonus*bufMul*mutHp);
  if(wave>=7) spd*=1.2;
  if(wave>=10) spd*=1.15;
  // 缓冲期僵尸移速略降（更硬但更慢，给玩家走位空间）
  if(ws==='buffer') spd*=0.85;
  // 精英波：保留原精英系统（ELITE_TYPES）概率生成
  const eliteChance = ws==='elite' ? 1.0 : Math.min(0.5, 0.08 + wave*0.05);
  let useOldElite = false;
  if(ws !== 'elite' && Math.random() < eliteChance * 0.4){
    // 旧精英系统（4种特殊精英）保留，但降低概率，给新原型让路
    useOldElite = true;
  }
  if(ws === 'elite' && Math.random() < 0.5){
    // 精英波一半概率用旧精英，一半用新原型
    useOldElite = true;
  }
  if(useOldElite){
    const elite=Math.floor(Math.random()*4)+1;
    const et=ELITE_TYPES[elite-1];
    const ehp=Math.floor((et.hp+Math.floor(wave*12))*hpMul*1.8*bufMul);  // 精英额外1.8倍血量
    let espd=et.speed*(1+(wave-1)*.12);
    if(ws==='night') espd*=1.6;
    if(wave>=7) espd*=1.3;
    if(wave>=10) espd*=1.25;
    const z={x:sx,hp:ehp,maxHp:ehp,spd:espd,alive:true,type:arch.meatType,
      pts:et.pts,coinReward:et.coins,walkT:Math.random(),facingR:false,hitFlash:0,burnTimer:null,burning:false,
      elite,state:'idle',stateTimer:0,shieldFlash:0,floatOffset:0,
      armorPct:elite===3?0.6:0.25, resistPct:0.15,  // 双轴克制：护盾精英高甲，其余中甲低抗
      zType:'old_elite', meatKind:'elite',
      yOffset: ws==='buffer' ? (Math.random()-0.5)*40 : 0};  // 缓冲期y方向分散
    zombies.push(z);
    return;
  }
  // ── 新原型僵尸生成 ──
  const z={x:sx,hp,maxHp:hp,spd,alive:true,type:arch.meatType,
    pts:arch.pts,coinReward:arch.coins,walkT:Math.random(),facingR:false,
    hitFlash:0,burnTimer:null,burning:false,hitStun:0,knockback:0,
    dashTimer:0,dashCd:60+Math.floor(Math.random()*120),
    zType:arch.key, meatKind:arch.meatKind, archColor1:arch.color1, archColor2:arch.color2, archHair:arch.hair,
    // ── 双轴克制：护甲/抗性从原型定义继承 ──
    armorPct:arch.armorPct||0, resistPct:arch.resistPct||0,
    // 机制初始化
    // 美术升级：路障/铁桶恢复护甲血池（纯视觉血条+被打碎表现；减伤已并入armorPct，
    // 血池掉光=装备被打飞的头像表现，同时在装备碎裂时临时降低armorPct形成"破甲"窗口）
    armorHp:0, armorMax:0,
    shieldDir:-1,  // 铁门盾卫朝向（-1=盾在左，玩家从左打来）
    hasJumped:false, jumpTimer:0,  // 弹跳狂尸
    explodeArmed:true,  // 自爆殉道者
    spawnTimer:480+Math.floor(Math.random()*120),  // 舞池感染源（8秒召唤）
    rangedCd:180+Math.floor(Math.random()*120),  // 火焰投手
    slamTimer:180,  // 巨型行刑者砸地
    rallyApplied:false,  // 号旗呼号者
    yOffset: ws==='buffer' ? (Math.random()-0.5)*40 : 0};  // 缓冲期y方向分散
  // 护甲装备血池（视觉+破甲窗口）
  if(arch.mechanic==='armor_cone'){
    z.armorHp = Math.max(30, Math.floor(z.maxHp * 0.3));
    z.armorMax = z.armorHp;
  }else if(arch.mechanic==='armor_bucket'){
    z.armorHp = Math.max(50, Math.floor(z.maxHp * 0.5));
    z.armorMax = z.armorHp;
  }
  zombies.push(z);
}

// ═══════════════════════════════════════════
//  ZOMBIE ARCHETYPE MECHANICS（新原型机制更新）
//  在主僵尸移动循环中调用，处理特殊行为
// ═══════════════════════════════════════════
function tickZArchetype(z, pcx, zcx, dir){
  if(!z.alive || !z.zType || z.zType==='old_elite') return;
  const dist = Math.abs(pcx - zcx);
  // ── 号旗呼号者：一次性加速身边同类 ──
  if(z.zType === 'flagbearer' && !z.rallyApplied){
    z.rallyApplied = true;
    zombies.forEach(z2 => {
      if(z2.alive && z2 !== z && Math.abs((z2.x+22)-zcx) < 200){
        z2.spd = (z2.spd || 0) * 1.15;
      }
    });
    // 视觉：光环
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;mkP({x:zcx,y:Z_TOP+28,vx:Math.cos(a)*3,vy:Math.sin(a)*3,r:3,rDecay:.05,decay:.05,color:'#ffaa44',type:'spark',grav:0,alpha:.8});}
  }
  // ── 火焰投手：远距离抛射火球 ──
  if(z.zType === 'ranged'){
    if(z.rangedCd > 0) z.rangedCd--;
    if(z.rangedCd <= 0 && dist > 180 && dist < 700){
      z.rangedCd = 200 + Math.floor(Math.random()*80);
      // 发射火球（使用 bossProjList 机制简化，或直接用 mkBullet 反向）
      const tx = vehicle.entered ? (vehicle.x+60) : (player.x+CHAR_W/2);
      const ty = Z_TOP + 28;
      const fx = zcx, fy = Z_TOP + 20;
      const adx = tx-fx, ady = ty-fy, adist = Math.sqrt(adx*adx+ady*ady)||1;
      // 创建自定义火球粒子（在update中推进+碰撞）
      if(!window._fireballs) window._fireballs = [];
      window._fireballs.push({x:fx,y:fy,vx:adx/adist*3.5,vy:ady/adist*3.5-1.5, gravity:0.08, r:6, life:180, dmg:18});
      sndBossProj();
      // 喷射视觉
      for(let i=0;i<5;i++){mkP({x:fx,y:fy,vx:adx/adist*2+(Math.random()-.5)*1.5,vy:ady/adist*2+(Math.random()-.5)*1.5,r:3+Math.random()*2,rDecay:.06,decay:.05,color:Math.random()>.5?'#ff6600':'#ffaa00',type:'circle',alpha:.85,grav:.05});}
    }
  }
  // ── 舞池感染源：定期召唤小僵尸 ──
  if(z.zType === 'spawner'){
    if(z.spawnTimer > 0) z.spawnTimer--;
    if(z.spawnTimer <= 0){
      z.spawnTimer = 480 + Math.floor(Math.random()*120);  // 8秒
      // 召唤2只小尸婴（弱版roamer）
      for(let k=0;k<2;k++){
        const ihp = Math.floor((40 + wave*4) * (wave>=13?16:wave>=10?11:wave>=7?7:wave>=4?4:2));
        const ispd = 1.6 * (1+(wave-1)*.18);
        zombies.push({
          x:z.x+10+(Math.random()-.5)*30, hp:ihp, maxHp:ihp, spd:ispd, alive:true, type:0,
          pts:6, coinReward:4, walkT:Math.random(), facingR:false, hitFlash:0, burnTimer:null, burning:false,
          hitStun:0, knockback:0, dashTimer:0, dashCd:120,
          zType:'imp', meatKind:'normal', archColor1:'#d8a8b8', archColor2:'#884466', archHair:'#3a1818',
          armorHp:0, armorMax:0, shieldDir:-1, hasJumped:false, jumpTimer:0, explodeArmed:false,
          spawnTimer:99999, rangedCd:99999, slamTimer:99999, rallyApplied:true,
          yOffset:(Math.random()-.5)*20
        });
      }
      // 喷吐视觉
      for(let i=0;i<8;i++){mkP({x:zcx,y:Z_TOP+10,vx:(Math.random()-.5)*4,vy:-2-Math.random()*3,r:2+Math.random()*2,rDecay:.06,decay:.05,color:'#cc4488',type:'circle',alpha:.8,grav:.2});}
      sndBossRoar();
    }
  }
  // ── 巨型行刑者：定期砸地 ──
  if(z.zType === 'gargantuar'){
    if(z.slamTimer > 0) z.slamTimer--;
    if(z.slamTimer <= 0 && dist < 350){
      z.slamTimer = 180;  // 3秒
      // 砸地：范围伤害+震屏+击退
      addShake(10); sndSlam();
      vfxExplosion(zcx, Z_TOP+40);
      // 冲击波视觉
      for(let i=0;i<20;i++){const a=i/20*Math.PI*2;mkP({x:zcx,y:Z_TOP+50,vx:Math.cos(a)*6,vy:Math.sin(a)*2-1,r:5,rDecay:.04,decay:.05,color:'#aa6644',type:'ring',alpha:.7,grav:0});}
      // 伤害玩家
      if(!vehicle.entered && Math.abs((player.x+CHAR_W/2)-zcx)<120 && (player.y+CHAR_H)>Z_TOP+10){
        takeDamage(25);
        player.vx=(player.x<zcx)?-12:12;player.vy=-7;player.onGround=false;player.iframes=40;
      }
      // 伤害围墙
      if(wallHp>0 && Math.abs(RIGHT_WALL_X-zcx)<120){
        wallHp=Math.max(0,wallHp-30);
      }
    }
  }
  // ── 自爆殉道者：接触玩家时立即爆炸（在移动循环外由contact触发，这里处理接触围墙预爆）──
  // 已在 killZombie 和 contact 中处理
}

// 火球更新+碰撞（每帧调用）
function updateFireballs(){
  if(!window._fireballs || window._fireballs.length===0) return;
  const fb = window._fireballs;
  for(let i=fb.length-1; i>=0; i--){
    const f = fb[i];
    f.x += f.vx; f.y += f.vy; f.vy += f.gravity; f.life--;
    // 拖尾
    mkP({x:f.x,y:f.y,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,r:3+Math.random()*2,rDecay:.08,decay:.06,color:Math.random()>.5?'#ff6600':'#ffaa00',type:'circle',alpha:.7,grav:0});
    // 碰撞玩家
    if(!vehicle.entered && Math.abs((player.x+CHAR_W/2)-f.x)<22 && (player.y+CHAR_H)>f.y-12 && player.y<f.y+12){
      takeDamage(f.dmg);
      player.vx=(player.x<f.x)?-7:7;player.vy=-5;player.onGround=false;player.iframes=40;
      vfxExplosion(f.x,f.y);sndExplosion();
      fb.splice(i,1); continue;
    }
    // 碰撞围墙
    if(wallHp>0 && Math.abs(RIGHT_WALL_X-f.x)<14 && f.y>Z_TOP && f.y<Z_TOP+60){
      wallHp=Math.max(0,wallHp-15);
      vfxExplosion(f.x,f.y);sndExplosion();addShake(3);
      fb.splice(i,1); continue;
    }
    // 落地或超时
    if(f.y > Z_TOP+50 || f.life<=0 || f.x < cameraX-50 || f.x > cameraX+GW+100){
      vfxExplosion(f.x,f.y);sndExplosion();
      fb.splice(i,1);
    }
  }
}


// [bId 已在 Section 01 顶层声明]
function fireWeapon(toX,toY){
  const w=cw();if(isReloading)return;
  // 狙击枪：移动时不能开火
  if(w.noMoveFire && (keys.l||keys.r) && player.onGround){
    addBanner('⚠ 狙击枪需要站定才能射击');return;
  }
  // 湮灭者：弹药用完不可补充
  if(w.noRefill && wAmmo[curWpnIdx]<=0){
    addBanner('⚠ 湮灭者弹药已耗尽，无法补充');flashReloadHint();return;
  }
  // Minigun heat
  if(w.id==='minigun'){
    if(w.overheated){flashOverheatHint();return;}
    w.heat=Math.min(w.maxHeat,w.heat+6);updateWeaponHeat();
    if(w.heat>=w.maxHeat){w.overheated=true;flashOverheatHint();stopAuto();}
  }
  if(w.id!=='minigun'){
    if(wAmmo[curWpnIdx]<=0){flashReloadHint();return;}
    wAmmo[curWpnIdx]--;updateAmmoUI();refreshWBar();
  }
  // 狙击枪开火时减速
  if(w.movePenalty){player.vx*=0.3;}
  // ── v53十字弩蓄力：记录本次开火时间（下一发的蓄力=距上次开火的间隔）──
  if(w.id==='crossbow'){
    window._xbowLastFire=performance.now();
  }
  const gun=getGunTip();const fx=gun.x,fy=gun.y,fa=gun.angle;
  vfxMuzzle(fx,fy,fa,w.id);
  if(typeof spawnShellCasing === 'function'){
    spawnShellCasing(fx, fy, fa, w.id);
  }
  const fireShake = w.id==='rocket'?7 : (w.id==='shotgun'||w.id==='sawoff')?4.5 : (w.id==='railgun'||w.id==='sniper'||w.id==='revolver'||w.id==='railcharger')?3.2 : (w.id==='minigun'?0.8 : 1.2);
  addShake(fireShake);
  const bigRecoil=['shotgun','sawoff','railgun','sniper','rocket','revolver','railcharger'].includes(w.id);
  muzzleFlashT=10;
  shootRecoil=Math.min(14,shootRecoil+(bigRecoil?(w.id==='rocket'?11:(w.id==='shotgun'||w.id==='sawoff'?9:7)):w.id==='minigun'?1.8:w.id==='smg'||w.id==='smg_heavy'?3:4));
  vfxMuzzleLight(w.id);
  vfxSmokeTick(fx,fy,w.id);
  sndShoot(w.id);
  // ── v53武器去同质化：喷火器「持续灼烧递增」──
  //    原版 rampUp 是死字段。持续射击每0.5s+1层(最高3层×伤害)，停火0.5s重置（主循环衰减）。
  if(w.rampUp){
    window._flameRampT=30;  // 0.5s内再射保层
    window._flameRampStacks=Math.min(3,(window._flameRampStacks||0)+0.25);
  }
  // ═══ 【v50 模块二】流派专属武器机制分发（在通用弹道前拦截）═══
  if(w.classWeapon){
    const dx2=toX-fx,dy2=toY-fy;
    // ── 磁轨充能狙击：暴击充能→满3格下一发爆射 ──
    if(w.id==='railcharger'){
      if(window._railCharge >= 3){
        window._railCharge = 0;
        // 磁轨爆射：全屏贯穿+爆头必暴+加粗弹道
        vfxRail(fx,fy,toX,toY,'#88ffee','#004455');
        // v52修：dist 在函数后面才 const 声明，此处引用会抛 TDZ ReferenceError（神射手满充能必崩）
        const dist2=Math.hypot(dx2,dy2)||1;
        const b2=mkBullet(fx,fy,(dx2/dist2)*48,(dy2/dist2)*48,w);
        b2.dmg *= 2.0; b2.piercing = true; b2.wide = true; b2.railBurst = true;
        addShake(7); orangeFlash=Math.min(1,orangeFlash+.4);
        spawnFloatText('磁轨爆射!', player.x+CHAR_W/2, player.y-40, '#88ffee');
        return;  // 爆射发不走通用管线
      }
      // 常规磁轨弹（暴击充能判定在 hitZombie 的 crit 处理——见武器id检查）
    }
    // ── 战地哨笛：零伤害号令 ──
    if(w.id==='warhorn'){
      // 号令音效（号角感）
      try{
        const a=getACtx();
        if(a){const now=a.currentTime;
          [392,523,659].forEach((f,i)=>{
            const o=a.createOscillator(),g=a.createGain();
            o.type='sawtooth';o.frequency.setValueAtTime(f,now+i*0.12);
            g.gain.setValueAtTime(0.12,now+i*0.12);
            g.gain.exponentialRampToValueAtTime(0.001,now+i*0.12+0.22);
            o.connect(g);g.connect(a.destination);o.start(now+i*0.12);o.stop(now+i*0.12+0.24);
          });
        }
      }catch(e){}
      let horned = 0;
      hiredCompanions.forEach(c=>{
        if(c.downed){
          // 远程救起倒地伙伴
          c.downed=false;c.hp=Math.floor(c.maxHp*0.5);c.downedT=0;
          companionBark(c,'revived');
          for(let i=0;i<8;i++){mkP({x:c.x+18,y:Z_TOP+20,vx:(Math.random()-.5)*3,vy:-2-Math.random()*2,r:2,rDecay:.05,decay:.04,color:'#88ffaa',type:'circle',grav:-.02,alpha:.9,blur:true});}
        }else{
          // 狂暴6秒（Lv3长号令=8秒）
          c.hornRage = hornLv3 ? 480 : 360;
          c.timer = 0;  // 立即行动
          horned++;
          for(let i=0;i<6;i++){mkP({x:c.x+18,y:Z_TOP+16+(Math.random()-.5)*20,vx:(Math.random()-.5)*2,vy:-1.5-Math.random(),r:1.8,rDecay:.05,decay:.05,color:'#ffcc44',type:'spark',grav:0,alpha:.9});}
        }
      });
      health = Math.min(maxHp, health+15); updateHpUI();
      spawnFloatText('❤+15 📣', player.x+CHAR_W/2, player.y-30, '#88ffaa');
      addBanner(horned>0 ? `📣 号令！${horned} 位伙伴狂暴6秒（伤+50% 射速×2 移速+30%）` : '📣 号令！伙伴已远程归队');
      addShake(4);
      return;
    }
    // ── 裂地援护锤：扇形击退+眩晕+护盾 ──
    if(w.id==='quakehammer'){
      const qkRange = 130;
      player.playerShield = 180;  // 护盾（takeDamage 处读取）
      doMeleeAttack(1.6, qkRange, {});  // 走近战管线（扇形命中）
      // 命中者追加眩晕+强化击退
      zombies.forEach(z=>{
        if(!z.alive)return;
        if(Math.abs((z.x+22)-(player.x+CHAR_W/2))<qkRange){
          z.hitStun = Math.max(z.hitStun||0, 90);  // 1.5秒眩晕
          z.knockback = (z.knockback||0) + (player.facingRight?18:-18);
        }
      });
      // 地裂视觉
      for(let i=0;i<10;i++){
        mkP({x:player.x+CHAR_W/2+(player.facingRight?i*12:-i*12),y:GROUND_Y-2,vx:0,vy:-2-Math.random()*2,r:3+Math.random()*3,rDecay:.05,decay:.04,color:i%2?'#b08850':'#8a6a3a',type:'circle',grav:.1,alpha:.8});
      }
      addShake(8);
      spawnFloatText('🛡 护盾3秒', player.x+CHAR_W/2, player.y-40, '#88ccff');
      return;
    }
    // ── 血肉双刃：快速扇形连斩+吸血（射速由 fireInterval 控制）──
    if(w.id==='bloodblades'){
      doMeleeAttack(1.0, 85, {});
      // 吸血3%
      const lsRate = 0.03;
      zombies.forEach(z=>{
        if(!z.alive)return;
        if(Math.abs((z.x+22)-(player.x+CHAR_W/2))<85){
          const heal = Math.max(1, Math.round(getDamage(14)*lsRate));
          health = Math.min(maxHp, health+heal);
          if(Math.random()<0.3) spawnFloatText('❤'+heal, player.x+CHAR_W/2, player.y-46, '#ff6688');
          z.bleedTimer = 180;
          z.bleedDmg = Math.max(3, Math.round(getDamage(14) * 0.25));
        }
      });
      updateHpUI();
      // 挥斩飞出穿透月牙血刃气波
      const pFacing = player.facingRight ? 1 : -1;
      bullets.push({
        x: player.x + CHAR_W/2 + pFacing * 16,
        y: player.y + CHAR_H/2 - 4,
        vx: pFacing * 13,
        vy: (Math.random() - 0.5) * 1.2,
        dmg: getDamage(16),
        range: 480,
        piercing: true,
        active: true,
        wpn: 'bloodblades',
        isBloodSlash: true,
        sx: player.x,
        sy: player.y
      });
      return;
    }
  }
  const heavyShake = ['shotgun','railgun','sniper','rocket','sawoff'].includes(w.id);
  if(!['flame','minigun','smg','smg_heavy'].includes(w.id))addShake(heavyShake?(w.id==='rocket'?8:6):3);
  else if(w.id==='minigun')addShake(1.5);
  else addShake(1);
  const dx=toX-fx,dy=toY-fy,dist=Math.sqrt(dx*dx+dy*dy)||1;
  // ── v53 smg跑射精准：移动射击时其他武器弹道微抖±2°，smg系免疫 ──
  //    原版 noMovePenalty 是死字段——"跑射扫射"从未与站桩射击有区别。
  let moveSpread=0;
  if((keys.l||keys.r)&&player.onGround&&!(w.noMovePenalty)){
    moveSpread=(Math.random()-.5)*(4*Math.PI/180);  // ±2°
  }
  const aimBase=Math.atan2(dy,dx)+moveSpread;
  // ── 武器物理后坐力推背感（短管双喷/霰弹/火箭/狙击/电磁炮反冲与空中垂直冲力）──
  const kickForce = w.id === 'sawoff' ? 5.2 : w.id === 'shotgun' ? 2.8 : w.id === 'rocket' ? 4.5 : (w.id === 'sniper' || w.id === 'railgun') ? 2.4 : 0;
  if(kickForce > 0){
    player.vx -= Math.cos(aimBase) * kickForce;
    if(!player.onGround){
      // 空中开火垂直反作用力：火箭跳 / 霰弹空中悬浮滞空
      player.vy -= Math.sin(aimBase) * kickForce * (w.id === 'rocket' ? 1.65 : (w.id === 'sawoff' ? 1.1 : 0.85));
    }
  }
  // ── 冲锋枪跑射机动性激活 ──
  if(w.id === 'smg' || w.id === 'smg_heavy'){
    window._smgSprintT = 30;
  }
  const dxA=Math.cos(aimBase)*dist, dyA=Math.sin(aimBase)*dist;
  // 霰弹枪距离衰减：远距离伤害降低
  let dmgMult=1;
  if(w.rangeFalloff && dist>200){dmgMult=Math.max(0.3,1-(dist-200)/400);}
  if(w.spread){
    const base=aimBase,half=(w.spreadDeg*Math.PI/180)/2;
    for(let i=0;i<w.pellets;i++){const ang=base-half+(i/(w.pellets-1))*(w.spreadDeg*Math.PI/180);
    const b=mkBullet(fx,fy,Math.cos(ang)*w.speed,Math.sin(ang)*w.speed,w);
    b.dmg*=dmgMult; // 霰弹衰减
    // 霰弹击退
    if(w.traitKnockback){b.knockbackMult=w.traitKnockback;}
    }
    // ── 终极超武【地狱龙息炮】：留下大范围熔岩火海焦土 ──
    if(w.evoType === 'dragon_cannon'){
      if(!window._groundFires) window._groundFires = [];
      window._groundFires.push({ x: fx + Math.cos(aimBase) * 150, y: Z_TOP + 50, life: 360, dmg: 40, tickT: 30 });
      for(let k=0; k<10; k++){
        mkP({x:fx+Math.cos(aimBase)*120+(Math.random()-.5)*60, y:Z_TOP+45, vx:(Math.random()-.5)*3, vy:-2-Math.random()*3, r:3+Math.random()*3, rDecay:.05, decay:.04, color:Math.random()>.4?'#ff4400':'#ffaa00', type:'spark', grav:.05, alpha:1});
      }
    }
  }else if(['railgun','sniper','tesla'].includes(w.id)){
    const railColors={railgun:['#00eeff','#0055bb'],sniper:['#80ff80','#226622'],tesla:['#80ddff','#0066aa'],annihilator:['#ff4400','#660000']};
    const rc=railColors[w.id]||['#00eeff','#0055bb'];
    vfxRail(fx,fy,toX,toY,rc[0],rc[1]);
    const railDmg = getDamage(w.damage);
    const railWidth = w.id==='railgun' ? 60 : w.id==='annihilator' ? 55 : w.id==='sniper' ? 22 : 42;
    railHitscan(fx,fy,toX,toY,railDmg,railWidth);
    if(w.id==='railgun'){
      if(!window._ionizationTrails) window._ionizationTrails = [];
      window._ionizationTrails.push({x1:fx, y1:fy, x2:toX, y2:toY, life:24, maxLife:24, dmg:railDmg*0.35});
    }
    if(w.id==='tesla'&&w.chain){teslaChain(fx,fy,toX,toY,w.chain);}
    const b=mkBullet(fx,fy,(dx/dist)*w.speed,(dy/dist)*w.speed,w);b.cosmetic=true;
  }else{
    const b=mkBullet(fx,fy,(dxA/dist)*w.speed,(dyA/dist)*w.speed,w);if(w.grav)b.grav=true;
    // ── 小胡军备改造台：战术挂件穿透强化 ──
    if(typeof getWeaponMod === 'function'){
      const tacP = getWeaponMod(w.id, 'tactical');
      if(tacP > 0) b.pierceMax = (b.pierceMax || w.pierceCount || 1) + tacP;
    }
    // ── 终极超武【双生风暴狂徒】：发射双联平行子弹 + 金色高能曳光 ──
    if(w.evoType === 'dual_storm'){
      b.isDualStorm = true;
      const b2 = mkBullet(fx, fy - 6, (dxA/dist)*w.speed, (dyA/dist)*w.speed, w);
      b2.isDualStorm = true;
      b2.dmg = b.dmg;
    }
    // ── 终极超武【加特林风暴裁决】：连续扫射伴随追踪穿甲微型导弹 ──
    if(w.evoType === 'gatling_whirlwind'){
      w._burstN = (w._burstN || 0) + 1;
      if(w._burstN % 7 === 0){
        [-0.15, 0.15].forEach(angOff => {
          const mb = mkBullet(fx, fy, Math.cos(aimBase + angOff)*24, Math.sin(aimBase + angOff)*24, w);
          mb.isMicroMissile = true; mb.dmg *= 1.5; mb.aoe = 65; mb.grav = false;
        });
        spawnFloatText('🚀 微型飞弹!', fx, fy - 22, '#5be4ff');
      }
    }
    // ── 终极超武【天基轨道死光】：落点引动天基死光巨柱 ──
    if(w.evoType === 'orbital_death_ray'){
      vfxRail(toX, 0, toX, GROUND_Y, '#ffffff', '#66ff66');
      explodeLogic(toX, GROUND_Y - 30, getDamage(w.damage) * 1.5, 140);
      vfxExplosion(toX, GROUND_Y - 30, 140);
      addShake(8);
      spawnFloatText('🛰️ 天基轨道死光!', toX, GROUND_Y - 50, '#aaffaa');
    }
    // ── 战前特餐【极光霜冻排】：发射冰霜剑气与极寒冲击波 ──
    if(activeSignature && activeSignature.id === 'frost'){
      const pFacing = player.facingRight ? 1 : -1;
      bullets.push({
        id: bId++,
        x: fx, y: fy,
        vx: pFacing * 17, vy: 0,
        dmg: getDamage(26),
        piercing: true,
        maxRange: 650,
        active: true,
        wpn: 'tactical_frost',
        frost: true,
        frostDur: 150,
        frostFactor: 0.3,
        traitSlow: 0.3,
        isFrostWave: true,
        sx: player.x, sy: player.y
      });
    }
    // ── 战前特餐【龙息炙烤盛宴】：25%概率触发扇形地狱龙息焦土 ──
    if(activeSignature && activeSignature.id === 'dragon' && Math.random() < 0.25){
      const pFacing = player.facingRight ? 1 : -1;
      const dfX = player.x + CHAR_W/2;
      const dfY = player.y + CHAR_H/2;
      addShake(5);
      spawnFloatText('🐉 地狱龙息!', dfX, dfY - 35, '#ff8800');
      for(let d=0; d<15; d++){
        const ang = (player.facingRight?0:Math.PI) + (Math.random()-0.5)*0.6;
        const sp = 9 + Math.random()*8;
        mkP({x:dfX, y:dfY, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, r:5+Math.random()*6, rDecay:.08, decay:.04, color:Math.random()>.4?'#ff4400':'#ffaa00', type:'circle', alpha:0.9, grav:0.02});
      }
      zombies.forEach(z => {
        if(!z.alive) return;
        const zx = z.x + 22;
        const isFront = player.facingRight ? (zx >= dfX - 20) : (zx <= dfX + 20);
        if(isFront && Math.abs(zx - dfX) < 260 && Math.abs(z.y - dfY) < 90){
          hitZombie(z, zx, Z_TOP+28, getDamage(40), dfX, dfY);
          applyBurn(z);
          z.knockback = (z.knockback||0) + pFacing * 16;
        }
      });
    }
    if(w.id==='plasma'){
      b.isPlasmaOrb=true;
      b.plasmaRadius=22;
      b.plasmaTimer=0;
      b.maxRange=600;
    }
    if(w.id==='sonic'){
      b.isSonicWave=true;
      if(!window._sonicWaves) window._sonicWaves = [];
      window._sonicWaves.push({x:fx, y:fy, angle:aimBase, radius:15, maxRadius:320, speed:14, life:24, maxLife:24, dmg:b.dmg});
    }
    // ── v53十字弩蓄力：距上次射击的时间越长蓄力越满（拉弓储能的直觉映射）──
    if(w.id==='crossbow'){
      const chargeWin=200;
      const elapsed=window._xbowLastFire?(performance.now()-window._xbowLastFire):9999;
      if(elapsed>=chargeWin){b.dmg*=1.8;b.pierceMax=(w.pierceCount||4)+2;spawnFloatText('🏹 蓄力贯穿!',fx,fy-14,'#ffd890');}
    }
    // ── v53喷火器递增：层数放大持续射击的火流伤害（1×→3×）──
    if(w.rampUp&&window._flameRampStacks>=1){
      b.dmg*=window._flameRampStacks;
      if(window._flameRampStacks>=2.9&&!b._rampPing){b._rampPing=true;spawnFloatText('🔥火力全开×3!',fx,fy-20,'#ff8830');}
    }
  }
  // ═══ v53湮灭者真实弹道：穿透+引力奇点+点燃+超大AOE爆破 ═══
  if(w.id==='annihilator'){
    vfxRail(fx,fy,toX,toY,'#ff4400','#660000');
  }
  if(wAmmo[curWpnIdx]===0&&w.id!=='minigun'&&!w.noRefill)setTimeout(()=>{if(wAmmo[curWpnIdx]===0&&!isReloading)flashReloadHint();},100);
}
// 特斯拉链电：从落点跳到附近 N 个敌人（v53：每跳衰减读武器表 chainDecay，原硬编码0.6）
function teslaChain(x1,y1,x2,y2,chainCount){
  const targetList=(gameState==='building')?buildingInteriorZombies:zombies;
  const wDef=WEAPONS[curWpnIdx];
  const decay=(wDef&&wDef.chainDecay)?wDef.chainDecay:0.6;
  let cx=x2,cy=y2,hit=new Set(),mul=1;
  for(let c=0;c<chainCount;c++){
    let nearest=null,nd=180;
    targetList.forEach(z=>{if(!z.alive||hit.has(z))return;const d=Math.sqrt((z.x+22-cx)**2+((Z_TOP+28)-cy)**2);if(d<nd){nd=d;nearest=z;}});
    if(boss&&boss.alive&&gameState!=='building'){const d=Math.sqrt((boss.x+40-cx)**2+((GROUND_Y-80)-cy)**2);if(d<nd){nd=d;nearest={isBoss:true};}}
    if(!nearest)break;
    const chainDmg=getDamage((wDef?wDef.damage:10))*mul;
    if(nearest.isBoss){hitBoss(chainDmg,boss.x+40,GROUND_Y-80,cx,cy);}
    else{hit.add(nearest);hitZombie(nearest,nearest.x+22,Z_TOP+28,chainDmg,cx,cy);}
    mul*=decay;  // v53：链伤逐跳按武器衰减系数递减
    const nx=nearest.isBoss?boss.x+40:nearest.x+22, ny=nearest.isBoss?GROUND_Y-80:Z_TOP+28;
    // 链电视觉
    vfxSpriteAttack(cx,cy,nx,ny);
    cx=nx;cy=ny;
  }
}
const _bulletFreeList = [];
function recycleBullet(b){
  if(b && !b._pooled && _bulletFreeList.length < 500){
    b.active = false;
    b._pooled = true;
    _bulletFreeList.push(b);
  }
}
function mkBullet(x,y,vx,vy,w){
  let b = _bulletFreeList.pop();
  if(!b){
    b = {id:bId++};
  }else{
    b.id = bId++;
  }
  b._pooled = false;
  b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.active = true;
  b.dmg = getDamage(w.damage);
  b.piercing = !!w.piercing;
  b.grav = false;
  b.burn = !!w.burn;
  b.maxRange = w.maxRange||9999;
  b.sx = x; b.sy = y;
  b.wpn = w.id;
  // ── 双轴克制：按武器特性标注伤害类型（发射时写入，命中时读取）──
  b.dmgType = w.explosive ? 'explosive'
            : (w.tagClass==='tag-fire'||w.tagClass==='tag-elec'||w.burn) ? 'energy'
            : 'physical';
  // 重置可选特性字段，杜绝池化子弹属性残留污染
  b.frost = false;
  b.poison = false;
  b.aoe = 0;
  b.chain = 0;
  b.traitSlow = 0;
  b.traitStun = false;
  b.traitPull = false;
  b.burnGround = false;
  b._groundBurned = false;
  b.burnGroundT = 0;
  b.knockbackMult = 1;
  b.pierceMax = 0;
  b._pierceN = 0;
  b.rampDmg = false;
  b.isBoomerang = false;
  b.returning = false;
  b.returnTimer = 0;
  b.spin = 0;
  b.fromTower = false;
  b.cosmetic = false;
  b.sniperPierceArmor = false;
  b._rampPing = false;
  b._pierceHit = null;
  // 流派被动：爆破专家爆炸伤+30%
  if(playerClass && playerClass.id==='demolition' && b.dmgType==='explosive') b.dmg *= 1.3;
  // 行囊被动：废土野山椒——15%几率赋予子弹灼烧引燃特性
  if(typeof backpackInventory !== 'undefined' && backpackInventory.spice_wasteland > 0 && Math.random() < 0.15){
    b.burn = true;
  }
  // 新武器特殊字段
  if(w.frost)b.frost=true;
  if(w.poison)b.poison=true;
  if(w.aoe)b.aoe=w.aoe;
  if(w.chain)b.chain=w.chain;
  // 新增武器特性字段
  if(w.traitSlow)b.traitSlow=w.traitSlow;
  if(w.traitStun)b.traitStun=true;
  if(w.traitPull)b.traitPull=true;
  if(w.burnGround)b.burnGround=true;
  if(w.traitKnockback)b.knockbackMult=w.traitKnockback;
  // ── v53十字弩穿透限制：pierceCount 原死字段——箭矢最多贯穿4敌（原无限穿透）──
  if(w.id==='crossbow'&&(w.pierceCount||0)>0){b.pierceMax=w.pierceCount;b._pierceN=0;}
  if(w.rampUp){b.rampDmg=true;}  // v53：喷火递增弹标记（视觉用）
  // 回旋镖专属：飞行后自动返回
  if(w.id==='boomerang'){b.isBoomerang=true;b.returning=false;b.returnTimer=0;b.maxRange=400;b.spin=0;}
  // 肉鸽天赋：燃烧弹 25%/层几率点燃
  if(playerPerks.incendiary && Math.random()<playerPerks.incendiary*0.25) b.burn=true;
  // 肉鸽天赋：冰冷触感 子弹附带减速
  if(playerPerks.frostbite) b.frost=true;
  // ── v53流派觉醒：鹰眼（神射手）技能窗口内所有子弹全穿透 ──
  if(window._classSkillT>0 && playerClass && playerClass.id==='marksman'){
    b.piercing=true;
    if(Math.random()<.4)mkP({x,y,r:2,rDecay:.05,decay:.1,color:'#ffcc44',type:'circle',grav:0,alpha:.8,blur:true});
  }
  bullets.push(b);return b;
}
function railHitscan(x1,y1,x2,y2,dmg,radius){
  // v53武器去同质化：伤害/宽度由调用方传入（原版固定99+42——光束系5把枪实际同一把枪）
  const useDmg = (typeof dmg === 'number' && dmg > 0) ? dmg : 99;
  const R = (typeof radius === 'number' && radius > 0) ? radius : 42;
  const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1,nx=dx/len,ny=dy/len;
  const targetZombies = (gameState === 'building') ? buildingInteriorZombies : zombies;
  targetZombies.forEach(z=>{if(!z.alive)return;const ex=(z.x+22)-x1,ey=(Z_TOP+28)-y1;const proj=ex*nx+ey*ny;const px=ex-proj*nx,py=ey-proj*ny;if(Math.sqrt(px*px+py*py)<R&&proj>0)hitZombie(z,z.x+22,Z_TOP+28,useDmg,x1,y1);});
  if(gameState !== 'building' && boss&&boss.alive){const ex=(boss.x+40)-x1,ey=(GROUND_Y-80)-y1;const proj=ex*nx+ey*ny;const px=ex-proj*nx,py=ey-proj*ny;if(Math.sqrt(px*px+py*py)<R+18&&proj>0)hitBoss(useDmg,boss.x+40,GROUND_Y-80,x1,y1);}
}
function flashReloadHint(){rldBtn.style.background='rgba(229,89,79,.22)';rldBtn.style.borderColor='var(--danger)';setTimeout(()=>{rldBtn.style.background='';rldBtn.style.borderColor='';},300);}
function flashOverheatHint(){rldBtn.textContent='机枪过热';rldBtn.style.borderColor='var(--danger)';setTimeout(()=>{rldBtn.innerHTML='装填<span class="key">R</span>';rldBtn.style.borderColor='';},1000);}

