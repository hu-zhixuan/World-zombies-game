// ═══════════════════════════════════════════
// 玩家站在城墙上时获得防御加成（减伤+射程加成）
function checkCastleWallBonus(){
  if(gameState!=='world')return 0;
  // 站在围墙上方（x在墙附近且在平台上）
  if(player.x>LEFT_WALL_X-20&&player.x<RIGHT_WALL_X+20&&player.onGround){
    return 0.3; // 30%减伤
  }
  return 0;
}

// ═══════════════════════════════════════════
//  系统5: 旧小镇隐藏宝箱 + 随机事件
// ═══════════════════════════════════════════
let hiddenChests=[];
// 旧小镇每日刷新：每波清场后，旧小镇的宝箱和事件会重置（参考潜水员戴夫的"每日潜水"机制）
function initHiddenChests(){
  hiddenChests=[
    {x:1750,y:GROUND_Y-30,found:false,reward:'coins',amount:15,label:'💰'},
    {x:1820,y:GROUND_Y-30,found:false,reward:'wood',amount:3,label:'🪵'},
    {x:1950,y:GROUND_Y-30,found:false,reward:'ammo',amount:1,label:'📦'},
    {x:2020,y:GROUND_Y-30,found:false,reward:'scrap',amount:2,label:'⚙️'},
    {x:2150,y:GROUND_Y-30,found:false,reward:'medkit',amount:1,label:'💉'},
    {x:2250,y:GROUND_Y-30,found:false,reward:'coins',amount:25,label:'💰'},
    {x:2320,y:GROUND_Y-30,found:false,reward:'wood',amount:5,label:'🪵'},
    {x:2400,y:GROUND_Y-30,found:false,reward:'scrap',amount:3,label:'⚙️'},
    {x:2460,y:GROUND_Y-30,found:false,reward:'medkit',amount:1,label:'💉'},
  ];
}
// 每波刷新旧小镇资源（让旧小镇成为"每日探索"的目的地）
function refreshOldTownResources(){
  hiddenChests.forEach(c => c.found = false);
  oldTownEvents.forEach(ev => ev.triggered = false);
  // 旧小镇建筑搜刮状态也重置（诊所/军火库/安全屋的搜刮可重复）
  buildingInteriorLooted.clinic = false;
  buildingInteriorLooted.armory = false;
  buildingInteriorLooted.safehouse = false;
  buildingInteriorLooted.clinicPerk = false;
  buildingInteriorLooted.armoryTower = false;
  safehouseRestBoost = false;
  // 建筑清场状态重置（每波旧小镇僵尸重新刷）
  buildingInteriorCleared.clinic = false;
  buildingInteriorCleared.tavern = false;
  buildingInteriorCleared.armory = false;
  buildingInteriorCleared.safehouse = false;
  buildingInteriorCleared.cabin = true;
  addBanner('🗺️ 旧小镇资源已刷新！可再次探索搜刮');
}
function checkHiddenChests(){
  if(gameState!=='world')return;
  const px=player.x+CHAR_W/2;
  hiddenChests.forEach(c=>{
    if(c.found)return;
    if(Math.abs(px-c.x)<30){
      c.found=true;
      if(c.reward==='coins'){coins+=c.amount;updateCoinUI();spawnFloatText('💰+'+c.amount,c.x,c.y-15,'#f0c060');}
      else if(c.reward==='ammo'){const maxA=weaponMagSize(WEAPONS[curWpnIdx]);if(WEAPONS[curWpnIdx].id!=='minigun'){const addA=Math.ceil(maxA*0.5);wAmmo[curWpnIdx]=Math.min(maxA,(wAmmo[curWpnIdx]||0)+addA);updateAmmoUI();spawnFloatText('📦 弹药 +'+addA,c.x,c.y-15,'#ffcc60');}}
      else if(c.reward==='medkit'){health=Math.min(maxHp,health+30);updateHpUI();spawnFloatText('💉+30HP',c.x,c.y-15,'#2ecc71');}
      else if(c.reward==='scrap'){scrapMetal+=c.amount;updateCoinUI();spawnFloatText('⚙️+'+c.amount,c.x,c.y-15,'#b0c4de');}
      else if(c.reward==='wood'){woodPlanks+=c.amount;updateCoinUI();spawnFloatText('🪵+'+c.amount,c.x,c.y-15,'#d2b48c');}
      sndCoin();
      for(let i=0;i<10;i++){mkP({x:c.x,y:c.y,vx:(Math.random()-.5)*5,vy:-2-Math.random()*4,r:3+Math.random()*2,rDecay:.05,decay:.025,color:'#ffcc00',type:'spark',grav:.2,alpha:1});}
      mkP({x:c.x,y:c.y,r:5,rDecay:-1,decay:.08,color:'#ffcc00',type:'ring',alpha:.8,grav:0});
    }
  });
}
function drawHiddenChests(){
  hiddenChests.forEach(c=>{
    if(c.found)return;
    const sx=c.x-cameraX;
    if(sx<-20||sx>GW+20)return;
    ctx.save();ctx.translate(sx,c.y);
    const pulse=0.5+0.5*Math.sin(Date.now()*0.005+c.x);
    ctx.shadowBlur=8+pulse*4;ctx.shadowColor='#ffaa00';
    ctx.fillStyle='#8a6020';ctx.fillRect(-6,-5,12,10);
    ctx.fillStyle='#aa8030';ctx.fillRect(-6,-5,12,2);
    ctx.fillStyle='#5a4010';ctx.fillRect(-6,3,12,2);
    ctx.strokeStyle='#ffcc00';ctx.lineWidth=1;ctx.strokeRect(-6,-5,12,10);
    ctx.fillStyle='#ffcc00';ctx.fillRect(-1,-2,2,3);
    // 飘浮指示箭头
    ctx.globalAlpha=.5+pulse*.5;
    ctx.fillStyle='#ffcc00';ctx.beginPath();
    ctx.moveTo(0,-12);ctx.lineTo(-3,-8);ctx.lineTo(3,-8);ctx.closePath();ctx.fill();
    ctx.globalAlpha=1;
    ctx.shadowBlur=0;
    ctx.restore();
  });
}

// ── 旧小镇随机事件系统（多触发点）──
let oldTownEvents = [];
function initOldTownEvents(){
  oldTownEvents = [
    {x:1800,triggered:false},
    {x:2000,triggered:false},
    {x:2200,triggered:false},
    {x:2380,triggered:false},
  ];
}
function checkOldTownEvent(){
  if(gameState!=='world')return;
  oldTownEvents.forEach(ev=>{
    if(ev.triggered)return;
    if(Math.abs(player.x - ev.x) < 40){
      ev.triggered = true;
      triggerRandomOldTownEvent(ev.x);
    }
  });
}
function triggerRandomOldTownEvent(x){
  const r = Math.random();
  if(r < 0.20){
    // 幸存者商人：临时打折商店
    addBanner('👬 遇到流浪商人！获得30金币+木头');
    coins += 30; woodPlanks += 2; updateCoinUI(); sndCoin();
    spawnFloatText('💰30 🪵2', x, GROUND_Y-50, '#f0c060');
  } else if(r < 0.40){
    // 精英僵尸伏击
    addBanner('⚠ 精英僵尸伏击！');
    for(let i=0;i<3;i++) setTimeout(()=>{ spawnZombie(); }, i*400);
    addShake(4);
  } else if(r < 0.55){
    // 军用物资箱
    addBanner('📦 搜得战术弹药箱！');
    lootDrops.push(createLootItem(x, GROUND_Y-30, 'ammo_crate_item', 1));
  } else if(r < 0.70){
    // 补给箱
    addBanner('📦 发现补给箱！');
    lootDrops.push(createLootItem(x, GROUND_Y-30, 'medkit', 1));
    lootDrops.push(createLootItem(x+20, GROUND_Y-30, 'ammo', 1));
  } else if(r < 0.82){
    // 陷阱：地雷
    addBanner('💥 踩到地雷！-15HP');
    takeDamage(15); addShake(8); redFlash = 0.5;
    vfxExplosion(x, GROUND_Y-10);
  } else if(r < 0.92){
    // 废铁+木头大发现
    addBanner('⛏️ 发现资源堆！+4木头 +3废铁');
    woodPlanks += 4; scrapMetal += 3; updateCoinUI(); sndCoin();
    spawnFloatText('🪵4 ⚙️3', x, GROUND_Y-50, '#d2b48c');
  } else {
    // 稀有：旧小镇废墟深处搜刮（常规波次给珍贵战备物资，严禁像垃圾一样随便掉枪；仅在W12+高难决战前夕废墟最深处触发传说「湮灭者」）
    const annIdx = wpnIdxById('annihilator');
    if(wave>=12 && !window._annGranted && annIdx>=0){
      window._annGranted = true;
      addBanner('☄️ 废墟深处发现传说中的「湮灭者」！！');
      spawnWeaponCrate(x, GROUND_Y-30, annIdx);
      addShake(10); orangeFlash=.8;
    }else{
      addBanner('📦 发现高级战备密封箱！战术压缩弹药×2 + 超导磁暴核！');
      lootDrops.push(createLootItem(x - 10, GROUND_Y-30, 'ammo_crate_item', 2));
      lootDrops.push(createLootItem(x + 10, GROUND_Y-30, 'magnetic_core', 1));
      coins += 40; updateCoinUI(); sndCoin();
      spawnFloatText('📦 战备物资 💰+40', x, GROUND_Y-50, '#f0c060');
    }
    for(let i=0;i<12;i++){mkP({x:x,y:GROUND_Y-30,vx:(Math.random()-.5)*4,vy:-3-Math.random()*3,r:2,rDecay:.04,decay:.04,color:'#ffee44',type:'spark',grav:.18,alpha:1});}
  }
}

// ── 旧小镇特殊敌人：游荡者（比普通僵尸强3倍）──
let oldTownWanderers = [];
function spawnWanderer(x){
  const hp = 40 + wave * 8;
  const spd = 1.8 + wave * 0.05;
  oldTownWanderers.push({
    x, y: GROUND_Y - 58, hp, maxHp: hp, spd, alive: true,
    walkT: Math.random(), facingR: Math.random() < 0.5,
    hitFlash: 0, attackCd: 0, dir: Math.random() < 0.5 ? -1 : 1,
    changeDirT: 60 + Math.floor(Math.random() * 120),
  });
  addBanner('⚠ 游荡者出现！');
}
function updateWanderers(){
  if(gameState !== 'world') return;
  for(let i = oldTownWanderers.length - 1; i >= 0; i--){
    const w = oldTownWanderers[i];
    if(!w.alive){ oldTownWanderers.splice(i, 1); continue; }
    if(w.hitFlash > 0) w.hitFlash -= 0.08;
    w.changeDirT--;
    if(w.changeDirT <= 0){ w.dir *= -1; w.changeDirT = 60 + Math.floor(Math.random()*120); }
    w.x += w.dir * w.spd;
    w.facingR = w.dir > 0;
    w.walkT += 0.05;
    // 限制在旧小镇范围
    w.x = Math.max(1700, Math.min(2500, w.x));
    // 攻击玩家
    if(w.attackCd > 0) w.attackCd--;
    const pcx = player.x + CHAR_W/2;
    if(Math.abs(w.x + 22 - pcx) < 35 && player.iframes === 0 && w.attackCd <= 0){
      takeDamage(12);
      w.attackCd = 60;
      player.vx = (player.x < w.x) ? -8 : 8;
      player.vy = -5; player.onGround = false; player.iframes = 60;
      vfxPlayerHurt(player.x, player.y); sndPlayerHurt();
    }
  }
}
function drawWanderers(){
  oldTownWanderers.forEach(w=>{
    if(!w.alive) return;
    const sx = w.x - cameraX;
    if(sx < -40 || sx > GW + 40) return;
    ctx.save();
    ctx.translate(w.x + 22, Z_TOP + 58);
    if(!w.facingR) ctx.scale(-1, 1);
    if(w.hitFlash > 0) ctx.globalAlpha = 0.3 + 0.7 * (1 - w.hitFlash);
    ctx.translate(-22, -58);
    const legA = Math.sin(w.walkT * Math.PI * 2) * 28;
    // 阴影
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(22, 60, 14, 3, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
    // 腿（深色军用裤）
    ctx.fillStyle = '#2a2a20';
    [{ox:15,a:-legA},{ox:27,a:legA}].forEach(l=>{
      ctx.save(); ctx.translate(l.ox, 44); ctx.rotate(l.a * Math.PI/180);
      ctx.fillRect(-3, 0, 7, 14); ctx.fillStyle = '#1a1a10'; ctx.fillRect(-3, 12, 7, 4);
      ctx.restore(); ctx.fillStyle = '#2a2a20';
    });
    // 身体（破旧军大衣）
    ctx.fillStyle = '#3a3528'; ctx.fillRect(8, 18, 28, 26);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(8, 18, 3, 26);
    ctx.fillStyle = '#4a4538'; ctx.fillRect(8, 18, 28, 3);
    ctx.fillStyle = '#2a2518'; ctx.fillRect(20, 18, 2, 26); // 纽扣线
    // 手臂
    const ga = 30 + Math.sin(w.walkT * Math.PI * 2) * 18;
    ctx.save(); ctx.translate(8, 22); ctx.rotate(-ga * Math.PI/180);
    ctx.fillStyle = '#3a3528'; ctx.fillRect(0, -2, 12, 6);
    ctx.fillStyle = '#c89868'; ctx.fillRect(11, -3, 8, 6); // 手
    ctx.restore();
    ctx.save(); ctx.translate(34, 22); ctx.rotate(ga * Math.PI/180);
    ctx.fillStyle = '#3a3528'; ctx.fillRect(-12, -2, 12, 6);
    ctx.fillStyle = '#c89868'; ctx.fillRect(-19, -3, 8, 6);
    ctx.restore();
    // 头（戴兜帽）
    ctx.fillStyle = '#c89868'; ctx.fillRect(14, 0, 16, 14);
    ctx.fillStyle = '#2a2518'; ctx.fillRect(12, -4, 20, 10); // 兜帽
    ctx.fillStyle = '#1a1510'; ctx.fillRect(12, -4, 20, 3);
    // 眼睛（发光红眼）
    ctx.fillStyle = '#ff3333'; ctx.shadowBlur = 4; ctx.shadowColor = '#ff0000';
    ctx.fillRect(17, 5, 2, 2); ctx.fillRect(23, 5, 2, 2);
    ctx.shadowBlur = 0;
    // 嘴（狞笑）
    ctx.strokeStyle = '#1a0a06'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(21, 10, 3, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();
    // HP bar
    const bw = 36;
    ctx.fillStyle = '#1a0505'; ctx.fillRect(4, -10, bw, 4);
    ctx.fillStyle = w.hp/w.maxHp > .5 ? '#27ae60' : w.hp/w.maxHp > .25 ? '#f39c12' : '#c0392b';
    ctx.fillRect(4, -10, bw * Math.max(0, w.hp/w.maxHp), 4);
    ctx.strokeStyle = '#0a0505'; ctx.lineWidth = .5; ctx.strokeRect(4, -10, bw, 4);
    ctx.fillStyle = '#ff6644'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('游荡者 ' + Math.ceil(w.hp) + '/' + w.maxHp, 22, -12);
    ctx.restore();
  });
}
function hitWanderer(w, bx, by, dmg, fromX, fromY){
  if(!w.alive) return;
  w.hp -= dmg; w.hitFlash = 1;
  vfxHit(bx, by, fromX ?? bx-50, fromY ?? by);
  sndHit();
  if(w.hp <= 0){
    w.alive = false;
    vfxKill(w.x + 22, Z_TOP + 20);
    sndKill();
    coins += 15; updateCoinUI();
    spawnFloatText('+15💰', w.x + 22, Z_TOP - 10, '#f0c060');
    // 掉落
    if(Math.random() < 0.3) lootDrops.push(createLootItem(w.x + 22, GROUND_Y - 30, 'scrap', 2));
    if(Math.random() < 0.2) lootDrops.push(createLootItem(w.x + 22, GROUND_Y - 30, 'coin', 20));
  }
}

// ── 旧小镇特殊地标：废弃加油站（可爆炸）──
let gasStationExploded = false;
function checkGasStation(){
  if(gameState !== 'world' || gasStationExploded) return;
  // 加油站在 x=2100，如果被爆炸塔/手榴弹/火箭筒击中附近就引爆
  const gx = 2100;
  if(gx - cameraX < -60 || gx - cameraX > GW + 60) return;
  // 检查附近是否有爆炸
  for(const p of particles){
    if(p.color && (p.color.includes('255,136,0') || p.color.includes('#ff8800')) && Math.abs(p.x - gx) < 50){
      gasStationExploded = true;
      // 巨大爆炸
      vfxExplosion(gx, GROUND_Y - 30); vfxExplosion(gx + 30, GROUND_Y - 20); vfxExplosion(gx - 20, GROUND_Y - 40);
      sndExplosion(); addShake(20); orangeFlash = 1;
      // 范围伤害
      zombies.forEach(z => { if(z.alive && Math.abs(z.x + 22 - gx) < 150) hitZombie(z, z.x + 22, Z_TOP + 28, 30, gx, GROUND_Y - 30); });
      oldTownWanderers.forEach(w => { if(w.alive && Math.abs(w.x + 22 - gx) < 150) hitWanderer(w, w.x + 22, Z_TOP + 28, 30, gx, GROUND_Y - 30); });
      addBanner('⛽ 加油站爆炸！范围消灭所有附近敌人！');
      // 掉落奖励
      lootDrops.push(createLootItem(gx, GROUND_Y - 30, 'coin', 50));
      lootDrops.push(createLootItem(gx + 20, GROUND_Y - 30, 'scrap', 3));
      break;
    }
  }
}
function drawGasStation(){
  if(gameState !== 'world') return;
  const gx = 2100;
  const sx = gx - cameraX;
  if(sx < -80 || sx > GW + 80) return;
  if(gasStationExploded){
    // 废墟
    ctx.save();
    ctx.fillStyle = '#1a1010'; ctx.fillRect(sx - 25, GROUND_Y - 15, 50, 15);
    ctx.fillStyle = '#2a1810'; ctx.fillRect(sx - 20, GROUND_Y - 18, 40, 5);
    ctx.fillStyle = '#0a0606'; ctx.fillRect(sx - 15, GROUND_Y - 12, 8, 8);
    ctx.restore();
    return;
  }
  ctx.save();
  // 加油站主体
  ctx.fillStyle = '#3a3020'; ctx.fillRect(sx - 25, GROUND_Y - 50, 50, 50);
  ctx.fillStyle = '#4a4030'; ctx.fillRect(sx - 25, GROUND_Y - 50, 50, 4);
  ctx.fillStyle = '#2a2010'; ctx.fillRect(sx - 25, GROUND_Y - 8, 50, 8);
  // 顶部招牌
  ctx.fillStyle = '#cc4400'; ctx.fillRect(sx - 28, GROUND_Y - 58, 56, 10);
  ctx.fillStyle = '#ffaa00'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('⛽ FUEL', sx, GROUND_Y - 51);
  // 油泵
  ctx.fillStyle = '#555'; ctx.fillRect(sx - 35, GROUND_Y - 30, 8, 25);
  ctx.fillStyle = '#777'; ctx.fillRect(sx - 34, GROUND_Y - 28, 6, 3);
  ctx.fillStyle = '#555'; ctx.fillRect(sx + 27, GROUND_Y - 30, 8, 25);
  ctx.fillStyle = '#777'; ctx.fillRect(sx + 28, GROUND_Y - 28, 6, 3);
  // 危险标志
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
  ctx.fillStyle = `rgba(255,${100+pulse*80},0,${.6+pulse*.4})`;
  ctx.font = '12px sans-serif';
  ctx.fillText('⚠', sx, GROUND_Y - 65);
  ctx.restore();
}

// ── 旧小镇迷你Boss：堕落士兵（第8波后在旧小镇随机出现）──
let oldTownMiniBoss = null;
function maybeSpawnMiniBoss(){
  if(gameState !== 'world' || oldTownMiniBoss || wave < 8) return;
  if(player.x > 1800 && Math.random() < 0.001){
    spawnWanderer(2300); // 先生成一个游荡者作为前置
    oldTownMiniBoss = { spawned: true, hp: 200 + wave * 20, maxHp: 200 + wave * 20 };
    // 生成3个游荡者
    for(let i = 0; i < 3; i++) spawnWanderer(2250 + i * 40);
    addBanner('☠️ 旧小镇深处传来嘶吼...游荡者群出现！');
  }
}

// ═══════════════════════════════════════════
//  系统6: 武器合成系统 [已移除] —— 改为多样化武器特性
//  原合成系统鸡肋，现移除。武器多样性通过 WEAPONS 注册表的 trait 字段实现。
// ═══════════════════════════════════════════

