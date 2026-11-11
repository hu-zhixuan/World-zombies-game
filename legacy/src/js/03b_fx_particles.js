// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  CANVAS FLOATING TEXT POOL (隐患2修复: 消除 DOM 频繁重绘与节点积压)
// ═══════════════════════════════════════════
var FLOAT_TEXT_POOL_SIZE = 256;
var floatTextPool = [];
for(let i=0; i<FLOAT_TEXT_POOL_SIZE; i++){
  floatTextPool.push({active:false, txt:'', x:0, y:0, vy:0, col:'#fff', isLarge:false, life:0, maxLife:24});
}
var floatTextHead = 0;

function clearFloatTexts(){
  if(!floatTextPool) return;
  for(let i=0; i<floatTextPool.length; i++){
    floatTextPool[i].active = false;
    floatTextPool[i].life = 0;
  }
  floatTextHead = 0;
}

function spawnFloatText(txt, x, y, col, isLarge){
  if(txt === undefined || txt === null || txt === '') return;
  const item = floatTextPool[floatTextHead];
  floatTextHead = (floatTextHead + 1) % FLOAT_TEXT_POOL_SIZE;
  item.active = true;
  item.txt = String(txt);
  item.x = x;
  item.y = y;
  item.vy = isLarge ? 1.0 : 0.75;
  item.col = col || '#fff';
  item.isLarge = !!isLarge;
  item.life = 24;
  item.maxLife = 24;
}

function drawFloatTexts(){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for(let i=0; i<FLOAT_TEXT_POOL_SIZE; i++){
    const item = floatTextPool[i];
    if(!item.active) continue;
    item.life--;
    item.y -= item.vy;
    item.vy *= 0.95;
    if(item.life <= 0){
      item.active = false;
      continue;
    }
    const alpha = Math.min(1, item.life / 6);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const fontSize = item.isLarge ? 15 : 12;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Trebuchet MS", sans-serif`;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(item.txt, item.x, item.y);
    ctx.fillStyle = item.col;
    ctx.fillText(item.txt, item.x, item.y);
  }
  ctx.restore();
}

// ═══════════════════════════════════════════
//  PARTICLE SYSTEM (隐患5修复: 对象池复用消除 V8 Young GC 压力)
// ═══════════════════════════════════════════
const particles=[];
const _particleFreeList=[];
function mkP(o){
  if(particles.length>1200)return; // cap to prevent memory leak
  let p = _particleFreeList.pop();
  if(!p){
    p = {};
  }
  p._pooled = false;
  p.x = o.x;
  p.y = o.y;
  p.vx = o.vx || 0;
  p.vy = o.vy || 0;
  p.life = 1;
  p.decay = o.decay || .025;
  p.r = o.r || 4;
  p.rDecay = o.rDecay || 0;
  p.color = o.color || '#fff';
  p.color2 = o.color2 || null;
  p.grav = o.grav || 0;
  p.type = o.type || 'circle';
  p.alpha = o.alpha || 1;
  p.spin = o.spin || 0;
  p.angle = o.angle || 0;
  p.blur = o.blur || false;
  p._bounced = false;
  particles.push(p);
}
function drawParticles(){
  ctx.save();
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.vx*=.97;p.angle+=p.spin;p.life-=p.decay;
    if(p.type==='shard' && p.y >= GROUND_Y - 4){
      p.y = GROUND_Y - 4;
      p.vy = -p.vy * 0.45;
      p.vx *= 0.6;
      p.spin *= 0.5;
      if(!p._bounced && Math.abs(p.vy) > 0.8){
        p._bounced = true;
        try{
          const a=getACtx();if(a){
            const o=a.createOscillator(),g=a.createGain(),now=a.currentTime;
            o.type='sine';
            o.frequency.setValueAtTime(1800 + Math.random()*800, now);
            o.frequency.exponentialRampToValueAtTime(1200, now+0.03);
            g.gain.setValueAtTime(0.015*SFX_VOL, now);
            g.gain.exponentialRampToValueAtTime(0.001, now+0.035);
            o.connect(g);g.connect(a.destination);
            o.start(now);o.stop(now+0.04);
          }
        }catch(e){}
      }
    }
    if(p.rDecay)p.r=Math.max(.1,p.r-p.rDecay);
    if(p.life<=0){
      if(!p._pooled && _particleFreeList.length < 1200){ p._pooled = true; _particleFreeList.push(p); }
      particles[i] = particles[particles.length - 1];
      particles.pop();
      continue;
    }
    const a=Math.min(1,p.life*p.alpha);
    ctx.globalAlpha=a;if(p.blur){ctx.shadowBlur=p.r*2;ctx.shadowColor=p.color;}else ctx.shadowBlur=0;
    if(p.type==='circle'){ctx.beginPath();if(p.color2){const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);g.addColorStop(0,p.color);g.addColorStop(1,p.color2);ctx.fillStyle=g;}else ctx.fillStyle=p.color;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
    else if(p.type==='spark'){ctx.strokeStyle=p.color;ctx.lineWidth=p.r*.5+.4;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*4,p.y-p.vy*4);ctx.stroke();}
    else if(p.type==='shard'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=p.color;ctx.fillRect(-p.r,-p.r*.4,p.r*2,p.r*.8);ctx.restore();}
    else if(p.type==='ring'){ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(.5,p.r*.12);ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.stroke();}
    else if(p.type==='ray'){ctx.strokeStyle=p.color;ctx.lineWidth=p.r*.4;const len=p.r*3*p.life;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(p.angle)*len,p.y+Math.sin(p.angle)*len);ctx.stroke();}
  }
  ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.restore();
  drawFloatTexts();
}
// 真实抛壳系统 (Ejected Brass Shell Casings)
function spawnShellCasing(x, y, angle, wpnId){
  if(!wpnId || ['warhorn','bloodblades','quakehammer','flame','chiliflamer'].includes(wpnId)) return;
  const isShotgun = ['shotgun','sawoff'].includes(wpnId);
  const isHeavy = ['sniper','railgun','railcharger','rifle','ak47'].includes(wpnId);
  const shellColor = isShotgun ? '#cc2222' : (isHeavy ? '#f0c040' : '#e6b830');
  const size = isShotgun ? 2.5 : (isHeavy ? 2.0 : 1.4);
  const ejectAngle = (typeof player !== 'undefined' && player.facingRight) ? (Math.PI * 0.72 + (Math.random() - 0.5) * 0.3) : (Math.PI * 0.28 + (Math.random() - 0.5) * 0.3);
  const spd = 2.4 + Math.random() * 2.2;
  mkP({
    x: x - Math.cos(angle) * 8,
    y: y - 2,
    vx: Math.cos(ejectAngle) * spd,
    vy: -2.8 - Math.random() * 2.2,
    r: size,
    rDecay: 0.003,
    decay: 0.012,
    color: shellColor,
    type: 'shard',
    angle: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.6,
    grav: 0.32,
    alpha: 0.95
  });
}
// VFX helpers
let shakeX=0,shakeY=0,redFlash=0,orangeFlash=0,purpleFlash=0;
function addShake(m){shakeX+=(Math.random()-.5)*m*2.5;shakeY+=(Math.random()-.5)*m*2.5;}
function vfxMuzzle(x,y,angle,wpnId){
  const c={
    pistol:['#ffe0a0','#ffaa30','#ff6600'],
    shotgun:['#fff','#ffcc80','#ff7700'],
    smg:['#ffe890','#ffbb40','#ff7700'],
    smg_heavy:['#ffe070','#ffa820','#ff6600'],
    crossbow:['#e0d0a0','#c8a860','#aa8830'],
    sniper:['#c0ffc0','#80ff80','#40dd40'],
    tesla:['#c0eeff','#80ddff','#00bbff'],
    railgun:['#e0ffff','#80ffff','#00eeff'],
    grenade:['#ccffaa','#88ff44','#44cc00'],
    ice:['#c0eeff','#80ccff','#44aaff'],
    poison:['#a0ff60','#66dd30','#33aa10'],
    flame:['#ffee80','#ff8800','#ff3300'],
    minigun:['#ffe880','#ffc820','#ff9900'],
    rocket:['#fff0a0','#ffaa30','#ff4400'],
    plasma:['#e0a0ff','#cc66ff','#8833dd'],
  }[wpnId]||['#ffe0a0','#ffaa30','#ff6600'];
  const autofire=['smg','smg_heavy','minigun'].includes(wpnId);
  if(autofire){
    mkP({x,y,r:3.2,rDecay:.3,decay:.2,color:c[0],type:'circle',alpha:.9,grav:0});
    for(let i=0;i<4;i++){
      const a=angle+(Math.random()-.5)*.32;
      const spd=3.2+Math.random()*4.2;
      mkP({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:0.9,rDecay:.03,decay:.07,color:c[1],type:'spark',grav:.12,alpha:.9});
    }
  }else{
    // 现代硬核战术枪口微焰：利落前向微型火星锥 + 紧凑闪点，彻底剔除全屏360°怪异光线与模糊大光球
    mkP({x,y,r:4.2,rDecay:.38,decay:.22,color:'#fff',type:'circle',alpha:.95,grav:0});
    const sparkCount = (wpnId==='shotgun'?10:5);
    for(let i=0;i<sparkCount;i++){
      const a=angle+(Math.random()-.5)*(wpnId==='shotgun'?0.65:0.32);
      const spd=3.2+Math.random()*5.2;
      mkP({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:1.1,rDecay:.03,decay:.06,color:c[i%2?1:2],type:'spark',grav:.12,alpha:.9});
    }
  }
}
function vfxHit(x,y,fromX,fromY){
  const angle = (fromX != null && fromY != null) ? Math.atan2(y - fromY, x - fromX) : 0;
  // 1. 清脆利落的弹着点微型火星（2-3颗金黄火花，快速消散）
  for(let i=0; i<3; i++){
    const a = angle + (Math.random() - 0.5) * 1.0;
    const spd = 2.0 + Math.random() * 3.0;
    mkP({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 0.3, r: 1.0 + Math.random()*0.4, rDecay: 0.08, decay: 0.12, color: i%2 ? '#ffe082' : '#ffb74d', type: 'spark', grav: 0.14, alpha: 0.9 });
  }
  // 2. 紧凑克制的暗红小血珠（2-3滴微粒自然下坠，干净扎实）
  for(let i=0; i<3; i++){
    const a = angle + (Math.random() - 0.5) * 1.2;
    const spd = 1.0 + Math.random() * 2.0;
    mkP({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 0.4, r: 1.1 + Math.random()*0.5, rDecay: 0.06, decay: 0.08, color: '#7a1212', type: 'circle', grav: 0.20, alpha: 0.85 });
  }
}
// 暴击命中特效：现代硬核战术暴击（高亮穿透火星 + 污血撕裂，拒绝杂乱光环射线与刺眼白闪）
function vfxCritHit(x,y,fromX,fromY){
  const angle = (fromX != null && fromY != null) ? Math.atan2(y - fromY, x - fromX) : 0;
  // 1. 锐利金白火花（4颗）
  for(let i=0; i<4; i++){
    const a = angle + (Math.random() - 0.5) * 1.2;
    const spd = 3.0 + Math.random() * 3.5;
    mkP({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 0.6, r: 1.2 + Math.random()*0.5, rDecay: 0.08, decay: 0.10, color: i%2 ? '#fff080' : '#ffaa00', type: 'spark', grav: 0.16, alpha: 0.95 });
  }
  // 2. 紧凑暴击暗红血沫（4滴）
  for(let i=0; i<4; i++){
    const a = angle + (Math.random() - 0.5) * 1.3;
    const spd = 1.5 + Math.random() * 2.5;
    mkP({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 0.8, r: 1.3 + Math.random()*0.6, rDecay: 0.06, decay: 0.07, color: '#881111', type: 'circle', grav: 0.22, alpha: 0.9 });
  }
  vfxCritFlash();
}
function vfxKill(x,y){
  addShake(3.5);
  // 击杀反馈：利落暗红污血散落与碎骨微粒，彻底移除“💫 晕了”杂乱浮字与全屏膨胀光环
  for(let i=0; i<12; i++){
    const a = Math.random() * Math.PI * 2;
    const spd = 1.2 + Math.random() * 4.5;
    mkP({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 2.0, r: 1.5 + Math.random()*2, rDecay: 0.035, decay: 0.025, color: i%3 === 0 ? '#5a0a0a' : (i%3===1 ? '#7c1212' : '#9c7a50'), type: 'circle', grav: 0.22, alpha: 0.95 });
  }
}
function vfxBossKill(x,y){
  addShake(20);orangeFlash=1;purpleFlash=.8;
  for(let i=0;i<60;i++){const a=Math.random()*Math.PI*2;const spd=2+Math.random()*14;mkP({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-3,r:3+Math.random()*6,rDecay:.06,decay:.015,color:['#ff2200','#ff6600','#ffaa00','#ff0066'][i%4],type:'circle',grav:.28,alpha:1,blur:i<12});}
  for(let i=0;i<16;i++){const a=Math.random()*Math.PI*2;mkP({x,y,vx:Math.cos(a)*(4+Math.random()*7),vy:Math.sin(a)*(4+Math.random()*7),r:4+Math.random()*4,rDecay:.05,decay:.016,color:'#c8b890',type:'shard',angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*.3,grav:.3,alpha:.9});}
  [0,100,200].forEach((_,i)=>setTimeout(()=>{mkP({x,y,r:15+i*25,rDecay:-(6+i*4),decay:.055,color:`rgba(255,${150-i*40},0,1)`,type:'ring',alpha:.8,grav:0});},_));
}
function vfxExplosion(cx,cy,R){
  // v53：半径参数（武器aoe）——大爆炸更大震/更亮/更广，小爆炸收敛；默认100=旧视觉
  const rad=(typeof R==='number'&&R>0)?R:100;
  const k=Math.max(.55,Math.min(1.6,rad/100));  // 视觉缩放系数（限幅防极端）
  orangeFlash=Math.max(orangeFlash,.9*k);addShake(Math.round(18*k));
  // ── 美术升级：白色闪光帧（最先0.1秒的纯白爆闪，定格打击感）──
  mkP({x:cx,y:cy,r:110*k,rDecay:9,decay:.5,color:'#ffffff',type:'circle',alpha:1,grav:0,blur:true});
  // 核心爆炸球（更大+多层）
  mkP({x:cx,y:cy,r:65*k,rDecay:2.5,decay:.06,color:'#fff',color2:'#ff8800',type:'circle',alpha:.98,grav:0,blur:true});
  mkP({x:cx,y:cy,r:40*k,rDecay:1.5,decay:.08,color:'#ffcc00',color2:'#ff4400',type:'circle',alpha:.9,grav:0,blur:true});
  // 爆炸碎片（更多+更大+blur）
  for(let i=0;i<Math.round(32*k);i++){const a=Math.random()*Math.PI*2;const spd=2+Math.random()*12;const h=Math.random();mkP({x:cx,y:cy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-1,r:(4+Math.random()*10)*k,rDecay:.08,decay:.02,color:h>.6?'#fffae0':h>.3?'#f39c12':'#e74c3c',type:'circle',grav:.04,alpha:.9,blur:true});}
  // 冲击波环（4层+更快扩散）
  [0,60,120,180].forEach((_,i)=>setTimeout(()=>{mkP({x:cx,y:cy,r:(8+i*16)*k,rDecay:-(6+i*3),decay:.05,color:`rgba(255,${170-i*35},${50-i*12},1)`,type:'ring',alpha:.8,grav:0});},_));
  // 碎片飞溅
  for(let i=0;i<Math.round(24*k);i++){const a=Math.random()*Math.PI*2;mkP({x:cx,y:cy,vx:Math.cos(a)*(3+Math.random()*14),vy:Math.sin(a)*(3+Math.random()*14)-3,r:2+Math.random()*4,rDecay:.03,decay:.014,color:i%2?'#3a2812':'#7a5533',type:'shard',angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*.3,grav:.32,alpha:.9});}
  // 烟雾（更多）
  for(let i=0;i<Math.round(18*k);i++){mkP({x:cx+(Math.random()-.5)*24,y:cy+(Math.random()-.5)*10,vx:(Math.random()-.5)*3,vy:-(Math.random()*2.5+1),r:6+Math.random()*12,rDecay:-.06,decay:.01,color:`rgba(55,50,45,0.5)`,type:'circle',grav:-.014,alpha:.5,blur:true});}
  // ── 美术升级：地面扬尘（两侧横向喷出的尘土弧）──
  for(let i=0;i<Math.round(14*k);i++){
    const dir=Math.random()<.5?-1:1;
    mkP({x:cx+dir*(4+Math.random()*8),y:cy+14,vx:dir*(1.5+Math.random()*4),vy:-(Math.random()*1.2),r:3+Math.random()*6,rDecay:-.04,decay:.012,color:'rgba(120,100,70,.55)',type:'circle',grav:-.008,alpha:.6,blur:true});
  }
  // ── 美术升级：地面焦痕（持续2秒的暗色椭圆，缓慢淡出）──
  mkP({x:cx,y:cy+14,r:34*k,rDecay:.02,decay:.008,color:'rgba(20,14,8,.7)',type:'circle',alpha:.75,grav:0,blur:true});
}
function vfxRail(x1,y1,x2,y2,col1,col2){
  const c1=col1||'#00eeff', c2=col2||'#0055bb';
  const dx=x2-x1,dy=y2-y1,dist=Math.sqrt(dx*dx+dy*dy)||1,nx=dx/dist,ny=dy/dist;
  for(let d=0;d<dist;d+=16)mkP({x:x1+nx*d,y:y1+ny*d,vx:(Math.random()-.5)*1.5,vy:(Math.random()-.5)*1.5,r:3+Math.random()*3,rDecay:.08,decay:.07,color:c1,color2:c2,type:'circle',grav:0,alpha:.8,blur:true});
  for(let i=0;i<22;i++){const t2=Math.random();mkP({x:x1+nx*dist*t2,y:y1+ny*dist*t2,vx:(-ny)*(Math.random()-.5)*6,vy:(nx)*(Math.random()-.5)*6,r:1.5,decay:.1,color:c1,type:'spark',grav:0,alpha:.9});}
  vfxHit(x2,y2,x1,y1);addShake(5);
}
function vfxFlame(x,y,angle){
  for(let i=0;i<3;i++){const a=angle+(Math.random()-.5)*.4;const spd=2+Math.random()*3;const h=Math.random();mkP({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-.3,r:3+Math.random()*4,rDecay:-.03,decay:.045,color:h>.5?'#fff8c0':h>.25?'#ff9900':'#ff3300',color2:'rgba(40,10,0,0)',type:'circle',grav:-.04,alpha:.82,blur:true});}
  for(let i=0;i<2;i++){mkP({x,y,vx:Math.cos(angle+(Math.random()-.5)*.7)*(3+Math.random()*3),vy:Math.sin(angle)*(3+Math.random()*3),r:.8,rDecay:.01,decay:.05,color:'#ffcc44',type:'spark',grav:.08,alpha:.9});}
}
function vfxPlayerHurt(px,py){redFlash=1;addShake(10);for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2;mkP({x:px+CHAR_W/2,y:py+CHAR_H/2,vx:Math.cos(a)*(1.5+Math.random()*5),vy:Math.sin(a)*(1.5+Math.random()*5),r:2+Math.random()*3,rDecay:.05,decay:.04,color:i%2?'#aa1818':'#ff3333',type:'circle',grav:.15,alpha:.9});}}
function vfxHeal(px,py){for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2;mkP({x:px+CHAR_W/2,y:py+CHAR_H/2,vx:Math.cos(a)*(1+Math.random()*2),vy:Math.sin(a)*(1+Math.random()*2)-2,r:2+Math.random()*2,rDecay:.04,decay:.03,color:i%2?'#27ae60':'#2ecc71',type:'circle',grav:-.06,alpha:.9,blur:true});}}
function vfxSpriteAttack(sx,sy,tx,ty){const dx=tx-sx,dy=ty-sy,dist=Math.sqrt(dx*dx+dy*dy)||1,nx=dx/dist,ny=dy/dist;for(let d=0;d<dist;d+=12)mkP({x:sx+nx*d,y:sy+ny*d,vx:0,vy:0,r:3,rDecay:.1,decay:.08,color:'#80c8ff',color2:'#4090ff',type:'circle',grav:0,alpha:.85,blur:true});}
function vfxShockwave(x,y){// Boss slam shockwave
  addShake(12);
  mkP({x,y:GROUND_Y,r:8,rDecay:-3,decay:.07,color:'rgba(255,180,60,.8)',type:'ring',alpha:.9,grav:0});
  mkP({x,y:GROUND_Y,r:15,rDecay:-2,decay:.08,color:'rgba(255,100,30,.6)',type:'ring',alpha:.7,grav:0});
  for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2;mkP({x,y:GROUND_Y,vx:Math.cos(a)*(3+Math.random()*8),vy:-(Math.random()*4+1),r:2+Math.random()*3,rDecay:.05,decay:.03,color:'#8a7030',type:'shard',angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*.3,grav:.35});}
}
// ── 换弹特效 ─────────────────────────────────────────────
function vfxReloadStart(x,y){
  // 卸弹匣：少量金属碎屑 + 灰色火星
  for(let i=0;i<7;i++){const a=Math.random()*Math.PI*2;mkP({x,y,vx:Math.cos(a)*(1+Math.random()*2.5),vy:Math.sin(a)*(1+Math.random()*2)-1.5,r:1.4+Math.random()*1.4,rDecay:.04,decay:.05,color:i%2?'#9a9080':'#6a6258',type:'shard',angle:Math.random()*Math.PI,spin:(Math.random()-.5)*.4,grav:.32,alpha:.9});}
  mkP({x,y,r:5,rDecay:-.6,decay:.09,color:'rgba(180,170,150,.5)',type:'ring',alpha:.6,grav:0});
}
function vfxReloadComplete(x,y){
  // 上膛完成：明亮的金色火星 + 光环
  for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2;const spd=1.5+Math.random()*3.5;mkP({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-.5,r:1.2+Math.random()*1.6,rDecay:.05,decay:.06,color:i%2?'#ffe080':'#ffb030',type:'spark',grav:.14,alpha:.95});}
  mkP({x,y,r:4,rDecay:-1.1,decay:.11,color:'#ffe080',type:'ring',alpha:.85,grav:0});
  mkP({x,y,r:8,rDecay:-.9,decay:.12,color:'rgba(255,200,80,.5)',type:'ring',alpha:.55,grav:0});
  addShake(2);
}
function spawnReloadMagDrop(x,y,facingR){
  // 创建一个物理弹匣掉落体（重力+旋转+反弹）
  reloadMagDrop={x,y,vx:(facingR?1:-1)*(1.2+Math.random()*0.8),vy:-2.2,angle:Math.random()*Math.PI,spin:(facingR?1:-1)*(0.18+Math.random()*0.12),life:1};
}
function updateReloadMagDrop(){
  const m=reloadMagDrop;if(!m)return;
  m.x+=m.vx;m.y+=m.vy;m.vy+=0.42;m.vx*=0.99;m.angle+=m.spin;m.life-=0.012;
  // 落地反弹
  const gy=groundYAt(m.x);
  if(m.y>=gy-3){
    m.y=gy-3;m.vy*=-0.35;m.vx*=0.6;m.spin*=0.5;
    if(Math.abs(m.vy)<0.6){m.vy=0;m.vx*=0.85;}
    // 落地灰尘
    if(Math.random()<0.5)mkP({x:m.x,y:gy,vx:(Math.random()-.5)*1.2,vy:-.6-Math.random()*.5,r:1.4+Math.random()*1.2,decay:.04,color:'rgba(120,100,70,.5)',type:'circle',grav:-.01,alpha:.5});
  }
  if(m.life<=0||m.x<cameraX-60||m.x>cameraX+GW+60)reloadMagDrop=null;
}
function drawReloadMagDrop(){
  const m=reloadMagDrop;if(!m)return;
  // 注意：绘制在已 translate(-cameraX) 的 ctx 内，故直接用世界坐标 m.x
  ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.angle);ctx.globalAlpha=Math.min(1,m.life);
  // 弹匣本体（金属色，依当前武器微调）
  const wpn=reloadWpnId;
  const base=wpn==='railgun'?'#334':wpn==='flame'?'#553311':wpn==='grenade'?'#445530':'#3a2e1e';
  const hi=wpn==='railgun'?'#557':wpn==='flame'?'#774422':wpn==='grenade'?'#556640':'#5a4a30';
  ctx.fillStyle=base;ctx.fillRect(-3,-7,6,14);
  ctx.fillStyle=hi;ctx.fillRect(-3,-7,2,14);
  ctx.fillStyle='#222';ctx.fillRect(-3,5,6,2);
  // 弹匣顶部弹簧片
  ctx.fillStyle='#888';ctx.fillRect(-2,-7,4,1);
  ctx.restore();ctx.globalAlpha=1;
}
// ── 枪口屏幕照明（短暂泛光） ─────────────────────────────
function vfxMuzzleLight(wpnId){
  const intensity={pistol:.18,shotgun:.32,smg:.14,smg_heavy:.18,crossbow:.10,sniper:.30,tesla:.24,railgun:.28,grenade:.16,ice:.20,poison:.16,flame:.22,minigun:.14,rocket:.38,plasma:.30}[wpnId]||.18;
  muzzleLightFlash=Math.min(1,muzzleLightFlash+intensity);
}
// 全屏泛光强度：手机上画面铺满整屏、离眼近，连射时整屏一明一暗像在闪，压到 1/3
function muzzleLightAlpha(){ return isPhoneUI() ? 0.07 : 0.22; }
// ── 暴击屏幕闪光 ─────────────────────────────────────────
function vfxCritFlash(){critFlash=Math.min(0.08, critFlash+0.04);}
// ── 烟雾累积（连射时生成烟雾粒子） ───────────────────────
function vfxSmokeTick(x,y,wpnId){
  const smokeMap={minigun:0.5,flame:1.2,shotgun:0.7,smg:0.4,smg_heavy:0.5,rocket:0.9,plasma:0.3};
  smokeAccum+=(smokeMap[wpnId]||0.3);
  if(smokeAccum>=1){
    smokeAccum=0;
    for(let i=0;i<2;i++){
      mkP({x:x+(Math.random()-.5)*6,y:y+(Math.random()-.5)*6,vx:(Math.random()-.5)*.6,vy:-.5-Math.random()*.7,r:3+Math.random()*3,rDecay:.02,decay:.012,color:wpnId==='flame'?'rgba(40,30,25,.55)':wpnId==='rocket'?'rgba(50,40,35,.6)':'rgba(90,80,70,.4)',type:'circle',grav:-.018,alpha:.5,blur:true});
    }
  }
}
let dustT=0;
function spawnDust(){
  // 彻底移除漂浮光斑微粒与浮尘
}

