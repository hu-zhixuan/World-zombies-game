// ═══════════════════════════════════════════

//  【白天模块 A10】MAIN GAME LOOP（主游戏循环）
// ═══════════════════════════════════════════
const _subsystemErrThrottle = {};
function safeSubsystem(name, fn){
  try{
    fn();
  }catch(err){
    const now = Date.now();
    if(!_subsystemErrThrottle[name] || now - _subsystemErrThrottle[name] > 3000){
      console.warn(`[SubsystemFault] 子系统 ${name} 运行异常，已安全隔离:`, err);
      _subsystemErrThrottle[name] = now;
    }
  }
}

function gameLoop(){
  if(!gameRunning)return;
  try{
  frameT++;
  checkStuckWatchdog();  // 防卡死检测
  if(shopOpen||cabinUIOpen||gamePaused||cinActive||gameState==='restaurant'||(typeof isDuffWorkshopOpen==='function'&&isDuffWorkshopOpen())){
    updateNextWaveBtn();
    return;  // finally块会继续调度下一帧
  }
  // ── 共享时间衰减（暂停/建筑/世界均生效）──
  if(comboTimer>0){comboTimer--; if(comboTimer===0){combo=0;lastComboMilestone=0;critComboCount=0;updateComboHUD();}}
  if(player.playerShield > 0){  // v50模块二：裂地援护锤护盾衰减（3秒）
    player.playerShield--;
    if(player.playerShield === 0) spawnFloatText('护盾消退', player.x+CHAR_W/2, player.y-24, '#88ccff');
  }
  // 小改：连杀狂热倒计时（结束时提示）
  if(frenzyT>0){
    frenzyT--;
    if(frenzyT===0) addBanner('狂热消退');
  }
  if(window._globalDmgNumCd>0)window._globalDmgNumCd--;  // 伤害数字全局限频衰减
  // ── 战前特餐：十全大补汤持续回血 (每90帧=1.5秒回2血) ──
  if(activeSignature && activeSignature.id === 'stew' && frameT % 90 === 0 && health < maxHp && gameState === 'world'){
    health = Math.min(maxHp, health + 2);
    updateHpUI();
    spawnFloatText('❤+2 🍲', player.x + CHAR_W/2, player.y - 25, '#88ffaa');
  }
  // ── 战前特餐：麻辣爆烤翻滚留火海 (仅在战斗世界生效) ──
  if(gameState === 'world' && activeSignature && activeSignature.id === 'spicy' && dodgeT > 0 && frameT % 4 === 0){
    if(!window._groundFires) window._groundFires = [];
    window._groundFires.push({ x: player.x + CHAR_W/2, y: Z_TOP+50, life: 240, dmg: 35, tickT: 45 });
  }
  if(comboFlash>0.02)comboFlash*=.88; else comboFlash=0;
  if(comboVignette)comboVignette.style.opacity=comboFlash;
  // 射击/换弹动画衰减
  if(muzzleFlashT>0)muzzleFlashT--;
  if(shootRecoil>0.1)shootRecoil*=.7; else shootRecoil=0;
  if(levelUpFlash>0.02)levelUpFlash*=.92; else levelUpFlash=0;
  const frozen=hitstop>0; if(frozen)hitstop--;
  // 肉鸽天赋：狼化/先锋 计时器递减
  if(window._berserkActive){
    window._berserkTimer--;
    if(window._berserkTimer<=0){
      window._berserkActive=false;
      addBanner('💀 狂化结束…力竭而亡');
      endGame();
    }else if(window._berserkTimer%60===0 && window._berserkTimer<=180){
      // 最后3秒每秒警告
      addBanner('⚠️ 狂化剩余 '+Math.ceil(window._berserkTimer/60)+'秒！');
    }
  }
  // ── 经营→战斗联动：菜品增益 tick（时长衰减+回血型增益生效）──
  if(gameState==='world' && activeBattleBuffs.length>0){
    let expired=false;
    activeBattleBuffs.forEach(b=>{
      b.timeLeft--;
      if(b.timeLeft<=0)expired=true;
      // hp_regen / all_buff：每2秒回1血（传说stacks=2 则每2秒回2血）
      if(b.id==='hp_regen'||b.id==='all_buff'){
        if(frameT%120===0 && health<maxHp && health>0){
          const heal=(b.id==='all_buff'?1:1)*b.stacks;
          health=Math.min(maxHp,health+heal);updateHpUI();
          spawnFloatText('+'+heal+'🍲', player.x+CHAR_W/2, player.y-10, '#88ff88');
        }
      }
    });
    if(expired){
      activeBattleBuffs=activeBattleBuffs.filter(b=>b.timeLeft>0);
      if(activeBattleBuffs.length===0)addBanner('🍽️ 美味增益消化完毕');
    }
  }
  if(window._vanguardBuffT>0)window._vanguardBuffT--;
  if(window._dualwieldT>0)window._dualwieldT--;   // v52：双持buff衰减（3秒=180帧）
  if(window._critFlowT>0)window._critFlowT--;      // v52：暴击节奏衰减（2秒=120帧）
  // ── v53：引信系统tick（手榴弹延迟雷/地雷定时雷）──
  if(gameState==='world' && !frozen)tickFuses();
  // ── v53流派觉醒：技能窗口/冷却衰减 + 狼群AI ──
  if(window._classSkillT>0)window._classSkillT--;
  if(window._classSkillCd>0){
    window._classSkillCd--;
    if(window._classSkillCd===0||window._classSkillCd%30===0)updateClassSkillBtn();
  }
  if(gameState==='world'&&!frozen)tickSkillWolves();
  if(window._flameRampT>0){window._flameRampT--;if(window._flameRampT<=0)window._flameRampStacks=0;}  // v53：喷火器停火重置递增
  ctx.clearRect(0,0,GW,GH);

  // ── HUB WORLD（避难所据点，独立于战斗世界）──
  if (gameState === 'hub') {
    try {
      if(!frozen) updateHubPlayer();
      if(!frozen) updateHubPrompt();
    } catch(err) {
      console.error('[Hub Update Error]', err);
    }
    // 特效衰减
    if(redFlash>0.01)redFlash*=.76;else redFlash=0;
    shakeX*=.82;shakeY*=.82;if(Math.abs(shakeX)<.05)shakeX=0;if(Math.abs(shakeY)<.05)shakeY=0;
    ctx.save();
    if(shakeX||shakeY)ctx.translate(shakeX,shakeY);
    try {
      drawHubWorld();
      // 玩家
      const aimA=getAimAngle();
      drawPlayer(player.x, player.y, player.facingRight, player.walkT, aimA, !player.onGround, player.iframes>0, frameT, dodgeT);
      drawParticles();
    } catch(err) {
      console.error('[Hub Render Error]', err);
    }
    ctx.restore();
    // 暖色调暗角 (使用离线缓存贴图)
    const hcv = getHvigCanvas();
    if(hcv) ctx.drawImage(hcv, 0, 0, GW, GH);
    drawWaveHUD();  // 据点也显示波次HUD
    mobileStatusTick();
    updateNextWaveBtn();
    return;
  }

  if (gameState === 'building') {
    if(!frozen) updateBuildingInterior();
    if(ownedWeaponsSet.has(minigunIdx())){
      const mg=getMinigun();
      if(mg&&mg.heat>0){
      const decayRate = upgrades.armoryCooling ? 2.25 : 1.5;
      mg.heat=Math.max(0,mg.heat-decayRate);
      if(mg.overheated&&mg.heat<mg.maxHeat*.5){mg.overheated=false;}
      updateWeaponHeat();
      }
    }
    if(mouseHeld&&cw().id==='flame'&&wAmmo[curWpnIdx]>0&&!isReloading){const g=getGunTip();vfxFlame(g.x,g.y,g.angle);}
    shakeX*=.82;shakeY*=.82;if(Math.abs(shakeX)<.05)shakeX=0;if(Math.abs(shakeY)<.05)shakeY=0;
    if(redFlash>0.01)redFlash*=.76;else redFlash=0;
    if(orangeFlash>0.01)orangeFlash*=.78;else orangeFlash=0;
    if(purpleFlash>0.01)purpleFlash*=.80;else purpleFlash=0;
    if(muzzleLightFlash>0.01)muzzleLightFlash*=.72;else muzzleLightFlash=0;
    if(critFlash>0.01)critFlash*=.80;else critFlash=0;
    updateReloadMagDrop();

    ctx.save();
    if(shakeX||shakeY)ctx.translate(shakeX,shakeY);
    drawBuildingInterior();
    buildingInteriorZombies.forEach(z => drawZombie(z, frameT));
    bossProjList.forEach(bp => { if (bp.active) drawBossProj(bp); });
    drawBullets();
    drawReloadMagDrop();
    drawLootDrops();
    const aimA = getAimAngle();
    drawPlayer(player.x, player.y, player.facingRight, player.walkT, aimA, !player.onGround, player.iframes > 0, frameT, dodgeT);
    drawCompanions();
    drawFieldSurvivors();
    drawParticles();
    ctx.restore();

    ctx.save();
    if(shakeX||shakeY)ctx.translate(shakeX,shakeY);
    if(redFlash>0.01){ctx.fillStyle=`rgba(180,20,20,${redFlash*.4})`;ctx.fillRect(0,0,GW,GH);}
    if(orangeFlash>0.01){ctx.fillStyle=`rgba(230,130,10,${orangeFlash*.28})`;ctx.fillRect(0,0,GW,GH);}
    if(muzzleLightFlash>0.01){
      const mlcv = getMuzzleLightCanvas();
      if(mlcv){
        ctx.save();
        ctx.globalAlpha = muzzleLightFlash * 0.22;
        ctx.drawImage(mlcv, 0, 0, GW, GH);
        ctx.restore();
      }
    }
    if(critFlash>0.01){ctx.fillStyle=`rgba(255,220,80,${critFlash*.18})`;ctx.fillRect(0,0,GW,GH);}
    const pcv = getPvigCanvas();
    if(pcv) ctx.drawImage(pcv, 0, 0, GW, GH);
    drawCrosshair(lastMX, lastMY);
    ctx.restore();

    mobileStatusTick();
    return;
  }

  // Update
  if(!frozen){
    safeSubsystem('Player', () => updatePlayer());
    safeSubsystem('Companions', () => updateCompanions());
    safeSubsystem('Survivors', () => { if(gameState === 'world') updateFieldSurvivors(); });
    safeSubsystem('Interaction', () => updateInteractionPrompt());
    safeSubsystem('Vehicle', () => updateVehicle(frameT));
    safeSubsystem('Sprite', () => updateSprite(frameT));
    safeSubsystem('Boss', () => updateBoss());
    safeSubsystem('Dust', () => spawnDust());
  }
  if(!frozen)safeSubsystem('LootDrops', () => updateLootDrops());
  if(!frozen)safeSubsystem('CabinTurret', () => updateCabinTurret());
  if(!frozen)safeSubsystem('Towers', () => updateTowers());        // 家园塔防系统
  // v52修：移除废弃 updateRest() 调用——它每帧把餐厅 #rest-timer display:'none'，
  // 夜晚营业时没有任何代码恢复显示，导致90秒倒计时整局不可见
  if(!frozen)safeSubsystem('WaveSpawning', () => updateWaveSpawning());
  // ── v52波次词条·雷暴之夜：每2秒随机落雷（敌我皆伤，战场走位考验）──
  if(!frozen && waveMutation && waveMutation.id==='thunder' && gameState==='world' && frameT%120===0 && zombies.length>0){
    const lx = RIGHT_WALL_X + 60 + Math.random()*(WORLD_W - RIGHT_WALL_X - 160);
    const ly = Z_TOP + 40 + Math.random()*40;
    // 雷击视觉（垂直闪电折线+白闪）
    for(let s=0;s<10;s++){
      const py=0 + (ly/10)*s;
      mkP({x:lx+(Math.random()-.5)*18,y:py,r:3.5,rDecay:.2,decay:.1,color:Math.random()>.3?'#aaeeff':'#ffffff',type:'circle',grav:0,alpha:1,blur:true});
    }
    vfxExplosion(lx,ly); addShake(6); orangeFlash=Math.min(1,orangeFlash+.25);
    sndExplosion();
    // 敌我皆伤（玩家在雷点附近也掉血——雷暴的代价）
    zombies.forEach(z=>{
      if(z.alive && Math.abs((z.x+22)-lx)<60){ hitZombie(z, lx, Z_TOP+28, 40+wave*4, lx, 0, 1, 'energy'); }
    });
    if(bossActive && boss && boss.alive && Math.abs((boss.x+40)-lx)<80){ hitBoss(30+wave*3, lx, 0, lx, 0, 'energy'); }
    if(!vehicle.entered && Math.abs((player.x+CHAR_W/2)-lx)<50 && player.iframes<=0){
      takeDamage(Math.max(4, 12-wave));
      spawnFloatText('⚡ 被雷击中!', player.x+CHAR_W/2, player.y-30, '#88ccff');
    }
  }
  if(!frozen)safeSubsystem('Charge', () => updateCharge());
  if(!frozen)safeSubsystem('EnvNarration', () => checkEnvNarration());
  if(!frozen)safeSubsystem('HiddenChests', () => checkHiddenChests());
  if(!frozen)safeSubsystem('OldTownEvent', () => checkOldTownEvent());
  if(!frozen)safeSubsystem('Wanderers', () => updateWanderers());
  if(!frozen)safeSubsystem('GasStation', () => checkGasStation());
  if(!frozen)safeSubsystem('MiniBoss', () => maybeSpawnMiniBoss());
  if(!frozen)safeSubsystem('Achievements', () => checkAchievements());
  // Minigun heat decay
  if(ownedWeaponsSet.has(minigunIdx())){
    const mg=getMinigun();
    if(mg&&mg.heat>0){
    const decayRate = (upgrades.armoryCooling ? 2.25 : 1.5);
    mg.heat=Math.max(0,mg.heat-decayRate);
    if(mg.overheated&&mg.heat<mg.maxHeat*.5){mg.overheated=false;}
    updateWeaponHeat();
    }
  }
  // Flame vfx
  if(mouseHeld&&cw().id==='flame'&&wAmmo[curWpnIdx]>0&&!isReloading){const g=getGunTip();vfxFlame(g.x,g.y,g.angle);}
  // Shake decay
  shakeX*=.82;shakeY*=.82;if(Math.abs(shakeX)<.05)shakeX=0;if(Math.abs(shakeY)<.05)shakeY=0;
  // Bullets
  if(!frozen)for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    if(!b||!b.active){recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();continue;}
    try {
      // ── 回旋镖特殊飞行逻辑 ──
      if(b.isBoomerang){
        b.spin += 0.4;  // 旋转动画
        if(!b.returning){
          b.x+=b.vx;b.y+=b.vy;
          b.returnTimer++;
          // 飞行30帧后开始返回
          if(b.returnTimer>30){
            b.returning=true;
          }
        } else {
          // 返回玩家：速度向量指向玩家
          const px=player.x+CHAR_W/2, py=player.y+CHAR_H/2;
          const dx=px-b.x, dy=py-b.y, dist=Math.sqrt(dx*dx+dy*dy)||1;
          b.vx += (dx/dist)*0.8;  // 加速向玩家
          b.vy += (dy/dist)*0.8;
          // 限制最大速度
          const sp=Math.sqrt(b.vx*b.vx+b.vy*b.vy);
          if(sp>14){b.vx=b.vx/sp*14;b.vy=b.vy/sp*14;}
          b.x+=b.vx;b.y+=b.vy;
          // 回到玩家附近时消失
          if(dist<30){
            recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();continue;
          }
          // 返回途中也能造成伤害（重置pierceHit让同一敌人可被再次命中）
          if(b._pierceHit) b._pierceHit={};
        }
      } else {
        b.x+=b.vx;b.y+=b.vy;if(b.grav)b.vy+=.27;
      }
      const trav=Math.sqrt((b.x-b.sx)**2+(b.y-b.sy)**2);
      // 回旋镖不因maxRange消失（它要返回）
      if(trav>b.maxRange && !b.isBoomerang){recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();continue;}
      if(b.x<-30||b.x>cameraX+GW+30||b.y<-30||b.y>GH+30){if(b.grav)vfxExplosion(b.x,b.y);recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();continue;}
      if(b.grav&&b.y>=GROUND_Y-8){
        // v53引信系统：手榴弹落地0.6s后爆炸（越墙延迟雷）；地雷落地变1.5s定时雷
        armFuse(b);
        recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();continue;
      }
      if(b.wpn!=='railgun'&&Math.random()<.5)mkP({x:b.x,y:b.y,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:b.wpn==='flame'?3.5:b.wpn==='minigun'?1.2:1.8,rDecay:.06,decay:b.wpn==='flame'?.04:.06,color:b.wpn==='_sprite'?'#80c8ff':b.wpn==='flame'?'#ff6600':b.wpn==='minigun'?'#ffee80':'#ffe060',type:'circle',grav:b.wpn==='flame'?-.04:.01,alpha:.65,blur:b.wpn==='flame'||b.wpn==='_sprite'});
      if(b.cosmetic)continue;
      let hit=false;
      // 肉鸽天赋：贯穿 所有子弹穿透（每只怪仍只受一次，但子弹不消失）
      const pierceAll = !!playerPerks.pierce;
      for(const z of zombies){
        if(!z.alive)continue;
        if(z._pierceHit && pierceAll && z._pierceHit[b.id])continue;  // 同子弹不重复命中
        const zx=z.x+22,zy=Z_TOP+28+(z.yOffset||0);
        if(Math.abs(b.x-zx)<40&&Math.abs(b.y-zy)<56){
          // ── v50模块二：黏弹投射器——命中后附着不即时结算，2秒后原地引爆 ──
          // v53 Lv3「双联弹」：一次投射两枚黏弹（第二枚附到最近邻敌或同一目标叠加伤害）
          if(b.wpn==='stickybomb'){
            hit=true;  // 子弹消失
            z._sticky = {t:120, dmg:b.dmg, aoe:90, x:zx, y:zy};
            z.frostTimer = Math.max(z.frostTimer, 120); z.spdMul = Math.min(z.spdMul||1, 0.7);  // 附着减速30%
            // 附着视觉：黏丝弹体贴身+闪烁引信
            mkP({x:zx,y:zy,r:5,rDecay:.3,decay:.08,color:'rgba(255,150,60,.8)',type:'circle',alpha:.9,grav:0,blur:true});
            spawnFloatText('黏弹附着!', zx, Z_TOP-16, '#ff9955');
            break;
          }
          hitZombie(z,b.x,b.y,b.dmg,b.sx,b.sy,b.knockbackMult||1,b.dmgType);if(b.burn)ignitZombie(z);
          if(b.isBloodSlash){
            z.bleedTimer = 180;
            z.bleedDmg = Math.max(3, Math.round(b.dmg * 0.25));
            health = Math.min(maxHp, health + Math.max(1, Math.round(b.dmg * 0.05)));
            updateHpUI();
            spawnFloatText('撕裂流血!', zx, Z_TOP-22, '#ff3355');
          }
          // ── v53武器去同质化：冰枪「冰封碎冰」——对已冰冻目标+80%伤害并碎裂（清减速+范围冰爆）──
          // 原版 frostShatter/frostMul 是死字段。碎冰后目标解冻——形成"冰→脆→碎"连段节奏。
          if(b.frost){
            if(z.frostTimer>0 && (b.wpn==='ice' || b.wpn==='tactical_frost' || b.isFrostWave)){
              // 碎冰：对冰冻目标追加80%伤害（frostMul=0.4→伤害乘1/(1-0.4)=1.67≈+80%按卡面），范围冰爆波及周围
              const shardDmg=b.dmg*(1+(1-((WEAPONS.find(w=>w.id==='ice')||{}).frostMul??0.4))-0.2);
              hitZombie(z,b.x,b.y,shardDmg*0.8,b.sx,b.sy,1,'energy');
              z.frostTimer=0;z.spdMul=1;  // 碎冰=解除冰冻
              spawnFloatText('❄碎冰!',zx,Z_TOP-22,'#88ddff');
              for(let si=0;si<8;si++){const sa=Math.random()*Math.PI*2;mkP({x:zx,y:zy,vx:Math.cos(sa)*3,vy:Math.sin(sa)*2-1,r:2+Math.random()*2,rDecay:.08,decay:.06,color:Math.random()>.5?'#cceeff':'#88ddff',type:'shard',angle:Math.random()*Math.PI,spin:.25,grav:.25,alpha:.9});}
              try{const a=getACtx();if(a){const o=a.createOscillator(),g=a.createGain(),now=a.currentTime;o.type='triangle';o.frequency.setValueAtTime(1400,now);o.frequency.exponentialRampToValueAtTime(400,now+.18);g.gain.setValueAtTime(.14,now);g.gain.exponentialRampToValueAtTime(.001,now+.2);o.connect(g);g.connect(a.destination);o.start(now);o.stop(now+.2);}}catch(e){}
              // 碎冰扩散：范围冰爆与减速波及周围
              const shAoe=50;
              zombies.forEach(z2=>{if(z2.alive&&z2!==z&&Math.abs((z2.x+22)-zx)<shAoe){hitZombie(z2,z2.x+22,Z_TOP+28,b.dmg*0.4,b.sx,b.sy,1,'energy');z2.frostTimer=Math.max(z2.frostTimer,60);z2.spdMul=Math.min(z2.spdMul||1,b.frostFactor||0.7);}});
            }else{
              z.frostTimer=b.frostDur||120;z.spdMul=Math.min(z.spdMul||1, b.frostFactor||0.6);mkP({x:zx,y:zy,r:2,rDecay:.04,decay:.06,color:'#aaeeff',type:'circle',alpha:.8,grav:0});
            }
          }
          // 毒素效果：持续伤害（隐患1修复: 移除异步 setInterval 泄漏隐患，统一纳入主循环帧驱动 z.poisonTimer）
          if(b.poison){
            const stacks=(z.poisonStacks||0);
            if(!z.poisoned){
              z.poisoned=true;
              z.poisonStacks=stacks+1;
              z.poisonTimer=480; // 8秒 = 20次tick * 24帧，由主循环帧驱动
              z.poisonDmg=Math.max(1, z.maxHp*0.02);
              z.spdMul=Math.min(z.spdMul||1,0.6);  // 毒减速40%
              spawnFloatText('中毒!', zx, Z_TOP-20, '#66cc33');
            }
          }
          // ── 新武器特性：减速（重冲）──
          if(b.traitSlow){z.frostTimer=120;z.spdMul=b.traitSlow;mkP({x:zx,y:zy,r:2,rDecay:.04,decay:.06,color:'#aabbcc',type:'circle',alpha:.7,grav:0});}
          // ── 新武器特性：眩晕（声波枪）──
          if(b.traitStun){z.hitStun=(z.hitStun||0)+90;for(let si=0;si<4;si++){mkP({x:zx,y:zy,vx:(Math.random()-.5)*2.5,vy:(Math.random()-.5)*2.5,r:1.2,decay:.06,color:'#ffee44',type:'spark',alpha:.9,grav:0});}spawnFloatText('STUN!',zx,Z_TOP-15,'#ffee44');}
          // ── 新武器特性：拉拽（鱼叉枪）──
          if(b.traitPull){const pullDir=(player.x<zx)?-1:1;z.x+=pullDir*45;for(let pi=0;pi<4;pi++){mkP({x:zx,y:zy,vx:pullDir*(1.5+Math.random()*2),vy:(Math.random()-.5)*2,r:1.2,decay:.06,color:'#88ccff',type:'spark',alpha:.9,grav:0});}}
          // ── 新武器特性：燃烧地面（凝固汽油）──
          // v53 Lv3「持久火海」：时长+80%（480→864帧≈14秒）——原版 longfire 写的 burnGroundT 从未被读取
          if(b.burnGround && !b._groundBurned){
            b._groundBurned = true;
            if(!window._groundFires) window._groundFires = [];
            const gLife=480;
            window._groundFires.push({x:b.x, y:Z_TOP+50, life:gLife, dmg:5, tickT:0});
          }
          // 塔特殊子弹命中效果（冰冻视觉/炮弹AOE）
          if(b.fromTower){applyTowerBulletHit(b,zx,zy);}
          // 玩家火箭/湮灭者等直射 AOE 爆炸（v53：半径用武器 aoe）
          else if(b.aoe){
            vfxExplosion(b.x,b.y,b.aoe);sndExplosion();explodeLogic(b.x,b.y,b.dmg,b.aoe);
          }
          if(pierceAll){z._pierceHit=z._pierceHit||{};z._pierceHit[b.id]=true;}
          // ── v53十字弩穿透上限：贯穿4敌后箭矢坠落（pierceMax）──
          if(b.pierceMax){
            b._pierceN=(b._pierceN||0)+1;
            if(b._pierceN>=b.pierceMax){recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();hit=true;break;}
          }
          if(!b.piercing && !pierceAll){
            if(b.fromTower){/* applyTowerBulletHit 已处理 */}
            else if(b.aoe){vfxExplosion(b.x,b.y,b.aoe);sndExplosion();explodeLogic(b.x,b.y,b.dmg,b.aoe);}
            recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();hit=true;break;
          }
        }
      }
      if(hit)continue;
      // Wanderer hit (旧小镇游荡者)
      for(const w of oldTownWanderers){
        if(!w.alive)continue;
        const wx=w.x+22, wy=Z_TOP+28;
        if(Math.abs(b.x-wx)<35&&Math.abs(b.y-wy)<56){
          hitWanderer(w,b.x,b.y,b.dmg,b.sx,b.sy);
          if(b.aoe&&!b.fromTower){vfxExplosion(b.x,b.y,b.aoe);sndExplosion();addShake(3);}
          if(!b.piercing){recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();hit=true;break;}
        }
      }
      if(hit)continue;
      // Boss hit
      if(boss&&boss.alive&&bossActive&&!hit){
        if(Math.abs(b.x-(boss.x+40))<60&&Math.abs(b.y-(GROUND_Y-80))<80){
          hitBoss(b.dmg,b.x,b.y,b.sx,b.sy,b.dmgType);
          if(b.fromTower){applyTowerBulletHit(b,b.x,b.y);}
          else if(b.aoe){vfxExplosion(b.x,b.y,b.aoe);sndExplosion();explodeLogic(b.x,b.y,b.dmg,b.aoe);}
          if(!b.piercing){recycleBullet(b);bullets[i]=bullets[bullets.length-1];bullets.pop();continue;}
        }
      }
    } catch(bErr) {
      console.warn('[BulletError] 子弹运算异常已安全移除:', bErr);
      recycleBullet(b);
      bullets[i]=bullets[bullets.length-1];bullets.pop();
      continue;
    }
  }
  // Zombies
  if(!frozen)safeSubsystem('PoisonPools', () => updatePoisonPools());
  if(!frozen)for(let i=zombies.length-1;i>=0;i--){
    const z=zombies[i];
    if(!z){zombies.splice(i,1);continue;}
    try {
      // 剔除非法数值/幽灵怪，防死怪占位
      if(!Number.isFinite(z.x) || !Number.isFinite(z.hp)){
        if(z.burnTimer){clearInterval(z.burnTimer);z.burnTimer=null;}
        z.alive=false;
        zombies.splice(i,1);
        continue;
      }
      if(!z.alive){if(z.burnTimer){clearInterval(z.burnTimer);z.burnTimer=null;}zombies.splice(i,1);continue;}
      if(z.hitFlash>0)z.hitFlash=Math.max(0,z.hitFlash-.08);
      if(z.armorBreakT>0)z.armorBreakT--;  // 破甲窗口倒计时
      if(z.bleedTimer>0){
        z.bleedTimer--;
        if(z.bleedTimer%25===0 && z.alive){
          const bDmg = z.bleedDmg || 5;
          z.hp -= bDmg;
          spawnFloatText('-'+bDmg, z.x+22, Z_TOP-14, '#ff2255');
          for(let bi=0; bi<3; bi++){
            mkP({x:z.x+22+(Math.random()-.5)*12, y:Z_TOP+22, vx:(Math.random()-.5)*1.5, vy:Math.random()*1.8, r:1.8, decay:.08, color:'#aa1122', type:'circle', grav:.15, alpha:.9});
          }
          if(z.hp<=0){ killZombie(z, z.x+22, Z_TOP+28); continue; }
        }
      }
      // 毒素持续伤害：帧驱动替代异步 setInterval（隐患1修复，防泄漏与跨场景游离回调）
      if(z.poisonTimer>0 && z.alive){
        z.poisonTimer--;
        if(z.poisonTimer%24===0){
          const pDmg = (z.poisonDmg || Math.max(1, z.maxHp*0.02)) * (z.poisonStacks || 1);
          z.hp -= pDmg;
          mkP({x:z.x+22,y:Z_TOP+15,r:2,decay:.05,color:'#88dd44',type:'circle',grav:-.02,alpha:.7});
          if(z.hp<=0){
            z.poisoned=false; z.poisonStacks=0; z.poisonTimer=0;
            killZombie(z, z.x+22, Z_TOP+28);
            continue;
          }
        }
        if(z.poisonTimer<=0){
          z.poisoned=false;
          z.poisonStacks=0;
          z.spdMul=(z.frostTimer>0)?0.6:1;
        }
      }
      // 燃烧持续伤害：帧驱动替代异步 setInterval（彻底消除原生定时器泄漏与游离异步回调）
      if(z.burnTimer>0 && z.alive){
        z.burnTimer--;
        if(z.burnTimer%11===0){
          const bDmg = z.burnDmg || 0.5;
          z.hp -= bDmg;
          mkP({x:z.x+12+Math.random()*20,y:Z_TOP+8,vx:(Math.random()-.5)*1.5,vy:-1.5-Math.random()*2,r:2.5+Math.random()*3,rDecay:.04,decay:.04,color:Math.random()>.5?'#ff9900':'#ff3300',type:'circle',grav:-.02,alpha:.8,blur:true});
          if(z.hp<=0){
            z.burning=false; z.burnTimer=0;
            killZombie(z, z.x+22, Z_TOP+20);
            continue;
          }
        }
        if(z.burnTimer<=0){
          z.burning=false;
          z.burnTimer=0;
        }
      }
    // ── v50模块二：黏弹倒计时+引爆 ──
    if(z._sticky){
      z._sticky.t--;
      // 引信闪烁
      if(z._sticky.t % 10 === 0) mkP({x:z.x+22,y:Z_TOP+22,r:1.5,rDecay:.06,decay:.08,color:'#ffcc44',type:'spark',grav:0,alpha:.9});
      if(z._sticky.t <= 0){
        const ex=z.x+22, ey=Z_TOP+28, sd=z._sticky;
        z._sticky = null;
        // v53：爆破专家爆炸范围被动+20% 在此生效
        const sdAoe = sd.aoe * (playerClass && playerClass.id==='demolition' ? 1.2 : 1);
        vfxExplosion(ex,ey,sdAoe); sndExplosion(); addShake(6);
        // 范围伤害（爆炸无视50%护甲）
        zombies.forEach(z2=>{if(z2.alive&&Math.abs((z2.x+22)-ex)<sdAoe){hitZombie(z2,z2.x+22,Z_TOP+28,sd.dmg,ex,ey,1,'explosive');}});
        if(boss&&boss.alive&&Math.abs((boss.x+40)-ex)<sdAoe+30)hitBoss(sd.dmg,ex,ey,ex,ey,'explosive');
      }
    }
    // Elite zombies run their own AI; skip default chase
    if(z.elite){
      updateElite(z);
      // Elite contact damage (shared with normal)
      const zcx2=z.x+22;
      if(vehicle.entered){
        if(zcx2>vehicle.x&&zcx2<vehicle.x+120){
          // 城堡塔防制（v47回退）：精英撞战车消失
          z.alive=false;if(z.burnTimer)clearInterval(z.burnTimer);
          zombies.splice(i,1);
          vehicle.hp-=12;
          vfxHit(zcx2,Z_TOP+30,vehicle.x+60,Z_TOP+30);
          sndHit();
          if(z.elite===1)spawnPoisonPool(z.x+22);
          if(vehicle.hp<=0){
            vfxExplosion(vehicle.x+60,GROUND_Y-22);
            vehicle.exists=false;vehicle.entered=false;player.x=vehicle.x+60;player.y=CHAR_GY;
            addBanner('⚠ 战车被摧毁！');
          }
        }
      }else if(player.iframes===0){
        const pcx2=player.x+CHAR_W/2;
        const pb2=player.y+CHAR_H;
        const contactR=z.elite===3?32:38;
        if(Math.abs(zcx2-pcx2)<contactR&&pb2>Z_TOP+10){
          // 城堡塔防制（v47回退）：精英撞玩家消失
          z.alive=false;if(z.burnTimer)clearInterval(z.burnTimer);
          zombies.splice(i,1);takeDamage(14);
          player.vx=(player.x<z.x)?-9:9;player.vy=-5;player.onGround=false;player.iframes=90;
          vfxPlayerHurt(player.x,player.y);sndPlayerHurt();
          if(z.elite===1)spawnPoisonPool(z.x+22); // spitter dies on contact too
        }
      }
      continue;
    }
    // ── v49批3：伙伴作为真实目标——最近的未倒地伙伴且足够近(<240)时优先追伙伴 ──
    // v54修：zcx 声明前置（原在下方的 const pcx=targetX,zcx=z.x+22 导致 TDZ ReferenceError，有伙伴/狼人开局必黑屏）
    const zcx = z.x + 22;
    let targetX = vehicle.entered ? (vehicle.x+60) : (player.x+CHAR_W/2);
    let targetComp = null;
    if(!vehicle.entered && hiredCompanions.length){
      let bd = 240;
      for(const cc of hiredCompanions){
        if(cc.downed)continue;
        const cx = (cc.x !== undefined && !Number.isNaN(cc.x)) ? cc.x : player.x;
        const d = Math.abs((cx+18) - zcx);
        if(d < bd){ bd = d; targetComp = cc; }
      }
      if(targetComp) targetX = ((targetComp.x !== undefined && !Number.isNaN(targetComp.x)) ? targetComp.x : player.x) + 18;
    }
    const pcx = targetX;
    // 城堡塔防制（v47回退）：僵尸追击玩家/战车（原版手感；批3起伙伴也是目标）
    const dir=Math.sign(pcx-zcx);
    // 击退 + 硬直处理（任务2）
    if(z.knockback){z.x+=z.knockback*0.6;z.knockback*=0.7;if(Math.abs(z.knockback)<0.3)z.knockback=0;}
    if(z.hitStun>0){z.hitStun--;z.walkT+=0.02;}
    else{
      // 肉鸽天赋：冰冷触感 减速衰减
      const frostMul = z.frostTimer>0 ? (z.spdMul||0.7) : 1;
      if(z.frostTimer>0)z.frostTimer--;
      // 部位伤害：腿部减速衰减
      let legMul = 1;
      if(z.legSlowTimer>0){z.legSlowTimer--; legMul=0.6;}
      z.facingR=(dir>0);
      // 冲刺AI（原版：接近目标时触发）
      const dist=Math.abs(pcx-zcx);
      if(z.dashCd>0)z.dashCd--;
      if(z.dashTimer>0){z.dashTimer--;z.x+=dir*z.spd*2.8*frostMul*legMul;z.walkT+=.15;}
      else if(dist<250&&dist>60&&z.dashCd<=0&&Math.random()<0.015){
        z.dashTimer=18;z.dashCd=120+Math.floor(Math.random()*80);
        mkP({x:zcx,y:Z_TOP+30,vx:-dir*2,vy:0,r:3,rDecay:.1,decay:.06,color:'#aaddff',type:'circle',alpha:.6,grav:0});
      }
      else{
        // 远距离赶路防断怪保护：当僵尸离视口较远且玩家在基地时，加速奔赴前线
        let rushMul = 1;
        if(z.x > cameraX + GW + 240 && dir < 0 && player.x <= RIGHT_WALL_X + 150){
          rushMul = 3.5;
        }
        z.x += dir * z.spd * frostMul * legMul * rushMul;
        z.walkT += .055 * z.spd * frostMul * legMul * rushMul;
      }
    }
    // ── 新原型机制更新 ──
    tickZArchetype(z, pcx, zcx, dir);
    // ── 弹跳狂尸：接触围墙时跳跃越过 ──
    if(z.zType==='jumper' && !z.hasJumped && z.x <= RIGHT_WALL_X + 30 && z.x > LEFT_WALL_X){
      z.hasJumped = true;
      z.jumpTimer = 50;  // 跳跃动画
      z.x = LEFT_WALL_X + 30;  // 直接跳到墙内
      spawnFloatText('越墙!', z.x+22, Z_TOP-15, '#aa44cc');
      for(let i=0;i<10;i++){mkP({x:RIGHT_WALL_X+10,y:Z_TOP+30,vx:-2-Math.random()*3,vy:-3-Math.random()*4,r:3,rDecay:.06,decay:.05,color:'#aa44cc',type:'spark',grav:.2,alpha:.9});}
      sndJump();
    }
    // ── 自爆殉道者：接触玩家/围墙时立即爆炸 ──
    const playerRealX = vehicle.entered ? (vehicle.x+60) : (player.x+CHAR_W/2);
    if(z.zType==='exploder' && z.explodeArmed){
      const shouldExplode = (
        (!vehicle.entered && player.iframes===0 && Math.abs(zcx-playerRealX)<40 && (player.y+CHAR_H)>Z_TOP+10) ||
        (wallHp>0 && z.x <= RIGHT_WALL_X + 20)
      );
      if(shouldExplode){
        // 直接触发爆炸（不经过killZombie，先标记armed=false防重）
        z.explodeArmed = false;
        const ex=z.x+22, ey=Z_TOP+28, ER=110, EDmg=40;
        vfxExplosion(ex,ey);sndExplosion();addShake(8);
        for(let i=0;i<20;i++){const a=i/20*Math.PI*2;mkP({x:ex,y:ey,vx:Math.cos(a)*6,vy:Math.sin(a)*6-1,r:4+Math.random()*3,rDecay:.05,decay:.04,color:Math.random()>.5?'#ff6600':'#ffaa00',type:'spark',grav:.1,alpha:.95});}
        // 伤害玩家
        if(!vehicle.entered && Math.abs(playerRealX-ex)<ER){
          takeDamage(25);
          player.vx=(player.x<ex)?-10:10;player.vy=-6;player.onGround=false;player.iframes=60;
        }
        // 伤害围墙
        if(wallHp>0 && Math.abs(RIGHT_WALL_X-ex)<ER){
          wallHp=Math.max(0,wallHp-50);
          if(wallHp<=0){addBanner('🧱 围墙被自爆僵尸炸毁！');sndExplosion();addShake(8);}
        }
        // 伤害其他僵尸
        zombies.forEach(z2=>{if(z2.alive&&z2!==z&&Math.abs((z2.x+22)-ex)<ER){hitZombie(z2,z2.x+22,Z_TOP+28,EDmg,ex,ey);}});
        // 自爆者死亡（不掉落常规肉）
        z.alive=false; if(z.burnTimer){clearInterval(z.burnTimer);z.burnTimer=null;}
        z.hp=0;
        killCount++; killsEl.textContent=killCount;
        spawnLoot(ex,ey, z.coinReward||25);
        lootDrops.push(createLootItem(ex, ey, 'meat_elite', 1));
        vfxKill(ex,ey);
      }
    }
    if(vehicle.entered){
      if(zcx>vehicle.x&&zcx<vehicle.x+120){
        // 城堡塔防制（v47回退）：撞击战车后僵尸消失（原版手感）
        z.alive=false;if(z.burnTimer){clearInterval(z.burnTimer);z.burnTimer=null;}
        zombies.splice(i,1);
        vehicle.hp-=8;
        vfxHit(zcx,Z_TOP+30,vehicle.x+60,Z_TOP+30);
        sndHit();
        if(vehicle.hp<=0){
          vfxExplosion(vehicle.x+60,GROUND_Y-22);
          vehicle.exists=false;vehicle.entered=false;player.x=vehicle.x+60;player.y=CHAR_GY;
          addBanner('⚠ 战车被摧毁！');
        }
        continue;
      }
    }else if(player.iframes===0){
      const pb=player.y+CHAR_H;
      // 修复黑屏致命根因：必须对比玩家真实坐标 playerRealX，严禁使用追逐伙伴时的 pcx！
      if(Math.abs(zcx-playerRealX)<38&&pb>Z_TOP+10){
        // 城堡塔防制（v47回退）：撞击玩家后僵尸消失（原版手感）
        z.alive=false;if(z.burnTimer){clearInterval(z.burnTimer);z.burnTimer=null;}
        zombies.splice(i,1);takeDamage(12);
        player.vx=(player.x<z.x)?-8:8;player.vy=-5;player.onGround=false;player.iframes=90;
        vfxPlayerHurt(player.x,player.y);sndPlayerHurt();
        continue;
      }
    }
    // ── v49批3：僵尸接触伙伴造成伤害（咬一口，僵尸不消失；伙伴HP归零倒地）──
    if(targetComp && !targetComp.downed){
      const compX = (Number.isFinite(targetComp.x) ? targetComp.x : player.x) + 18;
      if(Math.abs(zcx-compX)<34 && (frameT%45===0)){
        const zdmg = z.elite ? 22 : 12;
        targetComp.hp -= zdmg;
        vfxHit(zcx, Z_TOP+30, compX, Z_TOP+30);
        mkP({x:compX,y:Z_TOP+30,vx:(Math.random()-.5)*2,vy:-1.5,r:2,rDecay:.06,decay:.05,color:'#aa1818',type:'circle',grav:.1,alpha:.8});
        if(targetComp.hp <= 0){
          targetComp.hp = 0;
          targetComp.downed = true;
          targetComp.downedT = 60*60;  // 当波内可救
          companionBark(targetComp, 'downed');
          addBanner(`⚠ ${targetComp.name} 倒地了！靠近按 E 救援或吹响战号`);
        }
      }
    }
    } catch(zErr) {
      console.warn('[ZombieError] 僵尸运算异常已自愈清理:', zErr);
      if(z.burnTimer){ clearInterval(z.burnTimer); z.burnTimer = null; }
      z.alive = false;
      zombies.splice(i, 1);
      continue;
    }
  }
  // ── 僵尸移动后再次检查围墙阻挡（防止移动后穿墙）──
  for(const z of zombies){
    if(!z||!z.alive)continue;
    const deathPact = !!playerPerks.deathpact;
    // 跳跃中的僵尸不挡墙
    if(z.zType==='jumper' && z.jumpTimer>0){ z.jumpTimer--; continue; }
    if(z.x <= RIGHT_WALL_X + 2 && z.x > LEFT_WALL_X){
      if(wallHp > 0 || deathPact){
        z.x = RIGHT_WALL_X + 2;  // 推回墙外
      }
    }
  }
  // Flash decay
  if(redFlash>0.01)redFlash*=.76;else redFlash=0;
  if(orangeFlash>0.01)orangeFlash*=.78;else orangeFlash=0;
  if(purpleFlash>0.01)purpleFlash*=.80;else purpleFlash=0;
  if(muzzleLightFlash>0.01)muzzleLightFlash*=.72;else muzzleLightFlash=0;
  if(critFlash>0.01)critFlash*=.80;else critFlash=0;
  updateReloadMagDrop();
  repositionTowerPopover();  // 塔弹窗跟随相机滚动
  updateFireballs();  // 火球更新+碰撞

  // ── RENDER ──
  // 世界段：天空(屏幕固定) + 实体(随相机滚动)
  ctx.save();
  drawSky(frameT);
  ctx.save();
  ctx.translate(shakeX-cameraX,shakeY);
  drawWorldScenery(frameT);
  drawRuins(frameT);      // 废墟装饰（残墙/废弃车/油桶）
  drawBuildings();
  drawBarricade();
  drawBeaconTower(frameT); // 世界右端广播塔（目的地）
  drawPoisonPools(); // 毒沼画在地面景物之上、实体之下
  updateAndDrawGroundFires(); // 凝固汽油火海
  drawLootDrops();
  drawHiddenChests();
  drawGasStation();
  drawCabinTurret();
  drawWall();            // 家园围墙
  // drawTowerSlots() 已移除——地板/平台上不再有塔位标记，玩家可自由放置
  drawTowers();          // 家园塔防系统
  // Entities
  if(vehicle.exists)drawVehicle(vehicle,frameT);
  zombies.forEach(z=>drawZombie(z,frameT));
  drawWanderers();
  if(bossActive&&boss&&boss.alive)drawBoss(boss,frameT);
  bossProjList.forEach(bp=>{if(bp.active)drawBossProj(bp);});
  drawFuses();            // v53引信系统：埋设的手榴弹/地雷弹体
  drawSkillWolves();      // v53流派觉醒：狼群召唤的战斗狼
  drawBullets();
  updateAndDrawSpecialWeaponVFX();
  drawReloadMagDrop();
  if(!vehicle.entered){
    const aimA=getAimAngle();
    drawPlayer(player.x,player.y,player.facingRight,player.walkT,aimA,!player.onGround,player.iframes>0,frameT,dodgeT);
    // 翻滚冷却指示器
    if(dodgeCd>0&&!vehicle.entered){
      ctx.save();
      const cx=player.x+CHAR_W/2, cy=player.y-8;
      const cdR=dodgeCd/40;
      ctx.strokeStyle=cdR>0.5?'#5be4ff':'#44ff66';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(cx,cy,12,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-cdR));ctx.stroke();
      ctx.restore();
    }
    // 蓄力近战指示器
    if(isCharging&&!vehicle.entered){
      ctx.save();
      const cx=player.x+CHAR_W/2, cy=player.y+CHAR_H/2;
      const pct=chargeMelee/chargeMeleeMax;
      ctx.strokeStyle=pct>=0.8?'#ff4400':'#ffaa00';ctx.lineWidth=3;
      ctx.shadowBlur=8;ctx.shadowColor=ctx.strokeStyle;
      ctx.beginPath();ctx.arc(cx,cy,30,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);ctx.stroke();
      ctx.shadowBlur=0;
      if(pct>=0.8){
        const pulse=0.5+0.5*Math.sin(frameT*0.3);
        ctx.globalAlpha=0.3+pulse*0.3;ctx.fillStyle='#ff4400';
        ctx.beginPath();ctx.arc(cx,cy,35+pulse*5,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=1;
      }
      ctx.restore();
    }
  }
  drawCompanions();
  drawFieldSurvivors();
  if(sprite.exists)drawSprite(sprite,frameT);
  drawParticles();
  drawLamps(frameT);      // 路灯光晕（覆盖实体，照亮夜路）
  ctx.restore();
  ctx.restore();
  // HUD 段：闪屏/暗角/准星（屏幕固定，仅 shake）
  ctx.save();
  if(shakeX||shakeY)ctx.translate(shakeX,shakeY);
  if(redFlash>0.01){ctx.fillStyle=`rgba(180,20,20,${redFlash*.4})`;ctx.fillRect(0,0,GW,GH);const vig=ctx.createRadialGradient(GW/2,GH/2,GH*.1,GW/2,GH/2,GH*.8);vig.addColorStop(0,'rgba(180,0,0,0)');vig.addColorStop(1,`rgba(180,0,0,${redFlash*.3})`);ctx.fillStyle=vig;ctx.fillRect(0,0,GW,GH);}
  if(orangeFlash>0.01){ctx.fillStyle=`rgba(230,130,10,${orangeFlash*.28})`;ctx.fillRect(0,0,GW,GH);}
  if(purpleFlash>0.01){ctx.fillStyle=`rgba(120,30,200,${purpleFlash*.25})`;ctx.fillRect(0,0,GW,GH);}
  if(levelUpFlash>0.01){ctx.fillStyle=`rgba(255,238,68,${levelUpFlash*.2})`;ctx.fillRect(0,0,GW,GH);}
  if(muzzleLightFlash>0.01){
    const mlcv = getMuzzleLightCanvas();
    if(mlcv){
      ctx.save();
      ctx.globalAlpha = muzzleLightFlash * 0.22;
      ctx.drawImage(mlcv, 0, 0, GW, GH);
      ctx.restore();
    }
  }
  if(critFlash>0.01){ctx.fillStyle=`rgba(255,220,80,${critFlash*.18})`;ctx.fillRect(0,0,GW,GH);}
  // 迷雾波：视野缩小
  if(window.__waveSpecial==='fog'&&gameState==='world'){
    const fogR=120;
    const pcx=player.x-cameraX+CHAR_W/2, pcy=player.y+CHAR_H/2;
    const fg=ctx.createRadialGradient(pcx,pcy,fogR*.3,pcx,pcy,fogR);
    fg.addColorStop(0,'rgba(80,80,90,0)');
    fg.addColorStop(.7,'rgba(80,80,90,.3)');
    fg.addColorStop(1,'rgba(60,60,70,.85)');
    ctx.fillStyle=fg;ctx.fillRect(0,0,GW,GH);
  }
  // ── 低血量氛围警告（参考潜水员戴夫的缺氧红屏 + 心跳脉冲） ──
  if(gameRunning && !cinActive && health > 0 && health < maxHp * 0.3){
    const hpRatio = health / maxHp;  // 0~0.3
    const danger = 1 - (hpRatio / 0.3);  // 0(刚到30%)~1(快死)
    const pulse = 0.5 + 0.5 * Math.sin(frameT * 0.12);  // 心跳脉冲
    // 1. 边缘红色暗角（越危险越深）
    const lowVig = ctx.createRadialGradient(GW/2, GH/2, GH*0.25, GW/2, GH/2, GH*0.85);
    lowVig.addColorStop(0, 'rgba(140,0,0,0)');
    lowVig.addColorStop(0.6, `rgba(140,0,0,${danger*0.15})`);
    lowVig.addColorStop(1, `rgba(180,0,0,${danger*0.55*pulse})`);
    ctx.fillStyle = lowVig;
    ctx.fillRect(0, 0, GW, GH);
    // 2. 屏幕边缘"裂纹"效果（极度危险时）
    if(danger > 0.5){
      ctx.save();
      ctx.strokeStyle = `rgba(200,20,20,${(danger-0.5)*0.8})`;
      ctx.lineWidth = 1.5;
      const cracks = [
        [[0,0],[80,40],[60,120],[120,160]],
        [[GW,0],[GW-80,40],[GW-60,120],[GW-120,160]],
        [[0,GH],[80,GH-40],[60,GH-120],[120,GH-160]],
        [[GW,GH],[GW-80,GH-40],[GW-60,GH-120],[GW-120,GH-160]],
      ];
      cracks.forEach(crack => {
        ctx.beginPath();
        ctx.moveTo(crack[0][0], crack[0][1]);
        for(let i=1;i<crack.length;i++){
          ctx.lineTo(crack[i][0], crack[i][1]);
        }
        ctx.stroke();
      });
      ctx.restore();
    }
    // 3. "危险"文字提示（脉冲显示）
    if(danger > 0.3){
      ctx.save();
      ctx.font = `bold ${14+danger*6}px Microsoft YaHei UI,sans-serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 12;
      const warnText = danger > 0.7 ? '危险！' : '低血量';
      ctx.fillText(warnText, GW/2, 50);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    // 4. 心跳音效（每45帧一次）
    if(frameT % 45 === 0){
      try{
        const a=getACtx();
        const osc=a.createOscillator();
        const gain=a.createGain();
        const now=a.currentTime;
        osc.type='sine';
        osc.frequency.setValueAtTime(60,now);
        osc.frequency.exponentialRampToValueAtTime(40,now+0.15);
        gain.gain.setValueAtTime(0.0,now);
        gain.gain.linearRampToValueAtTime(0.25*SFX_VOL,now+0.03);
        gain.gain.exponentialRampToValueAtTime(0.001,now+0.25);
        osc.connect(gain);gain.connect(a.destination);
        osc.start(now);osc.stop(now+0.3);
      }catch(e){}
    }
  }
  const pcv = getPvigCanvas();
  if(pcv) ctx.drawImage(pcv, 0, 0, GW, GH);
  drawCrosshair(lastMX-cameraX,lastMY);
  // 侦察视角指示器：蓝色边框 + "侦察中"标签 + 玩家位置箭头
  if(scoutView){
    ctx.save();
    // 蓝色边框
    ctx.strokeStyle='rgba(108,182,224,.6)';ctx.lineWidth=3;
    ctx.strokeRect(1.5,1.5,GW-3,GH-3);
    // 顶部标签
    ctx.fillStyle='rgba(20,40,60,.85)';ctx.fillRect(GW/2-70,4,140,18);
    ctx.strokeStyle='#6cb6e0';ctx.lineWidth=1;ctx.strokeRect(GW/2-70,4,140,18);
    ctx.fillStyle='#6cb6e0';ctx.font='bold 11px sans-serif';ctx.textAlign='center';
    ctx.fillText('🔍 侦察战场 (松开Q返回)',GW/2,16);
    // 玩家位置指示箭头（玩家在屏幕左侧外时指向左边缘）
    const pScreenX=player.x-cameraX;
    if(pScreenX<0||pScreenX>GW){
      const edgeX=pScreenX<0?10:GW-10;
      const dir=pScreenX<0?-1:1;
      ctx.fillStyle='#ffcc44';ctx.beginPath();
      ctx.moveTo(edgeX,GH/2-8);ctx.lineTo(edgeX+dir*14,GH/2);ctx.lineTo(edgeX,GH/2+8);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffcc44';ctx.font='9px sans-serif';
      ctx.fillText('🏠 家园',pScreenX<0?60:GW-60,GH/2+4);
    }
    ctx.restore();
  }
  // 放置模式预览：塔=吸附到平台有效位置，陷阱=跟随鼠标；绿=可放置，红=无效
  if(placementMode){
    let py=GROUND_Y-8;
    let px, valid, label;
    if(placementMode.type==='tower'){
      // 平台自由放置（v47回退）：在玩家点击x附近找最近的有效平台位置
      const {slotIdx, dist, slotX}=findNearestEmptySlot(lastMX);
      if(slotIdx>=0 && dist<=180){
        px=slotX-cameraX; valid=coins>=placementMode.cost;
        // 塔位在城堡平台上
        py = PLATFORM_TOP - 8;
        label=valid?`✓ 平台 x=${Math.round(slotX)} · 💰${placementMode.cost}`:`💰 金币不足`;
      }else{
        px=lastMX-cameraX; valid=false;
        label=slotIdx<0?'⚠ 平台已满':'⚠ 请点击城堡平台上';
      }
    }else{
      // 陷阱跟随鼠标
      px=lastMX-cameraX;
      valid=isTrapPosValid(lastMX) && coins>=placementMode.cost;
      label=valid?`✓ 💰${placementMode.cost}`:(coins<placementMode.cost?'💰 金币不足':'⚠ 位置无效');
    }
    const col=valid?'#44ff66':'#ff4444';
    ctx.save();
    // 脉冲圆环
    const pulse=0.5+0.5*Math.sin(frameT*0.12);
    ctx.globalAlpha=.4+pulse*.3;
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.arc(px,py,20+pulse*4,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    // 实心内圈
    ctx.globalAlpha=.15;
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(px,py,16,0,Math.PI*2);ctx.fill();
    // 图标
    ctx.globalAlpha=.85;
    ctx.fillStyle=col;ctx.font='20px sans-serif';ctx.textAlign='center';
    ctx.fillText(placementMode.icon, px, py-2);
    // 标签
    ctx.globalAlpha=1;
    ctx.fillStyle=col;ctx.font='bold 10px sans-serif';
    ctx.fillText(label, px, py-28);
    // 提示文字
    ctx.fillStyle='rgba(255,238,68,.8)';ctx.font='9px sans-serif';
    ctx.fillText(placementMode.type==='tower'?'左键放置 · 右键/Esc取消':'左键放置 · 右键/Esc取消', px, py-40);
    ctx.restore();
  }
  ctx.restore();
  // ── 尸潮避难所指引信标与长按闭锁入屋系统 ──
  if(gameState === 'world' && (isHordeThreatActive() || wavePhase === 'cleared')){
    const nearCabin = isPlayerNearCabin();
    const cabinDoorScreenX = 165 - cameraX;
    const platTop = typeof PLATFORM_TOP !== 'undefined' ? PLATFORM_TOP : 435;

    // 1. 小屋门前引导信标与地面光圈（避难指示）
    if(cabinDoorScreenX >= -100 && cabinDoorScreenX <= GW + 100){
      ctx.save();
      const beaconAlpha = 0.4 + 0.3 * Math.sin(frameT * 0.1);
      const bGrad = ctx.createLinearGradient(cabinDoorScreenX, platTop, cabinDoorScreenX, platTop - 90);
      bGrad.addColorStop(0, `rgba(0, 240, 255, ${beaconAlpha})`);
      bGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = bGrad;
      ctx.fillRect(cabinDoorScreenX - 20, platTop - 90, 40, 90);

      // 地面光圈
      ctx.beginPath();
      ctx.ellipse(cabinDoorScreenX, platTop, 26, 7, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${beaconAlpha + 0.25})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 入口提示
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00f0ff';
      ctx.fillText('🚪 避难所入口', cabinDoorScreenX, platTop - 55);
      ctx.fillText(wavePhase === 'cleared' ? '[ 按E进入 ]' : '[ 长按E闭锁 ]', cabinDoorScreenX, platTop - 42);
      ctx.restore();
    }

    // 自动接合持续按住状态（如玩家跑向小屋时提前按住E，抵达门前自动起充；或被击退后再次走入门前自动恢复充能）
    if(keys.holdInteract && nearCabin && !cabinHoldActive){
      if(wavePhase === 'cleared'){
        enterCabinShelter();
      } else {
        startCabinHold();
      }
    }

    // 2. 长按逻辑与反馈
    if(cabinHoldActive){
      if(nearCabin){
        cabinHoldTimer++;
        if(cabinHoldTimer % 18 === 1){
          playHoldTickSound(cabinHoldTimer / CABIN_HOLD_MAX);
        }
        if(frameT % 3 === 0){
          spawnCabinHoldParticles();
        }
        if(cabinHoldTimer >= CABIN_HOLD_MAX){
          keys.holdInteract = false;
          cabinHoldActive = false;
          cabinHoldTimer = 0;
          enterCabinShelter();
        }
      } else {
        // 脱离小屋大门交互范围：进度快速衰减
        if(cabinHoldTimer > 0) cabinHoldTimer = Math.max(0, cabinHoldTimer - 3);
        if(cabinHoldTimer === 0){
          cabinHoldActive = false;
          addBanner('⚠ 已脱离小屋大门！闭锁中断');
        }
      }

      // 3. 玩家身周环形充能进度条 (Radial Ring)
      const pxScreen = player.x + CHAR_W/2 - cameraX;
      const pyScreen = player.y + CHAR_H/2;
      const prog = Math.min(1, cabinHoldTimer / CABIN_HOLD_MAX);
      if(pxScreen >= -60 && pxScreen <= GW + 60){
        ctx.save();
        const radius = 30;
        // 底轨
        ctx.beginPath();
        ctx.arc(pxScreen, pyScreen, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
        ctx.lineWidth = 4;
        ctx.stroke();
        // 充能弧
        ctx.beginPath();
        ctx.arc(pxScreen, pyScreen, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
        ctx.strokeStyle = nearCabin ? '#00f0ff' : '#ff4444';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 10;
        ctx.shadowColor = nearCabin ? '#00f0ff' : '#ff4444';
        ctx.stroke();
        // 倒计时文本
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(((CABIN_HOLD_MAX - cabinHoldTimer) / 60).toFixed(1) + 's', pxScreen, pyScreen - radius - 10);
        ctx.restore();
      }

      // 4. 屏幕中央下方战术充能长形进度条
      const barW = 280, barH = 22;
      const barX = (GW - barW) / 2;
      const barY = GH - 85;
      ctx.save();
      // 外框
      ctx.fillStyle = 'rgba(10, 14, 24, 0.92)';
      ctx.fillRect(barX - 4, barY - 4, barW + 8, barH + 8);
      ctx.strokeStyle = nearCabin ? '#00f0ff' : '#ff4444';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(barX - 4, barY - 4, barW + 8, barH + 8);

      // 渐变填充
      const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      if(nearCabin){
        grad.addColorStop(0, '#ff4444');
        grad.addColorStop(0.5, '#f39c12');
        grad.addColorStop(1, '#00f0ff');
      } else {
        grad.addColorStop(0, '#662222');
        grad.addColorStop(1, '#ff4444');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(barX, barY, barW * prog, barH);

      // 条形内边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      // 文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#000000';
      const hint = nearCabin
        ? `🚪 破障闭锁中... ${((CABIN_HOLD_MAX - cabinHoldTimer) / 60).toFixed(1)}s (${Math.floor(prog * 100)}%)`
        : '⚠ 脱离小屋大门！充能衰减中！快返回门前！';
      ctx.fillText(hint, GW / 2, barY + barH / 2);
      ctx.restore();
    } else {
      if(cabinHoldTimer > 0) cabinHoldTimer = Math.max(0, cabinHoldTimer - 4);
    }
  } else {
    keys.holdInteract = false;
    cabinHoldActive = false;
    cabinHoldTimer = 0;
  }
  drawWaveHUD();  // 画布上的波次HUD（始终可见）
  updateWorldProgress();
  mobileStatusTick();
  updateNextWaveBtn();
  }catch(err){
    console.error('[gameLoop] 渲染/更新异常，已跳过本帧以防黑屏:', err);
  }finally{
    animFrame=requestAnimationFrame(gameLoop);
  }
}

// ═══════════════════════════════════════════

//  系统10: 移动端优化 — 自动瞄准
// ═══════════════════════════════════════════
let autoAimEnabled=true; // 移动端默认开启自动瞄准
function getAutoAimTarget(){
  if(!autoAimEnabled||!isMobile())return null;
  const px=player.x+CHAR_W/2, py=player.y+CHAR_H/2;
  let best=null,bestD=600;
  zombies.forEach(z=>{
    if(!z.alive)return;
    const d=Math.abs(z.x+22-px);
    if(d<bestD){bestD=d;best=z;}
  });
  if(bossActive&&boss&&boss.alive){
    const d=Math.abs(boss.x+40-px);
    if(d<bestD){bestD=d;best={x:boss.x+40,y:GROUND_Y-80,isBoss:true};}
  }
  return best;
}
// 在touchFire中自动瞄准最近敌人（已由现有touchFire逻辑实现，这里仅做开关）

// 初始化隐藏宝箱 + 旧小镇事件
// [初始化与启动钩子已统筹归入 Block 06 主生命周期与结束流程]


