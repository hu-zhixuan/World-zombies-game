// ═══════════════════════════════════════════

//  【白天模块 A7】HIRED COMPANIONS SYSTEM（雇佣伙伴+剧情NPC参战）
// ═══════════════════════════════════════════
function updateCompanions() {
  hiredCompanions.forEach((c, idx) => {
    if(!c) return;
    if(!Number.isFinite(c.x)) c.x = player.x - 50;
    if(!Number.isFinite(c.y)) c.y = CHAR_GY;
    // ── v49批3：倒地状态——停止行动+举手挣扎+救援窗口计时 ──
    if(c.downed){
      c.downedT--;
      c.walkT = 0;
      if(c.downedT <= 0){
        // 当波未救：自动归队（不永久死亡，降低挫败）
        c.downed = false;
        c.hp = Math.floor((c.maxHp||100)*0.5);
        addBanner(`${c.name} 自己爬了起来（本波没顾上救）`);
      }
      // 救援交互：玩家靠近显示提示（E 按下由 handleInteractAction 统一分发——见 rescueNearestCompanion）
      const dist = Math.abs((player.x+CHAR_W/2) - (c.x+18));
      c._rescueReady = (dist < 50);
      return;  // 倒地时跳过所有行动
    }
    if(c.barkCd > 0)c.barkCd--;
    if(c.hornRage > 0){  // v50模块二：哨笛狂暴倒计时
      c.hornRage--;
      if(c.hornRage === 0 && frameT % 4 === 0) mkP({x:c.x+18,y:Z_TOP+20,vx:0,vy:-1,r:2,rDecay:.04,decay:.06,color:'rgba(255,204,68,.4)',type:'circle',grav:0,alpha:.6});
    }
    if(player.playerShield > 0){}  // 玩家护盾衰减在主循环（全局）
    c.timer = (c.timer||0) + 1;

    // ── 【波次清场·伙伴撤退逃回小屋AI】──
    // 每波打完后，在场伙伴立即停止射击，喊出撤退台词，转身快步逃回左侧安全小屋木门(x=90)
    if(wavePhase === 'cleared'){
      if(!c._retreatBarked){
        c._retreatBarked = true;
        const retreatLines = {
          '老兵张': '枪管过热了！趁僵尸没合围，快撤回小屋！',
          '护士小林': '伤员先进屋！快点，天要黑了！',
          '工程师阿强': '防线进入冷却，战术撤回避难所！',
          '通信兵小赵': '撤、快撤回屋里！直升机明天才来！'
        };
        const line = retreatLines[c.name] || '尸潮退了，快撤回小屋！';
        spawnFloatText('🏃 ' + line, c.x + 18, (c.y||CHAR_GY) - 34, c.color || '#ffaa66');
      }
      const cabinDoorX = 90;
      targetY = (gameState === 'building') ? CHAR_GY : (groundYAt(c.x + CHAR_W/2) - CHAR_H);
      c.y = targetY;
      const diff = cabinDoorX - c.x;
      if(Math.abs(diff) > 8){
        c.x += (diff > 0 ? 1 : -1) * 3.8;
        c.walkT += 0.14;
        c.facingR = (diff > 0);
      } else {
        if(!c._enteredCabin){
          c._enteredCabin = true;
          sndClack();
          for(let p=0;p<8;p++){
            mkP({x:c.x+18,y:c.y+40,vx:(Math.random()-.5)*2.5,vy:-1-Math.random()*2,r:2,rDecay:.05,decay:.04,color:'#d2b48c',type:'circle',grav:0,alpha:.7});
          }
        }
        c.walkT = 0;
        c.facingR = false;
      }
      return; // 撤退期间不再瞄准与开火
    } else {
      c._retreatBarked = false;
      c._enteredCabin = false;
    }

    // ── 根据角色类型决定站位行为 ──
    let targetX, targetY;
    if (c.type === 'sniper') {
      // 狙击手：固定站在据点/围墙高台旁（RIGHT_WALL_X附近），远程居高临下狙击；室内则紧随玩家
      if (gameState === 'building') {
        targetX = (player.x < 180) ? (player.x + 70) : (player.x - 70);
      } else {
        targetX = c.isStoryNpc ? (RIGHT_WALL_X - 60) : (player.x - 120);
      }
      targetY = (gameState === 'building') ? CHAR_GY : (groundYAt(c.x + CHAR_W/2) - CHAR_H);
      c.y = targetY;
      const diff = targetX - c.x;
      if (Math.abs(diff) > 8) {
        c.x += diff * (gameState === 'building' ? 0.12 : 0.06);
        c.walkT += 0.04;
        c.facingR = (diff > 0);
      } else {
        c.walkT = 0;
        c.facingR = true;  // 狙击手始终面向右侧（僵尸来袭方向）
      }
      if (gameState === 'building') {
        c.x = Math.max(35, Math.min(GW - 50, c.x));
      }
      // 狙击手AI：远程精准射击（射程800，高伤害，低射速）
      // v50模块二：哨笛狂暴——hornRage 期间射速×2伤害+50%
      const rageMul = c.hornRage > 0 ? 1.5 : 1;
      const fireRate = Math.floor((c.fireRate || 240) / ((c.hornRage > 0 ? 2 : 1) * (c.mealBoost || 1)));
      if (c.timer >= fireRate) {
        const range = c.isStoryNpc ? 800 : 700;
        const near = findNearestEnemy(c.x + CHAR_W/2, c.y + 30, range);
        if (near) {
          c.timer = 0;
          const fx = c.x + CHAR_W/2;
          const fy = c.y + 30;
          const tx = near.x;
          const ty = near.y;
          vfxRail(fx, fy, tx, ty);
          railHitscan(fx, fy, tx, ty, Math.round((c.dmg || 15) * rageMul));  // 狙击手伤害提升
          sndShoot('railgun');
          const ang = Math.atan2(ty - fy, tx - fx);
          vfxMuzzle(fx + Math.cos(ang)*24, fy + Math.sin(ang)*24, ang, 'railgun');
          spawnFloatText('🎯', fx, fy-20, '#88ccff');
        }
      }
    } else if (c.type === 'medic') {
      // 医疗兵：紧跟玩家（身后30px），持续治疗
      const offset = 35;
      targetX = player.facingRight ? (player.x - offset) : (player.x + CHAR_W + offset - 20);
      if (gameState === 'building') targetX = Math.max(35, Math.min(GW - 50, targetX));
      targetY = (gameState === 'building') ? CHAR_GY : (groundYAt(c.x + CHAR_W/2) - CHAR_H);
      c.y = targetY;
      const diff = targetX - c.x;
      if (Math.abs(diff) > 6) {
        c.x += diff * (c.hornRage > 0 ? 0.22 : 0.15);  // 医疗兵跟得更紧
        c.walkT += 0.08;
        c.facingR = (diff > 0);
      } else {
        c.walkT = 0;
        c.facingR = player.facingRight;
      }
      if (gameState === 'building') c.x = Math.max(35, Math.min(GW - 50, c.x));
      // 医疗兵AI：定期治疗玩家+偶尔治疗附近友军
      const healRate = (c.healRate || 360) / (c.mealBoost || 1);
      if (c.timer >= healRate) {
        if (health < maxHp * 0.95) {
          c.timer = 0;
          const healAmt = c.healAmt || 20;
          health = Math.min(maxHp, health + healAmt);
          updateHpUI();
          vfxHeal(player.x, player.y);
          sndHeal();
          spawnFloatText(`+${healAmt}\u2665`, player.x + CHAR_W/2, player.y, '#2ecc71');
        }
      }
      // ── v49批3：治疗光环——150px 内玩家每秒+1（护士小林的群体回血）──
      c.auraT = (c.auraT||0)+1;
      if(c.auraT >= 60){
        c.auraT = 0;
        const d = Math.abs((c.x+18)-(player.x+CHAR_W/2));
        if(d < 150 && health < maxHp){
          health = Math.min(maxHp, health+1);
          updateHpUI();
          if(frameT%180===0) mkP({x:player.x+CHAR_W/2,y:player.y+10,vx:0,vy:-1,r:2,rDecay:.03,decay:.04,color:'rgba(136,255,136,.6)',type:'circle',grav:-.02,alpha:.7,blur:true});
        }
      }
      // ── v49批3：玩家低血时喊话（限频由 barkCd 控制）──
      if(health < maxHp*0.3) companionBark(c, 'playerLow');
    } else if (c.type === 'gunner') {
      // 机枪手：中距离跟随（玩家身后80px），中程火力压制
      const offset = (gameState === 'building') ? 50 : 80;
      targetX = player.facingRight ? (player.x - offset) : (player.x + CHAR_W + offset - 25);
      if (gameState === 'building') targetX = Math.max(35, Math.min(GW - 50, targetX));
      targetY = (gameState === 'building') ? CHAR_GY : (groundYAt(c.x + CHAR_W/2) - CHAR_H);
      c.y = targetY;
      const diff = targetX - c.x;
      if (Math.abs(diff) > 8) {
        c.x += diff * (c.hornRage > 0 ? 0.16 : 0.1);
        c.walkT += 0.06;
        c.facingR = (diff > 0);
      } else {
        c.walkT = 0;
        c.facingR = player.facingRight;
      }
      if (gameState === 'building') c.x = Math.max(35, Math.min(GW - 50, c.x));
      // 机枪手AI：3连发扫射（射程500，主循环帧驱动，零原生定时器泄漏）；v50模块二：哨笛狂暴——射速×2伤害+50%
      const fireRate = Math.floor((c.fireRate || 100) / ((c.hornRage > 0 ? 2 : 1) * (c.mealBoost || 1)));
      if (c.timer >= fireRate && (!c.burstShots || c.burstShots <= 0)) {
        const near = findNearestEnemy(c.x + CHAR_W/2, c.y + 30, 500);
        if (near) {
          c.timer = 0;
          c.burstShots = 3;
          c.burstCd = 0;
          c.burstDmgMul = (c.dmg ? (c.dmg / 4) : 1) * (c.hornRage > 0 ? 1.5 : 1);
        }
      }
      if (c.burstShots > 0) {
        if (c.burstCd > 0) {
          c.burstCd--;
        } else {
          c.burstCd = 6; // 6帧 ≈ 100ms
          c.burstShots--;
          const currentNear = findNearestEnemy(c.x + CHAR_W/2, c.y + 30, 500);
          if (currentNear) {
            const fx = c.x + CHAR_W/2;
            const fy = c.y + 30;
            const tx = currentNear.x;
            const ty = currentNear.y;
            const dx = tx - fx, dy = ty - fy, dist = Math.sqrt(dx*dx+dy*dy)||1;
            const b = {
              id: bId++,
              x: fx, y: fy,
              vx: (dx/dist)*15, vy: (dy/dist)*15,
              active: true,
              dmg: getDamage(4) * (c.burstDmgMul || 1),
              piercing: false, grav: false, burn: false,
              maxRange: 550, sx: fx, sy: fy, wpn: 'minigun'
            };
            bullets.push(b);
            vfxMuzzle(fx, fy, Math.atan2(dy, dx), 'minigun');
            sndShoot('minigun');
          }
        }
      }
    }
  });
}

function drawCompanions() {
  hiredCompanions.forEach((c) => {
    if(!c) return;
    if(!Number.isFinite(c.x)) c.x = player.x - 50;
    if(!Number.isFinite(c.y)) c.y = CHAR_GY;
    if(gameState === 'building') c.x = Math.max(35, Math.min(GW - 50, c.x));
    if(!Number.isFinite(c.walkT)) c.walkT = 0;
    ctx.save();
    ctx.translate(c.x + CHAR_W/2, c.y + CHAR_H);
    // ── v49批3：倒地姿态——身体旋转90度躺平 + 微弱挣扎抖动 ──
    if(c.downed){
      ctx.rotate(Math.PI/2 * 0.92);
      ctx.translate(6, Math.sin(frameT*0.15)*1.5);  // 挣扎抖动
      ctx.globalAlpha = 0.75;
    }
    if (!c.facingR) ctx.scale(-1, 1);
    
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    
    ctx.translate(0, -CHAR_H);
    
    const walkT = c.walkT || 0;
    const legA = Math.sin(walkT * Math.PI * 2) * 22;
    const bootA = Math.sin(walkT * Math.PI * 2 + 0.5) * 14;
    
    function drawCompBoot(ox, la, ba) {
      ctx.save(); ctx.translate(ox, 52); ctx.rotate(la * Math.PI / 180); ctx.translate(0, 12); ctx.rotate(ba * Math.PI / 180);
      ctx.fillStyle = '#111'; ctx.fillRect(-4, 0, 9, 6); ctx.fillRect(-4, 4, 12, 4);
      ctx.restore();
    }
    drawCompBoot(-6, -legA, -bootA);
    drawCompBoot(6, legA, bootA);
    
    function drawCompLeg(ox, la) {
      ctx.save(); ctx.translate(ox, 52); ctx.rotate(la * Math.PI / 180);
      ctx.fillStyle = '#222'; ctx.fillRect(-5, 0, 10, 14);
      ctx.restore();
    }
    drawCompLeg(-6, -legA);
    drawCompLeg(6, legA);
    
    if (c.type === 'sniper') {
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(-10, 22, 20, 30);
      ctx.fillStyle = '#10223b';
      ctx.fillRect(-10, 22, 3, 30);
      ctx.save();
      ctx.translate(8, 32);
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(0, -2, 28, 4);
      ctx.fillRect(-4, -4, 10, 8);
      ctx.restore();
    } else if (c.type === 'medic') {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(-10, 22, 20, 30);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-2, 30, 4, 10);
      ctx.fillRect(-5, 33, 10, 4);
    } else if (c.type === 'gunner') {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-12, 20, 24, 32);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-10, 24, 20, 4);
      ctx.save();
      ctx.translate(6, 32);
      ctx.fillStyle = '#374151';
      ctx.fillRect(0, -4, 22, 6);
      ctx.fillRect(0, 0, 22, 6);
      ctx.fillStyle = '#111';
      ctx.fillRect(-6, -6, 10, 14);
      ctx.restore();
    }
    
    ctx.fillStyle = '#c8855a';
    ctx.fillRect(-6, 14, 12, 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(2, 17, 2, 2);
    
    if (c.type === 'sniper') {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(-8, 9, 16, 6);
      ctx.fillStyle = '#374151';
      ctx.fillRect(-9, 12, 3, 3);
    } else if (c.type === 'medic') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-7, 8, 14, 7);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1, 10, 2, 4);
      ctx.fillRect(-2, 11, 4, 2);
    } else if (c.type === 'gunner') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(-8, 8, 16, 8);
    }
    
    ctx.restore();
    
    // ── 剧情 NPC 名字标签 + 颜色标识（让玩家认出老兵张等）──
    if(c.isStoryNpc || c.name){
      ctx.save();
      ctx.translate(c.x + CHAR_W/2, c.y + CHAR_H);
      // 名字
      ctx.font = 'bold 9px Microsoft YaHei UI,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = c.color || '#ffaa66';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 3;
      ctx.fillText(c.name, 0, -CHAR_H - 8);
      ctx.shadowBlur = 0;
      // 头顶彩色小点（身份标识）
      ctx.fillStyle = c.color || '#ffaa66';
      ctx.beginPath();
      ctx.arc(0, -CHAR_H - 14, 2.5, 0, Math.PI*2);
      ctx.fill();
      // ── v49批3：HP血条（有 maxHp 的伙伴都显示；低于30%闪红）──
      if(c.maxHp){
        const hpR = c.hp/c.maxHp;
        ctx.fillStyle='rgba(0,0,0,.6)';
        ctx.fillRect(-15, -12, 30, 4);
        const low = hpR < 0.3 && Math.sin(frameT*0.3)>0;
        ctx.fillStyle = low ? '#ff2222' : (hpR>0.5?'#44dd44':'#ddaa22');
        ctx.fillRect(-14, -11, 28*hpR, 2);
      }
      // ── v49批3：倒地姿态（躺平+举手挣扎+呼救图标）──
      ctx.restore();
      if(c.downed){
        ctx.save();
        ctx.translate(c.x + CHAR_W/2, c.y + CHAR_H);
        // 呼救感叹气泡
        const bob = Math.sin(frameT*0.2)*2;
        ctx.fillStyle='rgba(255,80,60,.9)';
        ctx.beginPath();ctx.arc(16, -CHAR_H-20+bob, 6, 0, Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff';
        ctx.font='bold 9px Microsoft YaHei UI,sans-serif';ctx.textAlign='center';
        ctx.fillText('!', 16, -CHAR_H-17+bob);
        // E 提示（可救时）
        if(c._rescueReady){
          ctx.fillStyle='rgba(255,255,255,.85)';
          ctx.font='bold 8px Microsoft YaHei UI,sans-serif';
          ctx.fillText('E 救援', 0, -CHAR_H-2+bob);
        }
        ctx.restore();
      }
    }
  });
}

// ═══════════════════════════════════════════

//  SPRITE COMPANION AI
// ═══════════════════════════════════════════
function updateSprite(t){
  if(!sprite.exists)return;
  // Follow player with lag
  sprite.tx=player.x+50+Math.sin(t*.02)*20;
  sprite.ty=player.y-30+Math.cos(t*.015)*10;
  sprite.x+=(sprite.tx-sprite.x)*.06;
  sprite.y+=(sprite.ty-sprite.y)*.06;
  sprite.attackTimer--;
  sprite.healTimer--;
  // Attack nearest zombie
  if(sprite.attackTimer<=0){
    sprite.attackTimer=180; // 3 seconds at 60fps
    const near=findNearestEnemy(sprite.x,sprite.y,350);
    if(near){
      const tx=near.x,ty=near.y;
      vfxSpriteAttack(sprite.x,sprite.y,tx,ty);
      // Add sprite bolt to bullets
      const dx=tx-sprite.x,dy=ty-sprite.y,dist=Math.sqrt(dx*dx+dy*dy)||1;
      bullets.push({x:sprite.x,y:sprite.y,vx:(dx/dist)*12,vy:(dy/dist)*12,active:true,dmg:getDamage(3),piercing:false,grav:false,burn:false,maxRange:400,sx:sprite.x,sy:sprite.y,wpn:'_sprite',id:bId++});
    }
  }
  // Heal player if low HP
  if(sprite.healTimer<=0&&health<maxHp*.5){
    sprite.healTimer=480; // 8s cooldown
    const healAmt=15;health=Math.min(maxHp,health+healAmt);updateHpUI();
    vfxHeal(player.x,player.y);sndHeal();
    spawnFloatText(`+${healAmt}♥`,player.x+CHAR_W/2,player.y,'#2ecc71');
  }
  // Shield (level 2)
  if(sprite.level>=2&&sprite.shieldReady&&player.iframes>60){
    sprite.shieldReady=false;player.iframes=Math.max(player.iframes,160);
    // Shield VFX
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2;mkP({x:player.x+CHAR_W/2+Math.cos(a)*25,y:player.y+CHAR_H/2+Math.sin(a)*25,vx:Math.cos(a)*.5,vy:Math.sin(a)*.5,r:3,rDecay:.05,decay:.04,color:'#80c8ff',type:'circle',blur:true,alpha:.9});}
    setTimeout(()=>sprite.shieldReady=true,20000);
  }
  // Sprite particle trail
  if(Math.random()<.4)mkP({x:sprite.x+(Math.random()-.5)*6,y:sprite.y+(Math.random()-.5)*6,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,r:1.5+Math.random()*2,rDecay:.04,decay:.04,color:`hsl(${200+Math.random()*80},90%,70%)`,type:'circle',grav:-.005,alpha:.7,blur:true});
}

// ═══════════════════════════════════════════

//  BOSS SYSTEM
// ═══════════════════════════════════════════
const BOSS_TYPES=[
  // 第一章 BOSS — 暴君变异体（巨型冲撞型）— HP 3x，新增冲撞+跳跃+召唤
  // armorPct/resistPct：双轴克制（塔防重做）——暴君高物理甲，电弧塔克制
  {name:'暴君变异体',     baseHp:2700, speed:1.0, color:'#ff2222', dmgMul:2.5, summonN:6, armorPct:0.6, resistPct:0.1},
  // 第二章 BOSS — 喷吐者（远程酸液型）— HP 3x，新增酸雨+召唤+狂暴
  // 高能量抗性——炮击塔/机枪塔克制，电弧塔被抗
  {name:'喷吐者',   baseHp:4500, speed:1.2, color:'#aa22ff', dmgMul:3.0, summonN:8, armorPct:0.1, resistPct:0.65},
  // 第三章 BOSS — 尸王（最终BOSS，综合型）— HP 3x，全技能+多阶段
  // 双抗中庸偏高，P2/P3 狂暴时抗性互换（逼玩家配多类型塔）
  {name:'尸王',     baseHp:9000, speed:0.95, color:'#22aaff', dmgMul:3.5, summonN:10, armorPct:0.4, resistPct:0.4},
];

// BOSS 击败后独白（C1重写：致命蠢蛋主题）
const BOSS_VICTORY_DIALOGUES = [
  // Boss 0 击败后：暴君变异体
  { lines:[
    {npc:'ming',  text:'倒了。这东西的血比沥青还黏……'},
    {npc:'lin',   text:'围墙被撞出一道裂痕。我处理伤员，你们赶紧修墙。', enterDelay:500},
    {npc:'radio', text:'【军方广播】……检测到变异体信号消失……幸存者干得漂亮……继续坚守……', enterDelay:500},
    {npc:'zhang', text:'干得漂亮，小伙子。但下一个会更难。', enterDelay:500},
  ]},
  // Boss 1 击败后：喷吐者
  { lines:[
    {npc:'ming',  text:'酸液腐蚀了一大片地面。这玩意儿要是喷到墙上，铁墙也得化。'},
    {npc:'qiang', text:'我去补一层钢筋。还剩最后一个Boss——准备终战。', enterDelay:600},
    {npc:'radio', text:'【军方广播】……直升机编队已进入空域……预计不久抵达……请准备着陆区标记……', enterDelay:500},
    {npc:'zhao',  text:'机长已经在路上了。他说——这是最后一班，无论你们是否清场，他都会降落。', enterDelay:500},
  ]},
  // Boss 2 击败后：尸王（最终BOSS）
  { lines:[
    {npc:'ming',  text:'尸王……倒了。整个地面都在震。'},
    {npc:'heli',  text:'（螺旋桨轰鸣）地面单位！着陆区已确认！我们降落了！', enterDelay:500},
    {npc:'zhang', text:'我打了二十年仗……这是最后一次了。走吧，孩子，我们回家。', enterDelay:500},
    {npc:'lin',   text:'所有人——上飞机！我把药品箱都带上了。', enterDelay:400},
    {npc:'ming',  text:'结束了。十五天，十五波尸潮。我们活下来了。'},
  ]},
];

// 章节卡（僵尸围城生存主题）
const CHAPTER_CARDS = [
  { chapter:'第一章', title:'围城初夜', sub:'1 — 4 波 · 尸潮初临',
    text:'病毒爆发后的第一夜。尸潮从城区涌来，扑向你的城堡据点。\n围墙还没建好，武器弹药有限。\n守住前四波，攒金币升级城墙——这是活过今夜的关键。' },
  { chapter:'第二章', title:'尸潮升级', sub:'5 — 9 波 · 变异体出没',
    text:'感染体开始变异。跑得更快的、皮更厚的、远程喷酸的……\n每一种都比第一夜的普通僵尸致命十倍。\n第5波出现首个Boss，升级围墙到石墙，部署更多防御塔。' },
  { chapter:'第三章', title:'旧城区', sub:'10 — 14 波 · 旧城区探索',
    text:'你已深入旧城区。废弃的诊所、军火库、幸存者营地散落其间。\n搜索它们能获得稀有武器和强力升级。\n第10波的Boss比之前更强，准备好你的终极武器。' },
  { chapter:'终章', title:'最终围攻', sub:'第 15 波 · 直升机撤离',
    text:'军方直升机已在途中。但尸潮的攻势也达到顶峰。\n最终Boss尸王挡在着陆区——它是这片废墟里所有感染者的集合体。\n干掉它，清理着陆区，登上直升机。十五天围城，终章就在眼前。' },
];

// 环境旁白（僵尸围城生存主题）
const ENV_NARRATIONS = [
  { x: 180,  text:'路边一辆侧翻的救护车，车门大开，担架上空无一人，地上是干涸的血迹。' },
  { x: 350, text:'一面贴满寻人启事的墙。照片上的人早已不在，纸张被雨水泡烂，字迹模糊。' },
  { x: 550, text:'一个消防栓被撞断，水柱喷了三天三夜，把整条街泡成了沼泽。' },
  { x: 750, text:'十字路口。四辆车撞在一起，没人逃出来。车灯还亮着，电瓶快没电了。' },
  { x: 950, text:'废弃的营地。篝火早就熄了，帐篷塌了一半，地上散落着空罐头和弹壳。' },
  { x: 1150, text:'过街天桥上挂着一面横幅："撤离点 → 港口"。箭头指向东边，字迹是用血写的。' },
  { x: 1300, text:'焦土一片。曾有人在这里点燃汽油阻止尸潮，火势失控，把整条街都烧了。' },
  { x: 1450, text:'军火站的铁门被撬开。里面的武器被洗劫一空，只剩空架子和几箱过期弹药。' },
  { x: 1580, text:'地下通风口传来低沉的嘶吼。里面挤满了感染者，密密麻麻，像蜂巢一样。' },
  { x: 1650, text:'远处的着陆区标着烟雾弹。直升机还没来，但尸王已经站在那里等着了。' },
];
function spawnBoss(){
  const btype=bossCount%BOSS_TYPES.length;
  // Show boss intro dialogue first, then spawn
  triggerBossIntro(btype, ()=>{
    _doSpawnBoss(btype);
  });
}
function _doSpawnBoss(btype){
  const bdata=BOSS_TYPES[btype];
  // Boss HP成长：每次+200（大幅提升后期Boss血量）
  const hp=bdata.baseHp+bossCount*200;
  boss={
    x:1500,y:GROUND_Y-120,jumpVy:0,
    hp,maxHp:hp,alive:true,
    type:btype,facingR:false,
    state:'enter',stateTimer:0,
    walkT:0,hitFlash:0,
    speed:bdata.speed,
    phaseTwo:false,phaseThree:false,
    projTimer:0,
    summonN:bdata.summonN||4,
    dmgMul:bdata.dmgMul||1,
    // ── 双轴克制：Boss 抗性（塔防重做）──
    armorPct:bdata.armorPct||0, resistPct:bdata.resistPct||0,
    baseArmorPct:bdata.armorPct||0, baseResistPct:bdata.resistPct||0,
    // 新增Boss技能字段
    acidRainTimer:0,     // 酸雨技能计时器
    enrageTimer:0,       // 狂暴计时器
    shieldActive:false,  // 护盾（尸王专属）
    shieldHp:0,
    teleportTimer:0,     // 传送技能（喷吐者）
  };
  bossActive=true;bossCount++;
  document.getElementById('boss-name').textContent=bdata.name;
  bossHpBar.style.display='block';
  bossHpFill.style.width='100%';
  bossHpFill.style.background=`linear-gradient(90deg,#4a0000,${bdata.color})`;
  addBanner(`⚠ BOSS降临：${bdata.name}`);
  // v49批3：伙伴Boss战喊话
  const bossSquad = hiredCompanions.filter(c=>!c.downed);
  if(bossSquad.length){
    setTimeout(()=>{ if(gameRunning && bossActive) companionBark(bossSquad[Math.floor(Math.random()*bossSquad.length)], 'boss'); }, 2200);
  }
  purpleFlash=.6;
  sndBossAppear();
}
function updateBoss(){
  if(!boss||!boss.alive)return;
  boss.stateTimer++;
  if(boss.hitFlash>0)boss.hitFlash=Math.max(0,boss.hitFlash-.06);
  const pcx=player.x+CHAR_W/2;
  // 城堡塔防制（v47回退）：Boss 追击玩家（原版手感）
  const dir=Math.sign(pcx-(boss.x+40));
  boss.facingR=(dir>0);
  // Phase 2 at 60% HP，Phase 3 at 30% HP（阶段二-6 强化）
  if(!boss.phaseTwo&&boss.hp<boss.maxHp*.6){boss.phaseTwo=true;boss.speed*=1.3;addBanner('⚠ BOSS狂暴化！');purpleFlash=.8;addShake(15);sndBossRoar();}
  if(!boss.phaseThree&&boss.hp<boss.maxHp*.3){boss.phaseThree=true;boss.speed*=1.4;addBanner('⚠ BOSS濒死狂乱！全属性提升！');purpleFlash=1;addShake(20);sndBossRoar();}
  const dmgMul=boss.phaseThree?1.5:boss.phaseTwo?1.25:1;
  switch(boss.state){
    case'enter':
      boss.x=Math.max(cameraX+GW-180,boss.x-2.5);boss.walkT+=.04;
      if(boss.x<=cameraX+GW-180)boss.state='idle';break;
    case'idle':
      if(boss.stateTimer>40)boss.state='walk';break;
    case'walk':
      boss.x+=dir*boss.speed;boss.walkT+=.04;
      if(boss.stateTimer>200||Math.abs(pcx-(boss.x+40))<60){
        const r=Math.random();
        // 根据Boss类型和阶段选择不同攻击
        if(boss.type===0){ // 暴君：偏重冲撞和砸地
          boss.state=r<.4?'charge':r<.7?'slam':'roar';
        } else if(boss.type===1){ // 喷吐者：偏重咆哮弹幕和酸雨
          boss.state=r<.3?'slam':r<.5?'charge':boss.phaseTwo?'acidrain':'roar';
        } else { // 尸王：全技能随机
          boss.state=r<.25?'slam':r<.5?'charge':r<.75?'roar':boss.phaseThree?'teleport':'acidrain';
        }
        boss.stateTimer=0;
      }
      break;
    case'slam':
      if(boss.stateTimer===1){boss.jumpVy=-16;}
      boss.y+=boss.jumpVy;
      boss.jumpVy+=.7;
      if(boss.y>=GROUND_Y-120){boss.y=GROUND_Y-120;// Landed
        vfxShockwave(boss.x+40,GROUND_Y);sndSlam();
        // Damage players/vehicle near slam
        if(Math.abs(pcx-(boss.x+40))<120){
          if(vehicle.entered){
            vehicle.hp-=Math.round(30*dmgMul);
            if(vehicle.hp<=0){
              vfxExplosion(vehicle.x+60,GROUND_Y-22);
              vehicle.exists=false;vehicle.entered=false;player.x=vehicle.x+60;player.y=CHAR_GY;
              addBanner('⚠ 战车被摧毁！');
            }
          }else if(player.iframes===0){
            takeDamage(Math.round(25*dmgMul));player.vy=-8;player.onGround=false;player.iframes=80;vfxPlayerHurt(player.x,player.y);
          }
        }
        boss.state='idle';boss.stateTimer=0;}
      boss.walkT+=.04;break;
    case'charge':
      boss.x+=dir*(boss.speed*4.5);boss.walkT+=.1;
      if(boss.stateTimer>50||boss.x<-80||boss.x>cameraX+GW+80){boss.state='idle';boss.stateTimer=0;}
      if(Math.abs(pcx-(boss.x+40))<50){
        if(vehicle.entered){
          vehicle.hp-=Math.round(25*dmgMul);addShake(8);
          if(vehicle.hp<=0){
            vfxExplosion(vehicle.x+60,GROUND_Y-22);
            vehicle.exists=false;vehicle.entered=false;player.x=vehicle.x+60;player.y=CHAR_GY;
            addBanner('⚠ 战车被摧毁！');
          }
        }else if(player.iframes===0){
          takeDamage(Math.round(20*dmgMul));player.vx=dir*10;player.vy=-6;player.onGround=false;player.iframes=80;vfxPlayerHurt(player.x,player.y);
        }
      }
      break;
    case'roar':
      if(boss.stateTimer===1){
        purpleFlash=.5;addShake(8);sndBossRoar();
        // 召唤僵尸（随BOSS类型递增）
        const summonN=boss.summonN||4;
        for(let i=0;i<summonN;i++)setTimeout(()=>spawnZombie(),i*350);
        // 弹幕：所有BOSS都会发射，Phase3 多一轮
        const angles=[-30,-15,0,15,30].map(a=>a*Math.PI/180);
        angles.forEach(a=>{
          const baseA=Math.atan2((player.y+CHAR_H/2)-(GROUND_Y-80),(pcx-(boss.x+40)))+a;
          bossProjList.push({x:boss.x+40,y:GROUND_Y-80,vx:Math.cos(baseA)*6,vy:Math.sin(baseA)*6,active:true,type:boss.type===2?'bolt':'skull',color:boss.type===2?'#00aaff':'#aa22ff'});
          sndBossProj();
        });
        // Phase3 额外散射弹幕
        if(boss.phaseThree){
          for(let i=0;i<8;i++){
            const a=i/8*Math.PI*2;
            bossProjList.push({x:boss.x+40,y:GROUND_Y-80,vx:Math.cos(a)*4.5,vy:Math.sin(a)*4.5,active:true,type:'bolt',color:'#ff4444'});
          }
        }
      }
      if(boss.stateTimer>90){boss.state='idle';boss.stateTimer=0;}break;
    case'acidrain': // 新技能：酸雨（喷吐者专属，Phase2解锁）
      if(boss.stateTimer===1){
        purpleFlash=.6;addShake(10);sndBossRoar();
        addBanner('⚠ BOSS释放酸雨！全屏落下酸液！');
        // 在玩家上方区域生成大量酸液弹
        for(let i=0;i<12;i++){
          const tx=player.x+(Math.random()-.5)*400;
          const ty=GROUND_Y-200-Math.random()*100;
          bossProjList.push({x:tx,y:ty,vx:0,vy:3+Math.random()*2,active:true,type:'acid',color:'#88ff44'});
        }
      }
      if(boss.stateTimer>120){boss.state='idle';boss.stateTimer=0;}break;
    case'teleport': // 新技能：传送（喷吐者专属，Phase3解锁）
      if(boss.stateTimer===1){
        purpleFlash=.8;addShake(12);
        // 传送到玩家附近
        const oldX=boss.x;
        boss.x=player.x+200*(player.facingRight?-1:1);
        boss.x=Math.max(cameraX+100,Math.min(cameraX+GW-100,boss.x));
        addBanner('⚠ BOSS瞬移到你身后！');
        // 传送特效
        for(let i=0;i<20;i++){mkP({x:oldX+40,y:GROUND_Y-80,vx:(Math.random()-.5)*8,vy:(Math.random()-.5)*8,r:4,rDecay:.06,decay:.04,color:'#aa22ff',type:'circle',alpha:.8,blur:true});}
        for(let i=0;i<20;i++){mkP({x:boss.x+40,y:GROUND_Y-80,vx:(Math.random()-.5)*8,vy:(Math.random()-.5)*8,r:4,rDecay:.06,decay:.04,color:'#aa22ff',type:'circle',alpha:.8,blur:true});}
      }
      if(boss.stateTimer>60){boss.state='idle';boss.stateTimer=0;}break;
  }
  // ── Boss被动技能计时器 ──
  boss.acidRainTimer++;
  boss.teleportTimer++;
  boss.enrageTimer++;
  // 喷吐者(btype===1) Phase2: 每5秒释放酸雨
  if(boss.type===1 && boss.phaseTwo && boss.acidRainTimer>300 && boss.state==='idle'){
    boss.acidRainTimer=0;
    boss.state='acidrain';boss.stateTimer=0;
  }
  // 喷吐者 Phase3: 每8秒传送
  if(boss.type===1 && boss.phaseThree && boss.teleportTimer>480 && boss.state==='idle'){
    boss.teleportTimer=0;
    boss.state='teleport';boss.stateTimer=0;
  }
  // 尸王(btype===2) Phase2: 开启护盾（吸收500伤害）
  if(boss.type===2 && boss.phaseTwo && !boss.shieldActive && boss.shieldHp<=0){
    boss.shieldActive=true;boss.shieldHp=800;
    addBanner('⚠ 尸王开启暗影护盾！吸收800伤害！');
    purpleFlash=.7;
  }
  // 尸王 Phase3: 每10秒狂暴（移速+攻击力暂时提升）
  if(boss.type===2 && boss.phaseThree && boss.enrageTimer>600){
    boss.enrageTimer=0;
    boss.speed*=1.5;
    addBanner('⚠ 尸王进入狂暴状态！全属性提升！');
    sndBossRoar();addShake(15);purpleFlash=1;
    setTimeout(()=>{ if(boss&&boss.alive) boss.speed/=1.5; }, 5000);
  }
  // Keep boss in bounds
  boss.x=Math.max(-60,Math.min(WORLD_W-60,boss.x));
  // Update boss projectiles
  for(let i=bossProjList.length-1;i>=0;i--){
    const bp=bossProjList[i];
    if(!bp.active){bossProjList.splice(i,1);continue;}
    bp.x+=bp.vx;bp.y+=bp.vy;bp.vy+=.15;
    if(bp.x<-20||bp.x>cameraX+GW+20||bp.y>GH+20){bp.active=false;continue;}
    // Boss 投射物伤害随阶段递增
    if(!vehicle.entered&&player.iframes===0){
      if(Math.abs(bp.x-(player.x+CHAR_W/2))<20&&Math.abs(bp.y-(player.y+CHAR_H/2))<30){
        const dmg=Math.round((boss.phaseThree?28:boss.phaseTwo?22:15)*dmgMul);
        takeDamage(dmg);player.iframes=80;vfxPlayerHurt(player.x,player.y);sndPlayerHurt();
        vfxHit(bp.x,bp.y,bp.x-bp.vx*3,bp.y-bp.vy*3);bp.active=false;
      }
    }
  }
  // Update boss HP bar
  bossHpFill.style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';
}
function hitBoss(dmg,bx,by,fromX,fromY,dmgType){
  if(!boss||!boss.alive)return;
  // ── 双轴克制：Boss 抗性减伤（塔防重做）──
  let dt = dmgType;
  if(!dt){
    const w=cw();
    if(w){
      if(w.explosive) dt='explosive';
      else if(w.tagClass==='tag-fire'||w.tagClass==='tag-elec'||w.burn) dt='energy';
      else dt='physical';
    } else dt='physical';
  }
  const armor=boss.armorPct||0, resist=boss.resistPct||0;
  if(dt==='physical') dmg*=(1-armor);
  else if(dt==='explosive') dmg*=(1-armor*0.5);
  else if(dt==='energy') dmg*=(1-resist);
  const crit=Math.random()<CRIT_CHANCE;
  let fdmg=crit?dmg*2:dmg;
  // 尸王护盾：吸收伤害
  if(boss.shieldActive && boss.shieldHp > 0){
    const absorbed=Math.min(fdmg, boss.shieldHp);
    boss.shieldHp -= absorbed;
    fdmg -= absorbed;
    if(boss.shieldHp <= 0){
      boss.shieldActive=false;
      addBanner('💥 尸王护盾被击碎！');
      purpleFlash=.5;
      for(let i=0;i<15;i++){mkP({x:boss.x+40,y:GROUND_Y-80,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,r:3,rDecay:.06,decay:.04,color:'#22aaff',type:'circle',alpha:.8,blur:true});}
    }
  }
  boss.hp-=fdmg;boss.hitFlash=1;vfxHit(bx,by,fromX,fromY);
  // 连续暴击计数（神枪手成就）
  if(crit) critComboCount++; else critComboCount = 0;
  if(crit){sndCrit();vfxCritHit(bx,by,fromX,fromY);spawnFloatText('CRIT ' + Math.round(fdmg) + '!',bx,GROUND_Y-90,'#ff3344',true);}
  if(boss.hp<=0){
    boss.alive=false;bossActive=false;
    vfxBossKill(boss.x+40,GROUND_Y-80);sndBossDie();
    bossHpBar.style.display='none';bossProjList=[];
    // Boss physical loot drop shower
    const coinReward = 60 + bossCount * 15;
    for (let i = 0; i < 6; i++) {
      lootDrops.push(createLootItem(boss.x + 40, GROUND_Y - 80, 'coin', Math.ceil(coinReward / 6)));
    }
    lootDrops.push(createLootItem(boss.x + 40, GROUND_Y - 80, 'ammo', 1));
    lootDrops.push(createLootItem(boss.x + 40, GROUND_Y - 80, 'medkit', 1));
    lootDrops.push(createLootItem(boss.x + 40, GROUND_Y - 80, 'wood', 3));
    lootDrops.push(createLootItem(boss.x + 40, GROUND_Y - 80, 'scrap', 3));
    // Boss 保底掉落一个武器宝箱
    spawnWeaponCrate(boss.x + 40, GROUND_Y - 80);
    onKill(boss.x+40,GROUND_Y-80,200);       // 首领击杀走连击结算（含倍率）
    hitstop=24;                               // 首领击杀慢动作
    wavePhase='cleared';
    // Boss 击败后独白（阶段二-6），然后开商店（关商店时自动进下一波）
    const bossIdx=(bossCount-1)%BOSS_VICTORY_DIALOGUES.length;
    const victoryDlg=BOSS_VICTORY_DIALOGUES[bossIdx];
    // Boss 2 (3rd boss) = trigger ending
    if(bossCount>=3){
      addBanner('🏆 最终首领已消灭！');
      setTimeout(()=>{
        if(victoryDlg) showCinematic(victoryDlg.lines, ()=>showEnding());
        else showEnding();
      }, 2000);
    } else {
      addBanner('🏆 首领已消灭！');
      setTimeout(()=>{
        // Boss击败后也进入缓冲期（和普通波一样）
        if(victoryDlg) showCinematic(victoryDlg.lines, ()=>onWaveCleared());
        else onWaveCleared();
      }, 1800);
    }
  }
}

// ═══════════════════════════════════════════

//  PLAYER PHYSICS
