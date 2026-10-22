// ═══════════════════════════════════════════
//  VEHICLE
// ═══════════════════════════════════════════
function toggleVehicle() {
  if (!vehicle.exists) return;
  if (vehicle.entered) { exitVehicle(); return; }
  const dist = Math.abs((player.x + CHAR_W / 2) - (vehicle.x + 60));
  if (dist < 70) enterVehicle();
}
function enterVehicle() { vehicle.entered = true; setInteractPrompt(null); }
function exitVehicle() { vehicle.entered = false; player.x = vehicle.x + 60; player.y = CHAR_GY; }

function vehicleFire() {
  // Mounted gun fires automatically in updateVehicle
}
function updateVehicle(t) {
  if (!vehicle.exists) return;
  if (vehicle.entered) {
    if (keys.l) { vehicle.vx = -5.5; vehicle.facingR = false; }
    else if (keys.r) { vehicle.vx = 5.5; vehicle.facingR = true; }
    else vehicle.vx *= 0.78;
    vehicle.x += vehicle.vx;
    const maxVX = WORLD_W - 120;
    vehicle.x = Math.max(0, Math.min(maxVX, vehicle.x));
    player.x = vehicle.x + (vehicle.facingR ? 50 : 30);
    player.y = CHAR_GY;
    vehicle.turretAngle = Math.atan2(lastMY - (GROUND_Y - 30), lastMX - (vehicle.x + 78));
    if (Math.abs(vehicle.vx) > 1.5) {
      for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i]; if (!z.alive) continue;
        const zx = z.x + 22;
        if (zx > vehicle.x - 5 && zx < vehicle.x + 125) {
          z.hp -= 3; if (z.hp <= 0) killZombie(z, z.x + 22, Z_TOP + 30);
          else vfxHit(zx, Z_TOP + 30, vehicle.x + 60, Z_TOP + 30);
          mkP({ x: zx, y: GROUND_Y - 2, vx: (Math.random() - .5) * 5, vy: -(Math.random() * 3 + 2), r: 4 + Math.random() * 4, rDecay: .06, decay: .03, color: '#8a7030', type: 'shard', angle: Math.random() * Math.PI * 2, spin: .3, grav: .28, alpha: .9 });
        }
      }
    }
    if (boss && boss.alive && Math.abs(vehicle.vx) > 2) {
      const bx = boss.x + 40;
      if (bx > vehicle.x - 5 && bx < vehicle.x + 125) { boss.hp -= 1; boss.hitFlash = 1; addShake(4); }
    }
    vehicle.gunTimer = (vehicle.gunTimer || 0) + 1;
    if (vehicle.gunTimer >= 30) {
      vehicle.gunTimer = 0;
      const near = findNearestEnemy(vehicle.x + 78, GROUND_Y - 30, 400);
      if (near) {
        const tx = near.x, ty = near.y;
        const ang = Math.atan2(ty - (GROUND_Y - 30), tx - (vehicle.x + 78));
        vehicle.turretAngle = ang;
        const dx = tx - (vehicle.x + 78), dy = ty - (GROUND_Y - 30); const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const b = { x: vehicle.x + 78, y: GROUND_Y - 30, vx: (dx / dist) * 16, vy: (dy / dist) * 16, active: true, dmg: getDamage(2), piercing: false, grav: false, burn: false, maxRange: 600, sx: vehicle.x + 78, sy: GROUND_Y - 30, wpn: 'pistol', id: bId++ };
        bullets.push(b);
        vfxMuzzle(b.x, b.y, ang, 'pistol');
        addShake(2);
      }
    }
    if (Math.abs(vehicle.vx) > 1 && Math.random() < .3) {
      mkP({ x: vehicle.x + (vehicle.facingR ? 10 : 110), y: GROUND_Y - 2, vx: (Math.random() - .5) * .8, vy: -(Math.random() * .5 + .2), r: 2 + Math.random() * 3, rDecay: .04, decay: .025, color: 'rgba(120,100,50,.55)', type: 'circle', grav: -.003, alpha: .5 });
      sndVehicleEngine();
    }
  }
  if (vehicle.entered && bossActive && boss && boss.alive) {
    bossProjList.forEach(bp => {
      if (!bp.active) return;
      const vehRight = vehicle.x + 120, vehTop = GROUND_Y - 44;
      if (bp.x > vehicle.x && bp.x < vehRight && bp.y > vehTop && bp.y < GROUND_Y) {
        vehicle.hp -= 15; addShake(6); bp.active = false;
        if (vehicle.hp <= 0) {
          vfxExplosion(vehicle.x + 60, GROUND_Y - 22);
          vehicle.exists = false; vehicle.entered = false; player.x = 100; player.y = CHAR_GY;
          addBanner('⚠ 战车被摧毁！');
        }
      }
    });
  }
  if (vehicle.entered) {
    const vcx = vehicle.x + 60;
    const screenX = vcx - cameraX;
    const lead = vehicle.facingR ? GW * 0.58 : GW * 0.42;
    const dead = GW * 0.06;
    if (screenX > lead + dead) cameraX += (screenX - (lead + dead)) * 0.14;
    else if (screenX < lead - dead) cameraX -= ((lead - dead) - screenX) * 0.14;
    cameraX = Math.max(0, Math.min(cameraX, WORLD_W - GW));
    // 修复：塔防模式下结局只能由击败第3个Boss触发，开车到世界右端不再触发结局
    // （原逻辑 vehicle.x >= WORLD_W-200 会提前结束战斗，与塔防玩法冲突）
  }
}
//  BUILDING DUNGEON INTERIOR SYSTEM
// ═══════════════════════════════════════════
//  【基地防线与防御工事实体化渲染】
// ═══════════════════════════════════════════
function drawFortressInfrastructure(platTop){
  // 1. 后勤物资回收工坊 (cabinUpgrades.farm) 位于平台左侧 x=42
  const fLvl = (typeof cabinUpgrades !== 'undefined' && cabinUpgrades.farm) ? cabinUpgrades.farm : 0;
  if(fLvl > 0){
    ctx.save();
    const fx = 42;
    // 工坊地基与工作台面
    ctx.fillStyle = '#1e1610'; ctx.fillRect(fx - 24, platTop - 18, 48, 18);
    ctx.fillStyle = '#3a2818'; ctx.fillRect(fx - 22, platTop - 18, 44, 4);
    // 支撑木桩
    ctx.fillStyle = '#140e0a';
    ctx.fillRect(fx - 20, platTop - 14, 5, 14);
    ctx.fillRect(fx + 15, platTop - 14, 5, 14);

    if(fLvl === 1){
      // Lv.1: 木工作坊 (圆锯、原木堆、挂架工具)
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(fx - 18, platTop - 28, 16, 10);
      ctx.fillStyle = '#a06a38'; ctx.fillRect(fx - 16, platTop - 34, 12, 6);
      // 圆锯
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(fx + 6, platTop - 24, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(fx + 6, platTop - 24, 2.5, 0, Math.PI*2); ctx.fill();
      // 工具挂板
      ctx.fillStyle = '#22150a'; ctx.fillRect(fx + 14, platTop - 32, 8, 14);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(fx + 16, platTop - 28, 4, 2);
    } else if(fLvl === 2){
      // Lv.2: 蒸汽回收粉碎机 (烟囱冒烟、金属传送带、齿轮)
      ctx.fillStyle = '#334155'; ctx.fillRect(fx - 18, platTop - 32, 22, 14);
      ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1; ctx.strokeRect(fx - 18, platTop - 32, 22, 14);
      // 黄铜烟囱冒烟
      ctx.fillStyle = '#b45309'; ctx.fillRect(fx - 14, platTop - 44, 6, 12);
      ctx.fillStyle = '#78350f'; ctx.fillRect(fx - 16, platTop - 46, 10, 3);
      const smokeT = (frameT * 0.1) % 1;
      ctx.fillStyle = 'rgba(200,200,210,0.45)';
      ctx.beginPath(); ctx.arc(fx - 11, platTop - 50 - smokeT * 10, 3 + smokeT * 4, 0, Math.PI*2); ctx.fill();
      // 传送带与齿轮
      ctx.fillStyle = '#1e293b'; ctx.fillRect(fx + 5, platTop - 26, 16, 8);
      const spin = frameT * 0.08;
      ctx.save(); ctx.translate(fx + 13, platTop - 22); ctx.rotate(spin);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(-4, -1, 8, 2); ctx.fillRect(-1, -4, 2, 8);
      ctx.restore();
    } else {
      // Lv.3: 纳米自动化熔炉工坊 (熔岩炽热核心、焊接机械臂、黄金回收斗)
      ctx.fillStyle = '#0f172a'; ctx.fillRect(fx - 20, platTop - 38, 40, 20);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; ctx.strokeRect(fx - 20, platTop - 38, 40, 20);
      // 熔炉观察窗 (橙红炽热呼吸光)
      const glow = 0.6 + 0.4 * Math.sin(frameT * 0.12);
      ctx.fillStyle = `rgba(249, 115, 22, ${glow})`;
      ctx.shadowColor = '#f97316'; ctx.shadowBlur = 10;
      ctx.fillRect(fx - 12, platTop - 32, 12, 10);
      ctx.shadowBlur = 0;
      // 自动化机械臂
      const armA = Math.sin(frameT * 0.06) * 0.3;
      ctx.save(); ctx.translate(fx + 10, platTop - 34); ctx.rotate(armA);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, -8); ctx.lineTo(12, -2); ctx.stroke();
      // 焊接火花
      if(frameT % 4 === 0){
        ctx.fillStyle = '#ffd700'; ctx.fillRect(12, -2, 2, 2);
      }
      ctx.restore();
      // 黄金储料斗
      ctx.fillStyle = '#ffd700'; ctx.fillRect(fx + 8, platTop - 22, 10, 4);
    }
    // 工坊浮动标识牌
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(fx - 24, platTop - 46 - (fLvl===3?6:0), 48, 11);
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 0.8;
    ctx.strokeRect(fx - 24, platTop - 46 - (fLvl===3?6:0), 48, 11);
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 7.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⚙️ 后勤工坊 Lv.' + fLvl, fx, platTop - 38 - (fLvl===3?6:0));
    ctx.restore();
  }

  // 2. 高台战术军备补给架 (cabinUpgrades.supplier) 位于平台 x=240
  const sLvl = (typeof cabinUpgrades !== 'undefined' && cabinUpgrades.supplier) ? cabinUpgrades.supplier : 0;
  if(sLvl > 0){
    ctx.save();
    const sx2 = 240;
    // 钢架龙门底座
    ctx.fillStyle = '#1e293b'; ctx.fillRect(sx2 - 18, platTop - 6, 36, 6);
    ctx.fillStyle = '#475569';
    ctx.fillRect(sx2 - 16, platTop - 28, 4, 22);
    ctx.fillRect(sx2 + 12, platTop - 28, 4, 22);
    ctx.fillRect(sx2 - 18, platTop - 32, 36, 5); // 龙门横梁
    // 黄黑警戒斜纹
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(sx2 - 14, platTop - 31, 6, 3);
    ctx.fillRect(sx2 - 2, platTop - 31, 6, 3);
    ctx.fillRect(sx2 + 10, platTop - 31, 4, 3);

    // 双联军用墨绿战术弹药箱
    ctx.fillStyle = '#2e4a32'; ctx.fillRect(sx2 - 12, platTop - 20, 11, 14);
    ctx.fillStyle = '#3d6142'; ctx.fillRect(sx2 + 1, platTop - 20, 11, 14);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 0.8;
    ctx.strokeRect(sx2 - 12, platTop - 20, 11, 14); ctx.strokeRect(sx2 + 1, platTop - 20, 11, 14);
    // 弹药箱白色字样标记
    ctx.fillStyle = '#cbd5e1'; ctx.font = '5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('AMMO', sx2 - 6.5, platTop - 11);
    ctx.fillText('7.62', sx2 + 6.5, platTop - 11);

    if(sLvl >= 2){
      // 医疗急救加挂箱 (绿白十字)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx2 - 8, platTop - 26, 16, 6);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(sx2 - 2, platTop - 25, 4, 4);
      ctx.fillRect(sx2 - 1, platTop - 26, 2, 6);
      // 卫星通信小雷达
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx2 + 14, platTop - 36, 4, -0.6, 0.6); ctx.stroke();
    }

    // 状态指示灯 (有弹药绿闪，无弹药暗红)
    const hasAmmoSupply = (typeof cabinCrates !== 'undefined' && cabinCrates.ammoSpawned);
    ctx.fillStyle = hasAmmoSupply ? '#22c55e' : '#64748b';
    ctx.shadowColor = hasAmmoSupply ? '#22c55e' : 'transparent';
    ctx.shadowBlur = hasAmmoSupply ? 8 : 0;
    ctx.beginPath(); ctx.arc(sx2, platTop - 34, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // 浮动战备标识
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(sx2 - 24, platTop - 48, 48, 11);
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 0.8;
    ctx.strokeRect(sx2 - 24, platTop - 48, 48, 11);
    ctx.fillStyle = '#4ade80'; ctx.font = 'bold 7.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('📦 军备架 Lv.' + sLvl, sx2, platTop - 40);
    ctx.restore();
  }

  // 3. 高台鹰眼瞭望塔与防空雷达 (cabinUpgrades.watchtower) 位于平台右端靠近城墙 x=648
  const wLvl = (typeof cabinUpgrades !== 'undefined' && cabinUpgrades.watchtower) ? cabinUpgrades.watchtower : 0;
  if(wLvl > 0){
    ctx.save();
    const wx2 = 648;
    // 瞭望塔高耸桁架立柱
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(wx2 - 10, platTop); ctx.lineTo(wx2 - 5, platTop - 45);
    ctx.moveTo(wx2 + 10, platTop); ctx.lineTo(wx2 + 5, platTop - 45);
    ctx.stroke();
    // X型加固斜撑
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx2 - 9, platTop - 5); ctx.lineTo(wx2 + 7, platTop - 25);
    ctx.moveTo(wx2 + 9, platTop - 5); ctx.lineTo(wx2 - 7, platTop - 25);
    ctx.moveTo(wx2 - 7, platTop - 25); ctx.lineTo(wx2 + 5, platTop - 45);
    ctx.moveTo(wx2 + 7, platTop - 25); ctx.lineTo(wx2 - 5, platTop - 45);
    ctx.stroke();

    // 哨楼观察哨平台 (宽26，高14)
    ctx.fillStyle = '#1e293b'; ctx.fillRect(wx2 - 13, platTop - 53, 26, 8);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(wx2 - 15, platTop - 56, 30, 3);

    if(wLvl === 1){
      // Lv.1: 探照灯向下照射战场杀伤区
      const lightPulse = 0.5 + 0.2 * Math.sin(frameT * 0.08);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(wx2 - 4, platTop - 61, 8, 6);
      // 光锥照向右侧城门战场 (cone)
      const lCone = ctx.createLinearGradient(wx2, platTop - 58, wx2 + 80, GROUND_Y);
      lCone.addColorStop(0, `rgba(254, 240, 138, ${lightPulse * 0.6})`);
      lCone.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = lCone;
      ctx.beginPath();
      ctx.moveTo(wx2, platTop - 58);
      ctx.lineTo(wx2 + 90, GROUND_Y);
      ctx.lineTo(wx2 + 40, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    } else {
      // Lv.2: 旋转雷达预警电塔 + 红色激光测距扫描
      const rAngle = frameT * 0.05;
      ctx.save();
      ctx.translate(wx2, platTop - 60);
      ctx.rotate(rAngle);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(0, 0, 7, -Math.PI*0.4, Math.PI*0.4); ctx.stroke();
      ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // 红色激光扫描线投射至右侧战场
      const scanY = GROUND_Y - 30 + Math.sin(frameT * 0.05) * 20;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)'; ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(wx2 + 5, platTop - 58); ctx.lineTo(Math.min(WORLD_W, wx2 + 320), scanY); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 浮动标识牌
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(wx2 - 24, platTop - 70, 48, 11);
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 0.8;
    ctx.strokeRect(wx2 - 24, platTop - 70, 48, 11);
    ctx.fillStyle = '#7dd3fc'; ctx.font = 'bold 7.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🔭 瞭望哨 Lv.' + wLvl, wx2, platTop - 62);
    ctx.restore();
  }

  // 4. 花岗岩城垛要塞加固装甲 (cabinUpgrades.barricade) 沿平台顶面部署钢板与铁丝网
  const bLvl = (typeof cabinUpgrades !== 'undefined' && cabinUpgrades.barricade) ? cabinUpgrades.barricade : 0;
  if(bLvl > 0){
    ctx.save();
    // 沿城垛护栏装饰精钢螺栓铆接护板
    ctx.fillStyle = '#334155';
    for(let bx = 30; bx < RIGHT_WALL_X - 15; bx += 70){
      ctx.fillRect(bx, platTop - 4, 18, 4);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(bx + 3, platTop - 3, 2, 2);
      ctx.fillRect(bx + 13, platTop - 3, 2, 2);
      ctx.fillStyle = '#334155';
    }
    // 锋锐刺丝滚笼 (Razor wire coils)
    if(bLvl >= 2){
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
      for(let bx = 50; bx < RIGHT_WALL_X - 25; bx += 80){
        ctx.beginPath(); ctx.arc(bx, platTop - 6, 4, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - 3, platTop - 6); ctx.lineTo(bx + 3, platTop - 6); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════
function drawBuildings() {
  BUILDINGS.forEach(b => {
    const screenX = b.x - cameraX;
    if (screenX < -120 || screenX > GW + 120) return;
    const sx = b.x;
    // 家园建筑立在抬高的平台上，旧小镇建筑直接立在地面上
    const isHome = b.world === 'home';
    const baseY = isHome ? (GROUND_Y - HOME_PLATFORM_H) : GROUND_Y;  // 建筑底部y
    const top = baseY - 96;  // 建筑顶部y
    
    ctx.save();
    const platTop = baseY;  // 底部y（兼容原代码的 platTop 变量名）
    // 墙体（带竖向砖纹，立在平台上）
    ctx.fillStyle = '#18151f';
    ctx.fillRect(sx, top, b.w, 96);
    ctx.fillStyle = '#0f0d14';
    ctx.fillRect(sx, top, 4, 96);
    ctx.fillRect(sx + b.w - 4, top, 4, 96);
    ctx.fillRect(sx, platTop - 4, b.w, 4);  // 建筑底部贴平台顶
    // 砖纹横线
    ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=.8;
    for(let y=top+24;y<platTop;y+=24){ctx.beginPath();ctx.moveTo(sx+4,y);ctx.lineTo(sx+b.w-4,y);ctx.stroke();}
    // 砖纹竖线（错缝）
    ctx.strokeStyle='rgba(0,0,0,.2)';
    for(let y=top,row=0;y<platTop-4;y+=24,row++){
      const off=row%2?12:0;
      for(let x=sx+8+off;x<sx+b.w-8;x+=24){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+24);ctx.stroke();}
    }
    
    // 屋顶（按建筑类型差异化）
    const roofH=18;
    if(b.id==='cabin'){ 
      const fortLvl = (typeof cabinUpgrades !== 'undefined' && cabinUpgrades.fortify) ? cabinUpgrades.fortify : 0;
      if(fortLvl === 0){
        // Lv.0: 临时木屋前哨 (Rustic wooden cabin)
        ctx.fillStyle='#5a3a1e';
        ctx.beginPath();ctx.moveTo(sx-4,top);ctx.lineTo(sx+b.w/2,top-roofH);ctx.lineTo(sx+b.w+4,top);ctx.closePath();ctx.fill();
        ctx.fillStyle='#3a2410';ctx.fillRect(sx+b.w/2-3,top-roofH,6,roofH);
        // 烟囱+炊烟
        ctx.fillStyle='#2a2018';ctx.fillRect(sx+b.w-22,top-roofH-12,10,14);
        ctx.globalAlpha=.3;ctx.fillStyle='#aaa';
        ctx.beginPath();ctx.arc(sx+b.w-17,top-roofH-16,4,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=1;
      } else if(fortLvl === 1){
        // Lv.1: 精钢加固防空要塞 (Steel-reinforced bunker)
        ctx.fillStyle='#2b3544';
        ctx.fillRect(sx-4, top-roofH, b.w+8, roofH);
        ctx.fillStyle='#1e2736';
        ctx.fillRect(sx-4, top-roofH, b.w+8, 3);
        // 钢板铆钉
        ctx.fillStyle='#64748b';
        for(let rx=sx; rx<=sx+b.w; rx+=16){ ctx.fillRect(rx, top-roofH+6, 2.5, 2.5); }
        // 探照灯
        const lgt = 0.5 + 0.3*Math.sin(frameT*0.06);
        ctx.fillStyle=`rgba(255,240,160,${lgt})`;
        ctx.fillRect(sx+b.w-18, top-roofH-8, 10, 8);
        ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1; ctx.strokeRect(sx+b.w-18, top-roofH-8, 10, 8);
      } else if(fortLvl === 2){
        // Lv.2: 重装装甲指挥要塞 (Armored command fortress)
        ctx.fillStyle='#1a2332';
        ctx.fillRect(sx-6, top-roofH-4, b.w+12, roofH+4);
        ctx.fillStyle='#0f172a';
        ctx.fillRect(sx-6, top-roofH-4, b.w+12, 4);
        // 城垛凹凸
        ctx.fillStyle='#334155';
        for(let k=0; k<5; k++){ ctx.fillRect(sx-4+k*20, top-roofH-10, 12, 6); }
        // 通讯雷达旋转天线
        const rAng = frameT * 0.04;
        ctx.save();
        ctx.translate(sx+16, top-roofH-12);
        ctx.rotate(rAng);
        ctx.strokeStyle='#38bdf8'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0, 0, 8, -Math.PI*0.4, Math.PI*0.4); ctx.stroke();
        ctx.restore();
        // 蓝光科技信号标
        ctx.fillStyle='#38bdf8'; ctx.shadowColor='#38bdf8'; ctx.shadowBlur=8;
        ctx.fillRect(sx+b.w-20, top-roofH-12, 4, 8);
        ctx.shadowBlur=0;
      } else {
        // Lv.3: 宙斯盾终极防御核心 (Aegis bastion citadel)
        ctx.fillStyle='#0f172a';
        ctx.fillRect(sx-8, top-roofH-8, b.w+16, roofH+8);
        ctx.strokeStyle='#38bdf8'; ctx.lineWidth=1.5;
        ctx.strokeRect(sx-8, top-roofH-8, b.w+16, roofH+8);
        // 能量导管流动
        const flowP = (frameT * 0.1) % 1;
        const conduitGrad = ctx.createLinearGradient(sx, 0, sx+b.w, 0);
        conduitGrad.addColorStop(0, '#0284c7');
        conduitGrad.addColorStop(Math.min(1, Math.max(0, flowP)), '#38bdf8');
        conduitGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = conduitGrad;
        ctx.fillRect(sx-6, top-roofH+2, b.w+12, 3);
        // 顶端悬浮宙斯盾等离子力场护盾发生核
        const corePulse = 0.7 + 0.3 * Math.sin(frameT * 0.1);
        ctx.save();
        ctx.translate(sx+b.w/2, top-roofH-16);
        ctx.fillStyle='#38bdf8';
        ctx.shadowColor='#00f0ff'; ctx.shadowBlur=14 * corePulse;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 护盾微光环
        ctx.strokeStyle=`rgba(56, 189, 248, ${0.4 * corePulse})`;
        ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
    }else if(b.id==='clinic'){ // 诊所：平顶 + 红十字
      ctx.fillStyle='#6a1010';ctx.fillRect(sx-3,top-roofH,b.w+6,roofH);
      ctx.fillStyle='#5a0a0a';ctx.fillRect(sx-3,top-roofH,b.w+6,3);
      // 红十字标志
      ctx.fillStyle='#ff3333';ctx.shadowBlur=6;ctx.shadowColor='#ff0000';
      ctx.fillRect(sx+b.w/2-2,top-roofH/2-6,4,12);
      ctx.fillRect(sx+b.w/2-6,top-roofH/2-2,12,4);
      ctx.shadowBlur=0;
    }else if(b.id==='armory'){ // 军火库：铁皮平顶 + 警示条纹
      ctx.fillStyle='#3a4452';ctx.fillRect(sx-3,top-roofH,b.w+6,roofH);
      ctx.fillStyle='#2a323e';ctx.fillRect(sx-3,top-roofH,b.w+6,3);
      // 黄黑警示条
      for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#cc9900':'#1a1a1a';ctx.fillRect(sx+4+i*((b.w-8)/5),top-roofH+6,(b.w-8)/5-1,4);}
    }else if(b.id==='safehouse'){ // 安全屋：混凝土平顶 + 铁丝网
      ctx.fillStyle='#2a3548';ctx.fillRect(sx-3,top-roofH,b.w+6,roofH);
      ctx.fillStyle='#1a2538';ctx.fillRect(sx-3,top-roofH,b.w+6,3);
      ctx.strokeStyle='rgba(120,140,160,.4)';ctx.lineWidth=.6;
      for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(sx-3+i*8,top-roofH);ctx.lineTo(sx+b.w+3,top-roofH-4);ctx.stroke();}
    }else{ // tavern 营地：帐篷式斜顶
      ctx.fillStyle='#7a4a28';
      ctx.beginPath();ctx.moveTo(sx-4,top);ctx.lineTo(sx+b.w*0.35,top-roofH);ctx.lineTo(sx+b.w+4,top);ctx.closePath();ctx.fill();
      ctx.fillStyle='#5a3418';ctx.fillRect(sx-4,top,4,roofH+4);
    }
    
    // 破损细节：墙角裂缝
    ctx.strokeStyle='rgba(20,10,5,.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(sx+8,platTop-50);ctx.lineTo(sx+14,platTop-30);ctx.lineTo(sx+10,platTop-8);ctx.stroke();
    
    // 门
    ctx.fillStyle = b.color;
    ctx.fillRect(sx + b.w/2 - 14, platTop - 46, 28, 46);
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + b.w/2 - 14, platTop - 46, 28, 46);
    // 门把手
    ctx.fillStyle='#f0c060';ctx.fillRect(sx+b.w/2+6,platTop-24,3,3);
    
    // 窗户发光（呼吸效果）
    const winGlow=.12+.06*Math.sin(frameT*.03+b.x);
    ctx.fillStyle = `rgba(240,192,60,${winGlow})`;
    ctx.fillRect(sx + 10, top + 20, 18, 18);
    ctx.fillRect(sx + b.w - 28, top + 20, 18, 18);
    ctx.strokeStyle = '#251e12';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 10, top + 20, 18, 18);
    ctx.strokeRect(sx + b.w - 28, top + 20, 18, 18);
    // 窗格十字
    ctx.beginPath();ctx.moveTo(sx+19,top+20);ctx.lineTo(sx+19,top+38);ctx.moveTo(sx+10,top+29);ctx.lineTo(sx+28,top+29);ctx.stroke();
    ctx.beginPath();ctx.moveTo(sx+b.w-19,top+20);ctx.lineTo(sx+b.w-19,top+38);ctx.moveTo(sx+b.w-28,top+29);ctx.lineTo(sx+b.w-10,top+29);ctx.stroke();
    
    // 招牌
    ctx.fillStyle = '#221c28';
    ctx.fillRect(sx + b.w/2 - 38, top + 4, 76, 15);
    ctx.strokeStyle = '#f0c060';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(sx + b.w/2 - 38, top + 4, 76, 15);
    
    // 招牌文字
    ctx.fillStyle = '#f0c060';
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.icon + ' ' + b.name, sx + b.w/2, top + 15);
    
    // ── 基地要塞特殊标识（随 fortify 等级动态变化徽章与配色）──
    if(b.id==='cabin'){
      const fortLvl = (typeof cabinUpgrades !== 'undefined' && cabinUpgrades.fortify) ? cabinUpgrades.fortify : 0;
      const titleTxt = fortLvl === 0 ? '避难小屋' : fortLvl === 1 ? '防空要塞' : fortLvl === 2 ? '指挥堡垒' : '宙斯盾要塞';
      const borderCol = fortLvl <= 1 ? '#454c56' : '#f2a65a';
      const textCol = fortLvl <= 1 ? '#e8eaed' : '#f2a65a';
      ctx.save();
      ctx.fillStyle='rgba(12,13,15,.92)';ctx.fillRect(sx+b.w/2-34,top-30,68,16);
      ctx.strokeStyle=borderCol;ctx.lineWidth=1;ctx.strokeRect(sx+b.w/2-34,top-30,68,16);
      ctx.fillStyle=textCol;ctx.font='500 10px sans-serif';ctx.textAlign='center';
      ctx.fillText(titleTxt,sx+b.w/2,top-18.5);
      ctx.restore();
      // 窗户更暖更亮（区别于其他建筑，且随等级更璀璨）
      ctx.fillStyle=`rgba(255,220,120,${winGlow*(1.8 + fortLvl*0.4)})`;
      ctx.fillRect(sx+10,top+20,18,18);
      ctx.fillRect(sx+b.w-28,top+20,18,18);
      // 门框金色发光
      ctx.strokeStyle='#d8a85a';ctx.lineWidth=2;
      ctx.strokeRect(sx+b.w/2-14,platTop-46,28,46);
      ctx.shadowBlur=0;
      // ── 家园升级可视化：屋顶旁显示已建造的设施图标 ──
      const upgrades=[
        {lvl:cabinUpgrades.turret,icon:'🗼'},
        {lvl:cabinUpgrades.barricade,icon:'🪵'},
        {lvl:cabinUpgrades.supplier,icon:'📦'},
        {lvl:cabinUpgrades.fortify,icon:'🏰'},
        {lvl:cabinUpgrades.farm,icon:'🌾'},
        {lvl:cabinUpgrades.watchtower,icon:'🔭'},
      ];
      let iconX=sx-10;
      const iconY=top-14;
      upgrades.forEach(u=>{
        if(u.lvl>0){
          ctx.save();
          ctx.fillStyle='rgba(40,30,10,.8)';ctx.fillRect(iconX,iconY,16,16);
          ctx.strokeStyle='#ffd840';ctx.lineWidth=1;ctx.strokeRect(iconX,iconY,16,16);
          ctx.font='9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillText(u.icon,iconX+8,iconY+8);
          ctx.font='bold 7px sans-serif';ctx.fillStyle='#fff';
          ctx.fillText(u.lvl,iconX+13,iconY+4);
          ctx.restore();
          iconX+=18;
        }
      });
      // ── 基地防线实体化工程渲染（后勤工坊、战术军需架、鹰眼瞭望雷达塔、要塞装甲城垛）──
      drawFortressInfrastructure(platTop);
    }
    
    ctx.restore();
  });
}

function drawBarricade() {
  const screenX = 7000 - cameraX;
  if (screenX < -200 || screenX > GW + 200) return;
  const bx = 7000;
  
  const cleared = bossCount >= 2 && !bossActive;
  
  if (!cleared) {
    ctx.save();
    
    // Wrecked car shape 1
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(bx - 30, GROUND_Y - 45, 65, 45);
    ctx.fillStyle = '#34495e';
    ctx.fillRect(bx - 20, GROUND_Y - 40, 50, 20);
    // Wheels
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(bx - 15, GROUND_Y - 5, 8, 0, Math.PI*2);
    ctx.arc(bx + 20, GROUND_Y - 5, 8, 0, Math.PI*2);
    ctx.fill();
    
    // Barbed wire/fences surrounding it
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 2;
    for (let h = 0; h < 60; h += 15) {
      ctx.beginPath();
      ctx.moveTo(bx - 50, GROUND_Y - h);
      ctx.lineTo(bx + 50, GROUND_Y - h);
      ctx.stroke();
      // Draw cross wires
      for (let xOffset = -45; xOffset <= 45; xOffset += 15) {
        ctx.beginPath();
        ctx.moveTo(bx + xOffset - 5, GROUND_Y - h - 5);
        ctx.lineTo(bx + xOffset + 5, GROUND_Y - h + 5);
        ctx.moveTo(bx + xOffset + 5, GROUND_Y - h - 5);
        ctx.lineTo(bx + xOffset - 5, GROUND_Y - h + 5);
        ctx.stroke();
      }
    }
    
    // Danger Warning Sign post
    ctx.fillStyle = '#7e5109';
    ctx.fillRect(bx - 5, GROUND_Y - 80, 8, 35);
    ctx.fillStyle = '#c0392b'; // red plate
    ctx.fillRect(bx - 25, GROUND_Y - 80, 48, 20);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 25, GROUND_Y - 80, 48, 20);
    // Danger sign text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STOP ⛔', bx - 1, GROUND_Y - 72);
    ctx.font = '6px sans-serif';
    ctx.fillText('NO ENTRY', bx - 1, GROUND_Y - 63);
    
    ctx.restore();
  } else {
    ctx.save();
    
    // Scattered metallic shards
    ctx.fillStyle = '#34495e';
    ctx.fillRect(bx - 50, GROUND_Y - 8, 20, 8);
    ctx.fillRect(bx + 30, GROUND_Y - 6, 18, 6);
    
    // Rusty metal barrel lying down
    ctx.fillStyle = '#78281f';
    ctx.fillRect(bx - 15, GROUND_Y - 10, 25, 10);
    ctx.strokeStyle = '#511b15';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 15, GROUND_Y - 10, 25, 10);
    
    // Blown warning sign lying broken on the floor
    ctx.fillStyle = '#7e5109';
    ctx.fillRect(bx - 35, GROUND_Y - 4, 20, 4);
    ctx.fillStyle = '#7c2d12'; // broken red sign plate
    ctx.fillRect(bx - 45, GROUND_Y - 3, 14, 3);
    
    ctx.restore();
  }
}

function updateCabinTurret() {
  if (cabinUpgrades.turret <= 0 || gameState !== 'world') return;
  
  if (turretCooldown > 0) {
    turretCooldown--;
  }
  
  const turretX = 350;
  const turretY = PLATFORM_TOP - 16;
  
  let target = null;
  let minDist = 460;
  
  zombies.forEach(z => {
    if (!z.alive) return;
    const zx = z.x + 22;
    const zy = Z_TOP + 28;
    const dx = zx - turretX;
    const dy = zy - turretY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < minDist) {
      minDist = dist;
      target = z;
    }
  });
  
  if (bossActive && boss && boss.alive) {
    const bx = boss.x + 40;
    const by = GROUND_Y - 60;
    const dx = bx - turretX;
    const dy = by - turretY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < minDist) {
      minDist = dist;
      target = boss;
    }
  }
  
  if (target) {
    const tx = (target === boss) ? (target.x + 40) : (target.x + 22);
    const ty = (target === boss) ? (GROUND_Y - 60) : (Z_TOP + 28);
    const ang = Math.atan2(ty - turretY, tx - turretX);
    vehicle.cabinTurretAngle = ang;
    
    if (turretCooldown <= 0) {
      const level = cabinUpgrades.turret;
      turretCooldown = level === 1 ? 90 : (level === 2 ? 60 : 48);
      const dmg = level === 1 ? 1.5 : (level === 2 ? 2.5 : 3.0);
      
      sndShoot('pistol');
      
      if (level < 3) {
        const b = {
          x: turretX + Math.cos(ang) * 16,
          y: turretY + Math.sin(ang) * 16,
          vx: Math.cos(ang) * 14,
          vy: Math.sin(ang) * 14,
          active: true,
          dmg,
          piercing: false,
          grav: false,
          burn: false,
          maxRange: 400,
          sx: turretX,
          sy: turretY,
          wpn: 'turret'
        };
        bullets.push(b);
        vfxMuzzle(b.x, b.y, ang, 'pistol');
      } else {
        const offsets = [-0.12, 0.12];
        offsets.forEach(offset => {
          const a = ang + offset;
          const b = {
            x: turretX + Math.cos(a) * 16,
            y: turretY + Math.sin(a) * 16,
            vx: Math.cos(a) * 14,
            vy: Math.sin(a) * 14,
            active: true,
            dmg,
            piercing: false,
            grav: false,
            burn: false,
            maxRange: 400,
            sx: turretX,
            sy: turretY,
            wpn: 'turret'
          };
          bullets.push(b);
          vfxMuzzle(b.x, b.y, a, 'pistol');
        });
      }
      addShake(1.5);
    }
  } else {
    if (vehicle.cabinTurretAngle === undefined) vehicle.cabinTurretAngle = -Math.PI / 4;
    const diff = -Math.PI / 6 - vehicle.cabinTurretAngle;
    vehicle.cabinTurretAngle += diff * 0.03;
  }
}

function drawCabinTurret() {
  if (cabinUpgrades.turret <= 0 || gameState !== 'world') return;
  
  if (350 - cameraX < -60 || 350 - cameraX > GW + 60) return;
  const turretX = 350;
  const turretY = PLATFORM_TOP - 16;
  const ang = vehicle.cabinTurretAngle !== undefined ? vehicle.cabinTurretAngle : -Math.PI / 4;
  const lvl = cabinUpgrades.turret || 1;
  
  ctx.save();
  ctx.translate(turretX, turretY);
  
  // ── 重型近防炮台基座 ──
  ctx.fillStyle = '#161d26';
  ctx.fillRect(-18, 16, 36, 18);
  ctx.fillStyle = '#2b3648';
  ctx.fillRect(-16, 18, 32, 3);
  // 旋转液压伺服主轴
  ctx.fillStyle = '#374151';
  ctx.fillRect(-8, 2, 16, 16);
  
  // 伺服旋转球形装甲核心
  ctx.fillStyle = lvl >= 3 ? '#1e293b' : '#334155';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lvl >= 3 ? '#00f0ff' : '#64748b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.save();
  ctx.rotate(ang);
  
  if(lvl === 1){
    // Lv.1: 重型单管近防高射炮
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, -4, 26, 8);
    ctx.fillStyle = '#475569';
    ctx.fillRect(6, -5, 14, 2);
    ctx.fillRect(6, 3, 14, 2);
    // 枪口大型十字制退消焰器
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(22, -6, 5, 12);
  } else if(lvl === 2){
    // Lv.2: 双联装火神密集阵炮 (Twin Vulcan CIWS)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, -7, 28, 5); // 上管
    ctx.fillRect(0, 2, 28, 5);  // 下管
    // 中间供弹与散热鳍片
    ctx.fillStyle = '#64748b';
    ctx.fillRect(4, -2, 18, 4);
    // 侧装双弹鼓
    ctx.fillStyle = '#334155';
    ctx.fillRect(-3, -11, 8, 4);
    ctx.fillRect(-3, 7, 8, 4);
    // 枪口消焰器
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(26, -8, 4, 7);
    ctx.fillRect(26, 1, 4, 7);
    // 瞄准激光红线
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(130, 0); ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // Lv.3: 磁轨等离子终极重炮 (Magnetic Plasma Rail-cannon)
    // 重型双导轨
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, -8, 34, 6);
    ctx.fillRect(0, 2, 34, 6);
    // 导轨间充能电枢（发光青色等离子束）
    const plasmaP = 0.6 + 0.4 * Math.sin(frameT * 0.2);
    ctx.fillStyle = `rgba(0, 240, 255, ${plasmaP})`;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillRect(4, -2, 26, 4);
    ctx.shadowBlur = 0;
    // 导轨加强装甲外壳
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(6, -10, 16, 2);
    ctx.fillRect(6, 8, 16, 2);
    // 枪口磁极环
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(30, -9, 5, 18);
    // 充能瞄准激光
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(35, 0); ctx.lineTo(180, 0); ctx.stroke();
  }
  ctx.restore();
  
  ctx.restore();
}

// 手机上交互键下面的文字：去掉 emoji / 括号 / 说明，只留一个动词（最多 4 个字）
function actLabelFrom(text){
  let t = String(text).replace(/\[[^\]]*\]/g, '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
  t = t.split(/[（(—：:·]/)[0].trim().split(/\s+/)[0];
  return t ? t.slice(0, 4) : '交互';
}

function setInteractPrompt(text) {
  const btn = document.getElementById('btn-vehicle');
  const label = document.getElementById('act-label');
  if (text) {
    vehiclePrompt.style.display = 'block';
    // 手机上没有键盘，提示里的 [E] 之类的按键说明没意义
    vehiclePrompt.textContent = isPhoneUI() ? String(text).replace(/\[[^\]]*\]/g, '').trim() : text;
    // 只有真正能按 E 做点什么的提示才点亮交互键；"门锁着""向左撤回"之类只是信息，不亮
    const actionable = /\[\s*(长按\s*)?E\s*\]/.test(text) || /正在闭锁/.test(text);
    if (isMobile() && btn) {
      if (actionable) {
        btn.style.display = 'flex';
        let lbl;
        if (/正在闭锁/.test(text)) lbl = '闭锁中';
        else if ((isHordeThreatActive() || wavePhase === 'cleared') && gameState === 'world' && /小屋/.test(text)) lbl = wavePhase === 'cleared' ? '进小屋' : '长按闭锁';
        else lbl = actLabelFrom(text);
        if (label) label.textContent = lbl;
      } else {
        btn.style.display = 'none';
      }
    }
  } else {
    vehiclePrompt.style.display = 'none';
    if (isMobile() && btn) btn.style.display = 'none';
  }
}

function updateInteractionPrompt() {
  if (gameState === 'building') {
    const px = player.x + CHAR_W/2;
    const bId = activeBuilding.id;
    const cleared = buildingInteriorCleared[bId];
    
    if (px < 70) {
      setInteractPrompt(buildingReturnState === 'hub' ? '[ E ] 返回避难所据点 🚪' : `[ E ] 离开 ${activeBuilding.name}`);
      return;
    }
    
    if (cleared) {
      if (bId === 'clinic') {
        if (Math.abs(px - 200) < 40 && !buildingInteriorLooted.clinicPerk) {
          setInteractPrompt('[ E ] 临床试验（注入强力肉鸽天赋）');
          return;
        }
        if (Math.abs(px - 400) < 50 && !buildingInteriorLooted.clinic) {
          setInteractPrompt('[ E ] 搜刮战地医疗箱 (急救包×2/肾上腺素/提升最大生命值)');
          return;
        }
        if (Math.abs(px - 600) < 40 && !buildingInteriorLooted.clinicBox2) {
          setInteractPrompt('[ E ] 救治伤员与搜刮应急药箱 (💰50 + 强效肾上腺素泵)');
          return;
        }
      }
      if (bId === 'armory') {
        if (Math.abs(px - 200) < 40 && !buildingInteriorLooted.armoryTower) {
          setInteractPrompt('[ E ] 城堡防御全景蓝图 (防御塔上限+1 / 赠送防线)');
          return;
        }
        if (Math.abs(px - 320) < 45) {
          setInteractPrompt('[ E ] 武器配件改装工作台 (+10%伤害)');
          return;
        }
        if (Math.abs(px - 400) < 50 && !buildingInteriorLooted.armory) {
          setInteractPrompt('[ E ] 搜刮军备箱 (弹药盒×2/超导磁暴核/全武器强化)');
          return;
        }
      }
      if (bId === 'tavern') {
        const activeCompCount = hiredCompanions.length;
        const hasSniper = hiredCompanions.some(c => c.type === 'sniper');
        const hasMedic = hiredCompanions.some(c => c.type === 'medic');
        const hasGunner = hiredCompanions.some(c => c.type === 'gunner');
        
        if (Math.abs(px - 250) < 40 && !hasSniper && activeCompCount < 2) {
          setInteractPrompt('[ E ] 招募 狙击手阿强 (💰60)');
          return;
        }
        if (Math.abs(px - 400) < 40 && !hasMedic && activeCompCount < 2) {
          setInteractPrompt('[ E ] 招募 医疗兵小丽 (💰50)');
          return;
        }
        if (Math.abs(px - 550) < 40 && !hasGunner && activeCompCount < 2) {
          setInteractPrompt('[ E ] 招募 机枪手大壮 (💰70)');
          return;
        }
        if (Math.abs(px - 680) < 50 && !buildingInteriorLooted.tavernFood) {
          setInteractPrompt('[ E ] 搜刮末日食材冷柜 (霜降厚肉/异化基因肉/秘制调料)');
          return;
        }
      }
      if (bId === 'safehouse') {
        if (Math.abs(px - 260) < 40 && !safehouseRestUsed) {
          setInteractPrompt('[ E ] 躺下休息 (+20 HP)');
          return;
        }
        if (Math.abs(px - 440) < 40 && !safehouseCraftUsed && hasWeaponId('grenade')) {
          setInteractPrompt('[ E ] 制作手榴弹 (+2备弹)');
          return;
        }
        if (Math.abs(px - 600) < 40 && !damageBuffActive) {
          setInteractPrompt('[ E ] 喝伏特加 (💰30，下波伤害+30%)');
          return;
        }
      }
      if (bId === 'cabin') {
        if (Math.abs(px - 280) < 40) {
          setInteractPrompt('[ E ] 在舒适的大床上休息 (回满生命值)');
          return;
        }
        if (Math.abs(px - 450) < 40) {
          setInteractPrompt('[ E ] 打开避难所升级蓝图');
          return;
        }
        if (Math.abs(px - 620) < 40) {
          if ((cabinUpgrades.supplier >= 1 && cabinCrates.ammoSpawned) || (cabinUpgrades.supplier >= 2 && cabinCrates.medkitSpawned)) {
            setInteractPrompt('[ E ] 收集备用补给');
          } else {
            setInteractPrompt('补给架 (等待下一波生成)');
          }
          return;
        }
      }
    }
    setInteractPrompt(null);
    return;
  }
  
  if (vehicle.entered) {
    setInteractPrompt(null);
    return;
  }
  // 战场求救者就在身边：显示「救人」，手机上会点亮 E 按钮
  if (gameState === 'world') {
    const nearSurv = fieldSurvivors.find(sv => sv.state === 'waiting' && sv.near);
    if (nearSurv) { setInteractPrompt('[ E ] 救人：' + nearSurv.persona.name); return; }
  }
  // 优先：附近有武器宝箱 → 显示拾取提示（任何阶段都显示）
  const nearCrate = findNearbyWeaponCrate();
  if(nearCrate){
    const wpn = nearCrate.value>=0 && WEAPONS[nearCrate.value] ? WEAPONS[nearCrate.value] : null;
    setInteractPrompt(wpn ? `[ E ] 拾取 ${wpn.icon} ${wpn.name}` : '[ E ] 拾取战备军火箱');
    return;
  }
  // ── 优先：尸潮迫退与波次清场长按进小屋逻辑 ──
  if ((isHordeThreatActive() || wavePhase === 'cleared') && gameState === 'world') {
    const nearCabin = isPlayerNearCabin();
    if (cabinHoldActive) {
      const secs = ((CABIN_HOLD_MAX - cabinHoldTimer) / 60).toFixed(1);
      setInteractPrompt(`🚪 正在闭锁入屋... ${secs}s (持续按住勿放!)`);
    } else if (nearCabin) {
      if (wavePhase === 'cleared') {
        setInteractPrompt('🚪 [ E ] 进入避难所小屋据点');
      } else {
        setInteractPrompt('🚪 [ 长按 E ] 紧急闭锁入屋避难');
      }
    } else {
      const cabinCenter = 165;
      const dist = Math.round(Math.abs(player.x + CHAR_W/2 - cabinCenter));
      if(isHordeThreatActive()){
        setInteractPrompt(`🏃 尸潮压境！快向左撤回小屋门前避难 (${dist}px)`);
      } else {
        setInteractPrompt(`🏠 波次已清场，向左撤回小屋据点 (${dist}px)`);
      }
    }
    updateEmergencyRetreatPrompt();
    return;
  }
  const nearB = getNearbyBuilding();
  if (nearB) {
    if(nearB.id === 'cabin'){
      if(wavePhase === 'spawning'){
        setInteractPrompt('🔒 小屋门锁着 · 清完这波再进');
      } else if(wavePhase === 'boss'){
        setInteractPrompt('🔒 小屋门锁着（Boss战中）');
      } else if(wavePhase === 'cleared'){
        setInteractPrompt('🚪 [ E ] 进入避难所小屋据点');
      } else if(isHordeThreatActive()){
        setInteractPrompt('🚪 [ 长按 E ] 紧急闭锁入屋避难');
      } else {
        setInteractPrompt('🔒 小屋门紧锁');
      }
    } else {
      setInteractPrompt(`[ E ] 进入 ${nearB.name}`);
    }
    return;
  }
  if (gameState === 'world' && !cinActive && player.y <= PLATFORM_TOP + 14) {
    const px = player.x + CHAR_W/2;
    const bases = (typeof FORTRESS_BASE_SLOTS !== 'undefined') ? FORTRESS_BASE_SLOTS : [170, 310, 450, 590];
    const nearSlot = bases.find(bx => Math.abs(px - bx) < 38);
    if(nearSlot && !towers.some(t => Math.abs(t.x - nearSlot) < 25)){
      setInteractPrompt('🏗️ [ E ] 建造基地防御工事与哨塔');
      return;
    }
  }
  if (vehicle.exists) {
    const dist = Math.abs((player.x + CHAR_W/2) - (vehicle.x + 60));
    if (dist < 70) {
      setInteractPrompt('[ E ] 乘坐战车');
      return;
    }
  }
  setInteractPrompt(null);
}

function enterBuilding(b) {
  forceDismissAllOverlays();
  resetInputAndInteractionState();
  buildingOldWorldX = player.x;
  gameState = 'building';
  activeBuilding = b;
  scoutView=false;  // 进入建筑时关闭侦察视角
  cameraX = 0; // 室内固定视角，立即清零避免第一帧残留世界偏移
  
  bullets = [];
  particles.length = 0;
  lootDrops = [];
  
  player.x = 80;
  player.y = CHAR_GY;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  
  buildingInteriorZombies = [];
  if (!buildingInteriorCleared[b.id]) {
    const count = 3 + Math.floor(wave / 4);
    for (let i = 0; i < count; i++) {
      const zx = 300 + i * 120 + Math.random() * 50;
      let elite = 0;
      if (wave >= 2 && Math.random() < 0.2) {
        elite = Math.floor(Math.random() * 4) + 1;
      }
      
      const td = ZTYPES[Math.floor(Math.random() * ZTYPES.length)];
      const hp = (td.hp + Math.floor(wave / 3)) * (elite ? 2 : 1);
      const spd = td.speed * (1 + (wave - 1) * 0.08);
      
      const z = {
        x: zx, hp, maxHp: hp, spd, alive: true, type: td.type,
        pts: td.pts * (elite ? 2 : 1), coinReward: (td.coins + (elite ? 8 : 0)),
        walkT: Math.random(), facingR: false, hitFlash: 0, burnTimer: null, burning: false,
        elite, state: 'idle', stateTimer: 0, shieldFlash: 0, floatOffset: 0
      };
      buildingInteriorZombies.push(z);
    }
  }
  
  sndReload();
  addBanner(`☣ 探索建筑物：${b.name}`);
}

function exitBuilding() {
  forceDismissAllOverlays();
  resetInputAndInteractionState();
  if (!activeBuilding) return;
  bullets = [];
  bossProjList = [];
  particles.length = 0;
  lootDrops = [];
  buildingInteriorZombies = [];
  sndReload();

  if (buildingReturnState === 'hub') {
    buildingReturnState = null;
    activeBuilding = null;
    enterHub();
    addBanner('🚚 远征探险圆满归来！所有搜刮战利品已直接入库行囊！');
    if (typeof playTransition === 'function') {
      playTransition('night-day', '远征归来', '满载战利品安全撤回避难所据点', '🏠', null, 1000);
    }
  } else {
    player.x = buildingOldWorldX;
    player.y = CHAR_GY;
    player.vx = 0; player.vy = 0;
    const lead = player.facingRight ? GW*0.55 : GW*0.45;
    cameraX = Math.max(0, Math.min(WORLD_W - GW, player.x - lead));
    gameState = 'world';
    activeBuilding = null;
  }
}

function triggerInteriorInteraction() {
  const px = player.x + CHAR_W/2;
  const bId = activeBuilding.id;
  
  if (px < 70) {
    exitBuilding();
    return;
  }
  
  if (!buildingInteriorCleared[bId]) return;
  
  // 诊所新增：肉鸽天赋注入（px≈200）
  if (bId === 'clinic' && Math.abs(px - 200) < 40 && !buildingInteriorLooted.clinicPerk) {
    buildingInteriorLooted.clinicPerk = true;
    const pool = PERKS.filter(p=>(playerPerks[p.id]||0)<p.max);
    if(pool.length>0){
      const p = pool[Math.floor(Math.random()*pool.length)];
      playerPerks[p.id] = (playerPerks[p.id]||0)+1;
      addItemToBackpack('medkit_spec', 1, true);
      addBanner(`💉 临床试验！获得「${p.name}」天赋！${p.desc}`);
      spawnFloatText(p.icon+' '+p.name, 200, Z_TOP-20, '#ff44ff');
      sndWave();
    }else{addBanner('💉 所有天赋已满级！');}
  }
  if (bId === 'clinic' && !buildingInteriorLooted.clinic) {
    if (Math.abs(px - 400) < 50) {
      buildingInteriorLooted.clinic = true;
      health = maxHp;
      addItemToBackpack('medkit_spec', 3, true);
      
      const r = Math.random() < 0.5;
      if (r && upgrades.maxHp < 5) {
        upgrades.maxHp++;
        maxHp += 20;
        health = maxHp;
        addBanner("🏥 搜刮成功！获得战地急救包×3，最大生命值提升 +20 HP！");
      } else if (upgrades.clinicArmor < 5) {
        upgrades.clinicArmor++;
        addBanner("🏥 搜刮成功！获得战地急救包×3，外科防弹护甲强化 (+10% 减伤)！");
      } else {
        addBanner("🏥 搜刮成功！获得战地急救包×3，生命值回满！");
      }
      updateHpUI();
      sndHeal();
      spawnFloatText("Looted! 💉", 400, Z_TOP - 20, '#2ecc71');
    }
  }
  // 诊所新增：救治伤员与搜刮应急药箱（px≈600）
  if (bId === 'clinic' && Math.abs(px - 600) < 40 && !buildingInteriorLooted.clinicBox2) {
    buildingInteriorLooted.clinicBox2 = true;
    coins += 50; updateCoinUI();
    addItemToBackpack('medkit_spec', 2, true);
    addBanner("🏥 救治伤员与搜刮应急药箱成功！获得战地急救包×2 + 💰50金币！");
    sndCoin();
    spawnFloatText("+50金 💉", 600, Z_TOP - 20, '#2ecc71');
  }
  
  // 军火库新增：塔防强化（px≈200）—— 免费围墙升级+送塔+特种合金废铁
  if (bId === 'armory' && Math.abs(px - 200) < 40 && !buildingInteriorLooted.armoryTower) {
    buildingInteriorLooted.armoryTower = true;
    addItemToBackpack('scrap', 4, true);
    if(wallLevel<3){upgradeWall(true);addBanner('🛠️ 军火工坊战备构件已获取，赠送围墙升级！');}
    else{coins+=40;updateCoinUI();addBanner('🛠️ 战备构件已获取，围墙已满赠送40金币！');}
    const freeTowers=['turret','freeze','cannon','tesla','repair'];
    const ft=freeTowers[Math.floor(Math.random()*freeTowers.length)];
    // 城堡塔防制（v47回退）：在平台上找空位放赠送的塔
    if(towers.length<getTowerMaxCount()){
      const slot=findNearestEmptySlot(400);
      if(slot.slotIdx>=0){
        towers.push({x:slot.slotX,y:PLATFORM_TOP-40,level:1,cooldown:0,angle:-Math.PI/4,type:ft,recoil:0,slotIdx:0});
        addBanner(`🛠️ 附赠一座「${TOWER_TYPES[ft].name}」！`);
      }
    }
    spawnFloatText('SCRAP! ⚙️', 200, Z_TOP-20, '#ffaa00');
  }
  if (bId === 'armory' && !buildingInteriorLooted.armory) {
    if (Math.abs(px - 400) < 50) {
      buildingInteriorLooted.armory = true;
      addItemToBackpack('ammo_crate_item', 2, true);
      addItemToBackpack('wood', 4, true);
      wAmmo = WEAPONS.map(w => Math.floor(w.maxAmmo * (1 + upgrades.ammo * 0.5)));
      updateAmmoUI();
      refreshWBar();
      
      const r = Math.random() < 0.5;
      if (r && upgrades.armoryAmmo < 3) {
        upgrades.armoryAmmo++;
        upgrades.ammo++;
        rebuildAmmo();
        addBanner("🛠️ 搜刮成功！获得弹药盒×2、磁暴核×1，弹药装量永久扩增 +50%！");
      } else if (getMinigun() && ownedWeaponsSet.has(minigunIdx()) && upgrades.armoryCooling < 1) {
        upgrades.armoryCooling = 1;
        addBanner("🛠️ 搜刮成功！获得弹药盒×2、磁暴核×1，重机枪水冷消散散热阀已安装！");
      } else if (upgrades.armoryDamageBoost < 3) {
        // 枪械改装：全武器伤害永久 +15%（3层上限）。修复前该分支不存在，armoryDamageBoost 恒为 0/false
        upgrades.armoryDamageBoost++;
        addBanner("🛠️ 搜刮成功！获得弹药盒×2、磁暴核×1，枪械改装：全武器伤害永久 +15%！");
      } else {
        addBanner("🛠️ 搜刮成功！获得压缩弹药盒×2、磁暴核×1！备用弹药已全数补满！");
      }
      sndReload();
      spawnFloatText("Refilled! 📦", 400, Z_TOP - 20, '#f0c060');
    }
  }
  // ── v51模块四：军火站「武器改装台」——花金币给当前武器+10%改装（独立于搜刮，每局3次）──
  if (bId === 'armory' && Math.abs(px - 320) < 45 && !window._modPanelOpen) {
    const w = WEAPONS[curWpnIdx];
    const mods = window._weaponMods || (window._weaponMods = {});
    const modCount = mods[w.id] || 0;
    if(modCount < 3){
      const cost = 60 + modCount * 40;  // 60/100/140
      // 弹提示面板（非阻塞，用 banner + 按E二次确认流程）
      if(!window._modConfirm){ 
        addBanner(`🔧 改装台：「${w.name}」+10%伤害 需💰${cost} —— 再按E确认`);
        window._modConfirm = {weaponId:w.id, cost, t:frameT};
      }else if(window._modConfirm.weaponId === w.id && frameT - window._modConfirm.t < 300){
        // 二次E：确认购买
        if(coins >= window._modConfirm.cost){
          coins -= window._modConfirm.cost; updateCoinUI();
          mods[w.id] = modCount + 1;
          window._weaponMods = mods;
          addBanner(`🔧 「${w.name}」改装完成！伤害+10%（${mods[w.id]}/3 次）`);
          sndLevelUp();
          for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2;mkP({x:player.x+CHAR_W/2,y:player.y+20,vx:Math.cos(a)*3,vy:Math.sin(a)*3-2,r:2+Math.random()*2,rDecay:.06,decay:.05,color:'#88ccff',type:'spark',grav:.15,alpha:1});}
          buildWeaponBar();refreshWBar();
        }else{
          addBanner('💰 金币不足改装');
        }
        window._modConfirm = null;
      }else{
        window._modConfirm = null;  // 超时/换武器：重置
      }
    }else{
      addBanner(`🔧 「${w.name}」改装已满（3/3）`);
    }
  }
  // ── v51模块四：安全屋「肉冷冻柜」——批量卖肉+存量提示（替代零散的旧交互价值）──
  if (bId === 'safehouse' && Math.abs(px - 350) < 45) {
    const totalMeat = meatInventory.normal + meatInventory.fast + meatInventory.tank + meatInventory.elite;
    const sellVal = meatInventory.normal*3 + meatInventory.fast*5 + meatInventory.tank*8 + meatInventory.elite*15;
    if(!window._fridgeConfirm){
      addBanner(`🧊 冷冻柜：存肉 ${totalMeat} 块（约值💰${sellVal}）—— 再按E批量出售`);
      window._fridgeConfirm = frameT;
    }else if(frameT - window._fridgeConfirm < 300){
      if(totalMeat > 0){
        coins += sellVal; updateCoinUI(); sndCoin();
        meatInventory = {normal:0, fast:0, tank:0, elite:0};
        addBanner(`🧊 冷冻柜批量出售 ${totalMeat} 块肉 → +💰${sellVal}`);
        spawnFloatText('+'+sellVal+'金', player.x+CHAR_W/2, player.y-20, '#f0c060');
      }else{
        addBanner('🧊 冷冻柜空着——战斗中击杀僵尸掉肉会自动收集');
      }
      window._fridgeConfirm = null;
    }else{
      window._fridgeConfirm = null;
    }
  }
  
  if (bId === 'tavern') {
    const activeCompCount = hiredCompanions.length;
    const hasSniper = hiredCompanions.some(c => c.type === 'sniper');
    const hasMedic = hiredCompanions.some(c => c.type === 'medic');
    const hasGunner = hiredCompanions.some(c => c.type === 'gunner');
    
    if (Math.abs(px - 250) < 40 && !hasSniper && activeCompCount < 2 && coins >= 60) {
      coins -= 60; updateCoinUI();
      hiredCompanions.push({ type: 'sniper', name: '阿强', x: player.x, y: CHAR_GY, walkT: 0, facingR: true, timer: 0 });
      sndReload();
      addBanner("🧔 狙击手阿强已入队！");
      spawnFloatText("Hired!", 250, Z_TOP - 20, '#ff9900');
    }
    else if (Math.abs(px - 400) < 40 && !hasMedic && activeCompCount < 2 && coins >= 50) {
      coins -= 50; updateCoinUI();
      hiredCompanions.push({ type: 'medic', name: '小丽', x: player.x, y: CHAR_GY, walkT: 0, facingR: true, timer: 0 });
      sndHeal();
      addBanner("👩 医疗兵小丽已入队！");
      spawnFloatText("Hired!", 400, Z_TOP - 20, '#2ecc71');
    }
    else if (Math.abs(px - 550) < 40 && !hasGunner && activeCompCount < 2 && coins >= 70) {
      coins -= 70; updateCoinUI();
      hiredCompanions.push({ type: 'gunner', name: '大壮', x: player.x, y: CHAR_GY, walkT: 0, facingR: true, timer: 0 });
      sndReload();
      addBanner("💪 机枪手大壮已入队！");
      spawnFloatText("Hired!", 550, Z_TOP - 20, '#ff3300');
    }
    else if (Math.abs(px - 680) < 50 && !buildingInteriorLooted.tavernFood) {
      buildingInteriorLooted.tavernFood = true;
      addItemToBackpack('meat_tank', 2, true);
      addItemToBackpack('meat_elite', 1, true);
      addItemToBackpack('spice_wasteland', 2, true);
      addItemToBackpack('vintage_wine', 1, true);
      addBanner("🏕️ 营地物资搜刮完成！获得霜降厚肉×2、异化基因肉×1、废土野山椒×2、珍藏佳酿×1！");
      sndCoin();
      spawnFloatText("Looted! 🥓", 680, Z_TOP - 20, '#f39c12');
    }
  }
  
  // 安全屋新增：休息期延长（px≈440，花25金币延长休息10秒）
  if (bId === 'safehouse' && Math.abs(px - 440) < 40 && !safehouseRestBoost && coins>=25 && wavePhase==='rest') {
    coins-=25;updateCoinUI();
    safehouseRestBoost=true;
    restTimerVal += 10;
    addBanner('☕ 安全屋特调咖啡！休息期延长10秒！');
    spawnFloatText('+10s REST!', 440, Z_TOP-20, '#88ddff');
    sndHeal();
  }
  if (bId === 'safehouse') {
    if (Math.abs(px - 260) < 40 && !safehouseRestUsed) {
      safehouseRestUsed = true;
      health = Math.min(maxHp, health + 25);
      updateHpUI();
      sndHeal();
      addBanner("🛏️ 小憩结束，体力恢复！(+25 HP)");
      spawnFloatText("+25\u2665", 260, Z_TOP - 20, '#2ecc71');
    }
    else if (Math.abs(px - 440) < 40 && !safehouseCraftUsed && hasWeaponId('grenade')) {
      safehouseCraftUsed = true;
      const gIdx = wpnIdxById('grenade');
      const maxG = Math.floor(WEAPONS[gIdx].maxAmmo * (1 + upgrades.ammo * 0.5));
      wAmmo[gIdx] = Math.min(maxG, wAmmo[gIdx] + 2);
      updateAmmoUI();
      refreshWBar();
      sndReload();
      addBanner("💣 手工装配了 2 枚手榴弹！");
      spawnFloatText("+2💣", 440, Z_TOP - 20, '#f0c060');
    }
    else if (Math.abs(px - 600) < 40 && !damageBuffActive && coins >= 30) {
      coins -= 30; updateCoinUI();
      damageBuffActive = true;
      sndCoin();
      addBanner("🍺 痛饮伏特加！下波伤害暴增 +30%！");
      spawnFloatText("+30% DMG!", 600, Z_TOP - 20, '#ff9900');
    }
  }
  
  if (bId === 'cabin') {
    if (Math.abs(px - 280) < 40) {
      health = maxHp;
      if(typeof backpackInventory !== 'undefined' && backpackInventory.cozy_blanket > 0){
        window._cozyShield = Math.max(window._cozyShield || 0, 30);
        addBanner("🛏️ 盖着温暖羽绒毯小憩，生命全满并获得30点坚固护盾！");
      } else {
        addBanner("🛏️ 在温暖的被窝里睡了一觉，生命值已恢复到上限！");
      }
      updateHpUI();
      sndHeal();
      spawnFloatText("HP Restored! 💖", 280, Z_TOP - 20, '#2ecc71');
    }
    else if (Math.abs(px - 450) < 40) {
      openCabinUpgradeUI();
    }
    else if (Math.abs(px - 620) < 40) {
      let collected = false;
      let msg = "";
      if (cabinUpgrades.supplier >= 1 && cabinCrates.ammoSpawned) {
        wAmmo = wAmmo.map((amt, idx) => {
          if (idx === 5) return amt;
          const maxA = weaponMagSize(WEAPONS[idx]);
          return Math.min(maxA, amt + Math.ceil(maxA * 0.25));
        });
        updateAmmoUI();
        refreshWBar();
        cabinCrates.ammoSpawned = false;
        collected = true;
        msg += "📦 补充了战术备用弹药 (+25%)！";
      }
      if (cabinUpgrades.supplier >= 2 && cabinCrates.medkitSpawned) {
        health = Math.min(maxHp, health + 30);
        updateHpUI();
        sndHeal();
        cabinCrates.medkitSpawned = false;
        collected = true;
        msg += " 💉 获得了急救包医疗补给！";
      }
      if (collected) {
        addBanner(msg.trim());
        sndReload();
        spawnFloatText("Collected! 🎁", 620, Z_TOP - 20, '#5DADE2');
      } else {
        addBanner("🛖 补给架上空空如也，需要等待下一波攻势结束。");
      }
    }
  }
}

function updateBuildingInterior() {
  try {
    updatePlayer();
    if(player.x <= 20){
      player.x = 20;
      if(player.vx < 0) player.vx = 0;
    } else if(player.x >= GW - CHAR_W - 20){
      player.x = GW - CHAR_W - 20;
      if(player.vx > 0) player.vx = 0;
    }
  
  updateCompanions();
  updateLootDrops();
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= .97; p.angle += p.spin; p.life -= p.decay;
    if (p.rDecay) p.r = Math.max(.1, p.r - p.rDecay);
    if (p.life <= 0) {
      if(!p._pooled && _particleFreeList.length < 1200){ p._pooled = true; _particleFreeList.push(p); }
      particles[i] = particles[particles.length - 1];
      particles.pop();
      continue;
    }
  }
  
  const bId = activeBuilding.id;
  for (let i = buildingInteriorZombies.length - 1; i >= 0; i--) {
    const z = buildingInteriorZombies[i];
    if (!z.alive) {
      buildingInteriorZombies.splice(i, 1);
      continue;
    }
    
    const pcx = player.x + CHAR_W/2;
    const zcx = z.x + 22;
    const dir = Math.sign(pcx - zcx);
    z.x += dir * z.spd;
    z.facingR = (dir > 0);
    z.walkT += 0.055 * z.spd;
    
    if (player.iframes === 0) {
      const pb = player.y + CHAR_H;
      if (Math.abs(zcx - pcx) < 36 && pb > Z_TOP + 10) {
        z.alive = false;
        buildingInteriorZombies.splice(i, 1);
        takeDamage(12);
        player.vx = (player.x < z.x) ? -8 : 8;
        player.vy = -5;
        player.onGround = false;
        player.iframes = 90;
        vfxPlayerHurt(player.x, player.y);
        sndPlayerHurt();
      }
    }
  }
  
  if (buildingInteriorZombies.length === 0 && !buildingInteriorCleared[bId]) {
    buildingInteriorCleared[bId] = true;
    addBanner("✔ 区域已安全！开始进行探索吧。");
    [0, 100, 200].forEach((t, j) => {
      setTimeout(() => noiseFreqRamp(0.12, 350 + j * 150, 700 + j * 150, 'sine', 0.2), t);
    });
  }
  
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b || !b.active) {
      recycleBullet(b);
      bullets[i] = bullets[bullets.length - 1];
      bullets.pop();
      continue;
    }
    b.x += b.vx;
    b.y += b.vy;
    if (b.grav) b.vy += 0.27;
    
    const trav = Math.sqrt((b.x-b.sx)**2+(b.y-b.sy)**2);
    if (trav > b.maxRange || b.x < 15 || b.x > GW - 15 || b.y < -30 || b.y > GH + 30) {
      if (b.grav) vfxExplosion(b.x, b.y);
      recycleBullet(b);
      bullets[i] = bullets[bullets.length - 1];
      bullets.pop();
      continue;
    }
    
    if (b.y >= GROUND_Y - 4) {
      if (b.grav || b.aoe) { vfxExplosion(b.x, b.y); sndExplosion(); explodeInterior(b.x, b.y, b.dmg); }
      recycleBullet(b);
      bullets[i] = bullets[bullets.length - 1];
      bullets.pop();
      continue;
    }
    
    let hit = false;
    for (const z of buildingInteriorZombies) {
      if (!z.alive) continue;
      const zcx = z.x + 22, zy = Z_TOP + 28;
      if (Math.abs(b.x - zcx) < 40 && Math.abs(b.y - zy) < 56) {
        const crit = Math.random() < CRIT_CHANCE;
        const fdmg = crit ? b.dmg * 2 : b.dmg;
        z.hp -= fdmg;
        z.hitFlash = crit ? 2 : 1;
        // 连续暴击计数（神枪手成就）
        if (crit) critComboCount++; else critComboCount = 0;
        if (b.burn) ignitZombie(z);
        if (b.frost) { z.frostTimer = 120; z.spdMul = 0.6; }
        if (b.fromTower) { applyTowerBulletHit(b, zcx, zy); }
        else if (b.aoe) { vfxExplosion(b.x, b.y); sndExplosion(); explodeInterior(b.x, b.y, b.dmg); }
        if (crit) { sndCrit(); vfxCritHit(b.x, zy, b.x - b.vx * 4, b.y - b.vy * 4); if (b.dmg >= 1) spawnFloatText('CRIT ' + Math.round(fdmg) + '!', b.x, zy - 18, '#ff3344', true); }
        if (z.hp <= 0) {
          killZombie(z, b.x, b.y);
        } else {
          vfxHit(b.x, b.y, b.sx, b.sy);
          sndHit();
        }
        
        if (!b.piercing) {
          recycleBullet(b);
          bullets[i] = bullets[bullets.length - 1];
          bullets.pop();
          hit = true;
          break;
        }
      }
    }
  }

  // Update acid spit projectiles inside building
  for (let i = bossProjList.length - 1; i >= 0; i--) {
    const bp = bossProjList[i];
    if (!bp.active) {
      bossProjList.splice(i, 1);
      continue;
    }
    bp.x += bp.vx; bp.y += bp.vy;
    // Collision with player
    const pcx = player.x + CHAR_W/2, pcy = player.y + CHAR_H/2;
    if (Math.abs(bp.x - pcx) < 30 && Math.abs(bp.y - pcy) < 40 && player.iframes === 0) {
      takeDamage(10);
      player.iframes = 60;
      bp.active = false;
      vfxPlayerHurt(player.x, player.y);
      sndPlayerHurt();
    }
    if (bp.x < 0 || bp.x > GW || bp.y > GROUND_Y) {
      bp.active = false;
    }
  }

  updateInteractionPrompt();
  } catch(err) {
    console.error('[BuildingInterior Error]', err);
  }
}

function explodeInterior(cx, cy, dmg) {
  const R = 100;
  buildingInteriorZombies.forEach(z => {
    if (!z.alive) return;
    const dx = (z.x + 22) - cx, dy = (Z_TOP + 28) - cy;
    if (Math.sqrt(dx*dx + dy*dy) < R) {
      z.hp -= dmg;
      z.hitFlash = 1;
      if (z.hp <= 0) {
        killZombie(z, z.x + 22, Z_TOP + 28);
      }
    }
  });
}

function drawBuildingInterior() {
  const bId = activeBuilding.id;
  const cleared = buildingInteriorCleared[bId];
  
  ctx.fillStyle = '#0b090f';
  ctx.fillRect(0, 0, GW, GROUND_Y);
  
  ctx.strokeStyle = '#15111b';
  ctx.lineWidth = 1;
  for (let y = 30; y < GROUND_Y; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(GW, y);
    ctx.stroke();
    const offset = (y % 80 === 0) ? 30 : 0;
    for (let x = offset; x < GW; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x, y + 40);
      ctx.stroke();
    }
  }
  
  const grd = ctx.createLinearGradient(0, GROUND_Y, 0, GH);
  grd.addColorStop(0, '#1c1622'); grd.addColorStop(1, '#0c0a0f');
  ctx.fillStyle = grd;
  ctx.fillRect(0, GROUND_Y, GW, GROUND_H);
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(0, GROUND_Y, GW, 2);
  
  ctx.fillStyle = activeBuilding.color;
  ctx.fillRect(10, GROUND_Y - 56, 32, 56);
  ctx.strokeStyle = '#f39c12';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, GROUND_Y - 56, 32, 56);
  ctx.fillStyle = '#f39c12';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(buildingReturnState === 'hub' ? '返回据点 🚪' : 'EXIT 🚪', 26, GROUND_Y - 62);
  
  if (buildingReturnState === 'hub') {
    ctx.save();
    ctx.fillStyle = 'rgba(20,12,8,0.88)';
    ctx.fillRect(GW/2 - 250, 10, 500, 28);
    ctx.strokeStyle = '#c8963e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(GW/2 - 250, 10, 500, 28);
    ctx.font = 'bold 12px Microsoft YaHei UI,sans-serif';
    ctx.fillStyle = '#ffdd88';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🗺️ 旧城区远征中: ${activeBuilding.name} | 搜刮完成后前往左侧大门 [E] 返回据点`, GW/2, 24);
    ctx.restore();
  }
  
  if (bId === 'clinic') {
    // 试验台 (x: 200)
    ctx.fillStyle = '#2d2736';
    ctx.fillRect(180, GROUND_Y - 24, 60, 24);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(190, GROUND_Y - 34, 16, 10);
    ctx.fillStyle = buildingInteriorLooted.clinicPerk ? '#555' : '#2ecc71';
    ctx.fillRect(215, GROUND_Y - 32, 4, 8);
    ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = buildingInteriorLooted.clinicPerk ? '#666' : '#2ecc71';
    ctx.fillText(buildingInteriorLooted.clinicPerk ? '试验已用 🧬' : '🧬 临床试验台', 210, GROUND_Y - 38);

    // 主医疗箱 (x: 400)
    if (!buildingInteriorLooted.clinic && cleared) {
      const pulse = 10 + Math.sin(frameT * 0.1) * 6;
      ctx.save();
      ctx.shadowBlur = pulse; ctx.shadowColor = '#2ecc71';
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(385, GROUND_Y - 32, 30, 32);
      ctx.fillStyle = '#fff';
      ctx.fillRect(397, GROUND_Y - 24, 6, 16);
      ctx.fillRect(392, GROUND_Y - 19, 16, 6);
      ctx.restore();
    } else if (buildingInteriorLooted.clinic) {
      ctx.fillStyle = '#222';
      ctx.fillRect(385, GROUND_Y - 32, 30, 32);
      ctx.strokeStyle = '#555';
      ctx.strokeRect(385, GROUND_Y - 32, 30, 32);
      ctx.font = '10px sans-serif';
      ctx.fillText('EMPTY 📦', 400, GROUND_Y - 36);
    }

    // 应急药箱与伤员架 (x: 600)
    ctx.fillStyle = '#2d2736';
    ctx.fillRect(575, GROUND_Y - 24, 60, 24);
    if (!buildingInteriorLooted.clinicBox2 && cleared) {
      const pulse = 8 + Math.sin(frameT * 0.12) * 5;
      ctx.save();
      ctx.shadowBlur = pulse; ctx.shadowColor = '#27ae60';
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(590, GROUND_Y - 30, 28, 24);
      ctx.fillStyle = '#fff';
      ctx.fillRect(601, GROUND_Y - 24, 6, 12); ctx.fillRect(597, GROUND_Y - 21, 14, 6);
      ctx.restore();
    } else {
      ctx.fillStyle = '#222'; ctx.fillRect(590, GROUND_Y - 30, 28, 24);
      ctx.strokeStyle = '#555'; ctx.strokeRect(590, GROUND_Y - 30, 28, 24);
    }
    ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = buildingInteriorLooted.clinicBox2 ? '#666' : '#2ecc71';
    ctx.fillText(buildingInteriorLooted.clinicBox2 ? 'EMPTY 📦' : '💉 应急药箱', 604, GROUND_Y - 34);
  } 
  else if (bId === 'tavern') {
    ctx.fillStyle = '#5c3d24';
    ctx.fillRect(300, GROUND_Y - 30, 240, 30);
    ctx.fillStyle = '#2f1f17';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(320 + i * 60, GROUND_Y - 18, 14, 18);
      ctx.fillRect(317 + i * 60, GROUND_Y - 22, 20, 4);
    }
    
    if (cleared) {
      const activeCompCount = hiredCompanions.length;
      const hasSniper = hiredCompanions.some(c => c.type === 'sniper');
      const hasMedic = hiredCompanions.some(c => c.type === 'medic');
      const hasGunner = hiredCompanions.some(c => c.type === 'gunner');
      
      if (!hasSniper) {
        ctx.save(); ctx.translate(250, GROUND_Y - CHAR_H);
        drawNPC('sniper', '阿强 (💰60)');
        ctx.restore();
      }
      if (!hasMedic) {
        ctx.save(); ctx.translate(400, GROUND_Y - CHAR_H);
        drawNPC('medic', '小丽 (💰50)');
        ctx.restore();
      }
      if (!hasGunner) {
        ctx.save(); ctx.translate(550, GROUND_Y - CHAR_H);
        drawNPC('gunner', '大壮 (💰70)');
        ctx.restore();
      }

      // 食材名酒冷柜 (x: 680)
      ctx.fillStyle = '#5c3d24';
      ctx.fillRect(650, GROUND_Y - 28, 60, 28);
      if (!buildingInteriorLooted.tavernFood) {
        const pulse = 8 + Math.sin(frameT * 0.1) * 5;
        ctx.save();
        ctx.shadowBlur = pulse; ctx.shadowColor = '#f39c12';
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(660, GROUND_Y - 36, 36, 26);
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(666, GROUND_Y - 30, 24, 6);
        ctx.restore();
      } else {
        ctx.fillStyle = '#222';
        ctx.fillRect(660, GROUND_Y - 36, 36, 26);
        ctx.strokeStyle = '#555'; ctx.strokeRect(660, GROUND_Y - 36, 36, 26);
      }
      ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = buildingInteriorLooted.tavernFood ? '#666' : '#f39c12';
      ctx.fillText(buildingInteriorLooted.tavernFood ? 'EMPTY 📦' : '🥓 食材名酒冷柜', 680, GROUND_Y - 40);
    }
  } 
  else if (bId === 'armory') {
    // 蓝图桌 (x: 200)
    ctx.fillStyle = '#374151';
    ctx.fillRect(170, GROUND_Y - 24, 65, 24);
    ctx.fillStyle = buildingInteriorLooted.armoryTower ? '#333' : '#2563eb';
    ctx.fillRect(180, GROUND_Y - 28, 45, 6);
    ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = buildingInteriorLooted.armoryTower ? '#666' : '#60a5fa';
    ctx.fillText(buildingInteriorLooted.armoryTower ? '蓝图已取 📜' : '📜 全景防卫蓝图', 200, GROUND_Y - 32);

    // 武器改装工作台 (x: 320)
    ctx.fillStyle = '#475569';
    ctx.fillRect(295, GROUND_Y - 24, 55, 24);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🔧 武器改装台', 322, GROUND_Y - 28);
    
    // 军备箱 (x: 400)
    if (!buildingInteriorLooted.armory && cleared) {
      const pulse = 10 + Math.sin(frameT * 0.1) * 6;
      ctx.save();
      ctx.shadowBlur = pulse; ctx.shadowColor = '#f39c12';
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(385, GROUND_Y - 32, 30, 32);
      ctx.fillStyle = '#333';
      ctx.fillRect(385, GROUND_Y - 26, 30, 4);
      ctx.restore();
    } else if (buildingInteriorLooted.armory) {
      ctx.fillStyle = '#222';
      ctx.fillRect(385, GROUND_Y - 32, 30, 32);
      ctx.strokeStyle = '#555';
      ctx.strokeRect(385, GROUND_Y - 32, 30, 32);
      ctx.font = '10px sans-serif';
      ctx.fillText('EMPTY 📦', 400, GROUND_Y - 36);
    }
  } 
  else if (bId === 'safehouse') {
    ctx.fillStyle = '#333'; ctx.fillRect(130, GROUND_Y - 48, 40, 48);
    ctx.fillStyle = `rgba(255,${100+Math.sin(frameT*0.2)*50|0},0,0.8)`;
    ctx.fillRect(142, GROUND_Y - 18, 16, 18);
    
    ctx.fillStyle = '#4b5563'; ctx.fillRect(220, GROUND_Y - 14, 80, 14);
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(220, GROUND_Y - 22, 18, 8);
    if (safehouseRestUsed) {
       ctx.fillStyle = '#555'; ctx.font = '8px sans-serif'; ctx.fillText('已休整', 260, GROUND_Y - 18);
    }
    
    ctx.fillStyle = '#78350f'; ctx.fillRect(400, GROUND_Y - 24, 80, 24);
    ctx.fillStyle = '#374151'; ctx.fillRect(430, GROUND_Y - 32, 20, 8);
    if (safehouseCraftUsed) {
       ctx.fillStyle = '#555'; ctx.font = '8px sans-serif'; ctx.fillText('已消耗', 440, GROUND_Y - 28);
    }
    
    ctx.fillStyle = '#78350f'; ctx.fillRect(570, GROUND_Y - 28, 60, 28);
    ctx.fillStyle = '#6b7280'; ctx.fillRect(595, GROUND_Y - 38, 10, 10);
  }
  else if (bId === 'cabin') {
    // 1. Cozy fireplace with animated flames at x = 120
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(100, GROUND_Y - 48, 40, 48);
    ctx.fillStyle = '#212121';
    ctx.fillRect(108, GROUND_Y - 28, 24, 28);
    const fireTime = frameT * 0.15;
    for (let i = 0; i < 3; i++) {
      const h = 10 + Math.sin(fireTime + i) * 6;
      ctx.fillStyle = i === 0 ? '#ff3d00' : (i === 1 ? '#ff9100' : '#ffea00');
      ctx.fillRect(112 + i * 4, GROUND_Y - h, 4, h);
    }
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(104, GROUND_Y - 56, 32, 8);

    // 2. Comfortable bed at x = 280
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(240, GROUND_Y - 14, 80, 14);
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(242, GROUND_Y - 24, 76, 10);
    ctx.fillStyle = '#1976d2';
    ctx.fillRect(260, GROUND_Y - 24, 58, 10);
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(244, GROUND_Y - 28, 14, 6);
    ctx.fillStyle = '#fff';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('床 (E治疗)', 280, GROUND_Y - 32);

    // 3. Blueprint Desk at x = 450
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(410, GROUND_Y - 22, 80, 22);
    ctx.fillRect(415, GROUND_Y - 22, 8, 22);
    ctx.fillRect(477, GROUND_Y - 22, 8, 22);
    ctx.fillStyle = '#1e88e5';
    ctx.fillRect(430, GROUND_Y - 24, 40, 2);
    ctx.fillStyle = '#e3f2fd';
    ctx.fillRect(435, GROUND_Y - 24, 10, 1);
    ctx.fillRect(450, GROUND_Y - 24, 15, 1);
    ctx.fillStyle = '#ffcc60';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('蓝图桌 (E升级)', 450, GROUND_Y - 28);

    // 4. Emergency Supply Rack at x = 620
    ctx.fillStyle = '#37474f';
    ctx.fillRect(600, GROUND_Y - 50, 40, 50);
    ctx.fillStyle = '#263238';
    ctx.fillRect(602, GROUND_Y - 34, 36, 3);
    ctx.fillRect(602, GROUND_Y - 18, 36, 3);
    if (cabinUpgrades.supplier >= 1) {
      if (cabinCrates.ammoSpawned) {
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(606, GROUND_Y - 32, 12, 14);
        ctx.fillStyle = '#333';
        ctx.fillRect(606, GROUND_Y - 26, 12, 2);
      } else {
        ctx.fillStyle = '#555';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('空', 612, GROUND_Y - 24);
      }
    }
    if (cabinUpgrades.supplier >= 2) {
      if (cabinCrates.medkitSpawned) {
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(622, GROUND_Y - 15, 12, 15);
        ctx.fillStyle = '#fff';
        ctx.fillRect(627, GROUND_Y - 12, 2, 9);
        ctx.fillRect(624, GROUND_Y - 9, 8, 2);
      } else {
        ctx.fillStyle = '#555';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('空', 628, GROUND_Y - 8);
      }
    }
    ctx.fillStyle = '#85c1e9';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('补给架 (E收集)', 620, GROUND_Y - 54);

    // 5. Sleeping Dog at x = 350
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath();
    ctx.ellipse(350, GROUND_Y - 6, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(342, GROUND_Y - 9, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.ellipse(343, GROUND_Y - 12, 2, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d7ccc8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(360, GROUND_Y - 8, 4, 0, Math.PI, true);
    ctx.stroke();
    ctx.fillStyle = '#bbb';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐕 小白 (熟睡中)', 350, GROUND_Y - 16);
  }
}

function drawNPC(type, label) {
  ctx.save();
  // 影子
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 52, 12, 3, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  // 腿
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(-7, 38, 5, 14);
  ctx.fillRect(2, 38, 5, 14);
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(-7, 48, 5, 4);
  ctx.fillRect(2, 48, 5, 4);
  // 身体（按职业上色）
  let bodyColor, accentColor;
  if (type === 'sniper') { bodyColor = '#2a4a6a'; accentColor = '#88aacc'; }
  else if (type === 'medic') { bodyColor = '#e5e7eb'; accentColor = '#cc3333'; }
  else { bodyColor = '#3a4a3a'; accentColor = '#888888'; }
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-10, 18, 20, 24);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-10, 18, 3, 24);
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(7, 18, 3, 24);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-1, 18, 1, 24);  // 衣襟
  // 职业专属装饰
  if (type === 'sniper') {
    // 狙击手：护目镜+步枪
    ctx.fillStyle = '#332211'; ctx.fillRect(-6, 14, 12, 3);  // 帽檐
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(8, 28); ctx.lineTo(18, 30); ctx.stroke();  // 步枪
    ctx.fillStyle = '#222'; ctx.fillRect(16, 29, 4, 3);
  } else if (type === 'medic') {
    // 医护兵：红十字+针筒
    ctx.fillStyle = accentColor;
    ctx.fillRect(-2, 22, 4, 4);  // 红十字
    ctx.fillRect(-1, 23, 2, 2);
    ctx.fillStyle = '#88ccff'; ctx.fillRect(8, 30, 3, 8);  // 针筒
  } else {
    // 机枪手：弹药带+重型装备
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-10, 32, 20, 3);  // 弹药带
    ctx.fillStyle = '#888'; ctx.fillRect(-7, 33, 2, 2); ctx.fillRect(-2, 33, 2, 2); ctx.fillRect(3, 33, 2, 2);
    ctx.fillStyle = '#555'; ctx.fillRect(8, 24, 5, 12);  // 机枪
  }
  // 头
  ctx.fillStyle = '#c8855a';
  ctx.fillRect(-6, 8, 12, 12);
  ctx.fillStyle = '#3a2818'; ctx.fillRect(-6, 8, 12, 3);  // 头发
  ctx.fillStyle = '#1a0e06'; ctx.fillRect(-3, 12, 2, 2); ctx.fillRect(1, 12, 2, 2);  // 眼睛
  ctx.fillStyle = '#5a2a1a'; ctx.fillRect(-2, 16, 4, 1);  // 嘴
  // 名字标签
  ctx.fillStyle = 'rgba(0,0,0,.75)';
  ctx.fillRect(-label.length*3.5-2, -2, label.length*7+4, 11);
  ctx.fillStyle = '#f39c12';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, 6);
  ctx.restore();
}

