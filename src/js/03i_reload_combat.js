// ═══════════════════════════════════════════
//  RELOAD
// ═══════════════════════════════════════════
// 跟踪换弹过程中已调度的事件，便于中途取消
let reloadSoundTimers=[];
let reloadStageFlags={s1:false,s3:false,s5:false};
function clearReloadSounds(){
  reloadSoundTimers.forEach(t=>clearTimeout(t));
  reloadSoundTimers=[];
  reloadStageFlags={s1:false,s3:false,s5:false};
}
function cancelReload(){
  if(isReloading){
    clearInterval(reloadTimer);
    isReloading=false;
    reloadAnimT=0;
    reloadPhase=0;
    clearReloadSounds();
    const rBtn = document.getElementById('reload-btn') || (typeof rldBtn !== 'undefined' ? rldBtn : null);
    const rW = document.getElementById('reload-wrap') || (typeof rldW !== 'undefined' ? rldW : null);
    const rF = document.getElementById('reload-fill') || (typeof rldF !== 'undefined' ? rldF : null);
    if(rBtn) rBtn.disabled = false;
    if(rW) rW.style.display = 'none';
    if(rF) rF.style.width = '0%';
  }
}

function reloadWeapon(){
  const w=cw();
  if(w.id==='minigun')return;
  // 湮灭者不可换弹
  if(w.noRefill){addBanner('⚠ 湮灭者弹药无法补充');return;}
  // 肉鸽天赋：弹药专家 弹匣+30%/层，换弹-20%/层
  const ammoMul = 1 + (playerPerks.ammojack||0)*0.3;
  let reloadMul = Math.max(0.3, 1 - (playerPerks.ammojack||0)*0.2);
  // v52肉鸽·武器线：快手 换弹+30%/层
  if(playerPerks.fasthands) reloadMul = Math.max(0.2, reloadMul / (1 + playerPerks.fasthands*0.3));
  // ── 小胡武器改造台：极速快拔改装 (-15%/级) ──
  if(typeof getWeaponMod === 'function'){
    const rMod = getWeaponMod(w.id, 'reload');
    if(rMod > 0) reloadMul *= Math.pow(0.85, rMod);
  }
  const maxA=weaponMagSize(w);
  if(isReloading||wAmmo[curWpnIdx]>=maxA)return;
  stopAuto();isReloading=true;rldBtn.disabled=true;rldW.style.display='block';rldF.style.width='0%';
  reloadAnimT=100;
  reloadWpnId=w.id;
  reloadPhase=1;
  reloadStageFlags={s1:false,s3:false,s5:false};
  const totalMs=Math.max(w.reloadMs*reloadMul,100);
  // 调度分阶段音效（卸弹→装弹→上膛）
  sndReloadSequence(w.id, totalMs);
  // 阶段事件（由进度循环触发 VFX，与音效时间轴对齐）
  let prog=0;const step=50,inc=(step/totalMs)*100;
  // 卸弹匣：弹匣掉落 + 火星（prog~8%）
  const s1To=Math.round(totalMs*0.10);
  reloadSoundTimers.push(setTimeout(()=>{
    if(!isReloading)return;
    const pivX=player.x+(player.facingRight?CHAR_W*0.5:CHAR_W*0.5);
    const pivY=player.y+34;
    vfxReloadStart(pivX,pivY);
    spawnReloadMagDrop(pivX,pivY,player.facingRight);
    reloadPhase=2;
  },s1To));
  // 装弹匣（prog~45%）：阶段切换
  const s3To=Math.round(totalMs*0.48);
  reloadSoundTimers.push(setTimeout(()=>{
    if(!isReloading)return;
    reloadPhase=3;
  },s3To));
  // 上膛完成（prog~92%）：金色火星 + 光环
  const s5To=Math.round(totalMs*0.92);
  reloadSoundTimers.push(setTimeout(()=>{
    if(!isReloading)return;
    reloadPhase=4;
    const pivX=player.x+(player.facingRight?CHAR_W*0.82:CHAR_W*0.18);
    const pivY=player.y+28;
    vfxReloadComplete(pivX,pivY);
  },s5To));
  reloadTimer=setInterval(()=>{
    if(shopOpen||cabinUIOpen||gamePaused||(typeof isDuffWorkshopOpen==='function'&&isDuffWorkshopOpen())||(typeof isTacticalFeastOpen==='function'&&isTacticalFeastOpen()))return;
    prog+=inc;rldF.style.width=Math.min(prog,100)+'%';
    reloadAnimT=Math.max(0,100-prog);
    if(prog>=100){
      clearInterval(reloadTimer);
      const curW = cw();
      const finalMax = curW ? weaponMagSize(curW) : maxA;
      wAmmo[curWpnIdx]=finalMax;
      isReloading=false;reloadAnimT=0;reloadPhase=0;clearReloadSounds();rldBtn.disabled=false;rldW.style.display='none';rldF.style.width='0%';updateAmmoUI();refreshWBar();
      // 换弹完成提示
      spawnFloatText('✓ 装填完成',player.x+CHAR_W/2,player.y-10,'#ffee88');
    }
  },step);
}
function switchWeapon(idx){
  // idx = WEAPONS 索引（必须已拥有）
  if(!gameRunning||!ownedWeaponsSet.has(idx))return;stopAuto();
  cancelReload();
  // v52肉鸽·武器线：双持——切枪后3秒内伤害+40%
  if(playerPerks.dualwield && idx!==curWpnIdx){
    window._dualwieldT = 180;
    spawnFloatText('⚔ 双持!', player.x+CHAR_W/2, player.y-30, '#ffdd66');
  }
  curWpnIdx=idx;updateAmmoUI();refreshWBar();
}
// 按武器栏槽位序号切换（键盘 1-9）
function switchWeaponBySlot(slot){
  if(slot<0||slot>=ownedWeapons.length)return;
  switchWeapon(ownedWeapons[slot]);
}

// ═══════════════════════════════════════════
//  COMBAT
// ═══════════════════════════════════════════
function hitZombie(z,bx,by,dmg,fromX,fromY,knockbackMult,dmgType){
  if(!z.alive)return;
  // ── 双轴克制管线（王国保卫战式）──
  // 伤害类型: physical(吃armor) / explosive(吃armor但无视50%) / energy(吃resist) / 未标注=玩家武器自动映射
  let dt = dmgType;
  if(!dt){
    // 未显式标注：按来源武器映射（玩家子弹）
    const w=cw();
    if(w){
      if(w.explosive) dt='explosive';
      else if(w.tagClass==='tag-fire'||w.tagClass==='tag-elec'||w.burn) dt='energy';
      else dt='physical';
    } else dt='physical';
  }
  const armor = z.armorPct||0;   // 物理减伤%
  const resist = z.resistPct||0; // 能量减伤%
  // 破甲窗口（美术升级联动）：路障/铁桶装备被打碎后 6 秒内 armorPct 减半
  let effArmor = z.armorBreakT > 0 ? armor * 0.5 : armor;
  const dmgBefore = dmg;
  if(dt==='physical'){
    dmg *= (1-effArmor);
  }else if(dt==='explosive'){
    dmg *= (1-effArmor*0.5);  // 爆炸无视50%护甲
  }else if(dt==='energy'){
    dmg *= (1-resist);
  }
  // ── 美术升级：抗性可视化——高减伤被挡下时飘提示，一眼看懂该换武器 ──
  if(dmgBefore >= 8){
    if((dt==='physical' && armor >= 0.5) || (dt==='energy' && resist >= 0.5)){
      // 大幅减免：飘格挡/抗性提示（每只怪限频，防刷屏）
      if(!z._lastBlockTip || (z._lastBlockTip||0) < frameT - 90){
        z._lastBlockTip = frameT;
        if(dt==='physical') spawnFloatText('🛡高护甲', z.x+22, Z_TOP-28, '#aabbcc');
        else spawnFloatText('⚡高抗性', z.x+22, Z_TOP-28, '#5be4ff');
      }
    }else if(dmg < dmgBefore * 0.75){
      // 中度减免：小字提示（不显眼）
      if(!z._lastBlockTip || (z._lastBlockTip||0) < frameT - 150){
        z._lastBlockTip = frameT;
        spawnFloatText('-'+Math.round((1-dmg/dmgBefore)*100)+'%', z.x+22, Z_TOP-24, 'rgba(200,200,220,.7)');
      }
    }
  }
  // 物理被完全格挡→零伤害直接弹反（保持"打不动"的视觉反馈）
  if(dmg<1){
    mkP({x:bx,y:by,r:5,rDecay:.4,decay:.1,color:'#aabbcc',type:'circle',blur:true,alpha:.7,grav:0});
    sndClack();
    return;
  }
  // ── 美术升级：护甲装备血池（路障/铁桶）——先扣装备池，池空→装备碎裂+破甲窗口 ──
  if(z.armorMax > 0 && z.armorHp > 0){
    z.armorHp -= dmg * 0.8;  // 装备池吸收大部分伤害（视觉进度）
    if(z.armorHp <= 0){
      z.armorHp = 0;
      // 装备碎裂：飞散碎片 + 破甲窗口（armorPct 减半 6 秒，打出"先破甲再输出"的节奏）
      z.armorBreakT = 360;
      spawnFloatText('护甲碎裂!', z.x+22, Z_TOP-20, '#ffaa44');
      sndExplosion();
      for(let i=0;i<12;i++){
        mkP({x:z.x+22,y:Z_TOP+12,vx:(Math.random()-.5)*7,vy:-2-Math.random()*4.5,r:2+Math.random()*2.5,rDecay:.06,decay:.04,color:z.zType==='buckethead'?'#999':'#ff7722',type:'shard',angle:Math.random()*Math.PI,spin:.3,grav:.4,alpha:.95});
      }
    }
  }
  // Elite 3 (Shielder): 护盾朝固定方向，可绕背打
  if(z.elite===3){
    const zcx=z.x+22;
    const bulletFromLeft=(fromX??bx)<zcx;
    const shieldOnLeft=(z.shieldDir||1)<0;
    if(bulletFromLeft===shieldOnLeft){
      z.shieldFlash=1;
      mkP({x:bx,y:by,r:8,rDecay:.6,decay:.1,color:'#aabbcc',type:'circle',blur:true,alpha:.9,grav:0});
      sndHit();return;
    }
  }
  // ── 新原型机制：铁门盾卫（正面免疫【物理/爆炸】伤害，能量武器可穿透）──
  if(z.zType==='screendoor'){
    const zcx=z.x+22;
    const bulletFromLeft=(fromX??bx)<zcx;
    const shieldOnLeft=(z.shieldDir||-1)<0;  // 盾在左侧（朝玩家方向）
    if(bulletFromLeft===shieldOnLeft && dt!=='energy'){
      z.shieldFlash=1;
      mkP({x:bx,y:by,r:10,rDecay:.6,decay:.1,color:'#aabbcc',type:'circle',blur:true,alpha:.95,grav:0});
      // 火花
      for(let i=0;i<3;i++){mkP({x:bx,y:by,vx:(Math.random()-.5)*4,vy:-1-Math.random()*2,r:1.5,decay:.06,color:'#ffee88',type:'spark',grav:.2,alpha:.9});}
      sndClack();return;
    }
  }
  // （原路障/铁桶专属护甲池已并入双轴克制的全局 armorPct——护甲值即物理减伤%）
  const wCrit = cw();
  // ── 部位伤害系统：爆头×2.0 / 身体×1.0 / 腿部×0.6 ──
  const relY = by - Z_TOP;
  let bodyPart = 'body';
  let partMul = 1.0;
  // v49批1：神射手协同天赋「弱点洞察」爆头倍率×2.5（覆盖基础值）
  const headMul = (playerPerks.weakspot ? 2.5 : 2.0);
  if(relY < 18){
    bodyPart = 'head';
    partMul = (wCrit && wCrit.id === 'pistol') ? 2.0 : headMul;
  }
  else if(relY > 42){ bodyPart = 'legs'; partMul = 0.6; }
  if(z.zType==='gargantuar' && relY < 30){ bodyPart='head'; partMul=headMul*0.75; }
  dmg *= partMul;
  let critChance=CRIT_CHANCE+(playerPerks.precision||0)*0.10;
  if(wCrit&&wCrit.traitCritBonus)critChance+=wCrit.traitCritBonus;
  const clsCb=classCritBonus();
  critChance+=clsCb.chance;
  if(window._classSkillT>0 && playerClass && playerClass.id==='marksman')critChance+=0.40;
  if(wCrit&&wCrit.id==='sniper'&&bodyPart==='head')critChance=1;
  // 手枪清脆利落：爆头回弹 1 发
  if(wCrit&&wCrit.id==='pistol'&&bodyPart==='head'){
    wAmmo[curWpnIdx] = Math.min(weaponMagSize(wCrit), (wAmmo[curWpnIdx]||0) + 1);
    updateAmmoUI();
    spawnFloatText('+1 弹药 (精准回膛)', bx, by - 28, '#5be4ff');
  }      // 手枪爆头+50%
  if(wCrit&&wCrit._evoCritBonus)critChance+=wCrit._evoCritBonus;  // 进化·过载核心
  // ── 行囊被动：异化发光四叶草 暴击率+10% ──
  if(typeof getBackpackCritBonus === 'function') critChance += getBackpackCritBonus();
  // ── 小胡武器改造台：战术挂件暴击加成 (+6%/级) ──
  if(wCrit && typeof getWeaponMod === 'function'){
    critChance += getWeaponMod(wCrit.id, 'tactical') * 0.06;
  }

  let critMul=2+(playerPerks.precision||0)*0.5+clsCb.mult;
  if(wCrit&&wCrit.traitCritMul)critMul=Math.max(critMul,wCrit.traitCritMul);
  // ── 行囊被动：战前窖藏干红 暴击伤害倍率+0.3 ──
  if(typeof backpackInventory !== 'undefined' && backpackInventory.vintage_wine > 0) critMul += 0.3;

  // ── 防暴霰弹贴脸轰飞(<180px强力击退)与远距离自然散开衰减 ──
  if(wCrit && (wCrit.id==='shotgun'||wCrit.id==='sawoff')){
    const distToZ = Math.abs((player.x + CHAR_W/2) - (z.x + 22));
    if(distToZ < 180){
      dmg *= 1.45;
      z.knockback = (z.knockback||0) + 22;
      z.hitStun = Math.max(z.hitStun||0, 16);
      if(typeof addShake === 'function') addShake(2.5);
      spawnFloatText('💥 贴脸轰飞! +45%', bx, by-20, '#ff9900');
    } else if(distToZ > 280){
      dmg *= Math.max(0.35, 1 - (distToZ - 280) / 300);
    }
  }

  const crit=Math.random()<critChance;
  const fdmg=crit?dmg*critMul:dmg;

  // ── 肉鸽打击手感核心：打击停顿 (Hitstop 微冻结机制) ──
  const isHeavyWeapon = ['shotgun','sawoff','sniper','rocket','revolver','railcharger','railgun'].includes(wCrit?wCrit.id:'');
  const hitstopFrames = crit ? 4 : (bodyPart === 'head' ? 3 : (isHeavyWeapon ? 2 : 0));
  if(hitstopFrames > 0){
    hitstop = Math.max(hitstop, hitstopFrames);
  }
  // 连续暴击计数（神枪手成就）
  if(crit) critComboCount++; else critComboCount = 0;
  // v52肉鸽·武器线：暴击节奏——暴击后2秒攻速+25%/层
  if(crit && playerPerks.critflow){ window._critFlowT = 120; }
  // v52进化·链能泄漏：能量系武器进化后，命中链跳1个附近敌人（60%伤害）
  if(WEAPONS[curWpnIdx] && WEAPONS[curWpnIdx].evoChainZap && dmgType==='energy'){
    let near=null, nd=110;
    for(const z2 of zombies){ if(z2.alive && z2!==z){ const d=Math.abs((z2.x+22)-bx); if(d<nd){nd=d;near=z2;} } }
    if(near){
      for(let s=0;s<3;s++){ mkP({x:bx+(near.x+22-bx)*s/3+(Math.random()-.5)*10, y:by+(Z_TOP+28-by)*s/3+(Math.random()-.5)*10, r:2,rDecay:.15,decay:.12,color:'#88ddff',type:'circle',grav:0,alpha:.95,blur:true}); }
      hitZombie(near, near.x+22, Z_TOP+28, Math.max(4, dmg*0.6), bx, by, 1, 'energy');
    }
  }
  // 记录受击击退方向（给身体后仰顿挫物理计算使用）
  z.hitDir = ((fromX ?? bx) < (z.x + 22)) ? -1 : 1;
  z.hp -= fdmg;
  z.hitFlash = crit ? 2 : 1;
  // 定向血花喷溅粒子（沿子弹穿透方向后扬，打击质感利落扎实）
  const bSprayDir = ((fromX ?? bx) < (z.x + 22)) ? 1 : -1;
  const isArmorHit = (z.armorHp > 0 || (z.armorPct && z.armorPct > 0.5));
  if(isArmorHit){
    for(let i=0; i<3; i++){
      mkP({x:bx, y:by, vx:bSprayDir*(1.2+Math.random()*3), vy:-1+(Math.random()-0.5)*2.5, r:1.2, rDecay:.05, decay:.08, color:'#ffee77', type:'spark', grav:0.1, alpha:0.95});
    }
  } else {
    for(let i=0; i<4; i++){
      mkP({x:bx, y:by, vx:bSprayDir*(1.5+Math.random()*3.5), vy:-1.2+(Math.random()-0.5)*2.2, r:1.8+Math.random()*1.2, rDecay:.05, decay:.04, color:Math.random()>0.35?'#800a0a':'#aa1414', type:'circle', grav:0.25, alpha:0.9});
    }
  }
  // 扎实克制的现代射击打击反馈：普通枪击不晃屏，暴击与重型武器微幅定格与轻震
  const shakeAmt = crit ? 2.0 : (bodyPart === 'head' ? 1.2 : (isHeavyWeapon ? 1.0 : 0));
  if(shakeAmt > 0) addShake(shakeAmt);
  // 部位命中视觉反馈
  if(bodyPart === 'head'){
    if(z.knockback !== undefined) z.knockback = (z.knockback||0) + 8;
    // ── 爆头金属"叮"音 + 锐利微型十字火星 ──
    try{
      const a=getACtx(); if(a){
        const o=a.createOscillator(),g=a.createGain(),now=a.currentTime;
        o.type='square';o.frequency.setValueAtTime(2400,now);
        o.frequency.exponentialRampToValueAtTime(1800,now+0.05);
        g.gain.setValueAtTime(0.08,now);
        g.gain.exponentialRampToValueAtTime(0.001,now+0.06);
        o.connect(g);g.connect(a.destination);o.start(now);o.stop(now+0.07);
      }
    }catch(e){}
    // ── 终极超武【双生风暴狂徒】爆头引发全屏金色电光震荡波 ──
    if(wCrit && wCrit.evoType === 'dual_storm'){
      mkP({x:bx, y:by, r:15, rDecay:-2.5, decay:.05, color:'#ffd700', type:'ring', alpha:1, grav:0});
      zombies.forEach(oz => {
        if(oz.alive && oz !== z && Math.abs((oz.x+22)-bx) < 130){
          oz.hitStun = Math.max(oz.hitStun||0, 60);
          oz.knockback = (oz.knockback||0) + (oz.x < bx ? -12 : 12);
        }
      });
      spawnFloatText('⚡狂暴震击!', bx, by - 30, '#ffd700');
    }
    // ── 战前特餐：爆裂雷光拼盘（暴击/爆头天谴落雷与超导连锁跳跃）──
    if(typeof activeTacticalMeal !== 'undefined' && activeTacticalMeal && activeTacticalMeal.id === 'thunder' && (crit || bodyPart === 'head')){
      vfxRail(bx, 0, bx, by, '#dd66ff', '#8800ff');
      addShake(2.5);
      hitZombie(z, bx, by, 35, bx, 0, 1, 'energy');
      let hitCount = 0;
      zombies.forEach(oz => {
        if(oz !== z && oz.alive && hitCount < 4 && Math.abs((oz.x+22) - bx) < 200){
          vfxRail(bx, by, oz.x+22, Z_TOP+28, '#cc88ff', '#5500aa');
          hitZombie(oz, oz.x+22, Z_TOP+28, 25, bx, by, 1, 'energy');
          hitCount++;
        }
      });
    }
    // 十字微型火花（4向金黄微线迸射，短促消散）
    for(let i=0;i<2;i++){
    const a2=Math.random()*Math.PI*2;
    mkP({x:bx,y:by,vx:Math.cos(a2)*1.2,vy:Math.sin(a2)*1.2,r:0.9,rDecay:.08,decay:.18,color:'#ffe080',type:'spark',grav:.04,alpha:.9});
  }
  } else if(bodyPart === 'legs' && Math.random() < 0.3){
    z.spdMul = Math.min(z.spdMul||1, 0.6);
    z.legSlowTimer = 120;
  }

  // 肉鸽天赋：冰冷触感 减速
  if(playerPerks.frostbite){z.frostTimer=120;z.spdMul=0.7;}
  // 肉鸽天赋：吸血 8%/层回血
  if(playerPerks.lifesteal){health=Math.min(maxHp,health+fdmg*playerPerks.lifesteal*0.08);updateHpUI();}
  // 肉鸽天赋：狼化吸血 20%（狂化状态）
  if(window._berserkActive){health=Math.min(maxHp,health+fdmg*0.20);updateHpUI();}
  // 肉鸽天赋：跳弹 子弹命中后几率跳向附近敌人
  if(playerPerks.ricochet && !z._ricoFrom){
    const bounces=playerPerks.ricochet;
    for(let b=0;b<bounces;b++){
      if(Math.random()>0.5)continue;
      let nearest=null,nd=200;
      for(const z2 of zombies){if(!z2.alive||z2===z)continue;const d=Math.abs((z2.x+22)-(z.x+22));if(d<nd){nd=d;nearest=z2;}}
      if(nearest){
        const ricoDmg=fdmg*0.7*(b+1>1?0.7:1);
        nearest._ricoFrom=true;
        hitZombie(nearest,nearest.x+22,Z_TOP+28,ricoDmg,z.x+22,Z_TOP+28);
        nearest._ricoFrom=false;
        for(let i=0;i<3;i++){mkP({x:(z.x+22+nearest.x+22)/2,y:Z_TOP+28+(Math.random()-.5)*15,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,r:1.2,decay:.08,color:'#ffe080',type:'spark',grav:0,alpha:.8});}
      }
    }
  }
  // 击退 + 硬直（重型枪械与暴击给予更强物理击退反馈，顿挫扎实）
  const knockDir = z.x+22 < (fromX??bx) ? -1 : 1;
  const knockMult = knockbackMult || 1;
  const baseKnock = crit ? 9 : (bodyPart === 'head' ? 7 : (isHeavyWeapon ? 6.5 : 4));
  z.knockback = (z.knockback||0) + baseKnock * knockDir * knockMult;
  z.hitStun = (z.hitStun||0) + (crit ? 15 : (isHeavyWeapon ? 11 : 7));
  if(crit){
    sndCrit();
    vfxCritHit(bx,by,fromX,fromY);
  }
  if(z.hp<=0){
    // 肉鸽天赋：超额击杀 溢出伤害→范围爆炸
    if(playerPerks.overkill && hpBefore>0){
      const overkillDmg = -z.hp;
      if(overkillDmg>0){
        const explDmg = overkillDmg*2*playerPerks.overkill;
        for(let i=0;i<6;i++){mkP({x:bx,y:Z_TOP+28,vx:Math.cos(i/6*Math.PI*2)*3.5,vy:Math.sin(i/6*Math.PI*2)*3.5,r:2.5,rDecay:.06,decay:.05,color:'#ff6600',type:'spark',grav:.1,alpha:.9});}
        zombies.forEach(z2=>{if(z2.alive&&z2!==z&&Math.abs((z2.x+22)-bx)<70){hitZombie(z2,z2.x+22,Z_TOP+28,explDmg,bx,Z_TOP+28);}});
      }
    }
    killZombie(z,bx,by);
  }
  else{
    vfxHit(bx,by,fromX??bx-50,fromY??by);sndHit();
    // ── 现代硬核射击反馈：唯一定位伤害数字（小巧锐利、根据部位/暴击着色、急速浮动消散）──
    if(fdmg >= 5 && !window._globalDmgNumCd){
      window._globalDmgNumCd = 4;
      const val = Math.round(fdmg);
      let numTxt = '' + val;
      let numCol = '#f8fafc';
      let isBold = false;
      if(crit && bodyPart === 'head'){
        numTxt = 'CRIT ' + val + '!';
        numCol = '#ff3344';
        isBold = true;
      } else if(crit){
        numTxt = val + '!';
        numCol = '#f59e0b';
        isBold = true;
      } else if(bodyPart === 'head'){
        numTxt = val + '↑';
        numCol = '#fb923c';
        isBold = true;
      }
      spawnFloatText(numTxt, bx, by - 16, numCol, isBold);
    }
  }
}
function killZombie(z,bx,by){
  if(!z.alive)return;
  // v52进化·连环殉爆：爆炸系武器进化后，击杀触发二次爆炸（50%伤害AOE）
  const curW=WEAPONS[curWpnIdx];
  if(curW && curW.evoChainExplode){
    const ex=z.x+22, ey=Z_TOP+28;
    vfxExplosion(ex,ey,70); addShake(4);
    const eDmg=Math.max(8, Math.round(curW.damage*0.5));
    zombies.forEach(z2=>{ if(z2.alive && z2!==z && Math.abs((z2.x+22)-ex)<70){ hitZombie(z2, ex, Z_TOP+28, eDmg, ex-50, ey, 1, 'explosive'); } });
    if(Math.random()<.4) sndExplosion();
  }
  z.alive=false; z.burning=false;
  if(z.burnTimer){ if(typeof z.burnTimer==='number') z.burnTimer=0; else { clearInterval(z.burnTimer); z.burnTimer=null; } }
  killCount++;killsEl.textContent=killCount;
  // ── v49批2：当前武器击杀 +1 武器经验 ──
  // [已清理历史废弃单枪击杀经验死代码]
  // ── v49批1：狂战士流派击杀经验×1.5 ──
  if(playerClass && playerClass.id==='berserker') gainXp(Math.max(1,Math.round((z.pts||5)*0.1)));
  // 记录到图鉴
  try { recordCodexKill(z); } catch(e){}
  const kx=bx??z.x+22, ky=by??Z_TOP+20;
  // ── 美术升级：死亡肢体爆散（头/手臂/躯干碎块按原型配色飞散 + 血雾）──
  {
    const arch = (z.zType && ZOMBIE_DEX_MAP[z.zType]) || null;
    const skin = arch ? arch.color1 : '#c8a878';
    const cloth = arch ? arch.color2 : '#6a6a7a';
    const big = z.zType==='gargantuar';
    const gore = big ? 5 : 2;
    // 血雾（红雾圆粒，快衰减）
    for(let i=0;i<gore;i++){
      const a=Math.random()*Math.PI*2, sp=1+Math.random()*(big?4:2.5);
      mkP({x:kx,y:ky+8,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp*0.5-1.2,r:big?5:3+Math.random()*2,rDecay:.1,decay:.055,color:Math.random()>.25?'#8a1111':'#5a0a0a',type:'circle',grav:.05,alpha:.85,blur:true});
    }
    // 肢体碎块（shard 旋转飞出）
    const chunkColors=[skin,skin,cloth,'#7a2020'];  // 2皮肤+1衣料+1血块
    for(let i=0;i<(big?4:2);i++){
      const a=Math.random()*Math.PI*2, sp=(big?2.5:1.8)+Math.random()*2.2;
      mkP({x:kx,y:ky+4,vx:Math.cos(a)*sp,vy:-1.5-Math.random()*2.5,r:(big?5:3)+Math.random()*2,rDecay:.04,decay:.02,color:chunkColors[i%chunkColors.length],type:'shard',angle:Math.random()*Math.PI,spin:.18+Math.random()*.2,grav:.32,alpha:.95});
    }
  }
  const mult=onKill(kx,ky,z.pts);           // 连击/倍率/分数统一结算
  // ── 精英高光：仅真正精英/Boss才有慢动作与额外战利品，普通小怪绝不乱爆 ──
  if(z.elite){
    hitstop=Math.max(hitstop, 12);
  }
  // ── v49批1：变异金币修正（亡命徒×2 / 金币雨×3，贪婪天赋已在 spawnLoot 内乘，勿重复）+ 血月击杀回血 ──
  {
    let coinMult = mult;
    if(waveMutation){
      if(waveMutation.id==='frenzy') coinMult *= 2;
      else if(waveMutation.id==='goldrush') coinMult *= 3;
      if(waveMutation.id==='bloodmoon'){ health=Math.min(maxHp, health+1); }
    }
    spawnLoot(kx,ky,Math.round((z.coinReward||3)*coinMult));
  }
  vfxKill(kx,ky);
  sndKill();
  spawnFloatText('+'+Math.round(z.pts*mult),z.x+22,Z_TOP-10,'#f39c12');
  // ── 武器获取重构：末世武器极其珍贵，普通僵尸与精英怪严禁爆出整枪！──
  // 杜绝像垃圾一样满地乱爆枪。小怪与精英怪武器掉落率严格为 0%！
  // 武器通过夜间餐厅收益于军火商店选购、小胡工坊改装进化、或高难重大首领Boss击败奖励获得
  if(z.elite===1){spawnPoisonPool(z.x+22);}
  if(z.elite){ hitstop=18;                 // 精英击杀 → 0.3s 慢动作
    // v49批3：伙伴为精英击杀喝彩（随机一位在场未倒地伙伴喊话）
    const alive = hiredCompanions.filter(c=>!c.downed);
    if(alive.length && Math.random()<0.6) companionBark(alive[Math.floor(Math.random()*alive.length)], 'eliteKill');
    // v49批1：驭兽协同天赋「战意共鸣」——伙伴在场时精英击杀你回 2% 生命
    if(playerPerks.warmblood && alive.length){
      const heal = Math.max(2, Math.round(maxHp*0.02));
      health = Math.min(maxHp, health+heal); updateHpUI();
      spawnFloatText('❤+'+heal, player.x+CHAR_W/2, player.y-14, '#ff8899');
    }
  }
  else if(combo < 8){ hitstop=Math.max(hitstop, z.zType==='gargantuar'?5:2); }  // 美术A：低连杀时微定格（连杀≥8后取消——割草流畅优先）
  // 肉鸽天赋：猎头者 精准爆头/概率回弹（封顶弹夹上限，绝不无限溢出）+精英额外金币
  if(playerPerks.headhunter){
    const maxA = weaponMagSize(cw());
    if(cw().id !== 'minigun' && wAmmo[curWpnIdx] < maxA){
      if(z.headshot || Math.random() < 0.3 * playerPerks.headhunter){
        wAmmo[curWpnIdx] = Math.min(maxA, wAmmo[curWpnIdx] + 1);
        updateAmmoUI();
      }
    }
    if(z.elite){coins+=15*playerPerks.headhunter;updateCoinUI();spawnFloatText('+15💰',kx,ky-24,'#f0c060');}
  }
  // 肉鸽天赋：连锁处决 连击计数+1，3秒内有效
  if(playerPerks.chainkill){
    window._chainkillBuff=(window._chainkillBuff||0)+1;
    clearTimeout(window._chainkillTimer);
    window._chainkillTimer=setTimeout(()=>{window._chainkillBuff=0;},3000);
    if(window._chainkillBuff>=3){spawnFloatText('🔗 连杀'+window._chainkillBuff,kx,ky-40,'#5be4ff');}
  }
  // 肉鸽天赋：拾荒者 额外掉落
  if(playerPerks.scavenger){
    if(Math.random()<0.35*playerPerks.scavenger){
      lootDrops.push(createLootItem(kx,ky, Math.random()<0.5?'wood':'scrap',1));
    }
  }
  // ── 新原型机制：自爆殉道者死亡时爆炸 ──
  if(z.zType==='exploder' && z.explodeArmed){
    z.explodeArmed=false;  // 防止重复触发
    // 范围爆炸：伤害玩家+其他僵尸+围墙
    const ex=z.x+22, ey=Z_TOP+28, ER=110, EDmg=35;
    vfxExplosion(ex,ey);sndExplosion();addShake(6);
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;mkP({x:ex,y:ey,vx:Math.cos(a)*5,vy:Math.sin(a)*5-1,r:4+Math.random()*3,rDecay:.05,decay:.04,color:Math.random()>.5?'#ff6600':'#ffaa00',type:'spark',grav:.1,alpha:.95});}
    // 伤害其他僵尸（连锁）
    zombies.forEach(z2=>{if(z2.alive&&z2!==z&&Math.abs((z2.x+22)-ex)<ER){hitZombie(z2,z2.x+22,Z_TOP+28,EDmg,ex,ey);}});
    // 伤害玩家
    if(!vehicle.entered && Math.abs((player.x+CHAR_W/2)-ex)<ER && (player.y+CHAR_H)>Z_TOP+10){
      takeDamage(20);
      player.vx=(player.x<ex)?-8:8;player.vy=-6;player.onGround=false;player.iframes=60;
    }
    // 伤害围墙
    if(wallHp>0 && Math.abs(RIGHT_WALL_X-ex)<ER){
      wallHp=Math.max(0,wallHp-40);
      if(wallHp<=0){addBanner('🧱 围墙被自爆僵尸炸毁！');}
    }
  }
  // ── 厨房食材收紧机制：杜绝满地滥爆肉块，食材更显珍贵 ──
  let meatType;
  const mk = z.meatKind;
  let dropChance = 0.28; // 普通小怪仅28%概率掉落1块肉
  if(mk === 'elite' || z.elite){
    meatType = 'meat_elite';
    dropChance = 1.0; // 精英必掉
  } else if(mk === 'fast' || z.type === 1){
    meatType = 'meat_fast';
    dropChance = 0.35;
  } else if(mk === 'tank' || z.type === 2){
    meatType = 'meat_tank';
    dropChance = 0.45;
  } else {
    meatType = 'meat_normal';
    dropChance = 0.28;
  }
  // 厨神流派提升肉块掉率
  if(playerClass && playerClass.id === 'chef') dropChance *= 1.35;
  if(Math.random() < dropChance){
    lootDrops.push(createLootItem(kx, ky, meatType, 1));
  }
  // v52肉鸽·餐厅线：屠宰好手——肉块掉落+30%/层（概率追加一块同型肉）
  if(playerPerks.meatharvest && Math.random() < 0.3*playerPerks.meatharvest){
    lootDrops.push(createLootItem(kx-6, ky+3, meatType, 1));
  }
  // v52波次词条·饕餮盛宴：肉块掉落×2
  if(waveMutation && waveMutation.id==='feast'){
    lootDrops.push(createLootItem(kx-10, ky+5, meatType, 1));
  }
  // v50模块二：辣椒喷焰枪——异变肉掉率+50%（当前武器为辣椒时，异变肉掉落概率判定）
  const chiliW = WEAPONS[curWpnIdx];
  if(chiliW && chiliW.id==='chiliflamer' && Math.random() < 0.5){
    lootDrops.push(createLootItem(kx+6, ky-4, meatType === 'meat_elite' ? 'meat_elite' : meatType, 1));
  }
  // 精英僵尸额外多掉一块
  if(z.elite) lootDrops.push(createLootItem(kx+8, ky, 'meat_elite', 1));
  // 特殊原型额外掉肉
  if(z.zType==='gargantuar' || z.zType==='spawner'){
    lootDrops.push(createLootItem(kx-8, ky, 'meat_elite', 1));
    lootDrops.push(createLootItem(kx+8, ky+4, 'meat_tank', 1));
  }
}

function spawnLoot(x, y, coinVal, isElite, isBoss) {
  // 肉鸽天赋：贪婪 金币+50%/层 + 行囊四叶草金币加成(+20%)
  const greedMul = 1 + (playerPerks.greed||0)*0.5;
  const cloverCoinMul = (typeof backpackInventory !== 'undefined' && backpackInventory.lucky_clover > 0) ? 1.2 : 1.0;
  const realCoin = Math.round((coinVal||3)*greedMul*cloverCoinMul);
  // v52肉鸽·通用线：废料囤积——木材/废料掉率+50%/层（行囊四叶草+25%掉落率）
  const bpDropBonus = (typeof getBackpackDropRateBonus === 'function' ? getBackpackDropRateBonus() : 0);
  const scrapLuck2 = (1 + (playerPerks.scraphoard||0)*0.5) * (1 + bpDropBonus);
  const rollWood = Math.random() < Math.min(0.95, 0.30*scrapLuck2);
  const rollScrap = Math.random() < Math.min(0.95, 0.20*scrapLuck2);
  
  let rollAmmo = Math.random() < 0.022 * (1 + bpDropBonus);
  const curMax = weaponMagSize(WEAPONS[curWpnIdx]);
  if (cw().id !== 'minigun' && wAmmo[curWpnIdx] < curMax * 0.2) {
    rollAmmo = Math.random() < 0.045 * (1 + bpDropBonus);
  }
  
  let rollMed = Math.random() < 0.05 * (1 + bpDropBonus);
  if (health < maxHp * 0.4) {
    rollMed = Math.random() < 0.12 * (1 + bpDropBonus);
  }
  
  lootDrops.push(createLootItem(x, y, 'coin', realCoin || 3));
  if (rollWood) lootDrops.push(createLootItem(x, y, 'wood', 1));
  if (rollScrap) lootDrops.push(createLootItem(x, y, 'scrap', 1));
  if (rollAmmo) lootDrops.push(createLootItem(x, y, 'ammo', 1));
  if (rollMed) lootDrops.push(createLootItem(x, y, 'medkit', 1));

  // ═══════════════════════════════════════════
  //  避难所行囊系统：战利品多样化掉落
  //  掉落作用于餐厅经营、房屋设计、城堡塔防与肉鸽生存的丰富物品
  // ═══════════════════════════════════════════
  const dropRateMul = 1 + bpDropBonus;

  // ── 🍳 餐厅核心佐料 ──
  // 废土野山椒（提升菜肴售价，子弹点燃）
  if(Math.random() < (isElite ? 0.20 : 0.05) * dropRateMul){
    lootDrops.push(createLootItem(x + (Math.random()-0.5)*18, y, 'spice_wasteland', 1));
  }

  // ── ⚔️ 战术生存军需 ──
  // 军用战地急救包（+50HP并净化）
  if(Math.random() < (isElite ? 0.12 : 0.035) * dropRateMul){
    lootDrops.push(createLootItem(x + (Math.random()-0.5)*18, y, 'medkit_spec', 1));
  }
  // 便携压缩弹药盒（恢复50%备弹并赋予高爆充能）
  if(Math.random() < (isElite ? 0.07 : 0.008) * dropRateMul){
    lootDrops.push(createLootItem(x + (Math.random()-0.5)*18, y, 'ammo_crate_item', 1));
  }
}

// ── 武器掉落系统 ─────────────────────────────────────────
// 生成一个武器宝箱（按稀有度权重随机抽取一把未拥有的武器）
// forceIdx: 强制掉落指定武器索引（用于 Boss 保底掉落）
function spawnWeaponCrate(x, y, forceIdx){
  let wpnIdx = forceIdx != null ? forceIdx : -1;
  // 如果没有强制指定，在生成时就掷骰决定武器，这样宝箱颜色能正确显示
  if(wpnIdx < 0){
    wpnIdx = rollWeaponDrop();
  }
  const crate=createLootItem(x, y, 'weapon_crate', wpnIdx);
  crate.life=1800;
  crate.vy=-4-Math.random()*2;
  crate.vx=(Math.random()-.5)*4;
  lootDrops.push(crate);
}
// 按稀有度权重随机抽取一把未拥有的武器索引；全拥有则返回 -1
function rollWeaponDrop(){
  // 候选：未拥有的武器（v50：流派专属武器与湮灭者不进掉落池）
  const pool=WEAPONS.map((w,i)=>({w,i})).filter(({i,w})=>!ownedWeaponsSet.has(i) && !w.classWeapon && !w.superWeapon);
  if(pool.length===0)return -1;
  // 按波次动态调整：低波次只掉普通/稀有，高波次解锁史诗/传说
  const rarityGate={common:1, rare:Math.max(0,wave-1), epic:Math.max(0,Math.floor((wave-2)/1)), legendary:Math.max(0,Math.floor((wave-4)/1))};
  const eligible=pool.filter(({w})=>(rarityGate[w.rarity]||0)>0);
  const usePool=eligible.length>0?eligible:pool.filter(({w})=>w.rarity==='common');
  if(usePool.length===0)return -1;
  // 权重抽取
  const total=usePool.reduce((s,{w})=>s+(w.dropWeight||1),0);
  let r=Math.random()*total;
  for(const {w,i} of usePool){r-=(w.dropWeight||1);if(r<=0)return i;}
  return usePool[0].i;
}
// 收集武器宝箱：捡起后直接替换"当前手持武器"，旧武器掉落为可再次拾取的宝箱
// 全拥有/同武器时转为弹药补给
function collectWeaponCrate(item){
  let wpnIdx=item.value;
  // 宝箱在生成时已掷骰，value 就是武器索引
  // 如果 value 仍然 < 0（老存档兼容），才掷骰
  if(wpnIdx < 0) wpnIdx = rollWeaponDrop();
  if(wpnIdx<0){
    // 无可掉落武器（全拥有）：转金币 + 弹药
    coins+=20;updateCoinUI();
    const maxA=Math.floor(WEAPONS[curWpnIdx].maxAmmo*(1+upgrades.ammo*.5));
    if(WEAPONS[curWpnIdx].id!=='minigun')wAmmo[curWpnIdx]=maxA;
    updateAmmoUI();refreshWBar();sndReload();
    spawnFloatText('💰 +20 (无新武器)',item.x,item.y-12,'#f0c060');
    return;
  }
  // 已拥有该武器（在背包中）→ 转为弹药补给
  if(ownedWeaponsSet.has(wpnIdx)){
    const maxA=Math.floor(WEAPONS[wpnIdx].maxAmmo*(1+upgrades.ammo*.5));
    if(WEAPONS[wpnIdx].id!=='minigun'){wAmmo[wpnIdx]=maxA;}
    updateAmmoUI();refreshWBar();sndReload();
    spawnFloatText('📦 弹药补满 '+WEAPONS[wpnIdx].icon,item.x,item.y-12,'#ffcc60');
    return;
  }
  // ── v51模块二：宝箱满包分支改"对比选择"（原版直接粗暴替换当前手持，玩家无选择权）──
  const newW=WEAPONS[wpnIdx], rar=WEAPON_RARITY[newW.rarity];
  // 背包有空位 → 直接加入 + 开箱仪式
  if(ownedWeapons.length<MAX_OWNED_WEAPONS){
    ownedWeapons.push(wpnIdx);
    refreshOwnedSet();
    wAmmo[wpnIdx]=Math.floor(newW.maxAmmo*(1+upgrades.ammo*.5));
    curWpnIdx=wpnIdx;
    buildWeaponBar();refreshWBar();updateAmmoUI();
    if(isMobile())buildMobileWpnStrip();
    addBanner(`✨ 拾取 ${rar.cn}武器「${newW.name}」${newW.icon}！`);
    pickupBurst(item.x,item.y,rar);
    showWeaponUnboxCard(wpnIdx, null);  // 开箱仪式（新武器展示卡）
    return;
  }
  // 背包满 → v51对比界面：显示新武器 vs 当前武器（E换/Q留），不再粗暴替换
  showWeaponUnboxCard(wpnIdx, curWpnIdx);
}
// ── v51模块二：开箱仪式——武器升起展示卡（新武器/对比模式）──
let unboxActive = null;  // {newIdx, swapIdx, t}
function showWeaponUnboxCard(newIdx, swapIdx){
  const w = WEAPONS[newIdx];
  const rar = WEAPON_RARITY[w.rarity]||WEAPON_RARITY.common;
  const lv = weaponLevels[w.id] ? weaponLevels[w.id].lv : 1;
  const isNew = !ownedWeaponsSet.has(newIdx);
  const el = document.createElement('div');
  el.id = 'unbox-card';
  el.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.3);z-index:150;background:rgba(8,6,12,.95);border:2px solid '+rar.color+';border-radius:14px;padding:18px 26px;text-align:center;min-width:280px;box-shadow:0 0 40px '+rar.glow+',0 10px 30px rgba(0,0,0,.7);transition:transform .35s cubic-bezier(.2,1.5,.4,1);';
  let swapHtml = '';
  if(swapIdx !== null){
    const w1 = WEAPONS[ownedWeapons[0]];
    const w2 = WEAPONS[ownedWeapons[1]];
    swapHtml = `
      <div style="margin-top:10px;padding:8px 10px;background:rgba(255,255,255,.05);border-radius:8px;border:1px solid rgba(240,192,96,0.3);">
        <div style="font-size:.65rem;color:#ffd875;margin-bottom:6px;font-weight:700;">已达携带上限（最多2把武器），选择替换槽位：</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px;">
          <div onclick="event.stopPropagation();closeUnboxCardWithSlot(0)" style="cursor:pointer;flex:1;background:rgba(30,20,12,0.85);border:1.5px solid #c8963e;border-radius:6px;padding:6px;transition:all .15s;">
            <div style="color:#ffd875;font-size:.68rem;font-weight:700;">[1] 替换主武器</div>
            <div style="font-size:.62rem;color:#fff;margin-top:2px;">${w1?w1.icon+' '+w1.name:'无'}</div>
          </div>
          <div onclick="event.stopPropagation();closeUnboxCardWithSlot(1)" style="cursor:pointer;flex:1;background:rgba(30,20,12,0.85);border:1.5px solid #c8963e;border-radius:6px;padding:6px;transition:all .15s;">
            <div style="color:#ffd875;font-size:.68rem;font-weight:700;">[2] 替换副武器</div>
            <div style="font-size:.62rem;color:#fff;margin-top:2px;">${w2?w2.icon+' '+w2.name:'无'}</div>
          </div>
        </div>
        <div style="font-size:.62rem;color:#b0a284;">按 <b>[1]</b> 或 <b>[2]</b> 确认替换 · 按 <b>[Q / Esc]</b> 放弃保留</div>
      </div>`;
  }else{
    swapHtml = `<div style="margin-top:10px;font-size:.72rem;color:#88ff88;">✨ [E / 1] 收下新武器！</div>`;
  }
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-weight:800;font-size:.62rem;color:${rar.color};letter-spacing:3px;">${rar.cn}武器</div>
    <div style="font-size:3rem;margin:8px 0;filter:drop-shadow(0 4px 12px ${rar.glow});">${w.icon}</div>
    <div style="font-family:var(--font-display);font-weight:800;font-size:1.2rem;color:${rar.color};">${w.name}</div>
    <div style="font-size:.66rem;color:#c8b898;margin-top:6px;line-height:1.5;">${w.trait||''}</div>
    ${swapHtml}`;
  gameWrap.appendChild(el);
  requestAnimationFrame(()=>{requestAnimationFrame(()=>{el.style.transform='translate(-50%,-50%) scale(1)';});});
  // 金光粒子
  for(let i=0;i<18;i++){
    const a=Math.random()*Math.PI*2, sp=1.5+Math.random()*4;
    mkP({x:player.x+CHAR_W/2, y:player.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2.5, r:2+Math.random()*2, rDecay:.05, decay:.04, color:Math.random()>.5?'#ffd840':rar.color, type:'spark', grav:.15, alpha:1});
  }
  sndShopOpen();
  unboxActive = {newIdx, swapIdx, isNew, el};
  // 4秒后自动收（未决则默认保留旧武器）
  setTimeout(()=>{
    if(unboxActive && unboxActive.el === el){
      closeUnboxCard(false);
    }
  }, 4000);
}

function closeUnboxCardWithSlot(slot){
  if(!unboxActive) return;
  const targetSlot = Math.max(0, Math.min(ownedWeapons.length - 1, slot));
  unboxActive.swapIdx = ownedWeapons[targetSlot];
  closeUnboxCard(true);
}

function closeUnboxCard(take){
  if(!unboxActive)return;
  const {newIdx, swapIdx, el} = unboxActive;
  unboxActive = null;
  el.style.transform='translate(-50%,-50%) scale(0.3)';
  el.style.opacity='0';
  setTimeout(()=>el.remove(), 300);
  if(take && swapIdx !== null && !ownedWeaponsSet.has(newIdx)){
    const newW = WEAPONS[newIdx];
    const slot = ownedWeapons.indexOf(swapIdx);
    const curSlot = ownedWeapons.indexOf(curWpnIdx);
    const targetSlot = slot >= 0 ? slot : (curSlot >= 0 ? curSlot : 0);
    ownedWeapons[targetSlot] = newIdx;
    ownedWeaponsSet.delete(swapIdx);
    refreshOwnedSet();
    wAmmo[newIdx] = weaponMagSize(newW);
    curWpnIdx = newIdx;
    ensureWeaponLevel(newW.id);
    buildWeaponBar();refreshWBar();updateAmmoUI();
    if(isMobile())buildMobileWpnStrip();
    // 旧武器掉落为宝箱（可捡回）
    dropWeaponCrate(player.x+(player.facingRight?-40:40), GROUND_Y-40, swapIdx);
    const oldW = WEAPONS[swapIdx];
    addBanner(`🔄 「${oldW.name}」→「${newW.name}」！旧武器已掉落`);
  }else if(take && swapIdx !== null && ownedWeaponsSet.has(newIdx)){
    addBanner(`✨ 收下「${WEAPONS[newIdx].name}」！`);
  }
}
// 拾取爆裂特效（稀有度色光环+火星）
function pickupBurst(x,y,rar){
  vfxReloadComplete(x,y);
  for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2;const spd=2+Math.random()*5;mkP({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-2,r:2+Math.random()*2,rDecay:.04,decay:.04,color:rar.color,type:'spark',grav:.18,alpha:1});}
  mkP({x,y,r:6,rDecay:-1.2,decay:.08,color:rar.color,type:'ring',alpha:.9,grav:0});
  mkP({x,y,r:12,rDecay:-1.0,decay:.1,color:rar.glow,type:'ring',alpha:.6,grav:0});
  sndShopOpen();
}
// 掉落一个"指定武器"的宝箱到地上（旧武器回收，可再次被捡）
// 加 pickupCd 防止刚掉落就被磁吸吸回
function dropWeaponCrate(x,y,wpnIdx){
  const crate=createLootItem(x,y,'weapon_crate',wpnIdx);
  crate.life=2400;  // 替换掉的旧武器存活40秒（更长，方便捡回）
  crate.vy=-3-Math.random()*1.5;
  crate.vx=(Math.random()-.5)*2;
  crate.pickupCd=60;  // 1秒内不可被拾取（防止刚掉落就吸回）
  lootDrops.push(crate);
}

function createLootItem(x, y, type, value) {
  return {
    x: x + (Math.random() - 0.5) * 12,
    y: y - 5,
    vx: (Math.random() - 0.5) * 3.5,
    vy: -3.5 - Math.random() * 3,
    type,
    value,
    bounces: 0,
    life: type.startsWith('meat_') ? 99999 : 600  // 肉块不会过期消失
  };
}

function collectLoot(item) {
  if (item.type === 'coin') {
    coins += item.value;
    updateCoinUI();
    sndCoin();
    spawnFloatText('💰 +' + item.value, item.x, item.y - 12, '#f0c060');
  } else if (item.type === 'wood') {
    woodPlanks += item.value;
    coins += Math.max(5, item.value * 3);
    updateCoinUI();
    sndCoin();
    if(typeof addItemToBackpack === 'function'){
      addItemToBackpack('wood', item.value, false);
    }
    spawnFloatText('🪵 废料变现: +' + item.value + '木 💰+' + (item.value * 3), item.x, item.y - 12, '#d2b48c');
  } else if (item.type === 'scrap') {
    scrapMetal += item.value;
    coins += Math.max(5, item.value * 3);
    updateCoinUI();
    sndCoin();
    if(typeof addItemToBackpack === 'function'){
      addItemToBackpack('scrap', item.value, false);
    }
    spawnFloatText('⚙️ 废料变现: +' + item.value + '铁 💰+' + (item.value * 3), item.x, item.y - 12, '#b0c4de');
  } else if (item.type === 'ammo') {
    const mIdx=minigunIdx();
    if (curWpnIdx !== mIdx) {
      const maxA = weaponMagSize(WEAPONS[curWpnIdx]);
      const amt = Math.max(1, Math.ceil(maxA * 0.15));
      wAmmo[curWpnIdx] = Math.min(maxA, wAmmo[curWpnIdx] + amt);
      updateAmmoUI();
      refreshWBar();
      sndReload();
      spawnFloatText('📦 Ammo +' + amt, item.x, item.y - 12, '#ffcc60');
    } else {
      const mg=getMinigun();
      if(mg){mg.heat = Math.max(0, mg.heat - 30);
      updateWeaponHeat();
      sndReload();
      spawnFloatText('❄️ Cooled!', item.x, item.y - 12, '#80c8ff');}
    }
  } else if (item.type === 'medkit') {
    health = Math.min(maxHp, health + 15);
    updateHpUI();
    sndHeal();
    spawnFloatText('💉 +15 HP', item.x, item.y - 12, '#2ecc71');
  } else if (item.type === 'weapon_crate') {
    // 战备军火箱（由 tryPickupWeaponCrate 在玩家按 [E] 时主动调用）
    collectWeaponCrate(item);
  } else if (item.type.startsWith('meat_')) {
    const k = item.type.replace('meat_', '');
    if(typeof meatInventory !== 'undefined' && meatInventory[k] !== undefined){
      meatInventory[k] += item.value;
    }
    if(typeof addItemToBackpack === 'function'){
      addItemToBackpack(item.type, item.value, false);
    }
    noteTrendMeat(k, item.value);  // 今日热搜目标肉计数（战斗 HUD 显示）
    sndCoin();
    const lbl = k==='normal'?'鲜美肉':k==='fast'?'韧性瘦肉':k==='tank'?'霜降厚肉':'异化基因肉';
    const col = k==='normal'?'#c87862':k==='fast'?'#d89878':k==='tank'?'#a85838':'#aa44cc';
    spawnFloatText('🥩 '+lbl+'+' + item.value, item.x, item.y - 12, col);
  } else if (typeof INVENTORY_ITEMS !== 'undefined' && INVENTORY_ITEMS[item.type]) {
    addItemToBackpack(item.type, item.value || 1, true);
    sndCoin();
  }
}

function updateLootDrops() {
  const targetX = vehicle.entered ? (vehicle.x + 60) : (player.x + CHAR_W / 2);
  const targetY = vehicle.entered ? (GROUND_Y - 20) : (player.y + CHAR_H / 2);
  
  for (let i = lootDrops.length - 1; i >= 0; i--) {
    const item = lootDrops[i];
    item.life--;
    if (item.life <= 0) {
      lootDrops.splice(i, 1);
      continue;
    }
    // 掉落保护倒计时（武器替换掉的旧武器刚掉落时不可被拾取）
    if(item.pickupCd && item.pickupCd>0){item.pickupCd--;}
    
    const dx = targetX - item.x;
    const dy = targetY - item.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // 武器宝箱：不磁吸、需按 E 主动拾取（解锁新武器的仪式感保留手动）
    // 肉块与行囊物品：自动磁吸吸收（行囊磁暴核额外扩展+120px拾取半径）
    const isCrate = item.type==='weapon_crate';
    const needsManualPickup = isCrate;
    const bpMagnetBonus = (typeof getBackpackMagnetBonus === 'function' ? getBackpackMagnetBonus() : 0);
    const magnetRadius = 160 + bpMagnetBonus;
    if (!needsManualPickup && dist < magnetRadius && !(item.pickupCd>0)) {
      const speed = Math.min(16, 3.8 + (magnetRadius - dist) * 0.09);
      item.x += (dx / dist) * speed;
      item.y += (dy / dist) * speed;
      if (dist < 26) {
        collectLoot(item);
        lootDrops.splice(i, 1);
      }
    } else {
      if (item.y < GROUND_Y - 10) {
        item.vy += 0.28;
        item.x += item.vx;
        item.y += item.vy;
      } else {
        item.y = GROUND_Y - 10;
        if (item.bounces < 2) {
          item.vy = -item.vy * 0.45;
          item.vx *= 0.5;
          item.bounces++;
          item.x += item.vx;
          item.y += item.vy;
        } else {
          item.vy = 0;
          item.vx = 0;
        }
      }
    }
  }
}

// 查找玩家附近可拾取的武器宝箱或肉块（供 E 键调用）
function findNearbyWeaponCrate(){
  const px = vehicle.entered ? (vehicle.x + 60) : (player.x + CHAR_W / 2);
  const py = vehicle.entered ? (GROUND_Y - 20) : (player.y + CHAR_H / 2);
  let best=null, bestDist=150;  // 150px 拾取范围
  for(const item of lootDrops){
    // 战备军火箱专属手动拾取查验
    if(item.type !== 'weapon_crate') continue;
    if(item.pickupCd && item.pickupCd>0) continue;
    const d=Math.sqrt((item.x-px)**2+(item.y-py)**2);
    if(d<bestDist){bestDist=d;best=item;}
  }
  return best;
}
// E 键拾取武器宝箱
function tryPickupWeaponCrate(){
  const crate=findNearbyWeaponCrate();
  if(!crate)return false;
  // 从 lootDrops 移除并收集
  const idx=lootDrops.indexOf(crate);
  if(idx>=0)lootDrops.splice(idx,1);
  collectLoot(crate);
  return true;
}

function drawLootDrops() {
  lootDrops.forEach(item => {
    if (item.life < 120 && Math.floor(item.life / 8) % 2 === 0) {
      return;
    }
    
    ctx.save();
    ctx.translate(item.x, item.y);
    
    if (item.type === 'coin') {
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'wood') {
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(-6, -3, 12, 6);
      ctx.strokeStyle = '#5c3a21';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-6, -3, 12, 6);
      ctx.strokeStyle = '#a67b5b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4, -1); ctx.lineTo(4, -1);
      ctx.moveTo(-2, 1); ctx.lineTo(2, 1);
      ctx.stroke();
    } else if (item.type === 'scrap') {
      ctx.fillStyle = '#90a4ae';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.fillStyle = '#cfd8dc';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'ammo') {
      ctx.fillStyle = '#33691e';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.strokeStyle = '#1b5e20';
      ctx.lineWidth = 1;
      ctx.strokeRect(-7, -5, 14, 10);
      ctx.fillStyle = '#fbc02d';
      ctx.fillRect(-4, -2, 8, 4);
    } else if (item.type === 'medkit') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-7, -6, 14, 12);
      ctx.strokeStyle = '#c62828';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-7, -6, 14, 12);
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(-4, -1, 8, 2);
      ctx.fillRect(-1, -4, 2, 8);
    } else if (item.type === 'meat_normal' || item.type === 'meat_fast' || item.type === 'meat_tank' || item.type === 'meat_elite') {
      // 肉块：大幅放大+发光光环，更容易看到和捡取
      const meatColors = {
        meat_normal: {body:'#c87862', dark:'#8b4a3a', label:'肉', glow:'rgba(200,120,98,.5)'},
        meat_fast:   {body:'#d89878', dark:'#a86848', label:'瘦', glow:'rgba(216,152,120,.5)'},
        meat_tank:   {body:'#a85838', dark:'#783818', label:'厚', glow:'rgba(168,88,56,.5)'},
        meat_elite:  {body:'#aa44cc', dark:'#6a1888', label:'异', glow:'rgba(170,68,204,.6)'},
      };
      const mc = meatColors[item.type];
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.006);
      // 外发光环
      ctx.shadowBlur = 10 + pulse * 6;
      ctx.shadowColor = mc.body;
      ctx.fillStyle = mc.glow;
      ctx.beginPath();
      ctx.arc(0, 0, 12 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 肉块本体（放大1.5倍：椭圆半径7→12, 5→9）
      ctx.fillStyle = mc.body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mc.dark;
      ctx.lineWidth = 2;
      ctx.stroke();
      // 肉纹理（加粗）
      ctx.strokeStyle = mc.dark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-7, -2); ctx.lineTo(5, -3);
      ctx.moveTo(-5, 3); ctx.lineTo(7, 2);
      ctx.stroke();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath();
      ctx.ellipse(-3, -3, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // 精英肉额外发光
      if(item.type === 'meat_elite'){
        ctx.shadowBlur = 12 + pulse * 6;
        ctx.shadowColor = mc.body;
        ctx.strokeStyle = mc.body;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // 肉类型标签（小字）
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mc.label, 0, 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    } else if (typeof INVENTORY_ITEMS !== 'undefined' && INVENTORY_ITEMS[item.type]) {
      const def = INVENTORY_ITEMS[item.type];
      const rarCol = {common:'#e8e8e8', uncommon:'#5bba6f', rare:'#4a9fe8', epic:'#b06bd6', legendary:'#ffa033'}[def.rarity] || '#ffd875';
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.006 + (item.x||0));
      const hover = Math.sin(Date.now() * 0.004 + (item.x||0)) * 3;
      ctx.translate(0, hover);

      // 地面投影与光圈
      ctx.fillStyle = rarCol;
      ctx.globalAlpha = 0.18 + pulse * 0.12;
      ctx.beginPath();
      ctx.ellipse(0, 8, 14 + pulse * 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 外发光环
      ctx.shadowBlur = 12 + pulse * 6;
      ctx.shadowColor = rarCol;
      ctx.fillStyle = rarCol;
      ctx.globalAlpha = 0.35 + pulse * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, 11 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();

      // 物品质感衬底
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#1c130d';
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rarCol;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 物品图标
      ctx.globalAlpha = 1.0;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, 0, 0);

      // 悬浮名称
      ctx.font = 'bold 7px sans-serif';
      ctx.fillStyle = rarCol;
      ctx.fillText(def.name, 0, 13);
      ctx.textBaseline = 'alphabetic';
    } else if (item.type === 'weapon_crate') {
      // ── v51模块二：发光战利品箱（悬浮旋转+稀有度光柱+地面光圈+上升粒子）──
      let rar;
      if(item.value>=0 && WEAPONS[item.value]) rar=WEAPON_RARITY[WEAPONS[item.value].rarity];
      else rar={color:'#ffe066',glow:'rgba(255,224,102,.6)',cn:'?'};
      const pulse=0.5+0.5*Math.sin(Date.now()*0.006);
      const hover = Math.sin(Date.now()*0.003)*3;  // 悬浮
      const rarRgb=rar.color==='#9a9a9a'?'180,180,180':rar.color==='#5be4ff'?'91,228,255':rar.color==='#ffd840'?'255,216,64':rar.color==='#ff6644'?'255,102,68':'255,224,102';
      // 地面光圈（椭圆贴地，柔和无冲天光柱）
      ctx.fillStyle=`rgba(${rarRgb},${.14+pulse*.08})`;
      ctx.beginPath();ctx.ellipse(0,10,18+pulse*3,5,0,0,Math.PI*2);ctx.fill();
      // 上升粒子（稀有度色小火星从箱顶往上飘）
      if(Math.random()>.6){
        mkP({x:item.x+(Math.random()-.5)*16,y:item.y-10,vx:0,vy:-0.8-Math.random(),r:1+Math.random(),rDecay:.02,decay:.04,color:rar.color,type:'circle',grav:-.02,alpha:.7,blur:true});
      }
      ctx.translate(0,hover);  // 悬浮
      // 外发光环
      ctx.shadowBlur=16+pulse*12;ctx.shadowColor=rar.color;
      ctx.fillStyle=`rgba(${rarRgb},${.3+pulse*.25})`;
      ctx.beginPath();ctx.arc(0,0,16+pulse*5,0,Math.PI*2);ctx.fill();
      // 第二层光环
      ctx.shadowBlur=0;
      ctx.fillStyle=`rgba(${rarRgb},${.15+pulse*.1})`;
      ctx.beginPath();ctx.arc(0,0,24+pulse*6,0,Math.PI*2);ctx.fill();
      // 宝箱本体（金属渐变+旋转感的高光斜条）
      const boxG=ctx.createLinearGradient(-11,0,11,0);
      boxG.addColorStop(0,'#232330');boxG.addColorStop(.4,'#3a3a48');boxG.addColorStop(1,'#28283a');
      ctx.fillStyle=boxG;ctx.fillRect(-11,-9,22,18);
      ctx.fillStyle='#4a4a58';ctx.fillRect(-11,-9,22,4);
      ctx.fillStyle='#1a1a22';ctx.fillRect(-11,5,22,4);
      // 高光斜条（随时间扫过=旋转错觉）
      const sweep=(Date.now()*0.002)%1;
      if(sweep<0.5){
        ctx.save();ctx.beginPath();ctx.rect(-11,-9,22,18);ctx.clip();
        ctx.fillStyle=`rgba(255,255,255,${.12*(1-Math.abs(sweep-0.25)*2)})`;
        ctx.fillRect(-11+(sweep*44)-6,-9,5,18);
        ctx.restore();
      }
      ctx.strokeStyle=rar.color;ctx.lineWidth=2;ctx.strokeRect(-11,-9,22,18);
      // 宝箱锁扣
      ctx.fillStyle=rar.color;ctx.fillRect(-3,-2,6,5);
      ctx.fillStyle='#1a1a22';ctx.fillRect(-2,-1,4,3);
      // 武器图标在宝箱上方（随悬浮）
      ctx.font='16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      const icon=item.value>=0&&WEAPONS[item.value]?WEAPONS[item.value].icon:'❓';
      ctx.shadowBlur=6;ctx.shadowColor=rar.color;
      ctx.fillStyle='#fff';
      ctx.fillText(icon,0,-14);
      ctx.shadowBlur=0;
      // 稀有度小标
      ctx.font='7px sans-serif';
      ctx.fillStyle=rar.color;
      ctx.fillText(rar.cn||'?',0,13);
      // 上箭头指示（提示拾取）
      ctx.fillStyle=`rgba(${rarRgb},${.6+pulse*.4})`;
      ctx.beginPath();ctx.moveTo(0,-26);ctx.lineTo(-4,-20);ctx.lineTo(4,-20);ctx.closePath();ctx.fill();
      // ── v52美术升级C：传说宝箱专属特效——旋转金色守护环+双圈粒子 ──
      if(WEAPONS[item.value] && WEAPONS[item.value].rarity==='legendary'){
        const rot=Date.now()*.002;
        ctx.strokeStyle=`rgba(255,200,80,${.5+pulse*.3})`;ctx.lineWidth=1.6;
        for(let k=0;k<3;k++){                                     // 三重守护环（交错旋转）
          const ra=rot+k*Math.PI*2/3;
          ctx.beginPath();ctx.arc(0,0,28+k*4,ra,ra+Math.PI*1.2);ctx.stroke();
        }
        if(Math.random()>.5){                                     // 双圈金色火花
          const pa=Date.now()*.004;
          const rr2=30;
          mkP({x:item.x+Math.cos(pa)*rr2,y:item.y+Math.sin(pa)*rr2,vx:Math.cos(pa)*.5,vy:Math.sin(pa)*.5,r:1.4,rDecay:.02,decay:.05,color:'#ffd840',type:'circle',grav:0,alpha:.8,blur:true});
        }
      }
    }
    
    ctx.restore();
  });
}

function ignitZombie(z){
  if(!z.alive||(z.burnTimer&&z.burnTimer>0))return;
  // ── v53燃烧重做：伤害携带武器面板 ──
  // 原版固定 0.3×16≈4.8 点——W5 后怪血 500+，燃烧纯装饰。现在：
  // 基础tick=武器面板×0.12（火焰1伤→0.12/跳×16跳；等离子24伤→2.9/跳×16跳=46总伤），
  // 辣椒喷焰枪 alwaysBurn=必定引燃+无视护甲直接结算（卡面承诺"持续灼烧无视护甲"）。
  const wDef=WEAPONS[curWpnIdx]||{};
  const alwaysBurn=!!wDef.alwaysBurn||!!wDef.burnAlways;
  const tickDmg=Math.max(0.3,(wDef.damage||5)*0.12*(wDef.id==='chiliflamer'?1.5:1));
  z.burning=true;
  z.burnDmg=tickDmg;
  z.burnTimer=176; // 16次tick * 11帧 ≈ 2.9秒，由主循环帧驱动（彻底消除原生 setInterval 泄漏隐患）
  // 必定引燃视觉（辣椒枪）：绿色辣椒火苗标记
  if(alwaysBurn&&Math.random()<.5)spawnFloatText('🌶必定引燃',z.x+22,Z_TOP-16,'#ff5522');
}
function explodeLogic(cx,cy,dmg,R){
  // v53武器去同质化：爆炸半径由武器 aoe 决定（原版硬编码100——6把爆炸武器大小全一样）
  const rad=(typeof R==='number'&&R>0)?R:100;
  zombies.forEach(z=>{if(!z.alive)return;const dx=(z.x+22)-cx,dy=(Z_TOP+28)-cy;if(Math.sqrt(dx*dx+dy*dy)<rad)hitZombie(z,z.x+22,Z_TOP+28,dmg,cx,cy);});
  if(boss&&boss.alive){const dx=(boss.x+40)-cx,dy=(GROUND_Y-80)-cy;if(Math.sqrt(dx*dx+dy*dy)<rad)hitBoss(dmg,boss.x+40,GROUND_Y-80,cx,cy);}
}
// ═══ v53引信系统：让"抛物系"武器真正分化 ═══
// 手榴弹=越墙延迟雷(0.6s哔声提示后爆) / 地雷=落地埋入1.5s定时(Lv3感应：敌近提前引爆)
// 原版两者落地即炸且共用半径100——文案里的延迟爆破从未存在。
const fuseList=[];   // {x,y,t,total,dmg,aoe,kind}
function armFuse(b){
  const wDef=WEAPONS.find(w=>w.id===b.wpn);
  const aoe=(wDef&&wDef.aoe)||100;
  if(b.wpn==='grenade'){
    fuseList.push({x:b.x,y:GROUND_Y-6,t:36,total:36,dmg:b.dmg,aoe,kind:'grenade'});   // 0.6s
    spawnFloatText('⏱',b.x,GROUND_Y-24,'#ffcc44');
  }else if(b.wpn==='landmine'){
    // 基础版=1.5s定时
    const sense=false;
    fuseList.push({x:b.x,y:GROUND_Y-4,t:90,total:90,dmg:b.dmg,aoe:aoe,kind:'landmine',sense});
    mkP({x:b.x,y:GROUND_Y-3,vx:0,vy:-1,r:6,rDecay:.4,decay:.08,color:'rgba(140,100,60,.8)',type:'circle',grav:.2,alpha:.8,blur:true});
    spawnFloatText(sense?'感应雷埋设!':'地雷布设!',b.x,GROUND_Y-24,'#ffaa66');
  }else{
    // 其他抛物武器（凝固汽油等非引信流）保持落地即爆
    vfxExplosion(b.x,b.y,aoe);sndExplosion();explodeLogic(b.x,b.y,b.dmg,aoe);
  }
}
function tickFuses(){
  for(let i=fuseList.length-1;i>=0;i--){
    const f=fuseList[i];
    // 感应雷：敌人接近提前引爆
    if(f.sense){
      const near=zombies.some(z=>z.alive&&Math.abs((z.x+22)-f.x)<f.aoe*0.6);
      if(near)f.t=Math.min(f.t,12);
    }
    f.t--;
    // 引信闪烁（越闪越快：最后0.2s狂闪）
    if(f.t<=18?f.t%4===0:f.t%12===0){
      mkP({x:f.x+4,y:f.y-4,r:1.6,rDecay:.2,decay:.1,color:'#ff4422',type:'spark',grav:0,alpha:.95});
      if(f.kind==='grenade'&&f.t<=18&&f.t%8===0){try{const a=getACtx();if(a){const o=a.createOscillator(),g=a.createGain(),now=a.currentTime;o.type='square';o.frequency.setValueAtTime(1900,now);g.gain.setValueAtTime(.05,now);g.gain.exponentialRampToValueAtTime(.001,now+.05);o.connect(g);g.connect(a.destination);o.start(now);o.stop(now+.06);}}catch(e){}}
    }
    if(f.t<=0){
      fuseList.splice(i,1);
      vfxExplosion(f.x,f.y,f.aoe);sndExplosion();
      explodeLogic(f.x,f.y,f.dmg,f.aoe);
    }
  }
}
function drawFuses(){
  fuseList.forEach(f=>{
    ctx.save();
    // 埋入地面的弹体
    ctx.fillStyle=f.kind==='grenade'?'#3a8828':'#6a5a3a';
    ctx.beginPath();ctx.arc(f.x,f.y-3,f.kind==='grenade'?6:7,Math.PI,0);ctx.fill();
    // 引信灯（红点闪烁，倒数越少越亮）
    const blink=(f.t<=18)?(Math.floor(f.t/4)%2===0):(f.t%12<6);
    ctx.fillStyle=blink?'#ff2200':'#661100';
    ctx.shadowBlur=blink?8:2;ctx.shadowColor='#ff3300';
    ctx.beginPath();ctx.arc(f.x+2,f.y-8,2,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });
}
function takeDamage(dmg){
  // 肉鸽天赋：狼化 狂化状态下免伤
  if(window._berserkActive){
    return;
  }
  // ── 行囊被动：温暖羊毛羽绒毯 吸收伤害护盾 ──
  if(window._cozyShield && window._cozyShield > 0){
    const absorb = Math.min(dmg, window._cozyShield);
    window._cozyShield -= absorb;
    dmg -= absorb;
    spawnFloatText('🛡️ 护盾吸收 -' + absorb, player.x + CHAR_W / 2, player.y - 25, '#5be4ff');
    if(dmg <= 0) return;
  }
  const barricadeRed = (cabinUpgrades.barricade || 0) * 0.05;
  const ironRed = (playerPerks.iron||0) * 0.10;  // 肉鸽天赋：铁皮减伤10%/层
  const castleRed = checkCastleWallBonus();  // 城堡内防御加成
  const mingRed = mingToughness * 0.01;  // 小胡硬汉被动：每层1%减伤
  // ── 经营→战斗联动：菜品增益（减伤类）──
  let foodRed = 0;
  const buffStacks2 = id => (activeBattleBuffs.find(b => b.id === id)?.stacks) || 0;
  foodRed += 0.20 * buffStacks2('armor');
  foodRed += 0.20 * buffStacks2('all_buff');
  // v50模块二：裂地援护锤护盾——持续期间受伤-30%
  const hammerShield = player.playerShield > 0 ? 0.30 : 0;
  // ── v53流派觉醒：堡垒壁垒（守卫）6秒受伤-70%；血怒（狂战）受伤-25%（狂战容错）──
  let skillRed = 0;
  if(window._classSkillT>0 && playerClass){
    if(playerClass.id==='warden') skillRed = 0.70;
    else if(playerClass.id==='berserker') skillRed = 0.25;
  }
  const realDmg=Math.ceil(dmg*(1-upgrades.armor*.2-upgrades.clinicArmor*.1-barricadeRed-ironRed-castleRed-mingRed-foodRed-hammerShield-skillRed));
  health=Math.max(0,health-realDmg);updateHpUI();
  // ── 战前特餐：十全大补汤（受创爆发环形震荡冲击波，震飞周围僵尸并眩晕2秒）──
  if(typeof activeTacticalMeal !== 'undefined' && activeTacticalMeal && activeTacticalMeal.id === 'stew' && (!window._lastShockT || frameT - window._lastShockT > 60)){
    window._lastShockT = frameT;
    spawnFloatText('💥 护体冲击波!', player.x + CHAR_W/2, player.y - 30, '#ffd700');
    addShake(7);
    mkP({x:player.x+CHAR_W/2, y:player.y+CHAR_H/2, r:20, rDecay:-4, decay:.05, color:'#ffd700', type:'ring', alpha:.9, grav:0});
    zombies.forEach(z => {
      if(z.alive && Math.abs((z.x+22)-(player.x+CHAR_W/2)) < 160){
        const kDir = (z.x < player.x) ? -1 : 1;
        z.knockback = (z.knockback||0) + kDir * 24;
        z.hitStun = Math.max(z.hitStun||0, 120);
        hitZombie(z, z.x+22, Z_TOP+28, 28, player.x, player.y);
      }
    });
  }
  // ── 受伤反馈：红屏闪烁 + 屏幕震动 + 伤害数字飘字 + 警告音 ──
  redFlash = Math.min(1, redFlash + 0.6);
  addShake(Math.min(12, realDmg * 0.8));
  spawnFloatText('-'+realDmg, player.x+CHAR_W/2, player.y-10, '#ff3333');
  // 低血量警告
  if(health > 0 && health < maxHp * 0.3 && !window._lowHpWarned){
    window._lowHpWarned = true;
    addBanner('⚠ 危险！血量低于30%！快回据点睡觉或让小林治疗！');
    setTimeout(() => { window._lowHpWarned = false; }, 5000);
  }
  // 受伤音效（已有 sndPlayerHurt，由调用方触发；这里加低血心跳）
  if(health > 0 && health < maxHp * 0.25){
    sndHeartbeat();
  }
  // 肉鸽天赋：荆棘 反弹15伤害/层
  if(playerPerks.thorns && window._lastAttacker){
    const atk=window._lastAttacker;
    if(atk && atk.alive){atk.hp-=playerPerks.thorns*15;atk.hitFlash=1;vfxHit(atk.x+22,Z_TOP+28,player.x,player.y);}
  }
  if(health<=0){
    // 【v55迫退机制守护】极夜压迫感尸潮期间受创：不触发死亡失败，而是被逼入绝境紧急撤回避难所小屋开启建设与梦境！
    if(overwhelmingHordeActive || wavePhase === 'horde' || window.__waveSpecial === 'overwhelming_horde'){
      health = 1;
      updateHpUI();
      addBanner('💥 面对极夜恐怖尸潮，小胡被迫撤回避难所秘密小屋！');
      enterCabinShelter();
      return;
    }
    // 肉鸽天赋：狼化 血量归零时不死，进入10秒狂化
    if(playerPerks.berserkmode && !window._berserkUsed){
      window._berserkUsed=true;
      window._berserkActive=true;
      window._berserkTimer=600;  // 10秒
      health=1;updateHpUI();  // 锁血1点
      addBanner('🐺 狼化觉醒！10秒狂化形态！攻速×2·移速×1.5·吸血20%');
      sndBossRoar();
      // 狂化特效
      const px=player.x+CHAR_W/2,py=player.y+CHAR_H/2;
      mkP({x:px,y:py,r:40,rDecay:-3,decay:.04,color:'#ff2200',type:'ring',alpha:.7,grav:0});
      for(let i=0;i<24;i++){const a=i/24*Math.PI*2;mkP({x:px,y:py,vx:Math.cos(a)*6,vy:Math.sin(a)*6,r:4,rDecay:.05,decay:.03,color:'#ff4400',type:'spark',grav:0,alpha:1});}
    }else{
      endGame();
    }
  }
}

// 心跳音效（低血量时）
function sndHeartbeat(){
  try{
    const ac = getACtx(); if(!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine'; osc.frequency.value = 50;
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g); g.connect(ac.destination);
    osc.start(now); osc.stop(now + 0.15);
    // 第二下心跳
    const osc2 = ac.createOscillator();
    const g2 = ac.createGain();
    osc2.type = 'sine'; osc2.frequency.value = 45;
    g2.gain.setValueAtTime(0.2, now + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(g2); g2.connect(ac.destination);
    osc2.start(now + 0.2); osc2.stop(now + 0.35);
  }catch(e){}
}

