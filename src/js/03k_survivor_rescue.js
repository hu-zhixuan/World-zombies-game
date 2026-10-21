// ════════════════════════════════════════════════════════════════════════════
//  【战场求救】白天救下的人，晚上坐在食堂里吃饭
//  - 每个白天波次开头，城墙外可能有人求救（VIP 先在这里"遇见"，之后才会来店；也可能是普通幸存者）
//  - 走近按 E 救下；僵尸路过会啃他，来不及就救不下
//  - 救下的人记入 tonightGuests：晚上开张时优先入座，付小费更多、涨粉；VIP 当晚必来
//  食堂和战场因此共用同一批人，两段玩法是一个故事。
// ════════════════════════════════════════════════════════════════════════════

let fieldSurvivors = [];   // 战场上正在求救的人
let tonightGuests = [];    // 今晚会来食堂的人 [{kind:'survivor', persona} | {kind:'vip', vipId}]

const SURVIVOR_RESCUE_RANGE = 60;     // 走到多近可以按 E 救人
const SURVIVOR_HP = 100;
const SURVIVOR_BITE_PER_FRAME = 0.35; // 每只靠近的僵尸每帧对求救者的伤害

// ── VIP 与战场的关系 ──
// 一个 VIP 能来店的条件：粉丝够 + 已经遇见过（战场救下 / 旧存档里见过）。
// 兜底：粉丝解锁满 3 天仍没在战场遇到，会自己找上门，避免玩家一直碰不到。
function isVIPFieldMet(vipId){
  const comp = vipCompendium[vipId];
  if(!comp) return false;
  if(comp.fieldMet || comp.met) return true;
  if(comp.unlockedWave === undefined) return comp.unlocked === true;   // 旧存档里已解锁的
  return wave - comp.unlockedWave >= 3;
}

// 现在能在战场上遇到的 VIP：粉丝够、还没遇见
function getFieldEncounterVIPs(){
  return VIP_CUSTOMERS.filter(v => wastegramFans >= v.unlockFans && !(vipCompendium[v.id] && (vipCompendium[v.id].fieldMet || vipCompendium[v.id].met)));
}

function _vipShortName(vip){ const p = vip.name.split('·'); return p[p.length - 1]; }

function _survivorFromVIP(vip){
  return { name: _vipShortName(vip), skin:'#d4a574', hair:'#3a2a1a', shirt: vip.color || '#8b6914' };
}

// ── 每个白天波次开头调用（startWaveContent，Boss 波不刷）──
function maybeSpawnFieldSurvivor(){
  fieldSurvivors = [];
  const vips = getFieldEncounterVIPs();
  let s = null;
  if(wave === 1 && vips.length > 0){
    s = { vip: vips[0] };                       // 第一天必有一个：教会玩家"救人 → 晚上来店"
  }else if(vips.length > 0 && Math.random() < 0.5){
    s = { vip: vips[Math.floor(Math.random() * vips.length)] };
  }else if(Math.random() < 0.4){
    s = {};
  }
  if(!s) return null;
  const x = RIGHT_WALL_X + 240 + Math.random() * 300;
  const persona = s.vip ? _survivorFromVIP(s.vip) : generateNormalCustomerPersona();
  const surv = { x, vip: s.vip || null, persona, hp: SURVIVOR_HP, state: 'waiting', t: 0, near: false, fade: 1 };
  fieldSurvivors.push(surv);
  addBanner('城墙外有人求救：' + persona.name + '！走近按 E 救人');
  return surv;
}

// ── 每帧（world 状态）──
function updateFieldSurvivors(){
  if(fieldSurvivors.length === 0) return;
  const px = player.x + CHAR_W / 2;
  for(let i = fieldSurvivors.length - 1; i >= 0; i--){
    const s = fieldSurvivors[i];
    s.t++;
    if(s.state === 'waiting'){
      let biters = 0;
      for(const z of zombies){ if(z.alive && Math.abs((z.x + 22) - s.x) < 40) biters++; }
      if(biters > 0){
        s.hp -= SURVIVOR_BITE_PER_FRAME * biters;
        if(frameT % 20 === 0) spawnFloatText('救命!', s.x, groundYAt(s.x) - CHAR_H - 20, '#e5594f');
      }
      s.near = Math.abs(px - s.x) < SURVIVOR_RESCUE_RANGE;
      if(s.hp <= 0){
        addBanner('没能救下 ' + s.persona.name + '……');
        if(typeof sndHurt === 'function') try{ sndHurt(); }catch(e){}
        fieldSurvivors.splice(i, 1);
      }
    }else if(s.state === 'saved'){
      s.x -= 3.2;                       // 被救下后自己跑回小屋
      s.fade -= 0.012;
      if(s.fade <= 0 || s.x < RIGHT_WALL_X - 40) fieldSurvivors.splice(i, 1);
    }
  }
}

// ── E 键：救下最近的求救者（handleInteractAction 调用，返回是否处理了）──
function rescueNearestSurvivor(){
  for(const s of fieldSurvivors){
    if(s.state === 'waiting' && s.near){
      s.state = 'saved';
      onSurvivorRescued(s);
      return true;
    }
  }
  return false;
}

function onSurvivorRescued(s){
  const y = groundYAt(s.x) - CHAR_H - 20;
  try{ sndHeal(); }catch(e){}
  coins += 10; updateCoinUI();
  if(s.vip){
    const vip = s.vip;
    if(!vipCompendium[vip.id]) vipCompendium[vip.id] = { met:false, meetCount:0, bestQuality:null, lastVisit:0 };
    vipCompendium[vip.id].fieldMet = true;
    vipCompendium[vip.id].fieldMetWave = wave;
    tonightGuests.push({ kind:'vip', vipId: vip.id });
    spawnFloatText('谢谢你！今晚我去你的店', s.x, y, vip.accent || '#f2a65a');
    pushSideNotification('救下了 ' + vip.name, vip.bg, '今晚会来食堂', vip.color, 'vip');
  }else{
    tonightGuests.push({ kind:'survivor', persona: s.persona });
    spawnFloatText('谢谢！晚上去吃饭', s.x, y, '#9be89b');
    addBanner('救下了 ' + s.persona.name + '，今晚会来食堂');
  }
}

// 一波结束：没救的人自己撤离
function clearFieldSurvivors(){
  if(fieldSurvivors.some(s => s.state === 'waiting')) addBanner('求救的人自己摸黑撤走了');
  fieldSurvivors = [];
}

// ── 绘制（世界坐标，在 drawCompanions 之后调用）──
function drawFieldSurvivors(){
  if(gameState !== 'world' || fieldSurvivors.length === 0) return;
  fieldSurvivors.forEach(s => {
    const gy = groundYAt(s.x);
    const p = s.persona;
    const bob = s.state === 'saved' ? Math.sin(s.t * 0.6) * 2 : Math.sin(s.t * 0.15) * 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.fade);
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(s.x, gy - 2, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
    const top = gy - 54 + bob;
    // 身体 / 腿
    ctx.fillStyle = p.shirt || '#5a6a7a';
    ctx.fillRect(s.x - 8, top + 18, 16, 22);
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(s.x - 7, top + 40, 6, 12); ctx.fillRect(s.x + 1, top + 40, 6, 12);
    // 手臂：求救时高举挥动，被救后下垂
    ctx.strokeStyle = p.skin || '#d4a574'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const wave1 = s.state === 'waiting' ? Math.sin(s.t * 0.25) * 6 : 0;
    ctx.beginPath();
    if(s.state === 'waiting'){
      ctx.moveTo(s.x - 8, top + 22); ctx.lineTo(s.x - 14 + wave1, top + 4);
      ctx.moveTo(s.x + 8, top + 22); ctx.lineTo(s.x + 14 - wave1, top + 4);
    }else{
      ctx.moveTo(s.x - 8, top + 22); ctx.lineTo(s.x - 11, top + 36);
      ctx.moveTo(s.x + 8, top + 22); ctx.lineTo(s.x + 11, top + 36);
    }
    ctx.stroke();
    // 头 + 头发
    ctx.fillStyle = p.skin || '#d4a574';
    ctx.fillRect(s.x - 6, top + 6, 12, 12);
    ctx.fillStyle = p.hair || '#3a2a1a';
    ctx.fillRect(s.x - 7, top + 3, 14, 6);
    ctx.fillStyle = '#111';
    ctx.fillRect(s.x - 3, top + 11, 2, 2); ctx.fillRect(s.x + 1, top + 11, 2, 2);
    if(s.state === 'waiting'){
      // 头顶感叹号
      const bubY = top - 12 + Math.sin(s.t * 0.2) * 2;
      ctx.fillStyle = 'rgba(12,13,15,.9)';
      ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(s.x - 9, bubY - 12, 18, 18, 5); else ctx.rect(s.x - 9, bubY - 12, 18, 18); ctx.fill();
      ctx.fillStyle = '#f2a65a'; ctx.font = '600 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', s.x, bubY + 2);
      // 名字 + 血条
      ctx.font = '500 11px sans-serif'; ctx.fillStyle = '#e8eaed';
      ctx.fillText(p.name + (s.vip ? '（VIP）' : ''), s.x, top - 28);
      if(s.hp < SURVIVOR_HP){
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(s.x - 16, top - 24, 32, 3);
        ctx.fillStyle = '#e5594f'; ctx.fillRect(s.x - 16, top - 24, 32 * Math.max(0, s.hp / SURVIVOR_HP), 3);
      }
      if(s.near){
        ctx.fillStyle = 'rgba(12,13,15,.92)';
        const w = 62;
        ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(s.x - w/2, gy + 6, w, 20, 6); else ctx.rect(s.x - w/2, gy + 6, w, 20); ctx.fill();
        ctx.fillStyle = '#e8eaed'; ctx.font = '500 12px sans-serif';
        ctx.fillText('E 救人', s.x, gy + 20);
      }
    }
    ctx.restore();
  });
}

// ── 食堂：今晚的预约客人 ──
function takeTonightGuests(){
  const g = tonightGuests.slice();
  tonightGuests = [];
  return g;
}

// ── 老伙伴在店里帮忙：张端盘、林查卫生、强修灶、赵广播招客 ──
function getStoryCrew(){
  const crew = [];
  if(wave >= 2) crew.push({ id:'crew_zhang', type:'server', crew:true, name:'老兵张', role:'端盘', color:'#ffaa66', skill:0.8, timer:0, target:null, serveFlash:0 });
  if(wave >= 4) crew.push({ id:'crew_lin',   type:'crew',   crew:true, name:'护士小林', role:'查卫生', desc:'顾客更有耐心', color:'#ff88aa', timer:0, serveFlash:0 });
  if(wave >= 6) crew.push({ id:'crew_qiang', type:'crew',   crew:true, name:'工程师阿强', role:'修灶', desc:'烹饪速度 +10%', color:'#88ccff', timer:0, serveFlash:0 });
  if(wave >= 8) crew.push({ id:'crew_zhao',  type:'crew',   crew:true, name:'通信兵小赵', role:'广播招客', desc:'客流 +15%，涨粉 +20%', color:'#88ffcc', timer:0, serveFlash:0 });
  return crew;
}
