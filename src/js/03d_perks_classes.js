// ═══════════════════════════════════════════
// playerPerks 记录每个天赋已叠加层数，所有效果可叠加
const playerPerks = {};
// 天赋池：每项 {id,icon,name,desc,effect,rarity,isNew}
// rarity: common(普通数值) / rare(机制小改) / epic(规则改写) / legendary(流派定义)
// 设计原则：参考以撒/Hades/Dead Cells，高稀有度=改规则而非加数值
const PERKS = [
  // ── 普通数值型（common，保留原12个，给前期提供基础成长）──
  {id:'berserk',  icon:'💢', name:'狂暴',     desc:'伤害 +30%',           max:5, rarity:'common', apply:()=>{}},
  {id:'swift',    icon:'🏃', name:'疾风',     desc:'移速 +15% · 闪避冷却 -25%', max:4, rarity:'common', apply:()=>{}},
  {id:'iron',     icon:'🛡', name:'铁皮',     desc:'最大生命 +20 · 减伤 +10%',  max:5, rarity:'common', apply:()=>{}},
  {id:'precision',icon:'🎯', name:'精准',     desc:'暴击率 +10% · 暴击伤害 +50%',max:4, rarity:'common', apply:()=>{}},
  {id:'incendiary',icon:'🔥',name:'燃烧弹',   desc:'子弹 25% 几率点燃敌人',     max:3, rarity:'common', apply:()=>{}},
  {id:'rapidfire',icon:'⚡', name:'连发',     desc:'射速 +25%',           max:4, rarity:'common', apply:()=>{}},
  {id:'greed',    icon:'💰', name:'贪婪',     desc:'金币掉落 +50%',       max:3, rarity:'common', apply:()=>{}},
  {id:'lifesteal',icon:'🩸', name:'吸血',     desc:'造成伤害 8% 回血',     max:3, rarity:'common', apply:()=>{}},
  {id:'towermaster',icon:'🗼',name:'塔专家',  desc:'所有塔伤害 +25%',     max:3, rarity:'common', apply:()=>{}},
  {id:'frostbite',icon:'🧊', name:'冰冷触感', desc:'子弹附带 30% 减速 2秒',max:3, rarity:'common', apply:()=>{}},
  {id:'ammojack', icon:'📦', name:'弹药专家', desc:'弹匣 +30% · 换弹 -20%',max:3, rarity:'common', apply:()=>{}},
  {id:'thorns',   icon:'🌵', name:'荆棘',     desc:'受击反弹 15 伤害',     max:3, rarity:'common', apply:()=>{}},

  // ── 稀有·机制小改型（rare）── 改变单个行为反馈
  {id:'ricochet', icon:'☄️', name:'跳弹',     desc:'子弹命中后50%几率跳向附近敌人(最多3跳，每跳-30%伤害)', max:3, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'headhunter',icon:'💀',name:'猎头者',   desc:'击杀回复3弹药·精英击杀额外+15金币', max:3, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'overkill',  icon:'💥',name:'超额击杀', desc:'溢出伤害转化为范围爆炸(溢出值×2为爆炸伤害)', max:2, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'scavenger', icon:'🔧',name:'拾荒者',   desc:'僵尸掉落物翻倍·有几率额外掉落木材/废料', max:3, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'vanguard',  icon:'⚔️',name:'先锋',     desc:'围墙被击时玩家获得+50%伤害5秒(守墙反击流)', max:2, rarity:'rare', apply:()=>{}, isNew:true},

  // ── 史诗·规则改写型（epic）── 重定义某个系统
  {id:'pierce',    icon:'🏹',name:'贯穿',      desc:'所有子弹改为穿透(不再消失)，但射速-25%', max:1, rarity:'epic', apply:()=>{}, isNew:true},
  {id:'bloodfrenzy',icon:'🩸',name:'血腥狂热', desc:'血量越低伤害越高(每损失10%血+8%伤害)，满血时无加成', max:1, rarity:'epic', apply:()=>{}, isNew:true},
  {id:'chainkill', icon:'🔗',name:'连锁处决',  desc:'3秒内连续击杀，每杀+10%伤害(最高+80%)，中断清零', max:1, rarity:'epic', apply:()=>{}, isNew:true},
  {id:'titanfall', icon:'🏗️',name:'塔之共鸣',  desc:'每座塔+5%所有塔伤害(线性叠加)，鼓励铺塔流', max:1, rarity:'epic', apply:()=>{}, isNew:true},

  // ── 传说·流派定义型（legendary）── 颠覆玩法循环
  {id:'glasscannon',icon:'🔮',name:'玻璃大炮',desc:'伤害×2.2，但最大生命-50%(破釜沉舟)', max:1, rarity:'legendary', apply:()=>{}, isNew:true},
  {id:'deathpact',  icon:'⚰️',name:'死亡契约',desc:'围墙永不破损(无限血)，但每波结束扣10金币(金币<0则家园-20血)', max:1, rarity:'legendary', apply:()=>{}, isNew:true},
  {id:'berserkmode',icon:'🐺',name:'狼化',    desc:'血量归零时不死，进入10秒狂化(攻速×2/移速×1.5/吸血20%)，结束后真死。每局1次', max:1, rarity:'legendary', apply:()=>{}, isNew:true},

  // ═══ v52肉鸽扩充：天赋池 28→46 ═══
  // ── 塔防线（塔防流的真实构筑轴）──
  {id:'towerguard', icon:'🧱', name:'塔体加固', desc:'所有塔耐久 +40%/层（塔可被拆后站稳更久）', max:3, rarity:'common', apply:()=>{}, isNew:true},
  {id:'overclock',  icon:'🔌', name:'塔超频',   desc:'所有塔攻速 +20%', max:3, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'towerregen', icon:'🩹', name:'自动保修', desc:'所有塔每秒自修1%耐久', max:2, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'freezeray',  icon:'❄️', name:'寒霜领域', desc:'塔命中附带15%减速1秒（塔控场流）', max:1, rarity:'epic', apply:()=>{}, isNew:true},
  {id:'laststand',  icon:'🛡', name:'背水一战', desc:'塔耐久<30%时伤害+100%（残塔爆发）', max:1, rarity:'epic', apply:()=>{}, isNew:true},
  // ── 武器线（射击流构筑轴）──
  {id:'fireforce',  icon:'🔥', name:'烈焰弹道', desc:'燃烧/火系武器伤害 +30%', max:3, rarity:'common', apply:()=>{}, isNew:true},
  {id:'fasthands',  icon:'🤲', name:'快手',     desc:'换弹速度 +30%', max:3, rarity:'common', apply:()=>{}, isNew:true},
  {id:'critflow',   icon:'💫', name:'暴击节奏', desc:'暴击后2秒内攻速+25%', max:2, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'bigmag',     icon:'🗑', name:'扩容弹鼓', desc:'弹匣 +50%（再叠弹药专家）', max:2, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'dualwield',  icon:'⚔', name:'双持',     desc:'切枪后3秒内伤害+40%（鼓励多武器循环）', max:1, rarity:'epic', apply:()=>{}, isNew:true},
  // ── 餐厅线（经营→战斗强化轴）──
  {id:'meatharvest',icon:'🍖', name:'屠宰好手', desc:'僵尸肉块掉落 +30%', max:3, rarity:'common', apply:()=>{}, isNew:true},
  {id:'flavorguru', icon:'👨‍🍳', name:'风味大师', desc:'菜品品质概率提升（更容易出完美/传说）', max:2, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'moraleboost',icon:'🎺', name:'士气高昂', desc:'夜晚结算士气收益 ×1.5', max:2, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'buffextend', icon:'⏳', name:'余味悠长', desc:'菜品战斗增益持续到下一波（不再单波清零）', max:1, rarity:'epic', apply:()=>{}, isNew:true},
  // ── 通用线（跨系统）──
  {id:'coinflow',   icon:'🪙', name:'财源滚滚', desc:'餐厅收入 +25%（经营攒塔钱更快）', max:3, rarity:'common', apply:()=>{}, isNew:true},
  {id:'scraphoard', icon:'🔩', name:'废料囤积', desc:'战斗掉落的木材/废料 +50%（家园建设流）', max:2, rarity:'common', apply:()=>{}, isNew:true},
  {id:'secondwind', icon:'🌬', name:'回春之风', desc:'波次开始时回复25%生命', max:2, rarity:'rare', apply:()=>{}, isNew:true},
  {id:'siegebreed', icon:'👑', name:'围城大师', desc:'每波开始时：随机1座塔回满耐久并+10%伤害(本波)', max:1, rarity:'legendary', apply:()=>{}, isNew:true},
];
function perkCount(id){return playerPerks[id]||0;}
function perkMult(id,base){return 1+perkCount(id)*base;}

// ═══════════════════════════════════════════
//  【v49 批1】开局流派系统（肉鸽构筑核心：每局从第0秒就不一样）
//  新游戏→序章后弹 6 选 1；流派给 1 条被动 + 1 把专属开局武器
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// ── 当代大学生小胡 6 套战术装扮已集中归拢至 Section 01 CONFIG & REGISTRIES ──
let playerClass = null;  // 当前流派（null=未选）
// ═══════════════════════════════════════════
//  【v53 流派觉醒】每流派一个专属主动技能（X键/移动端技能按钮，20-30s冷却）
//  设计目标：6流派不再"同一个手感"——各有标志性主动改变战斗节奏。
//  实现模式：window._classSkill = {t:剩余帧, cd:冷却帧} 局内瞬态（不入存档），
//  效果在 getDamage/getMoveSpeed/takeDamage/hitZombie/mkBullet 读取 _classSkillT 窗口。
// ═══════════════════════════════════════════
const CLASS_SKILLS = {
  marksman:  {id:'hawkeye',   icon:'👁', name:'鹰眼',   cd:1200, dur:300,
              desc:'5秒：暴击率+40%·子弹全穿透·金色视界'},
  demolition:{id:'barrage',   icon:'💣', name:'齐射轰炸', cd:1500, dur:60,
              desc:'光标处5连轰炸（预警圈1秒后逐爆）'},
  beastmaster:{id:'wolfpack', icon:'🐺', name:'狼群召唤', cd:1200, dur:600,
              desc:'召唤3头幽灵战狼（10秒狂暴突袭，猛烈撕咬+重击退）'},
  warden:    {id:'bulwark',   icon:'🛡', name:'堡垒壁垒', cd:1400, dur:360,
              desc:'6秒受伤-70%·释放瞬间全场击退+眩晕'},
  chef:      {id:'warfeast',  icon:'🍲', name:'战地大餐', cd:1300, dur:480,
              desc:'立回40%血·8秒攻速+25%·移速+15%'},
  berserker: {id:'bloodrage', icon:'🩸', name:'血怒',   cd:1300, dur:360,
              desc:'6秒近战×2·移速+40%·近战吸血10%'},
};
window._classSkillT = 0;   // 技能剩余帧
window._classSkillCd = 0;  // 冷却剩余帧
const skillWolves = [];    // 狼群召唤的临时战斗狼
function classSkillDef(){ return playerClass ? CLASS_SKILLS[playerClass.id] : null; }
function tryClassSkill(){
  const sk = classSkillDef();
  if(!sk){ if(playerClass===null) return; addBanner('⚠ 当前无流派'); return; }
  if(window._classSkillCd > 0){
    spawnFloatText('冷却 '+Math.ceil(window._classSkillCd/60)+'s', player.x+CHAR_W/2, player.y-30, '#88aacc');
    return;
  }
  if(gameState!=='world' && gameState!=='building'){ addBanner('⚠ 战斗中才能释放'); return; }
  const px = player.x+CHAR_W/2, py = player.y+CHAR_H/2;
  // ── 通用：冷却+特效 ──
  window._classSkillCd = sk.cd;
  addShake(5);
  sndLevelUp();
  // ── 各技能分支 ──
  if(sk.id==='hawkeye'){
    window._classSkillT = sk.dur;
    orangeFlash = Math.min(1,(orangeFlash||0)+0.3);
    addBanner('👁 鹰眼！暴击+40% · 全穿透 · 5秒');
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;mkP({x:px,y:py,vx:Math.cos(a)*4,vy:Math.sin(a)*4,r:2.5,rDecay:.06,decay:.04,color:'#ffcc44',type:'spark',grav:0,alpha:1});}
  }
  else if(sk.id==='barrage'){
    // 光标区 5 连轰炸：预警圈 60 帧后逐个起爆
    const bx2 = lastMX, by2 = Math.min(lastMY, GROUND_Y-20);
    addBanner('💣 齐射轰炸落点标记！');
    for(let k=0;k<5;k++){
      const ox = bx2 + (Math.random()-.5)*130;
      setTimeout(()=>{
        if(gameState!=='world'&&gameState!=='building')return;
        vfxExplosion(ox, GROUND_Y-30, 100); sndExplosion(); addShake(6);
        explodeLogic(ox, GROUND_Y-30, getDamage(28), 100);
      }, (60+k*9)*16.7);  // 预警1秒后每150ms一发
    }
    // 落点预警圈视觉
    for(let k=0;k<5;k++){
      const ox = bx2 + (Math.random()-.5)*130;
      for(let r2=0;r2<3;r2++){mkP({x:ox,y:GROUND_Y-30,r:20+r2*15,rDecay:-(.12+r2*.04),decay:.035,color:'rgba(255,80,40,.8)',type:'ring',alpha:.85,grav:0});}
    }
  }
  else if(sk.id==='wolfpack'){
    addBanner('🐺 幽灵战狼群参战！10秒狂暴撕咬');
    skillWolves.length = 0;
    for(let k=0;k<3;k++){
      skillWolves.push({ox:player.x+(k-1)*34, t:600, biteCd:0});
    }
    try{
      const a=getACtx();
      if(a){
        const now=a.currentTime;
        const o=a.createOscillator(),g=a.createGain();
        o.type='sawtooth';
        o.frequency.setValueAtTime(260,now);
        o.frequency.exponentialRampToValueAtTime(580,now+0.4);
        o.frequency.exponentialRampToValueAtTime(320,now+1.0);
        g.gain.setValueAtTime(0.01,now);
        g.gain.linearRampToValueAtTime(0.22,now+0.3);
        g.gain.exponentialRampToValueAtTime(0.001,now+1.1);
        o.connect(g);g.connect(a.destination);o.start(now);o.stop(now+1.2);
      }
    }catch(e){}
    for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2;mkP({x:px,y:py-10,vx:Math.cos(a)*3,vy:Math.sin(a)*2-1.5,r:2+Math.random()*2,rDecay:.05,decay:.05,color:Math.random()>.4?'#8899aa':'#ccddee',type:'spark',grav:.05,alpha:.9});}
  }
  else if(sk.id==='bulwark'){
    window._classSkillT = sk.dur;
    player.playerShield = Math.max(player.playerShield||0, sk.dur);
    addBanner('🛡 堡垒壁垒！6秒受伤-70%');
    // 释放瞬间全场击退+眩晕
    zombies.forEach(z=>{
      if(!z.alive)return;
      const d=(z.x+22)-px;
      if(Math.abs(d)<420){
        z.knockback=(z.knockback||0)+(d>0?26:-26);
        z.hitStun=Math.max(z.hitStun||0,70);
      }
    });
    mkP({x:px,y:py,r:30,rDecay:-4,decay:.05,color:'rgba(120,180,255,.9)',type:'ring',alpha:.9,grav:0});
    mkP({x:px,y:py,r:14,rDecay:-2.5,decay:.06,color:'rgba(180,220,255,.7)',type:'ring',alpha:.8,grav:0});
  }
  else if(sk.id==='warfeast'){
    window._classSkillT = sk.dur;
    const heal=Math.round(maxHp*0.4);
    health=Math.min(maxHp,health+heal);updateHpUI();
    addBanner('🍲 战地大餐！回复'+heal+' · 攻速+25% · 移速+15%');
    vfxHeal(player.x,player.y);
    for(let i=0;i<14;i++){mkP({x:px+(Math.random()-.5)*30,y:py-20,vx:(Math.random()-.5)*1.5,vy:-2-Math.random()*2,r:2.5+Math.random()*2.5,rDecay:.05,decay:.045,color:Math.random()>.5?'#ffd45e':'#ff8a44',type:'circle',grav:-.02,alpha:.9,blur:true});}
  }
  else if(sk.id==='bloodrage'){
    window._classSkillT = sk.dur;
    addBanner('🩸 血怒！近战×2 · 移速+40% · 吸血10%');
    redFlash=Math.min(1,(redFlash||0)+0.5);
    mkP({x:px,y:py,r:34,rDecay:-3,decay:.04,color:'rgba(255,30,10,.85)',type:'ring',alpha:.8,grav:0});
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2;mkP({x:px,y:py,vx:Math.cos(a)*5,vy:Math.sin(a)*5,r:3,rDecay:.05,decay:.035,color:'#cc2200',type:'spark',grav:0,alpha:1});}
  }
  updateClassSkillBtn();
}
// 狼群召唤：每帧追咬 AI + 绘制（狼=幽灵狼伴，复用近战伤害管线）
function tickSkillWolves(){
  if(skillWolves.length===0)return;
  const targetList = (gameState === 'building') ? buildingInteriorZombies : zombies;
  for(let i=skillWolves.length-1;i>=0;i--){
    const wf=skillWolves[i];
    if(!wf){ skillWolves.splice(i,1); continue; }
    if(!Number.isFinite(wf.ox)) wf.ox = player.x;
    wf.t--;
    if(wf.t<=0){skillWolves.splice(i,1);continue;}
    // 追最近的僵尸
    let tgt=null,td=9999;
    targetList.forEach(z=>{if(!z.alive)return;const d=Math.abs((z.x+22)-wf.ox);if(d<td){td=d;tgt=z;}});
    if(tgt){
      const dir=(tgt.x+22)>wf.ox?1:-1;
      wf.ox+=dir*4.6;
      wf.biteCd = (wf.biteCd||0) - 1;
      if(Math.abs((tgt.x+22)-wf.ox)<42 && wf.biteCd<=0){
        wf.biteCd=34;
        hitZombie(tgt,tgt.x+22,Z_TOP+28,getDamage(28),wf.ox,Z_TOP+28,2.0);
        spawnFloatText('🐺撕咬-28', tgt.x+22, Z_TOP-12, '#88ccff');
        sndHit();
        mkP({x:tgt.x+22,y:Z_TOP+20,vx:(Math.random()-.5)*3,vy:-2,r:2.5,rDecay:.06,decay:.05,color:'#cc2222',type:'circle',grav:.1,alpha:.85,blur:true});
      }
    }
  }
}
function drawSkillWolves(){
  skillWolves.forEach(wf=>{
    if(!wf || !Number.isFinite(wf.ox)) return;
    const x=wf.x=wf.ox, y=GROUND_Y-18;
    ctx.save();
    ctx.translate(x, y);
    // 幽灵战狼地面阴影
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 16, 16, 4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    const run=Math.sin(frameT*.4)*3;
    ctx.fillStyle='rgba(140,160,180,.9)';
    ctx.shadowBlur=8;ctx.shadowColor='rgba(160,190,220,.6)';
    // 狼身（低伏流线型）
    ctx.beginPath();ctx.ellipse(0,0,14,7,0,0,Math.PI*2);ctx.fill();
    // 头+吻
    ctx.beginPath();ctx.arc(14,-3,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(190,210,230,.95)';
    ctx.beginPath();ctx.moveTo(18,-3);ctx.lineTo(23,-1);ctx.lineTo(18,1);ctx.closePath();ctx.fill();
    // 耳
    ctx.fillStyle='rgba(140,160,180,.95)';
    ctx.beginPath();ctx.moveTo(12,-7);ctx.lineTo(14,-12);ctx.lineTo(16,-7);ctx.closePath();ctx.fill();
    // 眼（红光）
    ctx.fillStyle='#ff3355';ctx.shadowColor='#ff3355';ctx.shadowBlur=6;
    ctx.beginPath();ctx.arc(15.5,-4,1.2,0,Math.PI*2);ctx.fill();
    // 腿（交替跑动）
    ctx.fillStyle='rgba(120,140,160,.9)';
    ctx.fillRect(-10,5+run*.5,3,7);ctx.fillRect(6,5-run*.5,3,7);
    // 尾
    ctx.strokeStyle='rgba(140,160,180,.8)';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-14,-2);ctx.quadraticCurveTo(-20,-6,-22,-2);ctx.stroke();
    ctx.restore();
  });
}
// 冷却HUD更新（桌面HUD技能按钮 + 移动端 #btn-skill）
function updateClassSkillBtn(){
  const sk=classSkillDef();
  const dt=sk?Math.ceil(window._classSkillCd/60):0;
  const btn=document.getElementById('btn-skill');
  if(btn){
    if(!sk){btn.style.display='none';return;}
    btn.style.display='grid';
    btn.title=sk.name;
    if(dt>0){btn.classList.add('cd');btn.classList.remove('ready');btn.dataset.cd=dt;}
    else{btn.classList.remove('cd');btn.classList.add('ready');btn.dataset.cd='';}
  }
  const hudBtn=document.getElementById('skill-hud-btn');
  if(hudBtn){
    if(!sk){hudBtn.style.display='none';return;}
    hudBtn.style.display='';
    if(dt>0){hudBtn.textContent='⏳'+dt+'s';hudBtn.disabled=true;}
    else{hudBtn.textContent='[X] '+sk.icon+' '+sk.name;hudBtn.disabled=false;}
  }
}
// 流派被动接线（getDamage/takeDamage 等处读取）
function classDamageMult(dmgType){
  if(!playerClass)return 1;
  if(playerClass.id==='demolition' && dmgType==='explosive')return 1.3;
  if(playerClass.id==='warden')return 1;  // 塔伤在 updateTowers 处理
  return 1;
}
function classCritBonus(){
  if(playerClass && playerClass.id==='marksman')return {chance:0.20, mult:0.5};
  return {chance:0, mult:0};
}

// ── 流派协同天赋（rarity:'class'：只有对应流派才进池）──
PERKS.push(
  {id:'weakspot', icon:'👁', name:'弱点洞察', desc:'爆头伤害倍率 ×2.5（神射手流派）', max:1, rarity:'class', classOnly:'marksman', apply:()=>{}},
  {id:'chainblast', icon:'🔗', name:'连锁殉爆', desc:'爆炸击杀敌人时引发二次爆炸（爆破流派）', max:1, rarity:'class', classOnly:'demolition', apply:()=>{}},
  {id:'warmblood', icon:'❤️', name:'战意共鸣', desc:'伙伴击杀敌人时你回复2%生命（驭兽师流派）', max:1, rarity:'class', classOnly:'beastmaster', apply:()=>{}},
  {id:'fieldration', icon:'🍲', name:'军粮秘方', desc:'菜品战斗增益时长×2（厨神流派）', max:1, rarity:'class', classOnly:'chef', apply:()=>{}},
  {id:'bloodfeast', icon:'🩸', name:'嗜血盛宴', desc:'近战击杀回复8%生命（狂战士流派）', max:1, rarity:'class', classOnly:'berserker', apply:()=>{}},
  {id:'fortify2', icon:'🏰', name:'铁壁领域', desc:'围墙HP+100% · 塔射程+15%（铁壁守卫流派）', max:1, rarity:'class', classOnly:'warden', apply:()=>{}}
);

// ── 流派选择 UI（复用 perk-choice 卡片风格）──
function showClassChoice(onDone){
  const scr = document.getElementById('perk-choice-scr');
  document.getElementById('perk-choice-level').textContent = '🎓 大学生小胡的战术装扮 —— 抉择本局战斗流派';
  const list = document.getElementById('perk-choice-list');
  let html = '';
  START_CLASSES.forEach(c=>{
    const sk = CLASS_SKILLS[c.id];
    html += `<div class="perk-card" data-class="${c.id}" style="border-color:${c.color};width:160px;min-height:240px;background:#1a1b1e;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 6px 18px rgba(0,0,0,0.6);">
      <div class="perk-rarity" style="position:static;color:${c.color};background:${c.color}22;border:1px solid ${c.color}55;font-weight:600;border-radius:4px;padding:2px 6px;align-self:flex-start;font-size:0.6rem;">${c.title||'战术装扮'}</div>
      <div class="perk-icon" style="font-size:2.2rem;line-height:1;margin:4px 0;text-align:center;">${c.icon}</div>
      <div class="perk-name" style="color:#ffffff;font-size:0.96rem;font-weight:600;text-align:center;">${c.name}</div>
      <div class="perk-desc" style="font-size:0.68rem;color:#ced0d4;line-height:1.45;flex:1;">${c.desc}</div>
      <div style="font-size:0.62rem;color:#f2a65a;background:rgba(242,166,90,0.08);padding:4px 6px;border-radius:4px;border:1px solid rgba(242,166,90,0.2);">觉醒[X]：${sk?sk.name+' - '+sk.desc:''}</div>
      <div style="font-size:0.6rem;color:#f85149;margin-top:2px;font-weight:700;">🎖️ 第3波通关交付专属神兵：${c.weaponName}</div>
      <div style="font-size:0.58rem;color:#8b949e;text-align:center;border-top:1px dashed rgba(255,255,255,0.1);padding-top:4px;">开局统一配备⚪制式手枪自卫</div>
    </div>`;
  });
  list.innerHTML = html;
  scr.style.display = 'flex';
  gamePaused = true;
  list._locked = false;
  list.onclick = (ev)=>{
    const card = ev.target.closest('[data-class]');
    if(!card) return;
    ev.stopPropagation();
    ev.preventDefault();
    const cls = START_CLASSES.find(c=>c.id===card.getAttribute('data-class'));
    if(!cls) return;
    if(list._locked) return;
    list._locked = true;
    applyStartClass(cls);
    scr.style.display = 'none';
    gamePaused = false;
    if(onDone) onDone();
  };
}

function applyStartClass(cls){
  playerClass = cls;
  // 被动天赋
  Object.keys(cls.perks||{}).forEach(pid=>{
    playerPerks[pid] = (playerPerks[pid]||0) + cls.perks[pid];
  });
  // ── 用户核心约束：开局平等自卫！无论选择何种装扮，开局小胡统一配备⚪白色【战术自卫手枪】！
  // 绝不开局携带紫色/红色专属神兵！专属神兵待坚守第3波撤回小屋后战备交付！
  const pIdx = WEAPONS.findIndex(w => w.id === 'pistol');
  ownedWeapons = [pIdx >= 0 ? pIdx : 0];
  refreshOwnedSet();
  curWpnIdx = ownedWeapons[0];
  wAmmo[curWpnIdx] = WEAPONS[curWpnIdx].maxAmmo;
  buildWeaponBar();
  refreshWBar();
  updateAmmoUI();

  // 流派专属效果
  if(cls.id==='warden'){
    wallLevel = Math.max(wallLevel, 2);
    wallHp = WALL_HP_PER_LEVEL[wallLevel];
  }
  if(cls.meatBonus){ meatInventory.normal += cls.meatBonus; }
  if(cls.companion){  // 驭兽师（狼人）开局伙伴
    if(!hiredCompanions.some(c=>c.type===cls.companion)){
      const gunnerBase = {
        type: cls.companion,
        name: '机枪手大壮',
        x: player.x - 50,
        y: CHAR_GY,
        walkT: 0,
        facingR: true,
        timer: 0,
        color: '#88aacc',
        fireRate: 85,
        dmg: 6,
        isStoryNpc: false
      };
      gunnerBase.maxHp = Math.round(100 * (playerClass.id==='beastmaster'?1.5:1));
      gunnerBase.hp = gunnerBase.maxHp;
      hiredCompanions.push(gunnerBase);
    }
  }
  // 存档字段
  window.__startClassId = cls.id;
  // v53流派觉醒：初始化技能按钮（HUD+移动端）
  window._classSkillT = 0; window._classSkillCd = 0; skillWolves.length = 0;
  try{ updateClassSkillBtn(); }catch(e){}
  addBanner(`${cls.icon} 流派「${cls.name}」构筑生效！`);
  sndLevelUp();
}

// ── 波次随机变异（v52扩充：5→8种词条，触发率20%→35%——每局变数更大）──
const WAVE_MUTATIONS = [
  {id:'frenzy', icon:'🌀', name:'亡命徒潮', desc:'僵尸速度+20%，金币掉落×2', color:'#ff8844'},
  {id:'bloodmoon', icon:'🌕', name:'血月', desc:'夜晚作战，僵尸速度+15%，击杀回血+1', color:'#cc4444'},
  {id:'ironwave', icon:'⚙️', name:'钢铁潮', desc:'装甲僵尸权重×2，木材/废料掉落+50%', color:'#aaaacc'},
  {id:'goldrush', icon:'💰', name:'金币雨', desc:'金币掉落×3，但僵尸血量+15%', color:'#ffcc44'},
  {id:'swarm', icon:'🦗', name:'蝗群', desc:'僵尸数量×1.4，单只血量-15%', color:'#88cc44'},
  // ── v52新词条 ──
  {id:'mist', icon:'🌫️', name:'迷雾潜行', desc:'僵尸半透明，塔索敌距离-20%，掉落宝箱率+50%', color:'#aaccee'},
  {id:'feast', icon:'🍖', name:'饕餮盛宴', desc:'肉块掉落×2（餐厅流狂欢），僵尸移速-10%', color:'#cc8866'},
  {id:'thunder', icon:'⛈️', name:'雷暴之夜', desc:'随机落雷轰炸战场（敌我皆伤），击杀经验+50%', color:'#88ccff'},
];
let waveMutation = null;  // 当前波变异（null=普通）
function rollWaveMutation(){
  waveMutation = null;
  if(wave < 2 || Math.random() > 0.35)return null;  // W2起 35% 概率（v52）
  waveMutation = WAVE_MUTATIONS[Math.floor(Math.random()*WAVE_MUTATIONS.length)];
  addBanner(`${waveMutation.icon} 本波词条「${waveMutation.name}」：${waveMutation.desc}`);
  return waveMutation;
}

// 升级弹窗状态
let perkChoiceActive=false;
let perkChoices=[];
let perkPendingLevels=0;  // 待选择的天赋次数（连续升级时累积）

function triggerPerkChoice(){
  if(perkPendingLevels<=0)return;
  // 随机抽3个未满级的天赋，按稀有度加权（高稀有更难得见）
  // v49批1：流派协同天赋（rarity:'class'）只有对应流派才进池；三张全满时提供重掷
  const pool = PERKS.filter(p=>perkCount(p.id)<p.max && (!p.classOnly || (playerClass && playerClass.id===p.classOnly)));
  if(pool.length===0){
    // 全满/无池：清积压并给一次"重掷"机会（洗牌全部已满天赋中的一层？不——直接作废并补金币补偿）
    if(perkPendingLevels>0){
      coins += 20*perkPendingLevels; updateCoinUI();
      addBanner('天赋已全满 → 每次剩余三选一折算 20 金币');
      perkPendingLevels=0;
    }
    return;
  }
  // 稀有度权重：common 60, rare 28, epic 10, legendary 4, class 20（流派协同中等出现率）
  const weight={common:60,rare:28,epic:10,legendary:4,class:20};
  // 加权不放回抽取3个
  const picked=[];
  const bag=[...pool];
  for(let n=0;n<3 && bag.length>0;n++){
    const totalW=bag.reduce((s,p)=>s+(weight[p.rarity||'common']||60),0);
    let r=Math.random()*totalW;
    let idx=0;
    for(let i=0;i<bag.length;i++){r-=(weight[bag[i].rarity||'common']||60);if(r<=0){idx=i;break;}}
    picked.push(bag.splice(idx,1)[0]);
  }
  // 保底：至少含1个非common（若池里有rare+且抽3个全是common，替换最后一个为池中最高稀有）
  if(picked.every(p=>(p.rarity||'common')==='common')){
    const nonCommon=pool.filter(p=>(p.rarity||'common')!=='common' && !picked.includes(p));
    if(nonCommon.length){
      nonCommon.sort((a,b)=>{const o={common:0,rare:1,epic:2,legendary:3};return (o[b.rarity]||0)-(o[a.rarity]||0);});
      picked[picked.length-1]=nonCommon[0];
    }
  }
  perkChoices = picked;
  perkChoiceActive=true;
  gamePaused=true;
  renderPerkChoiceUI();
}
function renderPerkChoiceUI(){
  const scr=document.getElementById('perk-choice-scr');
  const list=document.getElementById('perk-choice-list');
  list.innerHTML='';
  const rarityName={common:'普通',rare:'稀有',epic:'史诗',legendary:'传说',class:'流派'};
  const rarityColor={common:'#9a7ad8',rare:'#5be4ff',epic:'#ffd840',legendary:'#ff6644',class:'#88ffaa'};
  document.getElementById('perk-choice-level').innerHTML='Lv.'+playerLevel+' 升级！选择一个天赋';
  perkChoices.forEach((p,idx)=>{
    const cnt=perkCount(p.id);
    const card=document.createElement('div');
    const rar=p.rarity||'common';
    card.className='perk-card rarity-'+rar;
    const newTag=p.isNew?'<div class="perk-new-tag">NEW</div>':'';
    card.innerHTML=`${newTag}<div class="perk-rarity">${rarityName[rar]}</div>
      <div class="perk-icon">${p.icon}</div>
      <div class="perk-name">${p.name}</div>
      <div class="perk-desc">${p.desc}</div>
      <div class="perk-count">已拥有 ${cnt}/${p.max}</div>`;
    card.onclick=()=>selectPerk(idx);
    list.appendChild(card);
  });
  scr.style.display='flex';
}
function selectPerk(idx){
  const p=perkChoices[idx];if(!p)return;
  playerPerks[p.id]=perkCount(p.id)+1;
  // 铁皮立即加血
  if(p.id==='iron'){maxHp+=20;health=Math.min(maxHp,health+20);updateHpUI();}
  // 玻璃大炮：立即减半最大生命
  if(p.id==='glasscannon'){maxHp=Math.max(20,Math.floor(maxHp*0.5));health=Math.min(health,maxHp);updateHpUI();}
  // 死亡契约：围墙直接满级满血
  if(p.id==='deathpact'){wallLevel=3;wallHp=WALL_HP_PER_LEVEL[3];}
  document.getElementById('perk-choice-scr').style.display='none';
  perkChoiceActive=false;
  perkPendingLevels--;
  levelUpFlash=1;
  addBanner(`${p.icon} 获得「${p.name}」！${p.desc}`);
  sndWave();
  // 升级粒子（传说级更华丽）
  const px=player.x+CHAR_W/2,py=player.y+CHAR_H/2;
  const rar=p.rarity||'common';
  const pCol=rar==='legendary'?'#ff4444':rar==='epic'?'#ffd840':rar==='rare'?'#5be4ff':'#ffee44';
  mkP({x:px,y:py,r:8,rDecay:-1.2,decay:.05,color:pCol,type:'ring',alpha:.9,grav:0});
  const n=rar==='legendary'?28:rar==='epic'?22:16;
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;mkP({x:px,y:py,vx:Math.cos(a)*4,vy:Math.sin(a)*4,r:3,rDecay:.05,decay:.025,color:pCol,type:'spark',grav:0,alpha:1});}
  spawnFloatText(`${p.icon} ${p.name}`,px,py-30,pCol);
  // 如果还有待选（连续升级），继续弹
  if(perkPendingLevels>0){setTimeout(()=>triggerPerkChoice(),300);}
  else{
    gamePaused=false;
    if(wavePhase === 'cleared' && !overwhelmingHordeActive){
      setTimeout(()=>{
        if(gameRunning && gameState === 'world' && wavePhase === 'cleared'){
          triggerOverwhelmingHorde();
        }
      }, 1000);
    }
  }
}

function closePerkChoiceUI(){
  const scr=document.getElementById('perk-choice-scr');
  if(scr) scr.style.display='none';
  perkChoiceActive=false;
  gamePaused=false;
  if(wavePhase === 'cleared' && !overwhelmingHordeActive){
    setTimeout(()=>{
      if(gameRunning && gameState === 'world' && wavePhase === 'cleared'){
        triggerOverwhelmingHorde();
      }
    }, 800);
  }
}

// 暴击判定：基础15% + 精准天赋10%/层，暴击伤害×2 + 精准50%/层
function rollCrit(dmg){
  const chance = CRIT_CHANCE + (playerPerks.precision||0)*0.10;
  const critMul = 2 + (playerPerks.precision||0)*0.5;
  if(Math.random()<chance) return {dmg:dmg*critMul,crit:true};
  return {dmg,crit:false};
}
// 连杀倍率：每3杀 +0.5（0-2杀×1, 3-5×1.5, 6-8×2...）
// 小改：连击阶梯强化（5杀×1.5 → 10杀×2 → 20杀×3；鼓励激进割草）
function comboMult(){
  if(combo>=20) return 3;
  if(combo>=10) return 2;
  if(combo>=5)  return 1.5;
  return 1+Math.floor(combo/3)*0.25;
}
// 小改：连杀狂热——10连杀后触发4秒狂热（射速+20%+屏幕金光），期间再杀刷新时长
// [frenzyT 已在 Section 01 顶层声明]
function triggerFrenzy(){
  frenzyT = 240;  // 4秒
  comboFlash = Math.max(comboFlash, .8);
  addBanner('🔥 连杀狂热！射速+20%');
  sndComboMilestone(Math.max(combo,10));
}
// 暴击音效（高频锐音）
function sndCrit(){ noiseFreqRamp(0.08,2000,3200,'square',0.3,4000); }
// 击杀统一结算：combo 递增 + 分数加倍，返回倍率供调用方乘算金币
function onKill(x,y,pts){
  combo++; comboTimer=COMBO_TIMEOUT;
  notifyWaveKill();
  const mult=comboMult();
  score+=Math.round(pts*mult); scEl.textContent=score;
  gainXp(Math.max(1,Math.round(pts*0.22)));  // 击杀获得经验（降低，放慢升级节奏）
  // 连杀里程碑反馈（5/10/15/20…）：屏幕边缘闪光 + 升调音效
  if(combo>=5 && combo%5===0 && lastComboMilestone<combo){
    lastComboMilestone=combo;
    comboFlash=1;
    sndComboMilestone(combo);
    spawnFloatText(`连杀 ×${combo}！`,x,y-44,'#ff2200');
    // 小改：10连杀起触发/刷新狂热（射速+20%+金光，4秒）
    if(combo>=10) triggerFrenzy();
  } else if(combo>=3 && combo%3===0){
    spawnFloatText(`连击 ×${combo}`,x,y-30,'#ff6600');
  }
  // 小改：精英保底高光移至 killZombie（那里有僵尸对象与掉落权）——见 killZombie 内实现
  updateComboHUD();
  return mult;
}
// 连杀里程碑升调音效（每 5 连升一档）
function sndComboMilestone(n){
  const step=Math.min(Math.floor(n/5)-1,4);
  const base=600+step*220;
  noiseFreqRamp(0.12, base, base*1.5, 'square', 0.3);
  setTimeout(()=>noiseFreqRamp(0.1, base*1.5, base*2, 'sine', 0.25), 80);
}
// 连击 HUD 刷新
function updateComboHUD(){
  if(!comboHud)return;
  if(combo>=2){
    comboHud.style.display='block';
    comboHud.textContent=`连击 ×${combo}  ${comboMult().toFixed(1)}倍`;
  }else{
    comboHud.style.display='none';
  }
}
// 世界进度条刷新（按波次推进：15波=最终撤离，更长肉鸽塔防体验）
function updateWorldProgress(){
  if(!wpFill)return;
  const TOTAL_WAVES=15;
  // 波内击杀进度：让进度条在波次中平滑增长；Boss波无普通怪则停在章节边界
  let waveFrac=0;
  if(waveTotalThisWave>0){waveFrac=Math.min(1,waveKilledThisWave/waveTotalThisWave);}
  const p=endingTriggered?1:Math.max(0,Math.min(1,((wave-1)+waveFrac)/TOTAL_WAVES));
  wpFill.style.width=(p*100).toFixed(1)+'%';
  const wpText=document.getElementById('wp-text');
  if(wpText) wpText.textContent=Math.round(p*100)+'%';
  // 章节里程碑：第4波(二章)/第8波(三章)/第12波(四章)/第15波(终章)
  const milestones=[4,8,12,15];
  const msgs=['你已离开小镇中心','你已穿过废弃公路','你已抵达旧城区','港口已近在咫尺'];
  for(let i=0;i<4;i++){
    if(wave>=milestones[i] && progressMilestone<=i){
      progressMilestone=i+1;
      addBanner('📍 '+msgs[i]+'（'+Math.round(milestones[i]/TOTAL_WAVES*100)+'%）');
      sndWave();
    }
  }
}

// ═══════════════════════════════════════════

//  GUN TIP
// ═══════════════════════════════════════════
function getGunTip() {
  const pivX = player.x + (player.facingRight ? CHAR_W * .85 : CHAR_W * .15);
  const pivY = player.y + 30;
  const a = Math.atan2(lastMY - pivY, lastMX - pivX);
  return { x: pivX + Math.cos(a) * 28, y: pivY + Math.sin(a) * 28, angle: a };
}
function getAimAngle() { const pivX = player.x + (player.facingRight ? CHAR_W * .85 : CHAR_W * .15), pivY = player.y + 30; const raw = Math.atan2(lastMY - pivY, lastMX - pivX); return player.facingRight ? raw : Math.PI - raw; }

