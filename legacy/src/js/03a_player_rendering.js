/* ═══════════════════════════════════════════════════════════════════════════════
   ══ 03. COMBAT & DEFENSE ══
   小胡角色绘制 drawPlayer / 枪械射击弹道 / 高地机枪哨塔 / 僵尸AI状态机 / 受击死亡结算
═══════════════════════════════════════════════════════════════════════════════ */


//  BACKGROUND SCENERY (static)
// ═══════════════════════════════════════════
const stars=Array.from({length:90},()=>({x:Math.random()*GW,y:Math.random()*(GH*.52),r:.5+Math.random()*1.5,b:Math.random()}));
const bgTrees=Array.from({length:Math.ceil(WORLD_W/95)},(_,i)=>({x:i*95+Math.random()*40-20,h:60+Math.random()*80,w:10+Math.random()*12}));
const midTrees=Array.from({length:Math.ceil(WORLD_W/160)},(_,i)=>({x:i*160+Math.random()*60-30,h:80+Math.random()*60,w:16+Math.random()*14}));
const grassTufts=Array.from({length:Math.ceil(WORLD_W/55)},()=>({x:Math.random()*WORLD_W,h:4+Math.random()*8,j:Math.random()}));
const cracks=Array.from({length:Math.ceil(WORLD_W/180)},()=>({x:60+Math.random()*(WORLD_W-120),w:20+Math.random()*55}));

// 户外废墟装饰：残墙、废弃车、路灯、路障、垃圾桶，散布在世界各处增加探险感
const RUIN_TYPES=['wall','car','lamp','barrel','debris'];
const ruins=[];
(function(){
  // 用伪随机种子保证每次布局一致（不随刷新变），间距约 280px 一个
  let seed=12345;
  const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  for(let x=400;x<WORLD_W-300;x+=220+rnd()*180){
    // 避开建筑位置（建筑前后留空）
    let nearBld=false;
    for(const b of [{x:120,w:90},{x:1740,w:80},{x:1880,w:90},{x:2030,w:90},{x:2180,w:80}]){
      if(Math.abs(x-(b.x+b.w/2))<140){nearBld=true;break;}
    }
    if(nearBld)continue;
    ruins.push({x,type:RUIN_TYPES[Math.floor(rnd()*RUIN_TYPES.length)],v:rnd()});
  }
})();
// 移除突兀的现代铁质路灯，保留城堡古朴要塞风格
const lamps=[];
function rnd(){return Math.random();}

// 世界右端的广播塔（目的地，剧情结局触发点）
function drawBeaconTower(t){
  const tx=WORLD_W-60; // 塔基世界 x
  const screenX=tx-cameraX;
  if(screenX<-80||screenX>GW+80)return;
  const sx=tx;
  ctx.save();
  // 塔身
  ctx.fillStyle='#2a2a30';ctx.fillRect(sx-14,GROUND_Y-160,28,160);
  ctx.fillStyle='#1a1a20';ctx.fillRect(sx-14,GROUND_Y-160,6,160);
  ctx.fillStyle='#3a3a44';ctx.fillRect(sx+8,GROUND_Y-160,6,160);
  // 横向支架
  ctx.fillStyle='#222';for(let i=0;i<6;i++)ctx.fillRect(sx-14,GROUND_Y-150+i*28,28,3);
  // 塔顶信号灯（闪烁）
  const lit=t%60<40;
  if(lit){ctx.shadowBlur=18;ctx.shadowColor='#ff4444';}
  ctx.fillStyle=lit?'#ff3333':'#551111';ctx.beginPath();ctx.arc(sx,GROUND_Y-170,5,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  // 顶部天线
  ctx.strokeStyle='#555';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,GROUND_Y-170);ctx.lineTo(sx,GROUND_Y-195);ctx.stroke();
  // 已按用户要求删除背景垂直光柱
  ctx.restore();
}

// 户外废墟装饰（残墙/废弃车/油桶/碎片）
function drawRuins(t){
  ruins.forEach(r=>{
    const screenX=r.x-cameraX;
    if(screenX<-100||screenX>GW+100)return;
    const sx=r.x;
    ctx.save();
    switch(r.type){
      case'wall':
        ctx.fillStyle='#2a2620';ctx.fillRect(sx,GROUND_Y-42,28,42);
        ctx.fillStyle='#1a1812';ctx.fillRect(sx,GROUND_Y-42,4,42);
        ctx.fillStyle='#3a3428';ctx.fillRect(sx+24,GROUND_Y-42,4,42);
        ctx.fillStyle='#0a0904';ctx.fillRect(sx,GROUND_Y-42,28,6);
        ctx.fillRect(sx+6,GROUND_Y-38,5,4);ctx.fillRect(sx+16,GROUND_Y-40,6,6);
        ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=.8;
        ctx.beginPath();ctx.moveTo(sx,GROUND_Y-28);ctx.lineTo(sx+28,GROUND_Y-28);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sx,GROUND_Y-16);ctx.lineTo(sx+28,GROUND_Y-16);ctx.stroke();
        break;
      case'car':
        ctx.fillStyle='#3a2a1a';ctx.fillRect(sx-26,GROUND_Y-22,52,22);
        ctx.fillStyle='#2a1e12';ctx.fillRect(sx-22,GROUND_Y-30,40,10);
        ctx.fillStyle='rgba(120,160,180,.15)';ctx.fillRect(sx-18,GROUND_Y-28,14,7);ctx.fillRect(sx+2,GROUND_Y-28,14,7);
        ctx.fillStyle='#1a1208';ctx.fillRect(sx-26,GROUND_Y-6,52,6);
        ctx.fillStyle='#0a0a0a';ctx.beginPath();ctx.arc(sx-16,GROUND_Y-4,5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(sx+16,GROUND_Y-4,5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(120,60,20,.4)';ctx.fillRect(sx-20,GROUND_Y-18,16,4);
        break;
      case'barrel':
        ctx.fillStyle='#4a3a1a';ctx.fillRect(sx-6,GROUND_Y-18,12,18);
        ctx.fillStyle='#5a4a2a';ctx.fillRect(sx-6,GROUND_Y-18,3,18);
        ctx.fillStyle='#3a2a10';ctx.fillRect(sx-6,GROUND_Y-14,12,2);ctx.fillRect(sx-6,GROUND_Y-8,12,2);
        ctx.fillStyle='#cc8800';ctx.fillRect(sx-3,GROUND_Y-11,6,3);
        break;
      case'debris':
        ctx.fillStyle='#2a261c';
        ctx.beginPath();ctx.moveTo(sx-14,GROUND_Y);ctx.lineTo(sx-10,GROUND_Y-8);ctx.lineTo(sx-2,GROUND_Y-6);
        ctx.lineTo(sx+4,GROUND_Y-10);ctx.lineTo(sx+10,GROUND_Y-5);ctx.lineTo(sx+14,GROUND_Y);ctx.closePath();ctx.fill();
        ctx.fillStyle='#1a1610';ctx.fillRect(sx-8,GROUND_Y-3,4,3);ctx.fillRect(sx+2,GROUND_Y-4,5,4);
        break;
    }
    ctx.restore();
  });
}

// 战场街灯已彻底移除，平台仅保留要塞跳动火把与真实要塞氛围
function drawLamps(t){
  // 彻底移除突兀的现代街灯柱与地面大光斑，回归要塞城堡沉浸质感
}

// 天空层（屏幕固定，不随相机滚动）
// 美术D：波内进度（0→1，太阳/月亮轨迹用；与 updateWorldProgress 的 waveFrac 同算法）
function dayFracProgress(){
  if(waveTotalThisWave<=0)return 0.5;
  return Math.min(1, waveKilledThisWave/waveTotalThisWave);
}
function drawSky(t){
  // 天色优先根据 timeOfDay 决定（白天打僵尸 vs 夜晚餐厅）
  // 白天时再按波次细分明暗，夜晚统一深夜
  let dayPhase;
  if(timeOfDay === 'night'){
    dayPhase = 'deepnight';
  } else {
    // 白天：按波次推进天色（黎明→白天→黄昏→深夜循环，表现15天的流逝）
    dayPhase = (wave>=14)?'dawn'
             : (wave>=11)?'deepnight'
             : (wave>=9)?'dusk'
             : (wave>=6)?'day'
             : (wave>=4)?'dawn'
             : 'deepnight';
  }
  const sky=ctx.createLinearGradient(0,0,0,GROUND_Y);
  if(dayPhase==='dawn'){
    // 黎明：天空偏紫红 #2a1a30 → #3a2020
    sky.addColorStop(0,'#2a1a30');sky.addColorStop(.5,'#33202a');sky.addColorStop(1,'#3a2020');
  }else if(dayPhase==='day'){
    // 白天：天空偏蓝灰 #2a3850 → #3a4030，亮度+30%
    sky.addColorStop(0,'#2a3850');sky.addColorStop(.5,'#33404a');sky.addColorStop(1,'#3a4030');
  }else if(dayPhase==='dusk'){
    // 黄昏：天空偏橙红 #3a2010 → #2a1810
    sky.addColorStop(0,'#3a2010');sky.addColorStop(.5,'#332012');sky.addColorStop(1,'#2a1810');
  }else{
    // 深夜（保持原配色）#101830 → #2a261a
    sky.addColorStop(0,'#101830');sky.addColorStop(.5,'#1a2238');sky.addColorStop(1,'#2a261a');
  }
  ctx.fillStyle=sky;ctx.fillRect(0,0,GW,GROUND_Y);
  // Moon glow（更大更亮；白天阶段减弱）
  const mx=GW*.82,my=52;
  const glowA=dayPhase==='day'?.08:.22;
  const glowMid=dayPhase==='day'?.03:.08;
  const mg2=ctx.createRadialGradient(mx,my,0,mx,my,140);
  mg2.addColorStop(0,`rgba(255,253,180,${glowA})`);mg2.addColorStop(.5,`rgba(200,210,255,${glowMid})`);mg2.addColorStop(1,'transparent');
  ctx.fillStyle=mg2;ctx.fillRect(0,0,GW,GROUND_Y);
  // Moon（白天阶段降低亮度：globalAlpha=0.3）
  ctx.save();
  if(dayPhase==='day')ctx.globalAlpha=0.3;
  ctx.shadowBlur=28;ctx.shadowColor='rgba(255,253,160,.7)';
  const mg=ctx.createRadialGradient(mx-5,my-5,0,mx,my,24);
  mg.addColorStop(0,'#fffef0');mg.addColorStop(.6,'#e8d860');mg.addColorStop(1,'#b8a828');
  ctx.fillStyle=mg;ctx.beginPath();ctx.arc(mx,my,24,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=(dayPhase==='day'?0.3:1)*.16;ctx.fillStyle='#8a7a00';
  [[mx-7,my-4,5],[mx+7,my+5,3.5],[mx-1,my+9,2.5]].forEach(([cx2,cy2,cr])=>{ctx.beginPath();ctx.arc(cx2,cy2,cr,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;ctx.restore();
  // Stars
  stars.forEach(s=>{ctx.globalAlpha=(.6+.4*Math.sin(t*.0008+s.b*20))*.9;ctx.fillStyle='#fffde8';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;
  // ── 美术D：天体轨迹（黎明/黄昏画太阳，沿弧线随波内击杀进度移动——"这一天正在过去"）──
  if(dayPhase==='dawn' || dayPhase==='dusk'){
    const sunX = GW*(0.12 + 0.7*dayFracProgress());  // 左→右弧线
    const sunY = 130 - Math.sin(dayFracProgress()*Math.PI)*95;  // 弧顶
    const sunCol = dayPhase==='dawn' ? '255,190,120' : '255,120,60';
    // 大光晕
    const sg=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,90);
    sg.addColorStop(0,`rgba(${sunCol},.55)`);sg.addColorStop(.4,`rgba(${sunCol},.22)`);sg.addColorStop(1,'transparent');
    ctx.fillStyle=sg;ctx.fillRect(sunX-100,sunY-100,200,200);
    // 日盘
    const sd=ctx.createRadialGradient(sunX-4,sunY-4,0,sunX,sunY,18);
    sd.addColorStop(0,'#fff4d0');sd.addColorStop(.6,dayPhase==='dawn'?'#ffcc88':'#ff8848');sd.addColorStop(1,dayPhase==='dawn'?'#dd9a55':'#cc5520');
    ctx.fillStyle=sd;ctx.beginPath();ctx.arc(sunX,sunY,18,0,Math.PI*2);ctx.fill();
    // 太阳亮时压暗星星（白天看不到星）
    ctx.fillStyle='rgba(30,40,60,.25)';ctx.fillRect(0,0,GW,sunY+60);
  }
  // ── 美术D：全局光照色罩（时段氛围统一：黎明偏暖紫、白天清亮、黄昏橙、深夜蓝冷）──
  {
    const tintMap={dawn:'rgba(255,150,100,.06)',day:'rgba(120,160,200,.04)',dusk:'rgba(255,110,50,.08)',deepnight:'rgba(30,50,110,.10)'};
    ctx.fillStyle=tintMap[dayPhase]||'rgba(0,0,0,0)';
    ctx.fillRect(0,0,GW,GROUND_Y+GROUND_H);
  }
  // ── 美术重构：末世远景山脉与要塞废墟地平线（两层连续纵深剪影，与地面天然连贯，绝无悬空方柱）──
  {
    ctx.save();
    // 第一层：极远深渊山脉微光剪影（视差 ×0.06，连绵起伏，与地面平滑咬合）
    const mountainGrad = ctx.createLinearGradient(0, GROUND_Y - 90, 0, GROUND_Y);
    mountainGrad.addColorStop(0, dayPhase==='day' ? 'rgba(38,48,64,0.45)' : (dayPhase==='dusk' ? 'rgba(46,26,24,0.55)' : 'rgba(12,16,26,0.68)'));
    mountainGrad.addColorStop(1, dayPhase==='day' ? 'rgba(25,32,44,0.75)' : (dayPhase==='dusk' ? 'rgba(28,16,14,0.85)' : 'rgba(8,10,18,0.92)'));
    ctx.fillStyle = mountainGrad;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const mCam = cameraX * 0.06;
    for(let sx = 0; sx <= GW + 20; sx += 20){
      const wx = sx + mCam;
      const my = GROUND_Y - 42 - Math.sin(wx * 0.0032) * 24 - Math.sin(wx * 0.0085) * 12;
      ctx.lineTo(sx, my);
    }
    ctx.lineTo(GW + 20, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 第二层：近景末世要塞残垣与低矮废墟剪影（视差 ×0.16，扎实接地，暗影轮廓）
    const ridgeGrad = ctx.createLinearGradient(0, GROUND_Y - 50, 0, GROUND_Y);
    ridgeGrad.addColorStop(0, dayPhase==='day' ? 'rgba(22,28,38,0.7)' : 'rgba(6,8,14,0.88)');
    ridgeGrad.addColorStop(1, dayPhase==='day' ? 'rgba(14,18,25,0.95)' : 'rgba(4,5,9,0.98)');
    ctx.fillStyle = ridgeGrad;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const rCam = cameraX * 0.16;
    for(let sx = 0; sx <= GW + 20; sx += 24){
      const wx = sx + rCam;
      const bump = Math.sin(wx * 0.015) > 0.4 ? 7 : 0;
      const ry = GROUND_Y - 20 - Math.sin(wx * 0.0055) * 12 - Math.sin(wx * 0.012) * 6 - bump;
      ctx.lineTo(sx, ry);
    }
    ctx.lineTo(GW + 20, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Fog band
  const fog=ctx.createLinearGradient(0,GROUND_Y-50,0,GROUND_Y);
  fog.addColorStop(0,'rgba(90,110,70,0)');fog.addColorStop(1,'rgba(70,90,50,.2)');
  ctx.fillStyle=fog;ctx.fillRect(0,GROUND_Y-50,GW,50);
  // Ground fill (铺满屏) — 旧小镇地面偏冷灰，战场偏暖棕，家园偏石质
  const grd=ctx.createLinearGradient(0,GROUND_Y,0,GH);
  // 根据 cameraX 判断区域色
  const camRight=cameraX+GW;
  if(camRight>1680){
    // 旧小镇：冷灰色废墟地面
    grd.addColorStop(0,'#1a1a20');grd.addColorStop(.3,'#12121a');grd.addColorStop(1,'#0a0a10');
  }else if(cameraX>400){
    // 战场：暖棕
    grd.addColorStop(0,'#2a2614');grd.addColorStop(.3,'#1c1808');grd.addColorStop(1,'#141006');
  }else{
    // 家园：石质
    grd.addColorStop(0,'#2a2418');grd.addColorStop(.3,'#1a1610');grd.addColorStop(1,'#100c08');
  }
  ctx.fillStyle=grd;ctx.fillRect(0,GROUND_Y,GW,GROUND_H);
  // 地面顶线
  if(camRight>1680){ctx.fillStyle='#3a3a44';ctx.fillRect(0,GROUND_Y,GW,2);ctx.fillStyle='#2a2a34';ctx.fillRect(0,GROUND_Y+2,GW,2);}
  else{ctx.fillStyle='#4a4018';ctx.fillRect(0,GROUND_Y,GW,2);ctx.fillStyle='#382e10';ctx.fillRect(0,GROUND_Y+2,GW,2);}
  // 区域标签（屏幕固定，显示当前区域名）
  ctx.save();ctx.globalAlpha=.5;ctx.font='bold 13px Microsoft YaHei UI,sans-serif';ctx.textAlign='right';
  let zoneLabel='🏰 家园据点';
  if(cameraX>1400)zoneLabel='🏚️ 旧小镇';
  else if(cameraX>600)zoneLabel='⚔️ 战场';
  ctx.fillStyle=cameraX>1400?'#aaa':cameraX>600?'#cc7755':'#d2b48c';
  ctx.fillText(zoneLabel,GW-12,GROUND_Y-6);
  ctx.restore();
}

// 世界景物层（世界坐标，随相机 translate 滚动；含视差）
function drawWorldScenery(t){
  // 远树（视差 ×0.5）
  ctx.fillStyle='#060a04';
  const lo=-cameraX*0.5;
  bgTrees.forEach(tr=>{
    const sx=tr.x-lo;
    if(tr.x-cameraX*0.5<-40||tr.x-cameraX*0.5>GW+40)return;
    ctx.beginPath();ctx.moveTo(sx,GROUND_Y-tr.h);ctx.lineTo(sx-tr.w*.7,GROUND_Y-tr.h*.35);ctx.lineTo(sx-tr.w*.45,GROUND_Y-tr.h*.4);ctx.lineTo(sx-tr.w*.55,GROUND_Y-tr.h*.15);ctx.lineTo(sx+tr.w*.55,GROUND_Y-tr.h*.15);ctx.lineTo(sx+tr.w*.45,GROUND_Y-tr.h*.4);ctx.lineTo(sx+tr.w*.7,GROUND_Y-tr.h*.35);ctx.closePath();ctx.fill();
    ctx.fillRect(sx-2,GROUND_Y-tr.h*.18,4,tr.h*.18);
  });
  // 中树（视差 ×0.75）
  ctx.fillStyle='#040802';
  const mo=-cameraX*0.25;
  midTrees.forEach(tr=>{
    const sx=tr.x-mo;
    if(tr.x-cameraX*0.75<-40||tr.x-cameraX*0.75>GW+40)return;
    ctx.beginPath();ctx.moveTo(sx,GROUND_Y-tr.h);ctx.lineTo(sx-tr.w*.7,GROUND_Y-tr.h*.3);ctx.lineTo(sx-tr.w*.5,GROUND_Y-tr.h*.35);ctx.lineTo(sx-tr.w*.62,GROUND_Y-tr.h*.12);ctx.lineTo(sx+tr.w*.62,GROUND_Y-tr.h*.12);ctx.lineTo(sx+tr.w*.5,GROUND_Y-tr.h*.35);ctx.lineTo(sx+tr.w*.7,GROUND_Y-tr.h*.3);ctx.closePath();ctx.fill();
    ctx.fillRect(sx-3,GROUND_Y-tr.h*.14,6,tr.h*.14);
  });
  // ── 美术升级：战场地面残骸 decals（碎骨/弹壳/血渍，程序化散布，替代原道路）──
  {
    // 用坐标哈希做固定随机（同一位置每帧渲染一致，不闪烁）
    const hash = n => { const s=Math.sin(n*127.1)*43758.5453; return s-Math.floor(s); };
    const decalStart = RIGHT_WALL_X + 30, decalEnd = WORLD_W - 20;
    const decalStep = 47;
    for(let dx = decalStart; dx < decalEnd; dx += decalStep){
      const h1 = hash(dx), h2 = hash(dx*1.3), h3 = hash(dx*2.7);
      const jitterX = dx + (h1-0.5)*30;
      const sx2 = jitterX - cameraX;
      if(sx2 < -20 || sx2 > GW+20) continue;
      const gy2 = GROUND_Y - 2 - h2*4;
      const kind = h3;
      if(kind < 0.4){
        // 血渍（暗红斑，椭圆）
        ctx.fillStyle=`rgba(${90+h1*30},${8+h2*10},${8+h2*10},${.28+h1*.2})`;
        ctx.beginPath();ctx.ellipse(sx2, gy2+2, 5+h1*7, 2+h2*2, 0, 0, Math.PI*2);ctx.fill();
        // 溅点
        ctx.fillStyle='rgba(110,14,14,.3)';
        ctx.beginPath();ctx.arc(sx2+7+h1*6, gy2+1, 1.2, 0, Math.PI*2);ctx.fill();
      }else if(kind < 0.7){
        // 碎骨（白色小段，两三节）
        ctx.fillStyle='rgba(220,210,190,.55)';
        ctx.fillRect(sx2, gy2, 4+h1*3, 1.5);
        ctx.save();ctx.translate(sx2+6,gy2+2);ctx.rotate(0.5+h2);ctx.fillRect(0,0,3,1.2);ctx.restore();
        ctx.fillStyle='rgba(180,170,150,.4)';
        ctx.beginPath();ctx.arc(sx2+2, gy2-1, 1.5, 0, Math.PI*2);ctx.fill();
      }else{
        // 弹壳（铜色小筒散落）
        ctx.fillStyle='rgba(190,150,60,.6)';
        for(let ci=0; ci<3; ci++){
          ctx.save();
          ctx.translate(sx2+ci*4, gy2+(ci%2)*2);
          ctx.rotate(h1*6.28 + ci);
          ctx.fillRect(-2, -0.7, 4, 1.4);
          ctx.restore();
        }
        ctx.fillStyle='rgba(255,200,90,.35)';
        ctx.fillRect(sx2+2, gy2, 1.5, 1);
      }
    }
  }
  // 地面裂纹（世界坐标，无视差）
  ctx.strokeStyle='#0a0904';ctx.lineWidth=1.5;
  cracks.forEach(c=>{const sx=c.x;if(c.x-cameraX<-30||c.x-cameraX>GW+30)return;ctx.beginPath();ctx.moveTo(sx,GROUND_Y+4);ctx.lineTo(sx+c.w*.4,GROUND_Y+10);ctx.lineTo(sx+c.w,GROUND_Y+6);ctx.stroke();});
  // 草丛
  grassTufts.forEach(g=>{
    const screenX=g.x-cameraX;if(screenX<-10||screenX>GW+10)return;
    const sx=g.x;
    const sw=Math.sin(t*.001+g.j*10)*.8;
    ctx.strokeStyle='#2a3a12';ctx.lineWidth=1.2;
    for(let j=-1;j<=1;j+=2){ctx.beginPath();ctx.moveTo(sx+j*2,GROUND_Y);ctx.quadraticCurveTo(sx+j*3+sw,GROUND_Y-g.h*.6,sx+j*4+sw,GROUND_Y-g.h);ctx.stroke();}
    ctx.strokeStyle='#344a16';ctx.beginPath();ctx.moveTo(sx,GROUND_Y);ctx.quadraticCurveTo(sx+sw*.5,GROUND_Y-g.h*.5,sx+sw,GROUND_Y-g.h);ctx.stroke();
  });
  // 旧小镇入口路标（x=1640，战场与旧小镇分界）
  const signX=1640;
  if(signX-cameraX>-40&&signX-cameraX<GW+40){
    const sx=signX-cameraX;
    ctx.save();
    // 木桩
    ctx.fillStyle='#3a2a18';ctx.fillRect(sx-3,GROUND_Y-60,6,60);
    ctx.fillStyle='#5a4028';ctx.fillRect(sx-2,GROUND_Y-60,2,60);
    // 路牌
    ctx.fillStyle='#2a1a08';ctx.fillRect(sx-30,GROUND_Y-75,60,18);
    ctx.strokeStyle='#8a6028';ctx.lineWidth=1.5;ctx.strokeRect(sx-30,GROUND_Y-75,60,18);
    // 文字
    ctx.fillStyle='#d2a050';ctx.font='bold 8px Microsoft YaHei UI,sans-serif';ctx.textAlign='center';
    ctx.fillText('← 旧小镇',sx,GROUND_Y-63);
    ctx.fillText('战场 →',sx,GROUND_Y-55);
    ctx.restore();
  }
  // 旧小镇入口的残破铁丝网围栏（x=1660-1680）
  const fenceX=1660;
  if(fenceX-cameraX>-60&&fenceX-cameraX<GW+60){
    const sx=fenceX-cameraX;
    ctx.save();
    ctx.strokeStyle='#3a3a3a';ctx.lineWidth=1;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(sx+i*6,GROUND_Y);ctx.lineTo(sx+i*6,GROUND_Y-30);ctx.stroke();}
    for(let y=0;y<3;y++){ctx.beginPath();ctx.moveTo(sx,GROUND_Y-10-y*10);ctx.lineTo(sx+18,GROUND_Y-10-y*10);ctx.stroke();}
    ctx.restore();
  }
  // 旧小镇废墟装饰（x=1700+ 的碎石/倒塌路灯/废弃车辆）
  if(cameraX+GW>1700){
    // 倒塌路灯已彻底移除
    // 碎石堆
    [1700,1850,1960,2100,2230,2360].forEach(rx=>{
      if(rx-cameraX<-30||rx-cameraX>GW+30)return;
      const sx=rx-cameraX;
      ctx.save();
      ctx.fillStyle='#252528';
      ctx.beginPath();ctx.moveTo(sx-8,GROUND_Y);ctx.lineTo(sx-5,GROUND_Y-5);ctx.lineTo(sx,GROUND_Y-7);ctx.lineTo(sx+6,GROUND_Y-4);ctx.lineTo(sx+9,GROUND_Y);ctx.closePath();ctx.fill();
      ctx.fillStyle='#353538';ctx.fillRect(sx-3,GROUND_Y-4,3,2);ctx.fillRect(sx+2,GROUND_Y-5,2,2);
      ctx.restore();
    });
  }
}

// ═══════════════════════════════════════════

//  PLAYER SPRITE
// ═══════════════════════════════════════════
// 主角配色：橄榄绿夹克 + 暖橙围巾（和界面强调色同一个橙），夜景里剪影也认得出
const HERO = {
  line:'#0e1116',
  jacket:'#6e7f4c', jacketShade:'#566339', jacketLight:'#8a9b63',
  pants:'#4b5563', pantsShade:'#39414c',
  boot:'#2d2622', sole:'#15110f',
  scarf:'#e8743b', scarfShade:'#c45a28',
  skin:'#f3cba5', skinShade:'#dba982',
  hair:'#2b1f1a', hairLight:'#4a382c',
  glove:'#3b3329', pack:'#8a6a45', packShade:'#6d522f',
};
// 路径：圆角矩形（不依赖 ctx.roundRect）
function heroRR(x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
// 一块带描边的色块
function heroPart(fill,x,y,w,h,r){ heroRR(x,y,w,h,r); ctx.fillStyle=fill; ctx.fill(); ctx.stroke(); }
function heroDisc(fill,x,y,r){ ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.stroke(); }

function drawPlayer(px,py,facingR,walkT,aimA,jumping,hurtFlash,t,dodge){
  ctx.save();
  ctx.translate(px+CHAR_W/2,py+CHAR_H);
  if(!facingR)ctx.scale(-1,1);
  if(hurtFlash&&Math.floor(t/80)%2===0)ctx.globalAlpha=.25;

  // 脚下阴影（先画，翻滚时留在地面上）
  const shadowS=jumping?Math.max(.2,1-(CHAR_GY-py)/150):1;
  ctx.save();ctx.globalAlpha*=.3*shadowS;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(0,0,14*shadowS,3.6*shadowS,0,0,Math.PI*2);ctx.fill();ctx.restore();

  // 翻滚：绕身体中心滚一圈并压扁
  if(dodge>0){
    const dp=dodge/20;
    ctx.translate(0,-CHAR_H/2);
    ctx.rotate((1-dp)*Math.PI*2*(facingR?1:-1));
    ctx.scale(1,0.65+dp*0.35);
    ctx.translate(0,CHAR_H/2);
    if(t%2===0){
      mkP({x:px+CHAR_W/2,y:py+CHAR_H/2,vx:(facingR?-1:1)*(Math.random()*1.5),vy:-Math.random()*1.5,r:2+Math.random()*1.5,rDecay:.05,decay:.05,color:'rgba(240,240,240,.4)',type:'circle',grav:.05,alpha:.5,blur:true});
    }
  }
  ctx.translate(0,-CHAR_H);

  // 跑动：整体前倾 + 随步伐上下起伏
  const sw=jumping?0:Math.sin(walkT*Math.PI*2);
  const running=!jumping&&dodge<=0;
  if(running){
    ctx.save();
    ctx.translate(0,CHAR_H);ctx.rotate(0.07+sw*0.015);ctx.translate(0,-CHAR_H);
    ctx.translate(0,Math.abs(sw)*1.3);
  }
  // 后坐力：身体微微后仰
  if(shootRecoil*0.4>0.3&&dodge<=0) ctx.translate(-shootRecoil*0.14,0);

  ctx.strokeStyle=HERO.line;ctx.lineWidth=1.4;ctx.lineJoin='round';ctx.lineCap='round';

  // ── 背包（躯干身后）──
  heroPart(HERO.packShade,-14,25,9,16,3);
  ctx.fillStyle=HERO.pack;ctx.fillRect(-13,26,3,10);

  // ── 后臂（自然摆动，压在身后）──
  const freeA=jumping?-32:-sw*30;
  ctx.save();ctx.translate(-6.5,26.5);ctx.rotate(freeA*Math.PI/180);
  heroPart(HERO.jacketShade,-2.5,-1.8,5,12,2.4);
  heroDisc(HERO.skinShade,0,11.8,2.4);
  ctx.restore();

  // ── 双腿 ──
  function leg(ox,a,shade){
    ctx.save();ctx.translate(ox,46);ctx.rotate(a*Math.PI/180);
    heroPart(shade?HERO.pantsShade:HERO.pants,-3.2,-1,6.4,14,2.2);
    heroPart(HERO.boot,-3.6,11.4,9.2,6.6,2.6);
    ctx.fillStyle=HERO.sole;ctx.fillRect(-3.2,16.6,8.4,1.2);
    ctx.restore();
  }
  const legA=jumping?0:sw*26;
  if(jumping){ leg(-3,-24,true); leg(3.5,20,false); }
  else{ leg(-3,-legA,true); leg(3.5,legA,false); }

  // ── 躯干：夹克 + 腰带 ──
  heroPart(HERO.jacket,-8.5,23,17,23.5,4.6);
  ctx.fillStyle=HERO.jacketLight;heroRR(-7,24.2,6.5,3,1.5);ctx.fill();            // 肩部受光
  ctx.fillStyle=HERO.jacketShade;heroRR(-6.2,28.6,5.6,4.4,1.2);ctx.fill();        // 胸袋
  ctx.strokeStyle=HERO.jacketShade;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2.4,26);ctx.lineTo(2.4,40);ctx.stroke(); // 拉链
  ctx.strokeStyle=HERO.line;ctx.lineWidth=1.4;
  ctx.fillStyle=HERO.boot;ctx.fillRect(-8,40.2,16,3.6);                            // 腰带
  ctx.fillStyle='#d7b45a';ctx.fillRect(1,40.6,3.8,2.8);                            // 带扣

  // ── 围巾：飘带 + 绕颈一圈 ──
  const flap=Math.sin(t*0.012)*1.4+(jumping?-2.5:0)+sw*1.1;
  ctx.beginPath();
  ctx.moveTo(-5,22.5);ctx.quadraticCurveTo(-10,22.5+flap,-16,25+flap*2);
  ctx.lineTo(-14,30+flap*2);ctx.quadraticCurveTo(-9,27+flap,-3,26.5);ctx.closePath();
  ctx.fillStyle=HERO.scarfShade;ctx.fill();ctx.stroke();
  heroPart(HERO.scarf,-7.6,20.6,15,6,3);

  // ── 头：大头比例 ──
  // 后脑发
  ctx.beginPath();ctx.ellipse(-5.2,10,4.6,6.6,0,0,Math.PI*2);ctx.fillStyle=HERO.hair;ctx.fill();ctx.stroke();
  heroDisc(HERO.skin,0.5,11.5,9);
  heroDisc(HERO.skinShade,-5.6,13.2,1.9);   // 耳
  // 刘海 / 头发
  ctx.beginPath();
  ctx.moveTo(-8.4,10.6);
  ctx.quadraticCurveTo(-9.6,0.6,0.6,0.8);
  ctx.quadraticCurveTo(10.6,0.8,9.4,10.4);
  ctx.lineTo(8.2,7.8);ctx.lineTo(5.6,10.2);ctx.lineTo(3.4,7);ctx.lineTo(0.6,9.8);ctx.lineTo(-2.2,6.8);ctx.lineTo(-5,9.4);ctx.lineTo(-7,7.6);
  ctx.closePath();
  ctx.fillStyle=HERO.hair;ctx.fill();ctx.stroke();
  ctx.strokeStyle=HERO.hairLight;ctx.lineWidth=0.9;
  ctx.beginPath();ctx.moveTo(-3,3.6);ctx.quadraticCurveTo(1,1.8,5,4);ctx.stroke();
  ctx.strokeStyle=HERO.line;ctx.lineWidth=1.4;
  // 脸：眼睛 / 眉 / 嘴 / 腮红
  const squint=(shootRecoil>2);
  ctx.fillStyle='#1b1f27';
  if(squint){
    ctx.fillRect(-2,12.2,2.6,1.2);ctx.fillRect(3.6,12.2,2.6,1.2);
  }else{
    ctx.beginPath();ctx.ellipse(-0.7,12.6,1.3,1.9,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(4.9,12.6,1.3,1.9,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.fillRect(-0.2,11.3,0.7,0.7);ctx.fillRect(5.4,11.3,0.7,0.7);
  }
  ctx.strokeStyle='#3a2a22';ctx.lineWidth=0.9;
  ctx.beginPath();ctx.moveTo(-2.6,9.9);ctx.lineTo(0.8,9.4);ctx.moveTo(3.4,9.4);ctx.lineTo(6.8,9.9);ctx.stroke();
  ctx.strokeStyle='#a8654a';ctx.lineWidth=0.9;
  ctx.beginPath();ctx.arc(2.9,15.6,1.7,0.2*Math.PI,0.8*Math.PI);ctx.stroke();
  ctx.fillStyle='rgba(232,116,59,.28)';ctx.beginPath();ctx.arc(6.8,15.2,1.8,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=HERO.line;ctx.lineWidth=1.4;

  // ── 流派装扮（和头/躯干同一套比例）──
  if(playerClass){
    const pcId=playerClass.id;
    if(pcId==='marksman'){
      // 单边蓝色目镜
      ctx.fillStyle='#222a36';ctx.fillRect(-8.6,10.4,18,3);
      heroPart('#59b6ff',2.2,9.6,6.6,5,1.6);
      ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillRect(3.4,10.6,1.8,1);
    }else if(pcId==='berserker'){
      // 红额带 + 飘带
      ctx.fillStyle='#e63946';ctx.fillRect(-8.8,4.8,18.6,2.8);ctx.strokeRect(-8.8,4.8,18.6,2.8);
      ctx.beginPath();ctx.moveTo(-8,5.6);
      ctx.quadraticCurveTo(-13,3.6-Math.sin(t*0.01)*2,-17,8.4);ctx.lineTo(-14,9);
      ctx.quadraticCurveTo(-11,6.8,-7.6,7.4);ctx.closePath();ctx.fillStyle='#e63946';ctx.fill();ctx.stroke();
    }else if(pcId==='demolition'){
      // 斜挎弹带 + 耳罩
      ctx.save();ctx.strokeStyle=HERO.line;ctx.lineWidth=4.6;ctx.beginPath();ctx.moveTo(-7.4,25);ctx.lineTo(7.4,42);ctx.stroke();
      ctx.strokeStyle='#f08a2e';ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(-7.4,25);ctx.lineTo(7.4,42);ctx.stroke();
      ctx.fillStyle=HERO.line;for(let k=0;k<4;k++){ctx.fillRect(-4.6+k*3.6,28+k*4.1,1.8,2.8);}
      ctx.restore();
      heroDisc('#1f2937',-6.4,13,3);
    }else if(pcId==='beastmaster'){
      // 毛领 + 狼牙吊坠
      ctx.beginPath();ctx.ellipse(0,24,9.8,3.6,0,0,Math.PI*2);ctx.fillStyle='#ddd6c6';ctx.fill();ctx.stroke();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(-1.2,27);ctx.lineTo(1.2,27);ctx.lineTo(0,31.4);ctx.closePath();ctx.fill();ctx.stroke();
    }else if(pcId==='warden'){
      // 前肩护甲
      heroPart('#7b8798',3,22.4,10,6.4,2.6);
      ctx.fillStyle='#e0b84a';ctx.fillRect(4,23,8,1.6);
    }else if(pcId==='chef'){
      // 围裙 + 厨师帽
      heroPart('#f1efe8',-7.4,31,14.8,14,2.2);
      ctx.fillStyle='#e5594f';ctx.fillRect(-7,31.6,14,2);
      heroPart('#fbfaf6',-6.6,-4.6,13.4,6.4,3);
      heroDisc('#fbfaf6',-3,-6,3.6);heroDisc('#fbfaf6',3.8,-6.4,3.8);
    }
  }

  // ── 持枪手臂与枪械瞄准 ──
  const clampA=Math.max(-1.1,Math.min(1.1,aimA));
  function reloadAnim(){
    if(reloadAnimT<=0)return {tilt:0,dipY:0,handX:0,handY:0,cock:0,show:false};
    const prog=100-reloadAnimT;
    let tilt=0,dipY=0,handX=0,handY=0,cock=0;
    if(prog<15){ const t=prog/15; tilt=t*0.5; dipY=t*2.5; handY=t*1.5; }
    else if(prog<40){ tilt=0.5; dipY=2.5; handY=1.5; handX=Math.sin((prog-15)*0.5)*1.2; }
    else if(prog<60){ const t=(prog-40)/20; tilt=0.5*(1-t)+0.06*t; dipY=2.5*(1-t); handY=1.5*(1-t); }
    else if(prog<88){ const t=(prog-60)/28; const c=Math.sin(t*Math.PI); tilt=0.06+c*0.18; cock=c; handX=-c*1.8; }
    else{ const t=(prog-88)/12; tilt=0.06*(1-t); cock=(1-t)*0.1; }
    return {tilt,dipY,handX,handY,cock,show:true};
  }
  const ra=reloadAnim();
  const recoilOffset=shootRecoil*0.7;
  ctx.save();
  ctx.translate(8.6-recoilOffset+ra.handX, 26.4+ra.dipY+ra.handY);
  ctx.rotate(clampA+ra.tilt);
  heroPart(HERO.jacket,-2.6,-2.8,9.8,5.6,2.7);          // 袖子
  ctx.translate(8,1);
  drawGunSprite(ctx,WEAPONS[curWpnIdx].id);

  // 握枪的手
  {
    const cw2=WEAPONS[curWpnIdx];
    const isMelee=cw2.meleeWeapon||cw2.id==='warhorn';
    const hx=isMelee?2:4, hy=isMelee?3:4;
    ctx.strokeStyle=HERO.line;ctx.lineWidth=1.3;
    heroDisc(HERO.skin,hx,hy+0.6,2.7);
  }

  // 射击抛壳
  if(shootRecoil>5 && WEAPONS[curWpnIdx].id!=='minigun' && !WEAPONS[curWpnIdx].meleeWeapon && Math.random()>.6){
    const px2=player.x+(player.facingRight?CHAR_W*.6:CHAR_W*.4), py2=player.y+26;
    const shellDir=player.facingRight?-1:1;
    mkP({x:px2,y:py2,vx:shellDir*(1+Math.random()*1.2),vy:-1.8-Math.random()*1.2,r:1,rDecay:.04,decay:.025,color:'#f3cc66',type:'shard',angle:Math.random()*Math.PI,spin:.25,grav:.28,alpha:1});
  }

  // 枪口火光
  if(muzzleFlashT>0){
    const mf=muzzleFlashT/8;
    ctx.save();ctx.translate(18,0);ctx.globalAlpha=mf;
    ctx.fillStyle='#fff6c8';ctx.beginPath();ctx.arc(0,0,5*mf+1.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f2a65a';ctx.beginPath();ctx.arc(0,0,8*mf+2,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 换弹进度条（头顶）
  if(ra.show){
    const prog=100-reloadAnimT;
    ctx.save();
    ctx.fillStyle='rgba(14,17,22,.85)';heroRR(-14,-13,28,5,2.5);ctx.fill();
    ctx.fillStyle='#f2a65a';heroRR(-13,-12,26*(prog/100),3,1.5);ctx.fill();
    ctx.restore();
  }

  if(running){ctx.restore();}
  ctx.restore();
}

function drawGunSprite(c,wid){
  c.save();
  const minigunDef=typeof WEAPONS!=='undefined'?WEAPONS.find(w=>w.id==='minigun'):null;
  const heat=minigunDef&&wid==='minigun'?(minigunDef.heat||0)/100:0;
  // ── v52美术升级A：稀有度光晕层——握持的武器按稀有度散发微光 ──
  // 普通=无光晕（本色），稀有=冷蓝微光，史诗=紫辉，传说=橙金炽光
  {
    const wdef=typeof WEAPONS!=='undefined'?WEAPONS.find(w=>w.id===wid):null;
    if(wdef){
      const rr=WEAPON_RARITY[wdef.rarity];
      if(rr){
        const pulse=.5+.3*Math.sin(Date.now()*.004);
        const strength=wdef.rarity==='common'?0:wdef.rarity==='rare'?.35:wdef.rarity==='epic'?.55:.75;
        if(strength>0){
          c.shadowBlur=8*strength*pulse+3;c.shadowColor=rr.glow||rr.color;
          c.fillStyle=rr.color;c.fillRect(8,-1,2,2);  // 光晕锚点（借fill把shadow渲染出来）
          c.shadowBlur=0;
        }
      }
    }
  }
  switch(wid){
    case'pistol':
      // v52重绘：滑套分节缝+枪管内衬+握把防滑纹+准星
      c.fillStyle='#4a4a4a';c.fillRect(0,-3.5,13,7);                    // 滑套
      c.fillStyle='#5a5a5a';c.fillRect(1,-3,11,2);                       // 滑套上平面（受光）
      c.fillStyle='#333';c.fillRect(3.5,-3.5,.8,7);c.fillRect(9,-3.5,.8,7); // 分节缝
      c.fillStyle='#2a2a2a';c.fillRect(13,-1.5,5,3);                     // 枪口部
      c.fillStyle='#111';c.fillRect(16.5,-1,2,2);                        // 膛口
      c.fillStyle='#3a2e1e';c.fillRect(1.5,2.5,5,6);                     // 握把
      c.fillStyle='#2c2214';for(let k=0;k<3;k++)c.fillRect(2,3.4+k*1.6,4.2,.7); // 防滑纹
      c.fillStyle='#777';c.fillRect(0,-4.5,1.5,1);c.fillRect(13.5,-4.5,1.5,1); // 前/后准星
      c.fillStyle='#666';c.fillRect(6,.5,3,1.5);                         // 扳机护圈前
      break;
    case'shotgun':
      // v52重绘：双管并排+木纹渐变枪托+喉缩
      c.fillStyle='#5a3a1e';c.fillRect(-3,-3,11,6);                      // 枪托（木色渐变）
      c.fillStyle='#6a4a28';c.fillRect(-3,-3,11,2);                      // 受光面
      c.fillStyle='#3a2412';c.fillRect(7,-2,3,4);                        // 托机匣
      c.fillStyle='#4a4a4a';c.fillRect(10,-2.6,13,2.4);                  // 上管
      c.fillStyle='#3d3d3d';c.fillRect(10,.2,13,2.4);                   // 下管
      c.fillStyle='#666';c.fillRect(12,-2.6,9,.8);c.fillRect(12,.2,9,.8); // 管面高光
      c.fillStyle='#8a8a8a';c.fillRect(23,-2.4,4,4.8);                   // 喉缩套
      c.fillStyle='#2a2a2a';c.fillRect(26.5,-2,1.5,4);                   // 膛口
      c.fillStyle='#333';c.fillRect(1,2,3,4);                           // 前握把
      break;
    case'smg': // 冲锋枪：紧凑短管
      // v52重绘：机匣拉机柄+侧折托+散热孔
      c.fillStyle='#343434';c.fillRect(-2,-2.5,12,5);                     // 机匣
      c.fillStyle='#484848';c.fillRect(-2,-2.5,12,1.5);                  // 上平面
      c.fillStyle='#222';for(let k=0;k<3;k++)c.fillRect(2+k*3,.2,1.4,1.4); // 散热孔
      c.fillStyle='#5c5c5c';c.fillRect(10,-1,9,3);                       // 枪管
      c.fillStyle='#666';c.fillRect(11,-1,7,.8);                         // 管面光
      c.fillStyle='#1c1c1c';c.fillRect(2,2.5,6,5);                       // 直弹匣
      c.fillStyle='#2e2e2e';c.fillRect(2,2.5,6,1);                       // 匣顶受光
      c.fillStyle='#444';c.fillRect(-4,-1.5,4,3);                        // 侧折托
      c.fillStyle='#777';c.fillRect(3,-3.8,2,1.2);                       // 准星柱
      break;
    case'crossbow': // 十字弩
      // v52重绘：弓臂+弩弦+箭槽+瞄具
      c.fillStyle='#5a3a20';c.fillRect(-2,-2,16,4);                      // 弩身
      c.fillStyle='#6e4a28';c.fillRect(-2,-2,16,1.2);                   // 身上受光
      c.strokeStyle='#8a6a3a';c.lineWidth=1.6;                            // 弓臂（曲线上扬）
      c.beginPath();c.moveTo(8,-1);c.quadraticCurveTo(14,-9,18,-11);c.stroke();
      c.beginPath();c.moveTo(8,1);c.quadraticCurveTo(14,7,18,9);c.stroke();
      c.strokeStyle='#ccc';c.lineWidth=.7;                                // 弩弦（张紧）
      c.beginPath();c.moveTo(18,-11);c.quadraticCurveTo(9,-2,18,9);c.stroke();
      c.fillStyle='#3a2a1a';c.fillRect(10,-.7,14,1.4);                   // 箭槽轨道
      c.fillStyle='#9aa';c.beginPath();c.moveTo(24,-1.2);c.lineTo(29,0);c.lineTo(24,1.2);c.closePath();c.fill(); // 待发箭头
      c.fillStyle='#2c1e10';c.fillRect(0,2,6,4);                         // 握把
      break;
    case'smg_heavy': // 重型冲锋枪
      // v52重绘：加重机匣+鼓型弹匣+握把防滑
      c.fillStyle='#262626';c.fillRect(-3,-3.2,16,6.4);                   // 加重机匣
      c.fillStyle='#3a3a3a';c.fillRect(-3,-3.2,16,1.8);                  // 受光
      c.fillStyle='#141414';for(let k=0;k<4;k++)c.fillRect(1+k*3.4,.4,1.8,1.6); // 大散热孔
      c.fillStyle='#585858';c.fillRect(13,-2,11,4);                       // 重枪管
      c.fillStyle='#6e6e6e';c.fillRect(14,-2,9,1);                       // 管高光
      c.fillStyle='#8a8a8a';c.fillRect(24,-1.4,4,2.8);                   // 消焰器
      c.fillStyle='#1a1a1a';c.beginPath();c.arc(4,7,5.5,Math.PI,Math.PI*2);c.fill(); // 下挂鼓匣
      c.fillStyle='#2e2e2e';c.fillRect(-1.5,2.5,11,4.5);                 // 鼓匣基座
      c.fillStyle='#3f3f3f';c.fillRect(-4,-2,4,5);                       // 后托
      break;
    case'sniper': // 狙击枪：长管
      // v52重绘：两脚架+大型瞄镜+枪口制退器+托腮板
      c.fillStyle='#2e4030';c.fillRect(-3,-2.5,14,5);                     // 枪托
      c.fillStyle='#3a503c';c.fillRect(-3,-2.5,14,1.5);                  // 托受光
      c.fillStyle='#24361f';c.fillRect(9,-3.2,9,6.4);                    // 机匣
      c.strokeStyle='#1c2c18';c.lineWidth=1;                              // 托腮板线
      c.beginPath();c.moveTo(-2,-1);c.lineTo(9,-1);c.stroke();
      c.fillStyle='#484848';c.fillRect(17,-1.8,17,3.6);                   // 长枪管
      c.fillStyle='#5c5c5c';c.fillRect(18,-1.8,15,1);                    // 管高光
      c.fillStyle='#333';c.fillRect(33,-2.6,4,5.2);                      // 枪口制退器
      c.fillStyle='#222';c.fillRect(34,-2.2,2.4,1.8);c.fillRect(34,.4,2.4,1.8); // 制退孔
      c.fillStyle='#1a2a1a';c.fillRect(6,-6,10,3);                       // 瞄镜座
      c.fillStyle='#2c4430';c.fillRect(7,-7.5,9,2);                       // 瞄镜本体
      c.fillStyle='#88cc88';c.fillRect(15,-7,2,1);                       // 镜片（微光）
      c.strokeStyle='#445544';c.lineWidth=.8;                             // 两脚架
      c.beginPath();c.moveTo(20,1.8);c.lineTo(22,7);c.moveTo(23,1.8);c.lineTo(21,7);c.stroke();
      c.fillStyle='#20301c';c.fillRect(1,2.5,6,4.5);                     // 握把
      break;
    case'flame': // 喷火器
      // v52重绘：双压力罐+点火线圈+歧管
      c.fillStyle='#5a3818';c.fillRect(-3,-3.5,13,7);                     // 机匣
      c.fillStyle='#6e441e';c.fillRect(-3,-3.5,13,2);                    // 受光
      c.fillStyle='#7a5a30';c.fillRect(10,-2,13,4);                       // 喷管
      c.fillStyle='#8a6a3a';c.fillRect(11,-2,11,1);                       // 管光
      const ft2=Date.now();
      c.fillStyle=`rgba(255,${100+Math.sin(ft2*.02)*60|0},0,0.85)`;
      c.beginPath();c.arc(25,0,4+Math.sin(ft2*.03)*2,0,Math.PI*2);c.fill(); // 喷口常燃火苗
      c.fillStyle='#ffdd66';c.beginPath();c.arc(25,0,1.6+Math.sin(ft2*.05)*.6,0,Math.PI*2);c.fill(); // 火芯
      c.fillStyle='#33441e';c.beginPath();c.arc(-5,6,5,0,Math.PI*2);c.fill(); // 后压力罐（绿）
      c.fillStyle='#44552c';c.beginPath();c.arc(-5,6,5,Math.PI*1.1,Math.PI*1.9);c.fill(); // 罐受光
      c.fillStyle='#553311';c.beginPath();c.arc(2,7,4.5,0,Math.PI*2);c.fill(); // 前燃料罐
      c.strokeStyle='#777';c.lineWidth=1;                                 // 点火线圈
      c.beginPath();c.moveTo(20,-3);c.lineTo(23,-1);c.stroke();
      c.fillStyle='#ff4400';c.fillRect(22,-3.4,1.4,1.4);                 // 点火指示灯
      break;
    case'tesla': // 特斯拉：电蓝色线圈
      // v52重绘：双极线圈塔+电容罐+电弧
      c.fillStyle='#1e2a44';c.fillRect(-2,-3.5,15,7);                     // 深蓝机匣
      c.fillStyle='#2c3c5c';c.fillRect(-2,-3.5,15,2);                     // 受光
      c.fillStyle='#3a4a6a';c.fillRect(13,-2,11,4);                       // 枪管基座
      c.fillStyle='#00ccff';c.shadowBlur=6;c.shadowColor='#00ccff';
      c.beginPath();c.arc(7,0,3.2,0,Math.PI*2);c.fill();                  // 主线圈（发光）
      c.strokeStyle='#66eaff';c.lineWidth=1;                              // 线圈匝
      for(let k=0;k<3;k++){c.beginPath();c.arc(7,0,3.2,-.5+k*.5,.1+k*.5);c.stroke();}
      c.shadowBlur=0;
      const arcT=Date.now()*.02;                                          // 电弧（爬行）
      c.strokeStyle=`rgba(140,240,255,${.4+.4*Math.sin(arcT)})`;c.lineWidth=.8;
      c.beginPath();c.moveTo(10,-1);c.lineTo(14,1);c.lineTo(18,-2);c.lineTo(22,.5);c.stroke();
      c.fillStyle='#0a2838';c.fillRect(0,2.5,9,3.5);                      // 握把
      c.fillStyle='#132';c.beginPath();c.arc(3,8,3.8,0,Math.PI*2);c.fill(); // 下挂电容罐
      c.fillStyle='#1a4a5a';c.beginPath();c.arc(3,8,3.8,Math.PI*1.1,Math.PI*1.9);c.fill();
      c.fillStyle='#00e0ff';c.fillRect(2.2,7.2,1.6,1.6);                 // 罐指示灯
      break;
    case'railgun': // 电磁炮
      // v52重绘：双轨+绝缘子+充能腔
      c.fillStyle='#2c3444';c.fillRect(-2,-4.5,18,9);                     // 机匣
      c.fillStyle='#3c4a5c';c.fillRect(-2,-4.5,18,2.4);                  // 受光
      const railHue=(Date.now()*.3)%360;
      c.fillStyle=`hsl(${railHue},80%,60%)`;c.fillRect(0,-2.2,14,1.4);   // 上导轨（色循环能量）
      c.fillRect(0,.8,14,1.4);                                             // 下导轨
      c.fillStyle='#00384a';c.fillRect(0,-0.6,14,1.2);                    // 中绝缘槽
      c.fillStyle='#00ddff';c.shadowBlur=7;c.shadowColor='#00ddff';
      c.fillRect(14,-1.5,8,3);c.shadowBlur=0;                              // 加速器出口（青光）
      c.fillStyle='#0a2a3a';c.fillRect(1,3.5,15,2.5);                    // 下护板
      c.fillStyle='#0d3a4a';c.fillRect(6,-6,6,1.8);                       // 顶部充能腔
      c.fillStyle=`rgba(0,255,255,${.4+.4*Math.sin(Date.now()*.008)})`;   // 腔内能量呼吸
      c.fillRect(7,-5.7,4,1.2);
      c.fillStyle='#1a2230';c.fillRect(0,3,7,3);                         // 握把
      break;
    case'grenade': // 手榴弹投掷器
      // v52重绘：杯状发射筒+待发弹+握把保险栓
      c.fillStyle='#3e4a2c';c.fillRect(-2,-3,13,6);                      // 机匣（军绿）
      c.fillStyle='#4e5c38';c.fillRect(-2,-3,13,1.6);                     // 受光
      c.fillStyle='#2e3a20';c.beginPath();c.moveTo(11,-3);c.lineTo(19,-4);c.lineTo(19,4);c.lineTo(11,3);c.closePath();c.fill(); // 杯状发射筒
      c.fillStyle='#44552e';c.fillRect(12,-3.4,6,1);                      // 筒沿
      c.fillStyle='#333';c.beginPath();c.arc(15.5,0,2.8,0,Math.PI*2);c.fill(); // 筒内待发弹（隐约）
      c.fillStyle='#556640';c.beginPath();c.moveTo(12,-4.6);c.quadraticCurveTo(12,-8,15,-8);c.strokeStyle='#556640';c.lineWidth=1;c.stroke(); // 提把保险栓
      c.fillStyle='#223014';c.fillRect(1,2.8,7,4);                        // 握把
      c.fillStyle='#c8d860';c.fillRect(17.5,-1.6,1.6,3.2);              // 高可见弹尾
      break;
    case'ice': // 冰冻枪：青白
      // v52重绘：结晶枪管+霜雾罐+冷凝呼吸
      c.fillStyle='#24405e';c.fillRect(-2,-3.2,14,6.4);                   // 机匣
      c.fillStyle='#34506e';c.fillRect(-2,-3.2,14,1.8);                  // 受光
      c.fillStyle='#5da3e0';c.fillRect(12,-2,11,4);                       // 枪管
      c.fillStyle='#8ec4ee';c.fillRect(13,-2,9,1);                        // 管高光
      c.fillStyle='#aaddff';c.fillRect(20,-1.6,5,3.2);                    // 结晶枪口（多面）
      c.strokeStyle='#e8f8ff';c.lineWidth=.7;
      c.beginPath();c.moveTo(21,-1.4);c.lineTo(24,0);c.lineTo(21,1.4);c.stroke(); // 晶面棱线
      c.fillStyle='#eef8ff';c.beginPath();c.arc(25,0,1.6+Math.sin(Date.now()*.012)*.8,0,Math.PI*2);c.fill(); // 冷气核心
      c.fillStyle='rgba(190,230,255,.25)';                                // 枪口霜雾（缓慢呼出）
      c.beginPath();c.arc(26+Math.sin(Date.now()*.003)*2,0,3.5,0,Math.PI*2);c.fill();
      c.fillStyle='#183650';c.fillRect(0,2.8,8,3.4);                     // 握把
      c.fillStyle='#0f4a6a';c.beginPath();c.arc(4,8,3.6,0,Math.PI*2);c.fill(); // 下挂霜罐
      c.fillStyle='#1a6a8a';c.beginPath();c.arc(4,8,3.6,Math.PI*1.1,Math.PI*1.9);c.fill();
      break;
    case'poison': // 毒液枪：绿色
      // v52重绘：毒液罐+滴液枪口+腐蚀纹理
      c.fillStyle='#22401a';c.fillRect(-2,-3.2,14,6.4);                   // 机匣
      c.fillStyle='#32582a';c.fillRect(-2,-3.2,14,1.8);                   // 受光
      c.fillStyle='#558833';c.fillRect(12,-2,10,4);                       // 枪管
      c.fillStyle='#79aa4d';c.fillRect(13,-2,8,1);                        // 管高光
      c.fillStyle=`rgba(120,255,60,${.5+.5*Math.sin(Date.now()*.01)})`;
      c.shadowBlur=6;c.shadowColor='#77ff44';
      c.beginPath();c.arc(23,0,2.4,0,Math.PI*2);c.fill();c.shadowBlur=0;  // 枪口毒液泡（呼吸）
      c.fillStyle='rgba(110,220,60,.5)';                                  // 泡下挂滴
      const dripT=(Date.now()*.0008)%1;
      c.beginPath();c.arc(23,2+dripT*5,1,0,Math.PI*2);c.fill();
      c.fillStyle='#2c5216';c.beginPath();c.arc(-4,7,4.2,0,Math.PI*2);c.fill(); // 下挂毒罐
      c.fillStyle='#3f7a22';c.beginPath();c.arc(-4,7,4.2,Math.PI*1.1,Math.PI*1.9);c.fill();
      c.strokeStyle='#2c5216';c.lineWidth=.8;                             // 罐刻度线
      c.beginPath();c.moveTo(-7,7);c.lineTo(-1,7);c.stroke();
      c.fillStyle='#1a3410';c.fillRect(0,2.8,8,3.4);                     // 握把
      break;
    case'minigun': // 重型机枪
      // v52重绘：三管旋转总成+弹链导槽+液压托架+过热蒸腾
      const heatColor=`rgb(${80+heat*175|0},${80-heat*60|0},${80-heat*60|0})`;
      c.fillStyle=heatColor;c.fillRect(-4,-5.5,20,11);                      // 主机匣（随热度变红）
      c.fillStyle=`rgba(255,255,255,${.12-heat*.1})`;c.fillRect(-4,-5.5,20,3); // 机匣受光（过热时消失）
      c.fillStyle='#9a9a9a';c.fillRect(16,-4,15,8);                          // 枪管组基座
      const rAngle=Date.now()*.015;
      // 三根实体枪管（旋转总成：两根在前后平面转动）
      for(let k=0;k<3;k++){
        const ba=rAngle+k*Math.PI*2/3;
        const depth=Math.sin(ba);                                            // -1..1 模拟转出/转入
        const gx=16+Math.cos(ba)*0;                                          // 管组沿轴
        const gy=Math.sin(ba)*3.4;
        c.fillStyle=depth>0?`rgb(${140+depth*60|0},${140+depth*60|0},${150+depth*60|0})`:'#4a4a52';
        c.fillRect(gx+2,gy-1.2,13,2.4);                                      // 每根管
        c.fillStyle=depth>0?'#c8c8d0':'#3a3a42';
        c.fillRect(gx+3,gy-.7,10,.6);                                        // 管面高光
      }
      c.fillStyle='#666';c.fillRect(30,-2.4,9,4.8);                          // 管口稳定环
      c.fillStyle='#8a8a8a';c.fillRect(31,-1.8,7,1);                         // 稳定环光
      c.fillStyle='#555';c.fillRect(-4,4.5,15,4);                            // 下挂弹链盒
      c.fillStyle='#3d3d3d';for(let k=0;k<4;k++)c.fillRect(-3+k*3.6,5.4,2.6,2.4); // 盒内弹链（隐约）
      c.fillStyle='#4a4a4a';c.fillRect(4,-7,6,1.8);                          // 上提把
      if(heat>.7){c.shadowBlur=heat*12;c.shadowColor='#ff4400';c.fillStyle=`rgba(255,${68*(1-heat)|0},0,.6)`;c.beginPath();c.arc(36,0,3+heat*4,0,Math.PI*2);c.fill();c.shadowBlur=0;
        c.fillStyle=`rgba(255,120,40,${(heat-.7)*1.2})`;                     // 过热蒸腾波纹
        c.beginPath();c.arc(34,-3-heat*3,2+heat*3,0,Math.PI*2);c.fill();}
      break;
    case'rocket': // 火箭筒：粗管
      // v52重绘：管筒+前后护圈+瞄具+肩垫
      c.fillStyle='#4a3a20';c.fillRect(-3,-2.8,6,5.6);                    // 肩垫托
      c.fillStyle='#5a4a2e';c.fillRect(-3,-2.8,6,1.6);                    // 受光
      c.fillStyle='#5c5c5c';c.fillRect(2,-3.6,22,7.2);                    // 主筒
      c.fillStyle='#707070';c.fillRect(2,-3.6,22,2);                      // 筒上受光
      c.fillStyle='#3a3a3a';c.fillRect(6,-3.6,1.2,7.2);c.fillRect(18,-3.6,1.2,7.2); // 筍箍
      c.fillStyle='#8a8a8a';c.fillRect(1,-4.6,3,2);c.fillRect(22,-4.6,3,2); // 前后护圈
      c.fillStyle='#ff6600';c.fillRect(25,-2,2.5,4);                      // 膛口红标
      c.fillStyle='#26261e';c.fillRect(9,-5.6,7,2);                        // 提把瞄具
      c.fillStyle='#3c3c30';c.fillRect(10.5,-5.2,4,1.2);                  // 瞻孔
      c.fillStyle='#2e2a20';c.fillRect(4,3.4,8,3.4);                     // 下握把
      break;
    case'plasma': // 等离子炮：紫蓝能量
      // v52重绘：聚能环+导能管+能量腔视窗
      c.fillStyle='#33254e';c.fillRect(-2,-4.2,16,8.4);                   // 机匣
      c.fillStyle='#453a66';c.fillRect(-2,-4.2,16,2.2);                   // 受光
      const plHue=280+Math.sin(Date.now()*.005)*40;
      c.fillStyle=`hsl(${plHue},70%,55%)`;c.fillRect(0,-1.8,14,3.6);      // 导能管（色呼吸）
      c.fillStyle='#cc88ff';c.fillRect(13,-3,9,6);                        // 聚能器
      c.strokeStyle='#e8baff';c.lineWidth=1.2;                             // 聚能环×3
      for(let k=0;k<3;k++){c.beginPath();c.arc(17.5,0,4.5-k*1.4,0,Math.PI*2);c.stroke();}
      c.fillStyle='rgba(200,120,255,.35)';                                // 能量腔视窗
      c.fillRect(4,-1.2,7,2.4);
      c.fillStyle=`rgba(255,255,255,${.3+.3*Math.sin(Date.now()*.01)})`;  // 腔内光点
      c.fillRect(6,-.8,3,1.6);
      c.fillStyle='#221636';c.fillRect(0,3.8,10,2.6);                     // 握把
      break;
    case'annihilator': // 湮灭者：超大能量炮
      c.fillStyle='#1a0a0a';c.fillRect(-3,-5,20,10);c.fillStyle='#ff2200';c.fillRect(0,-3,16,6);c.fillStyle='#ffaa00';c.fillRect(16,-4,10,8);c.shadowBlur=10;c.shadowColor='#ff4400';c.fillStyle=`rgba(255,${100+Math.sin(Date.now()*.008)*80},0,${.7+.3*Math.sin(Date.now()*.015)})`;c.beginPath();c.arc(24,0,5,0,Math.PI*2);c.fill();c.fillStyle='#ffff00';c.beginPath();c.arc(24,0,2,0,Math.PI*2);c.fill();c.shadowBlur=0;c.fillStyle='#330000';c.fillRect(0,3,12,3);break;
    // ═══ 【v51模块三】6把流派专属武器的手持建模 ═══
    case'railcharger':{ // 磁轨充能狙击：长管+3格充能槽（随充能点亮）
      const chg=(window._railCharge||0);
      c.fillStyle='#1e2a30';c.fillRect(-2,-3,12,6);          // 机匣
      c.fillStyle='#3a4a52';c.fillRect(10,-2,24,4);          // 长枪管
      c.fillStyle='#88ffee';c.fillRect(32,-1.5,4,3);          // 枪口
      c.fillStyle='#0a1214';c.fillRect(6,-4,14,2);           // 瞄具导轨
      c.fillStyle='#667788';c.fillRect(2,-5,3,2);            // 瞄镜
      // 充能3格（点亮=青绿发光）
      for(let k=0;k<3;k++){
        const lit=chg>=(k+1);
        c.fillStyle=lit?'#88ffee':'#2a3a40';
        if(lit){c.shadowBlur=5;c.shadowColor='#88ffee';}
        c.fillRect(13+k*5,-3,3.5,6);
        c.shadowBlur=0;
      }
      if(chg>=3){ // 满能：枪管电流纹
        c.strokeStyle=`rgba(136,255,238,${.5+.5*Math.sin(Date.now()*.02)})`;c.lineWidth=1;
        c.beginPath();c.moveTo(12,-2);c.lineTo(20,2);c.lineTo(28,-3);c.stroke();
      }
      c.fillStyle='#14202a';c.fillRect(0,3,9,3);              // 握把
      break;}
    case'stickybomb':{ // 黏弹投射器：罐状弹匣+软管+发射碗口
      c.fillStyle='#4a3a28';c.fillRect(-2,-3,10,6);          // 机匣
      c.fillStyle='#885533';c.beginPath();c.arc(2,6,5,0,Math.PI*2);c.fill();  // 罐状弹匣（下挂）
      c.fillStyle='#6a4a30';c.fillRect(8,-2,12,4);           // 发射管
      c.fillStyle='#ccbbaa';c.beginPath();c.arc(21,0,4,Math.PI*0.4,Math.PI*1.6);c.fill();  // 碗口
      c.strokeStyle='#885533';c.lineWidth=1.2;               // 软管（机匣→弹匣）
      c.beginPath();c.moveTo(-1,2);c.quadraticCurveTo(-4,6,2,8);c.stroke();
      c.fillStyle='#ff9955';c.beginPath();c.arc(21,-2,1.8,0,Math.PI*2);c.fill();  // 待发弹头（橙）
      c.fillStyle='#3a2a1a';c.fillRect(0,3,8,4);             // 握把
      break;}
    case'warhorn':{ // 战地哨笛：铜喇叭号角
      const shine=.6+.4*Math.sin(Date.now()*.004);
      c.fillStyle='#b8860b';c.fillRect(-2,-2,10,4);           // 号管
      c.fillStyle='#daa520';c.fillRect(8,-1.5,8,3);          // 前管（黄铜亮面）
      c.fillStyle='#daa520';c.shadowBlur=4;c.shadowColor='#ffd700';  // 喇叭口（渐扩）
      c.beginPath();c.moveTo(16,-1.5);c.lineTo(24,-6);c.lineTo(24,6);c.lineTo(16,1.5);c.closePath();c.fill();
      c.shadowBlur=0;
      c.fillStyle='#8a6a2a';c.fillRect(2,-3,4,2);            // 号嘴
      c.fillStyle=`rgba(255,215,0,${shine*.3})`;             // 喇叭内反光
      c.beginPath();c.moveTo(17,-1);c.lineTo(22,-4);c.lineTo(22,4);c.lineTo(17,1);c.closePath();c.fill();
      c.fillStyle='#6a5a2a';c.fillRect(4,2,5,4);             // 握把+流苏
      c.strokeStyle='#cc2222';c.lineWidth=1;                 // 红流苏
      c.beginPath();c.moveTo(6,6);c.quadraticCurveTo(8,9,7,11);c.stroke();
      break;}
    case'quakehammer':{ // 裂地援护锤：锤头+缠带握把
      c.fillStyle='#5a4a3a';c.fillRect(-2,-1.5,14,3);        // 锤柄
      c.fillStyle='#8a7a6a';c.beginPath();c.arc(14,0,7,0,Math.PI*2);c.fill();  // 锤头
      c.fillStyle='#aaa';c.fillRect(17,-6,4,12);             // 锤面（金属）
      c.fillStyle='rgba(255,255,255,.3)';c.fillRect(17.5,-5,1.5,10);  // 锤面高光
      c.strokeStyle='#6a5a3a';c.lineWidth=2;                 // 握把缠带
      for(let k=0;k<4;k++){c.beginPath();c.moveTo(k*4,0);c.lineTo(k*4+2,3);c.stroke();}
      c.fillStyle='#ffcc44';c.fillRect(-3,-2,2,4);           // 柄尾配重
      // 使用时锤头蓄力光
      if(shootRecoil>3){c.strokeStyle=`rgba(255,204,68,${shootRecoil/10})`;c.lineWidth=1.5;c.beginPath();c.arc(14,0,9,0,Math.PI*2);c.stroke();}
      break;}
    case'chiliflamer':{ // 辣椒喷焰枪：红漆+燃料罐+辣椒弹鼓
      c.fillStyle='#aa2222';c.fillRect(-2,-3,12,6);          // 机匣（辣椒红漆）
      c.fillStyle='#cc3333';c.fillRect(10,-2,12,4);          // 喷管
      c.fillStyle='#dd4444';c.fillRect(4,-5,6,3);            // 上导轨红
      c.fillStyle='#662222';c.beginPath();c.arc(-1,6,4.5,0,Math.PI*2);c.fill();  // 燃料罐（下挂）
      c.fillStyle='#ffcc44';c.fillRect(21,-1,4,2);           // 喷口
      c.fillStyle=`rgba(255,${80+Math.sin(Date.now()*.02)*60|0},20,${.5+.3*Math.sin(Date.now()*.03)})`;  // 喷口火苗
      c.beginPath();c.arc(25,0,2.5+Math.sin(Date.now()*.03),0,Math.PI*2);c.fill();
      c.fillStyle='#882222';c.fillRect(0,3,8,3);             // 握把
      c.fillStyle='#3a1a1a';c.fillRect(5,-4,2,8);             // 弹鼓隔
      break;}
    case'bloodblades':{ // 血肉双刃：双锯齿刀刃+血滴
      c.fillStyle='#4a3a3a';c.fillRect(-2,-2,6,4);          // 柄首
      c.fillStyle='#8a2222';c.fillRect(4,-1.5,18,3);         // 主刃（暗红）
      c.fillStyle='#aa3333';                                 // 锯齿（上刃）
      for(let k=0;k<6;k++){c.beginPath();c.moveTo(6+k*3,-1.5);c.lineTo(7.5+k*3,-4.5);c.lineTo(9+k*3,-1.5);c.closePath();c.fill();}
      c.fillStyle='#8a2222';c.fillRect(4,1.5,14,2.5);        // 副刃（下）
      c.fillStyle='rgba(255,80,80,.6)';c.fillRect(20,-1,4,2);  // 刃口反光
      // 血滴（刃尖缓慢下滴）
      const drip=(Date.now()*0.001)%1;
      c.fillStyle=`rgba(180,20,20,${.8-drip*.5})`;
      c.beginPath();c.arc(22,1+drip*6,1.2,0,Math.PI*2);c.fill();
      c.fillStyle='#3a2a2a';c.fillRect(-2,2,5,4);            // 握把
      break;}
    // ═══ v53持枪美术补全：原8把武器持枪时显示为兜底手枪 ═══
    case'revolver':{ // 左轮：大转轮+长枪管（西部快枪手）
      c.fillStyle='#5a3a1e';c.fillRect(-2,-2.5,7,5);          // 枪托
      c.fillStyle='#6a6a6a';c.fillRect(4,-3,10,6);            // 机匣
      c.fillStyle='#8a8a8a';c.fillRect(13,-2,9,4);            // 长枪管
      c.fillStyle='#111';c.fillRect(20,-1.5,2.5,3);          // 膛口
      c.fillStyle='#7a7a7a';                                   // 转轮（圆柱侧面+弹巢孔）
      c.beginPath();c.arc(7,0,4,0,Math.PI*2);c.fill();
      c.fillStyle='#2a2a2a';
      for(let k=0;k<3;k++){c.beginPath();c.arc(7+Math.cos(k*2.1)*2,Math.sin(k*2.1)*2.4,.8,0,Math.PI*2);c.fill();}
      c.fillStyle='#c8a030';c.fillRect(0,-4,2,1.5);           // 金色准星
      c.fillStyle='#3a2e1e';c.fillRect(0,2,4,5);               // 握把
      break;}
    case'sawoff':{ // 锯短霰弹：双锯断枪管+粗糙切面
      c.fillStyle='#4a2a12';c.fillRect(-2,-2.5,7,5);          // 短托
      c.fillStyle='#4a4a4a';c.fillRect(4,-3.2,12,3);          // 上断管
      c.fillStyle='#3d3d3d';c.fillRect(4,.3,12,3);            // 下断管
      c.fillStyle='#666';c.fillRect(5,-3.2,10,.8);            // 管面高光
      c.fillStyle='#2a1a0a';                                   // 锯断口（粗糙深色）
      c.fillRect(15,-3.2,1.5,3);c.fillRect(15,.3,1.5,3);
      c.fillStyle='#8a6a3a';c.fillRect(3,-4,10,1.2);          // 缠绕固定带
      break;}
    case'boomerang':{ // 回旋镖：V形镖体+握持中带
      c.fillStyle='#c8a060';                                    // V形木质主体
      c.beginPath();c.moveTo(-2,-6);c.lineTo(16,0);c.lineTo(-2,6);c.lineTo(1,0);c.closePath();c.fill();
      c.fillStyle='#88ccff';                                    // 嵌边蓝晶
      c.beginPath();c.moveTo(0,-5);c.lineTo(14,0);c.lineTo(0,5);c.lineTo(2.5,0);c.closePath();c.fill();
      c.strokeStyle='#e0d0a0';c.lineWidth=.8;
      c.beginPath();c.moveTo(-2,-6);c.lineTo(16,0);c.lineTo(-2,6);c.stroke();
      c.fillStyle='#3a2a1a';c.fillRect(-3,-1.5,6,3);          // 中央握带
      break;}
    case'landmine':{ // 地雷发射器：短筒+弹鼓+压盘
      c.fillStyle='#4a423a';c.fillRect(-1,-3,14,6);           // 粗短发射筒
      c.fillStyle='#5a5248';c.fillRect(12,-2.5,5,5);          // 筒口扩张
      c.fillStyle='#333';c.fillRect(15,-2,3,4);               // 膛口
      c.fillStyle='#6a5a3a';                                   // 下挂弹鼓（3发雷体可见）
      c.beginPath();c.arc(5,5,4,0,Math.PI*2);c.fill();
      c.fillStyle='#8a2020';
      for(let k=0;k<3;k++){c.beginPath();c.arc(5+Math.cos(k*2.1)*2,5+Math.sin(k*2.1)*2.4,1,0,Math.PI*2);c.fill();}
      c.fillStyle='#3a2e1e';c.fillRect(0,3,4,5);               // 握把
      break;}
    case'harpoon':{ // 鱼叉枪：长叉管+绞盘线
      c.fillStyle='#3a4a5a';c.fillRect(-2,-2.5,22,5);         // 长发射管
      c.fillStyle='#4a5a6a';c.fillRect(-2,-2.5,22,1.6);       // 受光面
      c.fillStyle='#c0c0c0';c.fillRect(20,-1.5,6,3);          // 露出的叉头
      c.fillStyle='#888';c.beginPath();c.moveTo(26,-1.5);c.lineTo(30,-3.5);c.lineTo(30,3.5);c.lineTo(26,1.5);c.closePath();c.fill();  // 叉尖倒钩
      c.strokeStyle='#a08850';c.lineWidth=.8;                 // 绞盘缆线
      c.beginPath();c.moveTo(2,2.5);c.quadraticCurveTo(8,6,14,3);c.stroke();
      c.fillStyle='#2a3a4a';c.beginPath();c.arc(4,3,3,0,Math.PI*2);c.fill();  // 绞盘
      break;}
    case'sonic':{ // 声波枪：喇叭口+音圈环
      c.fillStyle='#6a5a2a';c.fillRect(-2,-2.5,12,5);        // 机匣
      c.fillStyle='#8a7a3a';                                   // 扩张喇叭口
      c.beginPath();c.moveTo(10,-2);c.lineTo(22,-5);c.lineTo(22,5);c.lineTo(10,2);c.closePath();c.fill();
      const sc=.5+.3*Math.sin(Date.now()*.02);                // 音圈脉动（视觉）
      c.strokeStyle=`rgba(255,238,68,${sc})`;c.lineWidth=1.2;
      for(let k=0;k<3;k++){c.beginPath();c.arc(14+k*4,0,3+k*.8,0,Math.PI*2);c.stroke();}
      c.fillStyle='#3a2e1e';c.fillRect(0,2,4,5);              // 握把
      break;}
    case'napalm':{ // 凝固汽油：油罐+粗喷管+滴油
      c.fillStyle='#5a4a2a';c.fillRect(-2,-3,13,6);          // 机匣
      c.fillStyle='#3a2a1a';c.beginPath();c.arc(-2,4,4.5,0,Math.PI*2);c.fill();  // 下挂油罐
      c.fillStyle='#2a1a0a';c.beginPath();c.arc(-2,4,2.5,0,Math.PI*2);c.fill();
      c.fillStyle='#7a5a2a';c.fillRect(11,-2,10,4);           // 粗喷管
      c.fillStyle='#ff6600';c.fillRect(20,-1.5,3,3);          // 燃烧喷口
      const nd=(Date.now()*.0012)%1;                           // 管口滴油
      c.fillStyle=`rgba(180,100,20,${.8-nd*.4})`;
      c.beginPath();c.arc(21+nd*3,2+nd*4,1,0,Math.PI*2);c.fill();
      c.fillStyle='#3a2e1e';c.fillRect(0,3,4,5);
      break;}
    case'shockwave':{ // 冲击波锤：锤柄+能量锤头
      c.fillStyle='#5a4a3a';c.fillRect(-2,-1.5,15,3);        // 锤柄
      c.fillStyle='#4a5a7a';c.beginPath();c.arc(15,0,6.5,0,Math.PI*2);c.fill();  // 锤头
      c.fillStyle=`rgba(136,204,255,${.5+.3*Math.sin(Date.now()*.03)})`;  // 能量核心脉动
      c.beginPath();c.arc(15,0,3.5,0,Math.PI*2);c.fill();
      c.strokeStyle='rgba(136,204,255,.5)';c.lineWidth=1.4;   // 冲击环
      c.beginPath();c.arc(15,0,8+Math.sin(Date.now()*.02)*1.5,0,Math.PI*2);c.stroke();
      c.fillStyle='#ffcc44';c.fillRect(-3,-2,2,4);           // 柄尾配重
      break;}
    default: // 兜底：普通手枪样式
      c.fillStyle='#555';c.fillRect(0,-3,12,6);c.fillStyle='#444';c.fillRect(12,-2,6,4);c.fillStyle='#3a2e1e';c.fillRect(2,2,5,6);
  }
  c.restore();
}

// ═══════════════════════════════════════════

//  ZOMBIE SPRITE（精美化：支持12种新原型 + 旧4种）
// ═══════════════════════════════════════════
function drawZombie(z,t){
  if(!z.alive)return;
  if(z.elite){drawElite(z,t);return;}
  // ── 调度：新原型走专用绘制，旧/无原型走legacy ──
  if(z.zType && z.zType !== 'old_elite' && ZOMBIE_DEX_MAP[z.zType]){
    drawArchetypeZombie(z,t);
    return;
  }
  if(z.zType === 'imp'){ drawImpZombie(z,t); return; }
  drawLegacyZombie(z,t);
}

// ── 通用僵尸部件绘制工具（所有原型复用） ──
// 美术升级：颜色明暗工具（hex → 提亮/压暗，用于立体渐变与轮廓）
function _shade(hex, mul){
  try{
    const h = hex.replace('#','');
    const r = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(0,2),16)*mul)));
    const g = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(2,4),16)*mul)));
    const b = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(4,6),16)*mul)));
    return `rgb(${r},${g},${b})`;
  }catch(e){ return hex; }
}
function _lighten(hex, mul){ return _shade(hex, mul); }   // mul>1 提亮
function _darken(hex, mul){ return _shade(hex, mul); }    // mul<1 压暗
function _zShadow(cx,gy,r){
  ctx.save();ctx.globalAlpha=.32;ctx.fillStyle='#000';
  ctx.beginPath();ctx.ellipse(cx,gy,r,r*0.25,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function _zLegs(cx,gy,legA,bootColor,pantColor){
  // 左右腿，带裤管阴影+靴子
  ctx.save();
  ctx.fillStyle=pantColor;
  // 左腿
  ctx.save();ctx.translate(cx-5,gy);ctx.rotate(legA*Math.PI/180);
  ctx.fillRect(-3,-14,6,14);
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(-3,-14,2,14);
  ctx.fillStyle=bootColor;ctx.fillRect(-4,-4,8,5);
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(-4,-2,8,2);
  ctx.restore();
  // 右腿
  ctx.save();ctx.translate(cx+5,gy);ctx.rotate(-legA*Math.PI/180);
  ctx.fillStyle=pantColor;ctx.fillRect(-3,-14,6,14);
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(-3,-14,2,14);
  ctx.fillStyle=bootColor;ctx.fillRect(-4,-4,8,5);
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(-4,-2,8,2);
  ctx.restore();
  ctx.restore();
}
function _zArms(cx,ay,armA,sleeveColor,skinColor,frontFlip){
  // 双臂摆动
  ctx.save();
  // 后臂（被身体遮挡）
  ctx.save();ctx.translate(cx-12,ay);ctx.rotate(armA*Math.PI/180);
  ctx.fillStyle=sleeveColor;ctx.fillRect(-2,-3,12,6);
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(-2,-3,2,6);
  ctx.fillStyle=skinColor;ctx.fillRect(8,-3,5,6);
  ctx.restore();
  // 前臂
  ctx.save();ctx.translate(cx+10,ay);ctx.scale(frontFlip||1,1);ctx.rotate(-armA*Math.PI/180*0.7);
  ctx.fillStyle=sleeveColor;ctx.fillRect(-2,-3,12,6);
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(-2,-3,2,6);
  ctx.fillStyle=skinColor;ctx.fillRect(8,-3,6,7);
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(8,-3,2,7);
  ctx.restore();
  ctx.restore();
}
function _zHead(cx,hy,sk,hair,eyeColor, mouthOpen){
  // 头部腐化基底渐变
  const hGrad=ctx.createLinearGradient(cx-9,hy,cx+9,hy+18);
  hGrad.addColorStop(0,sk);hGrad.addColorStop(0.6,_shade(sk,0.85));hGrad.addColorStop(1,_shade(sk,0.65));
  ctx.fillStyle=hGrad;
  ctx.fillRect(cx-9,hy,18,17);
  // 腐烂暗斑
  ctx.fillStyle='rgba(30,50,25,0.45)';
  ctx.fillRect(cx-7,hy+2,4,4);ctx.fillRect(cx+3,hy+9,5,3);
  // 下巴腐蚀阴影
  ctx.fillStyle='rgba(10,5,5,.35)';ctx.fillRect(cx-9,hy+13,18,4);
  // 耳朵（残破）
  ctx.fillStyle=_shade(sk,0.8);ctx.fillRect(cx-11,hy+5,2,5);ctx.fillRect(cx+9,hy+6,2,3);
  // 凌乱腐败发丝
  ctx.fillStyle=hair;ctx.fillRect(cx-10,hy-3,20,6);
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(cx-10,hy-3,20,2);
  ctx.fillStyle=hair;ctx.fillRect(cx-11,hy+1,3,6);ctx.fillRect(cx+8,hy+2,2,4);
  // 凹陷深邃眼窝
  ctx.fillStyle='rgba(0,0,0,0.65)';
  ctx.fillRect(cx-7,hy+6,5,4);ctx.fillRect(cx+2,hy+6,5,4);
  // 发光感染邪眼 (Luminous Infected Eyes)
  const zEye = eyeColor || '#ffdd33';
  ctx.fillStyle=zEye;ctx.shadowBlur=5;ctx.shadowColor=zEye;
  ctx.fillRect(cx-6,hy+7,3,3);ctx.fillRect(cx+3,hy+7,3,3);
  ctx.shadowBlur=0;
  ctx.fillStyle='#000';ctx.fillRect(cx-5,hy+7,1.2,2);ctx.fillRect(cx+4,hy+7,1.2,2); // 竖瞳
  // 腐烂血口与外露獠牙
  ctx.fillStyle='#2a0505';
  if(mouthOpen){
    ctx.fillRect(cx-4,hy+12,8,4);
    // 上下交错獠牙
    ctx.fillStyle='#ffffd0';
    ctx.fillRect(cx-3,hy+12,1.5,1.5);ctx.fillRect(cx+1.5,hy+12,1.5,1.5); // 上牙
    ctx.fillRect(cx-1,hy+14.5,1.5,1.5);ctx.fillRect(cx+2,hy+14.5,1.5,1.5); // 下牙
    ctx.fillStyle='rgba(180,20,20,0.8)';ctx.fillRect(cx-1,hy+16,2,2); // 滴血
  }else{
    ctx.fillRect(cx-4,hy+13,8,2);
    ctx.fillStyle='#ffffd0';ctx.fillRect(cx-2,hy+13,1.2,1.2);ctx.fillRect(cx+1,hy+13,1.2,1.2);
  }
  // 鼻孔阴影
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(cx-1.5,hy+10,3,1.5);
}
function _zHPBar(cx,by,hp,maxHp,armorHp,armorMax){
  const bw=38,bx=cx-bw/2;
  // 主HP
  ctx.fillStyle='#1a0505';ctx.fillRect(bx,by,bw,4);
  ctx.fillStyle=hp/maxHp>.5?'#27ae60':hp/maxHp>.25?'#f39c12':'#c0392b';
  ctx.fillRect(bx,by,bw*Math.max(0,hp/maxHp),4);
  ctx.strokeStyle='#0a0505';ctx.lineWidth=.5;ctx.strokeRect(bx,by,bw,4);
  // 护甲条（黄色，在HP上方）
  if(armorMax>0){
    ctx.fillStyle='#3a2a08';ctx.fillRect(bx,by-3,bw,2);
    ctx.fillStyle='#ffaa33';ctx.fillRect(bx,by-3,bw*Math.max(0,armorHp/armorMax),2);
  }
  ctx.fillStyle='#fff';ctx.font='7px sans-serif';ctx.textAlign='center';
  ctx.fillText(Math.ceil(hp)+'/'+maxHp,cx,by-5);
}
function _zStatusFX(cx,gy,z){
  // 冰冻
  if(z.frostTimer>0){
    ctx.globalAlpha=.3;ctx.fillStyle='#aaeeff';
    ctx.fillRect(cx-12,gy-58,24,62);
    ctx.globalAlpha=.7;ctx.fillStyle='#cceeff';
    ctx.fillRect(cx-8,gy-50,3,3);ctx.fillRect(cx+5,gy-40,3,3);ctx.fillRect(cx-3,gy-30,3,3);
    ctx.globalAlpha=1;
  }
  if(z.legSlowTimer>0){
    ctx.globalAlpha=.5;ctx.fillStyle='#ffaa00';
    ctx.fillRect(cx-6,gy-6,3,3);ctx.fillRect(cx+3,gy-6,3,3);
    ctx.globalAlpha=1;
  }
  if(z.burning){
    ctx.globalAlpha=.6+.3*Math.random();
    ctx.fillStyle='#ff6600';ctx.fillRect(cx-6,gy-62,3,5);
    ctx.fillStyle='#ffaa00';ctx.fillRect(cx-4,gy-65,2,4);
    ctx.fillStyle='#ffee44';ctx.fillRect(cx-2,gy-63,2,3);
    ctx.globalAlpha=1;
  }
  // ── Bug修复+美术：中毒显示（原版完全无中毒渲染，毒液枪命中像没打）──
  if(z.poisoned){
    // 绿色 tint 全身覆盖（半透明毒气罩）
    ctx.globalAlpha=.28+.1*Math.sin(frameT*0.15);
    ctx.fillStyle='#66cc33';
    ctx.fillRect(cx-16,gy-60,32,62);
    ctx.globalAlpha=1;
    // 头顶毒滴粒子（随机滴落）
    if(Math.random()>.5){
      ctx.fillStyle='rgba(102,204,51,.8)';
      ctx.fillRect(cx-8+Math.random()*16, gy-64+Math.random()*4, 2, 3);
    }
    // 毒气泡（体内升腾）
    if(Math.random()>.6){
      ctx.globalAlpha=.6;ctx.fillStyle='#88ee44';
      ctx.beginPath();ctx.arc(cx-10+Math.random()*20, gy-40+Math.random()*24, 1.5+Math.random(), 0, Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
    }
  }
}

// ── 新原型僵尸统一绘制 ──
function drawArchetypeZombie(z,t){
  const {x,hp,maxHp,walkT,facingR,hitFlash,zType}=z;
  const arch = ZOMBIE_DEX_MAP[zType];
  // ①垂直步伐起伏（步履颠簸，杜绝滑冰假人感）
  const bob = Math.abs(Math.sin((walkT||0) * Math.PI * 2)) * 3.2;
  const y = Z_TOP + (z.yOffset||0) + bob;
  ctx.save();
  ctx.translate(x+22, y+58);
  if(!facingR) ctx.scale(-1,1);
  // 彻底废除 ctx.globalAlpha 幽灵半透明虚化
  ctx.translate(-22,-58);

  const w = walkT;
  const legA = Math.sin(w*Math.PI*2)*22;
  const armA = 25 + Math.sin(w*Math.PI*2)*18;
  const cx = 22, gy = 58;
  const sk = arch.color1, cl = arch.color2, hair = arch.hair;

  // ── 美术A：僵尸动作系统 ──
  // ①蹒跚步态：整体侧倾摇摆（重心不稳的丧尸感）+速度自适应（慢怪大幅低频、快怪小幅高频）
  const spdFactor = Math.min(1.6, (z.spd||1.4)/1.4);
  const sway = Math.sin(w*Math.PI*2 + 0.5) * (5/spdFactor) * (z.hitStun>0?0.3:1);
  // ②前后倾：移动越快前倾越多（疾行前扑感）；受击时上半身后仰（弯腰反馈替代纯闪白）
  const lean = Math.min(0.16, 0.03*spdFactor + (z.dashTimer>0?0.10:0));
  const hurtLean = hitFlash>0.4 ? -(hitFlash-0.4)*0.45 : 0;
  // 受击物理后仰顿挫（根据弹道冲击方向物理微倾）
  const flinch = (hitFlash > 0 ? (z.hitDir || -1) * (Math.min(1.5, hitFlash) * 0.16) : 0);
  // ③攻击前摇：贴近玩家时抬臂前扑姿态（可预判可翻滚）
  const nearP = Math.abs((player.x+CHAR_W/2)-(z.x+22))<70 && z.hitStun<=0;
  const lunge = nearP ? 0.10+0.05*Math.sin(frameT*0.3) : 0;
  // 统一动作变换（绕脚底 cx,gy；坐标系已按朝向翻转，前倾=+旋角）
  ctx.save();
  ctx.translate(cx, gy);
  ctx.rotate((sway*Math.PI/180) + (lean + hurtLean + lunge + flinch));
  ctx.translate(-cx, -gy);

  // 阴影
  _zShadow(cx, gy+2, 14);
  // 腿
  _zLegs(cx, gy, legA, '#1a120a', '#3a3a4a');
  // ── 美术升级：身体立体感（垂直渐变+深色轮廓包边+顶光）──
  {
    const bodyGrad = ctx.createLinearGradient(0, gy-42, 0, gy-12);
    bodyGrad.addColorStop(0, _lighten(cl, 1.22));   // 顶部受光
    bodyGrad.addColorStop(0.55, cl);
    bodyGrad.addColorStop(1, _darken(cl, 0.72));    // 底部阴影
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(cx-16, gy-40, 32, 28);
    // 1px 深色轮廓包边（rim）
    ctx.strokeStyle = _darken(cl, 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(cx-16.5, gy-40.5, 33, 29);
    // 左侧受光高光条
    ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(cx-15,gy-39,2,26);
    // 右侧暗面
    ctx.fillStyle='rgba(0,0,0,.24)';ctx.fillRect(cx+13,gy-39,2,26);
    // 破损下摆（锯齿边缘，告别方头方脑）
    ctx.fillStyle=_darken(cl,0.6);
    ctx.beginPath();
    ctx.moveTo(cx-16,gy-12);ctx.lineTo(cx-12,gy-9);ctx.lineTo(cx-8,gy-13);
    ctx.lineTo(cx-4,gy-9);ctx.lineTo(cx,gy-12);ctx.lineTo(cx+4,gy-9);
    ctx.lineTo(cx+8,gy-13);ctx.lineTo(cx+12,gy-9);ctx.lineTo(cx+16,gy-12);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(cx-1,gy-40,1,28); // 衣襟
    ctx.fillStyle=cl;ctx.fillRect(cx-6,gy-42,12,4); // 衣领
    // 纽扣
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(cx-1,gy-34,2,2);ctx.fillRect(cx-1,gy-28,2,2);ctx.fillRect(cx-1,gy-22,2,2);
    // 胸口血迹
    ctx.fillStyle='rgba(120,20,20,.5)';ctx.fillRect(cx-8,gy-32,6,8);ctx.fillRect(cx+2,gy-26,5,5);
    // ── 美术升级：重伤表现（HP<50% 时身上出现血渍/撕裂伤口）──
    if(hp/maxHp < 0.5){
      const woundN = hp/maxHp < 0.25 ? 3 : 2;
      for(let wi=0; wi<woundN; wi++){
        const wx = cx - 10 + wi*9 + ((z.id||wi)%4);
        const wy = gy - 36 + ((wi*7)%12);
        ctx.fillStyle='rgba(90,8,8,.75)';
        ctx.beginPath();ctx.arc(wx,wy,2.6+wi*0.6,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(140,20,20,.5)';
        ctx.fillRect(wx-1,wy+2,2,5);  // 下淌血痕
      }
      // 重伤跛行：绿色感染滴液
      if(Math.random()>.6){
        mkP({x:x+22+(Math.random()-.5)*14,y:y+40,vx:0,vy:.8,r:1.6,rDecay:.03,decay:.04,color:'rgba(120,20,20,.8)',type:'circle',grav:.1,alpha:.7});
      }
    }
  }

  // ── 原型专属装饰 ──
  if(zType === 'roamer'){
    // 普通游荡者：手里提着破书包
    ctx.save();ctx.translate(cx+12, gy-26);
    ctx.fillStyle='#665544';ctx.fillRect(-5,0,10,9);
    ctx.fillStyle='#443322';ctx.fillRect(-5,0,10,2);
    ctx.strokeStyle='#332211';ctx.lineWidth=.5;ctx.strokeRect(-5,0,10,9);
    ctx.restore();
  } else if(zType === 'sprinter'){
    // 冲刺者：运动服+头带
    ctx.fillStyle='#cc3333';ctx.fillRect(cx-10,gy-58+3,20,2); // 头带
    ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(cx-8,gy-58+3,16,1);
    // 运动短裤条纹
    ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillRect(cx-6,gy-14,12,1);
  } else if(zType === 'flagbearer'){
    // 号旗呼号者：举旗（美术升级：破旗随风波涛+旗杆金属渐变）
    ctx.save();ctx.translate(cx+12, gy-50);
    // 旗杆（金属渐变）
    const poleGrad = ctx.createLinearGradient(-1, 0, 1.5, 0);
    poleGrad.addColorStop(0,'#8a6a4a');poleGrad.addColorStop(0.5,'#5a3a1a');poleGrad.addColorStop(1,'#3a2812');
    ctx.strokeStyle=poleGrad;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-32);ctx.stroke();
    // 旗杆顶球
    ctx.fillStyle='#c8a050';ctx.beginPath();ctx.arc(0,-33,1.5,0,Math.PI*2);ctx.fill();
    // 破旗（正弦波飘动+破口）
    const wave1=Math.sin(t*0.12)*2.5, wave2=Math.sin(t*0.12+1.2)*3.5;
    ctx.fillStyle='#cc2222';
    ctx.beginPath();
    ctx.moveTo(0,-31);
    ctx.quadraticCurveTo(7,-30+wave1, 15,-28+wave1);
    ctx.lineTo(15,-22+wave2);
    ctx.quadraticCurveTo(7,-21+wave2, 0,-20);
    ctx.closePath();ctx.fill();
    // 旗面暗纹+破损缺口
    ctx.fillStyle='rgba(0,0,0,.35)';
    ctx.fillRect(4,-27+wave1*0.5,3,4);
    ctx.fillStyle='rgba(200,200,200,.25)';  // 反光高光
    ctx.fillRect(9,-27.5+wave1*0.6,4,1.5);
    ctx.fillStyle='#0a0505';  // 骷髅印
    ctx.font='bold 6px sans-serif';ctx.fillText('☠',4,-23.5+wave2*0.4);
    // 旗帜破损飘带
    ctx.strokeStyle='rgba(204,34,34,.7)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(15,-26+wave1);ctx.lineTo(19,-24+wave2);ctx.stroke();
    ctx.restore();
  } else if(zType === 'bruiser'){
    // 壮汉：更宽身体+胸肌+哑铃
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(cx-12,gy-35,4,20); // 胸肌阴影
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(cx+8,gy-35,4,20);
    ctx.save();ctx.translate(cx+14,gy-22);
    ctx.fillStyle='#666';ctx.fillRect(-8,-3,4,8);ctx.fillRect(4,-3,4,8);
    ctx.fillStyle='#888';ctx.fillRect(-6,-2,12,2);
    ctx.restore();
  } else if(zType === 'coneblock'){
    // 路障囚徒：头顶橙色路障（美术升级：反光条+划痕+立体暗面）
    const armorRatio = z.armorHp / Math.max(1,z.armorMax);
    if(z.armorHp > 0){
      ctx.save();ctx.translate(cx, gy-58);
      // 路障三角锥（左右明暗面+底缘）
      ctx.fillStyle='#ff7722';ctx.beginPath();
      ctx.moveTo(-13,9);ctx.lineTo(0,-13);ctx.lineTo(13,9);ctx.closePath();ctx.fill();
      // 右侧暗面（立体）
      ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();
      ctx.moveTo(0,-13);ctx.lineTo(13,9);ctx.lineTo(4,9);ctx.closePath();ctx.fill();
      // 左侧受光面
      ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();
      ctx.moveTo(0,-13);ctx.lineTo(-13,9);ctx.lineTo(-5,9);ctx.closePath();ctx.fill();
      // 反光条纹（白+亮黄交替，交通路障特征）
      ctx.fillStyle='#ffffff';ctx.fillRect(-11,3,22,2.5);
      ctx.fillStyle='#ffee44';ctx.fillRect(-7.5,-3,15,2.5);
      ctx.fillStyle='#ffffff';ctx.fillRect(-4.5,-8.5,9,2);
      // 条纹斜切（路障锥环感）
      ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(-11,5.5,22,1);
      // 划痕
      ctx.strokeStyle='rgba(60,20,0,.6)';ctx.lineWidth=.7;
      ctx.beginPath();ctx.moveTo(-8,4);ctx.lineTo(-4,-1);ctx.stroke();
      ctx.beginPath();ctx.moveTo(5,7);ctx.lineTo(8,2);ctx.stroke();
      // 裂纹（受损时）
      if(armorRatio < 0.6){
        ctx.strokeStyle='#1a0a00';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(-4,-2);ctx.lineTo(2,4);ctx.lineTo(-2,7);ctx.stroke();
        ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(-2,-6,4,1.5);  // 缺口
      }
      // 锥体描边
      ctx.strokeStyle='rgba(90,35,0,.8)';ctx.lineWidth=.8;
      ctx.beginPath();ctx.moveTo(-13,9);ctx.lineTo(0,-13);ctx.lineTo(13,9);ctx.closePath();ctx.stroke();
      ctx.restore();
    }else{
      // 路障被打掉，头上残留底座
      ctx.fillStyle='rgba(255,119,34,.4)';ctx.fillRect(cx-8,gy-52,16,3);
    }
  } else if(zType === 'buckethead'){
    // 铁桶禁闭者：头套铁桶（美术升级：铆钉+凹痕+锈斑+桶箍立体）
    if(z.armorHp > 0){
      const armorRatio = z.armorHp / Math.max(1,z.armorMax);
      ctx.save();ctx.translate(cx, gy-58);
      // 铁桶主体（金属渐变）
      const bucketGrad = ctx.createLinearGradient(-11, 0, 11, 0);
      bucketGrad.addColorStop(0,'#a8a8a8');bucketGrad.addColorStop(0.35,'#888');bucketGrad.addColorStop(1,'#5a5a5a');
      ctx.fillStyle=bucketGrad;ctx.fillRect(-11,-6,22,18);
      // 桶边（上下箍）
      ctx.fillStyle='#666';ctx.fillRect(-12,-8,24,3);   // 顶箍
      ctx.fillStyle='#777';ctx.fillRect(-12,-8,24,1.5); // 顶箍高光
      ctx.fillStyle='#666';ctx.fillRect(-12,10,24,3);   // 底箍
      ctx.fillStyle='#555';ctx.fillRect(-12,12,24,1);   // 底箍暗线
      // 铆钉（两道箍各4颗）
      ctx.fillStyle='#ccc';
      for(let ri=0;ri<4;ri++){
        ctx.beginPath();ctx.arc(-8+ri*5.4, -6.5, 0.9, 0, Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(-8+ri*5.4, 11, 0.9, 0, Math.PI*2);ctx.fill();
      }
      ctx.fillStyle='rgba(0,0,0,.4)';  // 铆钉阴影点
      ctx.fillRect(-8.5,-6.9,0.6,0.8);ctx.fillRect(-2.7,-6.9,0.6,0.8);
      // 锈迹（多层）
      ctx.fillStyle='rgba(130,60,20,.55)';ctx.fillRect(-8,-1,4,3.5);ctx.fillRect(5,4,5,4.5);
      ctx.fillStyle='rgba(180,90,30,.4)';ctx.fillRect(-9,1,2,4);ctx.fillRect(7,0,3,5);
      // 中箍（桶身中环）
      ctx.fillStyle='rgba(102,102,102,.9)';ctx.fillRect(-11,2,22,2);
      ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(-11,2,22,0.7);
      // 凹痕（受损时：凹陷椭圆+高光边）
      if(armorRatio < 0.5){
        ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(-3,5,3.5,2.5,0.3,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=.8;
        ctx.beginPath();ctx.ellipse(-3,5,3.5,2.5,0.3,0,Math.PI*2);ctx.stroke();
      }
      // 轮廓
      ctx.strokeStyle='rgba(30,30,30,.7)';ctx.lineWidth=.8;ctx.strokeRect(-11.5,-8.5,23,21.5);
      ctx.restore();
    }else{
      // 桶没了，露出凌乱头发
      ctx.fillStyle=hair;ctx.fillRect(cx-9,gy-58,18,4);
    }
  } else if(zType === 'screendoor'){
    // 铁门盾卫：手举铁门（美术升级：门框+把手+铁链+门钉立体）
    ctx.save();ctx.translate(cx-14, gy-30);
    // 门体（金属渐变+立体）
    const doorGrad = ctx.createLinearGradient(-5, 0, 5, 0);
    doorGrad.addColorStop(0,'#b8b8b8');doorGrad.addColorStop(0.4,'#9a9a9a');doorGrad.addColorStop(1,'#707070');
    ctx.fillStyle=doorGrad;ctx.fillRect(-4.5,-20,9,40);
    // 门框（上下横梁）
    ctx.fillStyle='#5a5a5a';ctx.fillRect(-5.5,-22,11,3);ctx.fillRect(-5.5,19,11,3);
    ctx.fillStyle='rgba(255,255,255,.15)';ctx.fillRect(-5.5,-22,11,1);
    // 网格（内嵌线，带透视深度）
    ctx.strokeStyle='rgba(60,60,60,.8)';ctx.lineWidth=.6;
    for(let i=-18;i<20;i+=4){ctx.beginPath();ctx.moveTo(-4.5,i);ctx.lineTo(4.5,i);ctx.stroke();}
    // 门钉（竖排装饰）
    ctx.fillStyle='#ccc';
    for(let di=-16; di<20; di+=9){ctx.beginPath();ctx.arc(0,di,0.8,0,Math.PI*2);ctx.fill();}
    // 门把手（圆环）
    ctx.strokeStyle='#888';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(-5.5,-2,2.2,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.arc(-5.8,-2.4,0.8,0,Math.PI*2);ctx.fill();
    // 铁链（从把手垂下）
    ctx.strokeStyle='rgba(140,140,140,.85)';ctx.lineWidth=1;
    const chainSway=Math.sin(t*0.08)*1.5;
    for(let ci=0;ci<3;ci++){
      const cy2=3+ci*4;
      ctx.beginPath();ctx.ellipse(-6+chainSway*(ci/3),cy2,1.4,2.2,0,0,Math.PI*2);ctx.stroke();
    }
    // 闪光（被击中时）
    if(z.shieldFlash>0){
      ctx.globalAlpha = z.shieldFlash;
      ctx.fillStyle='#ffeeaa';ctx.fillRect(-4.5,-20,9,40);
      ctx.globalAlpha=1;
      z.shieldFlash -= 0.08;
    }
    ctx.restore();
  } else if(zType === 'jumper'){
    // 弹跳狂尸：弹簧腿+跳姿
    if(z.jumpTimer > 30){
      // 跳跃中：身体抬高
      ctx.translate(0, -20);
    }
    // 弹簧腿装饰
    ctx.strokeStyle='#aa44cc';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(cx-5,gy-6);ctx.lineTo(cx-5,gy-2);
    ctx.moveTo(cx+5,gy-6);ctx.lineTo(cx+5,gy-2);ctx.stroke();
    // 紫色运动衫条纹
    ctx.fillStyle='rgba(170,68,204,.4)';ctx.fillRect(cx-14,gy-30,28,2);
    ctx.fillStyle='rgba(170,68,204,.4)';ctx.fillRect(cx-14,gy-22,28,2);
  } else if(zType === 'exploder'){
    // 自爆殉道者：腹胀+导火索+脉动
    const pulse = 1 + Math.sin(t*0.2)*0.08;
    ctx.save();ctx.translate(cx,gy-26);ctx.scale(pulse,pulse);
    // 膨胀腹部
    ctx.fillStyle='rgba(204,68,34,.7)';ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,150,80,.5)';ctx.beginPath();ctx.arc(-4,-3,5,0,Math.PI*2);ctx.fill();
    ctx.restore();
    // 导火索+火花
    ctx.strokeStyle='#5a3a1a';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(cx,gy-58);ctx.lineTo(cx+4,gy-66);ctx.stroke();
    ctx.fillStyle=Math.random()>.5?'#ff6600':'#ffaa00';
    ctx.fillRect(cx+3,gy-68,3,3);
    // 心跳红光
    ctx.fillStyle=`rgba(255,40,40,${.3+.2*Math.sin(t*0.3)})`;
    ctx.fillRect(cx-12,gy-40,24,4);
  } else if(zType === 'spawner'){
    // 舞池感染源：粉色皮肤+脉动腹部+小尸婴露头
    const pulse = 1 + Math.sin(t*0.15)*0.05;
    ctx.save();ctx.translate(cx,gy-24);ctx.scale(pulse*1.3,pulse);
    ctx.fillStyle='rgba(204,68,136,.6)';ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();
    ctx.restore();
    // 嘴里露出小尸婴
    ctx.fillStyle='#d8a8b8';ctx.fillRect(cx-3,gy-46,6,5);
    ctx.fillStyle='#000';ctx.fillRect(cx-2,gy-45,2,2);ctx.fillRect(cx+1,gy-45,2,2);
  } else if(zType === 'ranged'){
    // 火焰投手：喉咙鼓胀+火焰边
    ctx.fillStyle='rgba(255,100,30,.6)';ctx.beginPath();ctx.arc(cx-4,gy-44,5,0,Math.PI*2);ctx.fill();
    // 火焰呼吸粒子
    if(Math.random()>.7){
      ctx.fillStyle=Math.random()>.5?'#ff6600':'#ffaa00';
      ctx.fillRect(cx-2+Math.random()*4,gy-58,2,2);
    }
    // 火焰纹身
    ctx.fillStyle='rgba(255,120,40,.4)';ctx.fillRect(cx-8,gy-32,6,3);ctx.fillRect(cx+2,gy-28,5,2);
  } else if(zType === 'gargantuar'){
    // 巨型行刑者：放大1.8倍+巨拳+铁链
    ctx.save();ctx.translate(cx,gy);ctx.scale(1.8,1.8);ctx.translate(-cx,-gy);
    // 巨大身体（已通过scale放大）
    ctx.fillStyle='rgba(85,34,34,.5)';ctx.fillRect(cx-18,gy-44,36,32);
    // 巨拳（右臂更粗）
    ctx.fillStyle=sk;ctx.fillRect(cx+14,gy-38,12,14);
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(cx+14,gy-38,3,14);
    // 铁链装饰
    ctx.strokeStyle='#888';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(cx-12,gy-36);ctx.lineTo(cx-8,gy-30);ctx.lineTo(cx-12,gy-24);ctx.stroke();
    // 凶恶表情
    ctx.fillStyle='#ff0000';ctx.fillRect(cx-7,gy-50,4,3);ctx.fillRect(cx+3,gy-50,4,3);
    // 獠牙
    ctx.fillStyle='#fff';ctx.fillRect(cx-3,gy-44,1,3);ctx.fillRect(cx+2,gy-44,1,3);
    ctx.restore();
    // 砸地预警光圈
    if(z.slamTimer < 40 && z.slamTimer > 0){
      ctx.globalAlpha = 0.3 + 0.3*Math.sin(t*0.5);
      ctx.strokeStyle='#ff4400';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(cx,gy+2,60,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }
  }

  // 通用：手臂+头（美术A：手臂反相甩动+攻击前摇抬臂；头部滞后晃动）
  if(zType !== 'gargantuar'){
    // 手臂摆幅随速度自适应（快怪甩得急），前摇时双臂前抬扑抓
    const armSwing = armA * (0.7 + spdFactor*0.3);
    const attackPose = nearP && z.hitStun<=0;
    _zArms(cx, gy-34, attackPose ? -40 : armSwing, cl, sk);
    // 头部滞后：身体摇摆时头反向迟半拍晃（惯性拖拽感）
    const headLag = Math.sin(w*Math.PI*2 + 1.4) * (2.5/spdFactor);
    ctx.save();
    ctx.translate(cx, gy-58);
    ctx.rotate(headLag*Math.PI/180);
    ctx.translate(-cx, -(gy-58));
    _zHead(cx, gy-58, sk, hair, zType==='exploder'?'#ff3300':null, zType==='spawner'||zType==='exploder');
    ctx.restore();
  }

  // 状态特效（随身体变换）
  _zStatusFX(cx, gy, z);

  // 纯白冲击闪光(White Flash)与深红充血层（纯正扎实生物受击反馈，告别半透明）
  if(hitFlash > 0){
    ctx.save();
    if(hitFlash > 0.4){
      ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.min(0.85, (hitFlash - 0.4) / 0.6 * 0.9) + ')';
    } else {
      ctx.fillStyle = 'rgba(180, 15, 15, ' + Math.min(0.55, (hitFlash / 0.4) * 0.55) + ')';
    }
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(cx - 16, gy - 40, 32, 28, 4);
    else ctx.rect(cx - 16, gy - 40, 32, 28);
    ctx.fill();
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(cx - 9, gy - 58, 18, 17, 3);
    else ctx.rect(cx - 9, gy - 58, 18, 17);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();  // ← 美术A动作变换（sway/lean/前扑）结束，此后HP条不随身体倾倒

  // HP条（画在动作变换外——血条永远水平稳定，不随蹒跚晃动）
  _zHPBar(cx, gy-66, hp, maxHp, z.armorHp||0, z.armorMax||0);
  ctx.restore();
}

// ── 小尸婴（spawner召唤物）绘制 ──
function drawImpZombie(z,t){
  const {x,hp,maxHp,walkT,facingR,hitFlash}=z;
  const bob = Math.abs(Math.sin((walkT||0) * Math.PI * 2)) * 2.2;
  const y = Z_TOP + (z.yOffset||0) + bob;
  ctx.save();
  ctx.translate(x+22, y+58);
  if(!facingR) ctx.scale(-1,1);
  ctx.translate(-22,-58);
  // 缩小
  ctx.save();ctx.translate(22,58);ctx.scale(0.55,0.55);ctx.translate(-22,-58);
  const cx=22, gy=58;
  _zShadow(cx,gy+2,8);
  _zLegs(cx,gy,Math.sin(walkT*Math.PI*2)*30,'#5a2a3a','#884466');
  ctx.fillStyle=z.archColor2||'#884466';ctx.fillRect(cx-12,gy-30,24,18);
  _zHead(cx,gy-46,z.archColor1||'#d8a8b8',z.archHair||'#3a1818','#ff44aa',true);
  _zHPBar(cx,gy-54,hp,maxHp,0,0);
  ctx.restore();
  ctx.restore();
}

// ── 旧版僵尸绘制（向后兼容，type 0-3） ──
function drawLegacyZombie(z,t){
  const {x,hp,maxHp,walkT,type,facingR,hitFlash}=z;
  const bob = Math.abs(Math.sin((walkT||0) * Math.PI * 2)) * 3.2;
  const y=Z_TOP + (z.yOffset||0) + bob;
  ctx.save();ctx.translate(x+22,y+58);if(!facingR)ctx.scale(-1,1);
  ctx.translate(-22,-58);
  const w=walkT,legA=Math.sin(w*Math.PI*2)*25;
  const skins=['#e0b888','#d4a878','#c89868','#e8c098'];
  const cloths=['#4a8acc','#cc5544','#55aa55','#cc8844'];
  const sk=skins[type], cl=cloths[type];
  const ww=40,h=58;
  ctx.save();ctx.globalAlpha=.3;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(22,h+2,14,3,0,0,Math.PI*2);ctx.fill();ctx.restore();
  function zl(ox,la){ctx.save();ctx.translate(ox,h-16);ctx.rotate(la*Math.PI/180);ctx.fillStyle='#3a3a4a';ctx.fillRect(-4,0,8,14);ctx.fillStyle='#2a2a3a';ctx.fillRect(-4,0,2,14);ctx.fillStyle='#4a4a5a';ctx.fillRect(2,0,2,14);ctx.fillStyle=sk;ctx.fillRect(-3,8,2,6);ctx.fillStyle='#1a120a';ctx.fillRect(-4,12,10,5);ctx.fillStyle='#0a0806';ctx.fillRect(-4,12,10,2);ctx.restore();}
  zl(22-7,-legA);zl(22+5,legA);
  ctx.fillStyle=cl;ctx.fillRect(22-ww/2+2,h-40,ww-4,26);
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(22-ww/2+2,h-40,3,26);
  ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(22+ww/2-5,h-40,3,26);
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(22-2,h-40,1,26);
  ctx.fillStyle=cl;ctx.fillRect(22-6,h-42,12,4);
  const ga=30+Math.sin(w*Math.PI*2)*20;
  function za(ox,flip){ctx.save();ctx.translate(ox,h-36);ctx.scale(flip,1);ctx.rotate(-ga*Math.PI/180);ctx.fillStyle=cl;ctx.fillRect(0,-3,14,7);ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(0,-3,2,7);ctx.fillStyle=sk;ctx.fillRect(13,-4,10,8);ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(13,-4,2,8);ctx.restore();}
  za(22-ww/2+2,-1);za(22+ww/2-16,1);
  ctx.fillStyle=sk;ctx.fillRect(22-9,h-58,18,16);
  ctx.fillStyle='rgba(0,0,0,.1)';ctx.fillRect(22-9,h-58,3,16);
  ctx.fillStyle=sk;ctx.fillRect(22-11,h-52,2,4);ctx.fillRect(22+9,h-52,2,4);
  ctx.fillStyle=['#3a2818','#5a4030','#2a1810','#6a5030'][type];ctx.fillRect(22-9,h-58,18,5);
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(22-9,h-58,18,2);
  ctx.strokeStyle='#1a0e06';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(22-4,h-52,2.5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  ctx.beginPath();ctx.arc(22+4,h-52,2.5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  ctx.fillStyle='rgba(255,150,150,.5)';ctx.fillRect(22-8,h-49,3,2);ctx.fillRect(22+5,h-49,3,2);
  ctx.strokeStyle='#1a0e06';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(22,h-47,4,0.1*Math.PI,0.9*Math.PI);ctx.stroke();
  ctx.save();ctx.translate(22+12,h-30);
  if(type===0){
    ctx.fillStyle='#666';ctx.fillRect(-6,0,12,8);ctx.fillStyle='#888';ctx.fillRect(-7,-2,14,3);
    ctx.fillStyle='rgba(255,200,100,.7)';ctx.fillRect(-5,1,10,3);
    ctx.globalAlpha=.4+.2*Math.sin(t*.1);ctx.fillStyle='#fff';ctx.fillRect(-3,-5,2,3);ctx.fillRect(1,-6,2,3);ctx.globalAlpha=1;
  }else if(type===1){
    ctx.fillStyle='#aa6644';ctx.fillRect(-5,-3,10,7);ctx.fillStyle='#885533';ctx.fillRect(-5,-3,10,2);
    ctx.strokeStyle='#664422';ctx.lineWidth=.5;ctx.strokeRect(-5,-3,10,7);
  }else if(type===2){
    ctx.fillStyle='#eee';ctx.fillRect(-3,0,12,5);ctx.fillStyle='#ccc';ctx.fillRect(8,1,4,3);
    ctx.fillStyle='#4499dd';ctx.fillRect(-6,1,3,3);ctx.strokeStyle='#888';ctx.lineWidth=.5;ctx.strokeRect(-3,0,12,5);
  }else if(type===3){
    ctx.fillStyle='#888';ctx.fillRect(-4,0,4,12);ctx.fillStyle='#aaa';ctx.fillRect(-7,0,10,4);
    ctx.strokeStyle='#666';ctx.lineWidth=.5;ctx.strokeRect(-7,0,10,4);
  }
  ctx.restore();
  _zHPBar(22,h-68,hp,maxHp,0,0);
  _zStatusFX(22,h,z);
  ctx.restore();
}

// ═══════════════════════════════════════════

//  BOSS SPRITE
// ═══════════════════════════════════════════
function drawBoss(b,t){
  if(!b||!b.alive)return;
  ctx.save();
  const BW=80,BH=120;
  const by=GROUND_Y-BH;
  ctx.translate(b.x+BW/2,GROUND_Y);
  if(!b.facingR)ctx.scale(-1,1);
  // 彻底废除 Boss 受击透明度衰减
  ctx.translate(-BW/2,-BH);
  const w=b.walkT,legA=Math.sin(w*Math.PI*2)*28;
  // Shadow
  ctx.save();ctx.globalAlpha=.4;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(BW/2,BH+2,36,8,0,0,Math.PI*2);ctx.fill();ctx.restore();
  // Type-specific
  if(b.type===0){drawBossType0(ctx,b,BW,BH,t,legA,w);}
  else if(b.type===1){drawBossType1(ctx,b,BW,BH,t,legA,w);}
  else{drawBossType2(ctx,b,BW,BH,t,legA,w);}
  ctx.restore();
}
function drawBossType0(c,b,BW,BH,t,legA,w){ // MUTANT - giant festering zombie
  const sl=b.state==='slam'?Math.abs(Math.sin(b.stateTimer*.1))*-8:0;
  c.save();c.translate(0,sl);
  // Massive legs
  function bl(ox,la){c.save();c.translate(ox,BH-28);c.rotate(la*Math.PI/180);c.fillStyle='#3a2818';c.fillRect(-9,0,18,30);c.fillStyle='#2a1c10';c.fillRect(-9,0,4,30);c.fillStyle='#1a0e08';c.fillRect(-9,28,22,10);c.restore();}
  bl(12,-legA);bl(48,legA);
  // Torso - massive and hunched
  c.fillStyle='#5a7848';c.fillRect(4,BH-80,BW-8,52);
  c.fillStyle='#4a6038';c.fillRect(4,BH-80,8,52);c.fillStyle='#6a9058';c.fillRect(BW-20,BH-80,6,52);
  // Exposed guts
  c.fillStyle='rgba(180,20,20,.8)';c.fillRect(20,BH-60,20,18);
  c.fillStyle='rgba(120,10,10,.6)';c.fillRect(22,BH-58,16,14);
  // Arms - dragging on ground
  function ba(ox,flip,la2){c.save();c.translate(ox,BH-70);c.scale(flip,1);c.rotate(la2*Math.PI/180);c.fillStyle='#5a7848';c.fillRect(0,-6,28,12);c.fillStyle='#7a9a60';c.fillRect(26,-8,18,14);c.fillRect(40,-10,6,5);c.fillRect(40,-4,6,5);c.fillRect(40,2,6,5);c.restore();}
  ba(0,-1,-20-Math.sin(w*Math.PI*2)*25);ba(BW-6,1,-20-Math.sin(w*Math.PI*2+Math.PI)*25);
  // Neck
  c.fillStyle='#5a7848';c.fillRect(BW/2-8,BH-88,16,10);
  // Head - huge
  c.fillStyle='#6a8858';c.fillRect(BW/2-18,BH-118,36,32);
  // Face
  c.fillStyle='#1a0e06';c.fillRect(BW/2-12,BH-110,8,9);c.fillRect(BW/2+4,BH-110,8,9);
  c.fillStyle='#ff2200';c.fillRect(BW/2-10,BH-108,5,5);c.fillRect(BW/2+6,BH-108,5,5);
  c.fillStyle='#0e0808';c.fillRect(BW/2-10,BH-97,20,7);
  c.fillStyle='#d8c8a0';for(let i=0;i<5;i++)c.fillRect(BW/2-9+i*4,BH-96,3,5);
  // Rotting flesh patches
  ['#4a5a38','#8aaa68','#2a3820'].forEach((col,i)=>{c.fillStyle=col;c.fillRect(BW/2-14+i*8,BH-116,6,4);});
  c.restore();
}
function drawBossType1(c,b,BW,BH,t,legA,w){ // COMMANDER - undead warlord with projectiles
  c.save();
  // Armored legs
  function bl(ox,la){c.save();c.translate(ox,BH-30);c.rotate(la*Math.PI/180);c.fillStyle='#2a3040';c.fillRect(-9,0,18,32);c.fillStyle='#3a4458';c.fillRect(-9,0,18,8);c.fillStyle='#1a1818';c.fillRect(-9,28,22,10);c.restore();}
  bl(12,-legA);bl(48,legA);
  // Cape
  c.fillStyle='#6a0808';c.beginPath();c.moveTo(4,BH-88);c.lineTo(-8,BH-12);c.lineTo(16,BH-10);c.lineTo(4,BH-88);c.fill();
  c.beginPath();c.moveTo(BW-4,BH-88);c.lineTo(BW+8,BH-12);c.lineTo(BW-16,BH-10);c.lineTo(BW-4,BH-88);c.fill();
  // Torso - armored
  c.fillStyle='#2a3040';c.fillRect(4,BH-85,BW-8,55);
  c.fillStyle='#3a4458';c.fillRect(10,BH-82,BW-20,15);c.fillRect(10,BH-65,BW-20,15);
  c.fillStyle='#4a5a70';c.fillRect(BW/2-6,BH-88,12,6);
  // Glowing chest rune
  c.fillStyle=`hsl(${t*2},80%,55%)`;c.shadowBlur=10;c.shadowColor=`hsl(${t*2},80%,55%)`;
  c.beginPath();c.arc(BW/2,BH-70,8,0,Math.PI*2);c.fill();c.shadowBlur=0;
  // Arms with weapons
  c.save();c.translate(0,BH-72);c.rotate(-35*Math.PI/180);c.fillStyle='#2a3040';c.fillRect(0,-8,24,16);c.fillStyle='#888';c.fillRect(22,-4,16,8);c.restore();
  c.save();c.translate(BW-4,BH-72);c.rotate(35*Math.PI/180);c.fillStyle='#2a3040';c.fillRect(-24,-8,24,16);c.fillStyle='#888';c.fillRect(-38,-4,16,8);c.restore();
  // Head with crown
  c.fillStyle='#7a6048';c.fillRect(BW/2-14,BH-115,28,28);
  c.fillStyle='#c8a830';// Crown spikes
  [[BW/2-10,BH-120],[BW/2-3,BH-125],[BW/2+4,BH-120],[BW/2+10,BH-116]].forEach(([cx2,cy2])=>{c.beginPath();c.moveTo(cx2-3,BH-112);c.lineTo(cx2,cy2);c.lineTo(cx2+3,BH-112);c.fill();});
  c.fillRect(BW/2-12,BH-114,24,5);
  // Face - skull-like
  c.fillStyle='#100808';c.fillRect(BW/2-10,BH-109,7,10);c.fillRect(BW/2+3,BH-109,7,10);
  c.fillStyle='#ff8800';c.shadowBlur=8;c.shadowColor='#ff8800';
  c.fillRect(BW/2-8,BH-107,4,6);c.fillRect(BW/2+5,BH-107,4,6);c.shadowBlur=0;
  c.restore();
}
function drawBossType2(c,b,BW,BH,t,legA,w){ // UNDEAD MECH - zombie fused with machine
  c.save();
  // Metal legs with pistons
  function bl(ox,la){c.save();c.translate(ox,BH-30);c.rotate(la*Math.PI/180);c.fillStyle='#333a40';c.fillRect(-10,0,20,32);c.fillStyle='#4a5560';c.fillRect(-10,0,20,8);c.fillStyle='#222';c.fillRect(-10,28,24,10);c.restore();}
  bl(12,-legA);bl(48,legA);
  // Heavy chassis body
  c.fillStyle='#2a3038';c.fillRect(2,BH-92,BW-4,62);
  c.fillStyle='#3a4448';c.fillRect(2,BH-92,BW-4,8);
  // Armor plates
  c.fillStyle='#3a4448';c.fillRect(2,BH-84,12,54);c.fillRect(BW-14,BH-84,12,54);
  // Mechanical arms with guns
  const armA=Math.sin(w*Math.PI*2)*15;
  c.save();c.translate(-2,BH-80);c.rotate(-armA*Math.PI/180);
  c.fillStyle='#333a40';c.fillRect(-4,-6,28,12);c.fillStyle='#555';c.fillRect(24,-4,16,8);c.restore();
  c.save();c.translate(BW+2,BH-80);c.rotate(armA*Math.PI/180);
  c.fillStyle='#333a40';c.fillRect(-24,-6,28,12);c.fillStyle='#555';c.fillRect(-40,-4,16,8);c.restore();
  // Glowing vents
  for(let i=0;i<4;i++){const gv=.5+.5*Math.sin(t*.08+i);c.fillStyle=`rgba(0,220,255,${gv*.6})`;c.fillRect(16+i*8,BH-75,6,8);}
  // Mixed organic/metal head
  c.fillStyle='#2a3038';c.fillRect(BW/2-16,BH-122,32,30);
  c.fillStyle='#4a5560';c.fillRect(BW/2-16,BH-122,32,8);
  // Cyber eyes
  c.fillStyle='#00aaff';c.shadowBlur=12;c.shadowColor='#00aaff';
  c.beginPath();c.arc(BW/2-8,BH-108,6,0,Math.PI*2);c.fill();
  c.beginPath();c.arc(BW/2+8,BH-108,6,0,Math.PI*2);c.fill();
  c.shadowBlur=0;
  c.restore();
}

// ═══════════════════════════════════════════

//  VEHICLE SPRITE
// ═══════════════════════════════════════════
function drawVehicle(vh,t){
  if(!vh.exists)return;
  ctx.save();
  const vx=vh.x,vy=GROUND_Y-44;
  ctx.translate(vx+60,vy+44);
  if(!vh.facingR)ctx.scale(-1,1);
  ctx.translate(-60,-44);
  // Wheels (4)
  const wheelRot=vh.vx*.08;
  [[10,38],[26,42],[78,38],[92,42]].forEach(([wx,wy])=>{
    ctx.save();ctx.translate(wx,wy);ctx.rotate(wheelRot);
    ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#555';for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.fillRect(Math.cos(a)*2-1,Math.sin(a)*2-1,2,2);}
    ctx.restore();
  });
  // Hull
  ctx.fillStyle='#4a5840';ctx.fillRect(6,16,108,30);
  ctx.fillStyle='#3a4830';ctx.fillRect(6,16,10,30);ctx.fillStyle='#5a6a50';ctx.fillRect(108,16,6,30);
  // Angled front armor
  ctx.fillStyle='#4a5840';ctx.beginPath();ctx.moveTo(6,16);ctx.lineTo(26,8);ctx.lineTo(26,16);ctx.closePath();ctx.fill();
  ctx.fillStyle='#3a4830';ctx.beginPath();ctx.moveTo(6,46);ctx.lineTo(26,46);ctx.lineTo(20,44);ctx.closePath();ctx.fill();
  // Cockpit glass
  ctx.fillStyle='#1a2a30';ctx.fillRect(28,10,30,20);
  ctx.fillStyle='rgba(100,200,255,.12)';ctx.fillRect(30,12,26,16);
  // Player in vehicle
  ctx.fillStyle='#c4805a';ctx.fillRect(36,10,12,10);ctx.fillStyle='#3e5434';ctx.fillRect(34,8,16,6);
  // Body armor
  ctx.fillStyle='#5a6a50';ctx.fillRect(60,12,38,22);
  ctx.fillStyle='#4a5840';ctx.fillRect(90,14,8,18);
  // HP indicator
  const hpRatio=vh.hp/vh.maxHp;
  ctx.fillStyle='#1a0505';ctx.fillRect(6,2,108,5);
  ctx.fillStyle=hpRatio>.5?'#27ae60':hpRatio>.25?'#f39c12':'#c0392b';
  ctx.fillRect(6,2,108*hpRatio,5);
  // Turret
  const tAngle=vh.turretAngle;
  ctx.save();ctx.translate(78,18);ctx.rotate(tAngle);
  ctx.fillStyle='#3a4030';ctx.fillRect(-8,-6,16,12);
  ctx.fillStyle='#222';ctx.fillRect(6,-3,20,6);ctx.restore();
  // Damage scratches
  if(vh.hp<100){ctx.strokeStyle='#222';ctx.lineWidth=1.5;[[20,20,40,30],[70,14,85,22]].forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});}
  ctx.restore();
}

// ═══════════════════════════════════════════

//  SPRITE COMPANION
// ═══════════════════════════════════════════
function drawSprite(sp,t){
  if(!sp.exists)return;
  ctx.save();
  const {x,y}=sp;
  const pulse=.7+.3*Math.sin(t*.06);
  // Orbiting particles
  for(let i=0;i<6;i++){const a=t*.03+i*(Math.PI*2/6);const r=14+Math.sin(t*.04+i)*3;
    ctx.fillStyle=`hsla(${200+i*30},90%,70%,${pulse*.8})`;
    ctx.beginPath();ctx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,1.5,0,Math.PI*2);ctx.fill();}
  // Glow
  const g=ctx.createRadialGradient(x,y,0,x,y,20*pulse);
  g.addColorStop(0,'rgba(180,230,255,.7)');g.addColorStop(.5,'rgba(100,180,255,.3)');g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,20*pulse,0,Math.PI*2);ctx.fill();
  // Core
  ctx.shadowBlur=12;ctx.shadowColor='#80c8ff';
  const cg=ctx.createRadialGradient(x,y,0,x,y,8);
  cg.addColorStop(0,'#ffffff');cg.addColorStop(.5,'#b0e0ff');cg.addColorStop(1,'#4090ff');
  ctx.fillStyle=cg;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();
  // Wing-like aura lines
  for(let i=0;i<4;i++){const a=t*.04+i*(Math.PI/2);
    ctx.strokeStyle=`rgba(150,220,255,${pulse*.5})`;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*18,y+Math.sin(a)*10);ctx.stroke();}
  // Level indicator
  if(sp.level>=2){ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(x+8,y-8,3,0,Math.PI*2);ctx.fill();}
  ctx.shadowBlur=0;ctx.restore();
}

// ═══════════════════════════════════════════

//  BOSS PROJECTILE
// ═══════════════════════════════════════════
function drawBossProj(bp){
  ctx.save();ctx.translate(bp.x,bp.y);
  ctx.shadowBlur=10;ctx.shadowColor=bp.color;
  ctx.fillStyle=bp.color;
  if(bp.type==='rock'){ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#888';ctx.fillRect(-4,-4,3,3);}
  else if(bp.type==='skull'){ctx.font='16px serif';ctx.fillText('💀',-8,-8);}
  else if(bp.type==='acid'){ctx.beginPath();ctx.ellipse(0,0,7,5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#88ff44';ctx.beginPath();ctx.arc(-2,-2,2,0,Math.PI*2);ctx.fill();}
  else{ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

// ═══════════════════════════════════════════

//  ELITE ZOMBIE SYSTEM
// ═══════════════════════════════════════════

// ── Elite config ────────────────────────────────────────
const ELITE_TYPES=[
  // 1: 视力障碍抛物手—— 抛掷哑铃/花盆/哈士奇
  {id:1,name:'视力障碍抛物手',hp:60,speed:0.95,pts:30,coins:18,
   color1:'#4a6a8a',color2:'#2a4a6a',projColor:'#aa8844'},
  // 2: 热心搬家大哥—— 扛冰箱直线狂飙，撞墙眩晕
  {id:2,name:'热心搬家大哥',hp:50,speed:1.6,pts:25,coins:15,
   color1:'#aa8855',color2:'#886633',projColor:'#ffaa44'},
  // 3: 强迫症保洁阿姨—— 改为倒洗洁精打滑陷阱型
  {id:3,name:'强迫症保洁阿姨',hp:100,speed:.65,pts:35,coins:22,
   color1:'#5588aa',color2:'#3a6688',projColor:'#88ccee'},
  // 4: 庆祝狂人—— 改为自爆型，抱烟花冲来
  {id:4,name:'庆祝狂人',hp:70,speed:1.1,pts:40,coins:25,
   color1:'#cc4488',color2:'#882266',projColor:'#ff66aa'},
];

// ── Poison pools (from spitter death) ──────────────────
const poisonPools=[];
function spawnPoisonPool(wx){
  poisonPools.push({x:wx,y:GROUND_Y,r:70,life:180,decay:1/180});
  sndExplosion();
  mkP({x:wx,y:GROUND_Y-10,r:12,rDecay:.8,decay:.06,color:'#44cc22',type:'circle',alpha:.8,grav:0,blur:true});
}
function updatePoisonPools(){
  const pcx=vehicle.entered?(vehicle.x+60):(player.x+CHAR_W/2);
  const pcy=player.y+CHAR_H/2;
  for(let i=poisonPools.length-1;i>=0;i--){
    const p=poisonPools[i];
    p.life-=p.decay;
    if(p.life<=0){poisonPools.splice(i,1);continue;}
    // Damage player if standing in pool
    // Bug修复：原判定是竖直平面圆 sqrt(dx²+dy²)<r——池y=GROUND_Y(420)而玩家y≈286，
    // dy常年在130以上>半径70，玩家站池里永远不挨毒（视觉椭圆与判定完全不符）。
    // 改为与视觉一致的横向判定：只看水平距离（玩家在地面/低空时才受毒）。
    if(player.iframes===0&&!vehicle.entered){
      if(Math.abs(pcx-p.x)<p.r && player.y+CHAR_H>GROUND_Y-70){
        if(frameT%45===0){takeDamage(4);vfxPlayerHurt(player.x,player.y);}
        // 踩入提示：绿雾粒子
        if(frameT%20===0)mkP({x:pcx,y:GROUND_Y-30,vx:(Math.random()-.5)*1.5,vy:-1-Math.random(),r:2+Math.random()*2,decay:.06,color:'#66cc33',type:'circle',grav:-.02,alpha:.6,blur:true});
      }
    }
    // VFX: bubbles（美术升级：更密集的毒泡+边缘毒圈线）
    if(frameT%6===0)mkP({x:p.x+(Math.random()-.5)*p.r*1.6,y:GROUND_Y-2-Math.random()*5,
      vx:(Math.random()-.5)*.3,vy:-.6-Math.random()*.6,r:1.5+Math.random()*2.5,decay:.05,
      color:Math.random()>.4?'#44cc22':'#88ee44',type:'circle',grav:-.02,alpha:.7,blur:true});
  }
}
function drawPoisonPools(){
  poisonPools.forEach(p=>{
    ctx.save();ctx.globalAlpha=p.life*.4;
    const g=ctx.createRadialGradient(p.x,GROUND_Y,0,p.x,GROUND_Y,p.r);
    g.addColorStop(0,'rgba(68,204,34,.5)');g.addColorStop(.7,'rgba(34,136,17,.3)');g.addColorStop(1,'transparent');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,GROUND_Y,p.r,12,0,0,Math.PI*2);ctx.fill();
    // 美术升级：毒圈边缘线（清晰可辨的腐蚀边界，与判定半径一致）
    ctx.globalAlpha=p.life*.55;
    ctx.strokeStyle='rgba(110,220,60,.7)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.ellipse(p.x,GROUND_Y,p.r,12,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  });
}

// ── 地面火海（凝固汽油弹/龙息炮/特餐遗留）──
function updateAndDrawGroundFires(){
  if(!window._groundFires || window._groundFires.length===0) return;
  const fires = window._groundFires;
  // 限制最大地面火焰数量，防止大量堆叠致性能与绘制卡顿
  if(fires.length > 18){
    fires.splice(0, fires.length - 18);
  }
  for(let i=fires.length-1; i>=0; i--){
    const f = fires[i];
    f.life--;
    f.tickT++;
    // 每秒对范围内僵尸造成伤害
    if(f.tickT >= 60){
      f.tickT = 0;
      zombies.forEach(z => {
        if(z.alive && Math.abs((z.x+22)-f.x) < 60 && z.y < Z_TOP+80){
          hitZombie(z, z.x+22, Z_TOP+28, f.dmg, f.x, f.y);
        }
      });
      if(boss && boss.alive && Math.abs((boss.x+40)-f.x) < 80){
        hitBoss(getDamage(f.dmg), boss.x+40, GROUND_Y-80, f.x, f.y);
      }
    }
    if(f.life <= 0){ fires.splice(i,1); continue; }
    // 绘制火海
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life/60) * 0.8;
    const g = ctx.createRadialGradient(f.x, Z_TOP+50, 0, f.x, Z_TOP+50, 70);
    g.addColorStop(0, 'rgba(255,150,30,.7)');
    g.addColorStop(0.5, 'rgba(255,80,0,.5)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(f.x, Z_TOP+50, 70, 14, 0, 0, Math.PI*2); ctx.fill();
    // 火焰粒子——概率采样，避免同屏几十个火海每帧生成上百个粒子致死卡顿
    if(Math.random() < 0.35){
      mkP({x:f.x+(Math.random()-.5)*60, y:Z_TOP+45, vx:(Math.random()-.5)*1.5, vy:-2-Math.random()*2, r:2+Math.random()*2, rDecay:.06, decay:.05, color:Math.random()>.5?'#ff6600':'#ffaa00', type:'circle', alpha:.8, grav:.05});
    }
    ctx.restore();
  }
}

// ── Elite AI update ────────────────────────────────────
function updateElite(z){
  if(!z.alive||!z.elite)return;
  z.stateTimer=(z.stateTimer||0)+1;
  const pcx=vehicle.entered?(vehicle.x+60):(player.x+CHAR_W/2);
  const zcx=z.x+22;
  const dist=Math.abs(pcx-zcx);
  // 城堡塔防制（v47回退）：旧精英追击玩家
  const dir=Math.sign(pcx-zcx);
  z.facingR=(dir>0);

  switch(z.elite){
    case 1: updateSpitter(z,pcx,zcx,dist,dir); break;
    case 2: updateCharger(z,pcx,zcx,dist,dir); break;
    case 3: updateShielder(z,pcx,zcx,dist,dir); break;
    case 4: updateSummoner(z,pcx,zcx,dist,dir); break;
  }
}

// Elite 1: Spitter — ranged acid spit, leaves poison on death
function updateSpitter(z,pcx,zcx,dist,dir){
  switch(z.state){
    case'idle':
      // Walk toward player until mid-range
      z.x+=dir*z.spd;z.walkT+=.055*z.spd;
      if(dist<300&&dist>120)z.state='spit';
      else if(dist<=120)z.state='retreat';
      if(z.stateTimer>180)z.state='spit'; // force spit every 3s
      if(z.state!=='idle')z.stateTimer=0;
      break;
    case'spit':
      z.walkT+=0; // stand still
      if(z.stateTimer===1){
        // Fire acid projectile toward player
        const angle=Math.atan2((player.y+CHAR_H/2)-(Z_TOP+28),pcx-zcx);
        bossProjList.push({x:zcx,y:Z_TOP+28,vx:Math.cos(angle)*5,vy:Math.sin(angle)*5,
          active:true,type:'acid',color:'#44cc22',fromElite:true});
        sndBossProj();
        mkP({x:zcx,y:Z_TOP+20,r:6,rDecay:.5,decay:.1,color:'#66ff33',type:'circle',blur:true,alpha:.8});
      }
      if(z.stateTimer>40){z.state='idle';z.stateTimer=0;}
      break;
    case'retreat':
      z.x-=dir*z.spd*1.3;z.walkT+=.055*z.spd;
      if(dist>200||z.stateTimer>60){z.state='idle';z.stateTimer=0;}
      break;
  }
}

// Elite 2: Charger — wind up then dash
function updateCharger(z,pcx,zcx,dist,dir){
  switch(z.state){
    case'idle':
      z.x+=dir*z.spd;z.walkT+=.055*z.spd;
      if(z.stateTimer>100){z.state='windup';z.stateTimer=0;}
      break;
    case'windup':
      // Red glow warning, stand still
      if(z.stateTimer%8===0)mkP({x:zcx,y:GROUND_Y,r:20+Math.random()*10,rDecay:.8,decay:.08,
        color:'rgba(255,60,20,.4)',type:'circle',alpha:.5,grav:0});
      // Red line on ground toward player
      if(frameT%4===0){mkP({x:zcx+(Math.random()-.5)*6,y:GROUND_Y-1,vx:0,vy:0,r:1.5,decay:.06,
        color:'#ff4400',type:'circle',grav:0,alpha:.7});}
      if(z.stateTimer>60){z.state='dash';z.stateTimer=0;z.dashDir=dir;z.dashHits=false;}
      break;
    case'dash':
      z.x+=z.dashDir*12;z.walkT+=.3;
      // Hit player during dash
      if(!z.dashHits&&!vehicle.entered&&player.iframes===0){
        if(Math.abs(pcx-zcx)<38&&player.y+CHAR_H>Z_TOP+10){
          takeDamage(15);player.vx=z.dashDir*10;player.vy=-5;player.onGround=false;
          player.iframes=80;vfxPlayerHurt(player.x,player.y);z.dashHits=true;
        }
      }
      // Dust trail
      if(frameT%2===0)mkP({x:zcx,y:GROUND_Y-2,vx:(Math.random()-.5)*3,vy:-Math.random()*2,
        r:3+Math.random()*3,rDecay:.06,decay:.04,color:'#8a6030',type:'circle',grav:0,alpha:.6});
      if(z.stateTimer>20){z.state='cooldown';z.stateTimer=0;}
      break;
    case'cooldown':
      z.x+=dir*z.spd*.3;z.walkT+=.03;
      if(z.stateTimer>80){z.state='idle';z.stateTimer=0;}
      break;
  }
}

// Elite 3: Shielder — frontal shield blocks bullets
function updateShielder(z,pcx,zcx,dist,dir){
  // 护盾朝向固定，每 180 帧（3秒）翻转一次，玩家可绕背攻击（修复阶段A3）
  if(z.shieldDir===undefined)z.shieldDir=dir<0?-1:1;
  z.stateTimer=(z.stateTimer||0)+1;
  if(z.stateTimer>180){z.shieldDir=-z.shieldDir;z.stateTimer=0;z.shieldFlash=1;}
  z.x+=dir*z.spd;z.walkT+=.04;
  // 护盾闪光衰减
  if(z.shieldFlash>0)z.shieldFlash=Math.max(0,z.shieldFlash-.05);
}

// Elite 4: Summoner — periodic zombie summon + blink teleport
function updateSummoner(z,pcx,zcx,dist,dir){
  // Float effect (oscillate y offset)
  z.floatOffset=Math.sin(frameT*.04)*6;
  switch(z.state){
    case'idle':
      // Maintain mid-range
      if(dist>350)z.x+=dir*z.spd;
      else if(dist<200)z.x-=dir*z.spd;
      z.walkT+=.03;
      if(z.stateTimer>180){z.state='summon';z.stateTimer=0;}
      // Random blink teleport to dodge bullets
      if(z.stateTimer>60&&Math.random()<.005){
        z.x+=dir*(60+Math.random()*40);
        z.x=Math.max(0,Math.min(WORLD_W-44,z.x));
        for(let i=0;i<12;i++){const a=Math.random()*Math.PI*2;mkP({x:zcx,y:Z_TOP+28,
          vx:Math.cos(a)*3,vy:Math.sin(a)*3,r:2,decay:.06,color:'#aa44ff',type:'circle',grav:0,alpha:.7,blur:true});}
      }
      break;
    case'summon':
      // Stand still, channel summon
      if(z.stateTimer%6===0)mkP({x:zcx+(Math.random()-.5)*30,y:Z_TOP+20+Math.random()*30,
        vx:0,vy:-1-Math.random(),r:2+Math.random()*2,decay:.04,color:'#aa44ff',type:'circle',grav:-.03,alpha:.7});
      if(z.stateTimer===60){
        // Summon 2 zombies near self
        for(let i=0;i<2;i++){
          const sx2=z.x+(i===0?-50:50)+Math.random()*20;
          spawnZombieAt(sx2);
        }
        addBanner('☠ 亡灵召唤！');
        sndBossRoar();
      }
      if(z.stateTimer>90){z.state='idle';z.stateTimer=0;}
      break;
  }
}

// Helper: spawn a normal zombie at specific world x
function spawnZombieAt(sx){
  if(!gameRunning)return;
  const td=ZTYPES[Math.floor(Math.random()*Math.min(Math.ceil(wave/2),ZTYPES.length))];
  const spd=(td.speed)*(1+(wave-1)*.12);
  const hp=td.hp+Math.floor(wave/3);
  const z={x:sx,hp,maxHp:hp,spd,alive:true,type:td.type,pts:td.pts,coinReward:td.coins,walkT:Math.random(),facingR:false,hitFlash:0,burnTimer:null,burning:false};
  if (gameState === 'building') {
    buildingInteriorZombies.push(z);
  } else {
    zombies.push(z);
  }
}

// ── Elite drawing ──────────────────────────────────────
// Shared leg helper for elite drawings (top-level, not closure)
function elLeg(ox,la,footCol){
  ctx.save();ctx.translate(ox,56);ctx.rotate(la*Math.PI/180);
  ctx.fillStyle=footCol||'#1a120a';ctx.fillRect(-4,0,8,12);ctx.fillStyle=footCol||'#1a120a';ctx.fillRect(-4,11,10,5);ctx.restore();
}

function drawElite(z,t){
  if(!z.alive||!z.elite)return;
  const bob = Math.abs(Math.sin((z.walkT||0) * Math.PI * 2)) * 2.8;
  const y=Z_TOP+(z.elite===4?(z.floatOffset||0):bob);
  ctx.save();ctx.translate(z.x+22,y+58);if(!z.facingR)ctx.scale(-1,1);
  ctx.translate(-22,-58);
  const w=z.walkT,legA=Math.sin(w*Math.PI*2)*20;
  const et=ELITE_TYPES[z.elite-1];

  switch(z.elite){
    case 1: drawSpitter(et,legA,t,z); break;
    case 2: drawCharger(et,legA,t,z); break;
    case 3: drawShielder(et,legA,t,z); break;
    case 4: drawSummoner(et,t,z); break;
  }

  // Elite name tag
  ctx.fillStyle='rgba(255,255,255,.15)';ctx.font='7px sans-serif';ctx.textAlign='center';
  ctx.fillText(et.name,22,-4);

  // HP bar (wider for elites)
  const bw=44,bx=22-22,by=-12;
  ctx.fillStyle='#1a0505';ctx.fillRect(bx,by,bw,5);
  ctx.fillStyle=z.hp/z.maxHp>.5?'#27ae60':z.hp/z.maxHp>.25?'#f39c12':'#c0392b';
  ctx.fillRect(bx,by,bw*Math.max(0,z.hp/z.maxHp),5);
  ctx.strokeStyle='#0a0505';ctx.lineWidth=.5;ctx.strokeRect(bx,by,bw,5);

  // Burning
  if(z.burning){ctx.globalAlpha=.3+Math.random()*.2;ctx.fillStyle='#ff6600';ctx.fillRect(22-20,y+58-54,40,54);ctx.globalAlpha=1;}
  ctx.restore();
}

function drawSpitter(et,legA,t,z){
  // 视力障碍抛物手大爷：穿便装、戴老花镜、手里拿着要扔的东西
  elLeg(14,-legA,'#3a3a4a');elLeg(28,legA,'#3a3a4a');
  // 身体（便装）
  ctx.fillStyle='#6a7a8a';ctx.fillRect(8,26,28,28);
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(8,26,4,28);
  // 背包（装着要扔的东西）
  ctx.fillStyle='#5a4a3a';ctx.fillRect(32,28,8,16);
  ctx.fillStyle='#7a6a5a';ctx.fillRect(33,30,6,12);
  // 头（老头肤色）
  ctx.fillStyle='#d4a878';ctx.fillRect(14,-4,16,14);
  // 秃顶 + 边发
  ctx.fillStyle='#999';ctx.fillRect(14,-4,16,2);ctx.fillStyle='#aaa';ctx.fillRect(14,-2,4,3);ctx.fillRect(26,-2,4,3);
  // 老花镜（圆框）
  ctx.strokeStyle='#333';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(18,2,3,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(26,2,3,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(21,2);ctx.lineTo(23,2);ctx.stroke();
  // 镜片后的眯眼
  ctx.fillStyle='#1a0e06';ctx.fillRect(17,1,2,2);ctx.fillRect(25,1,2,2);
  // 微笑嘴
  ctx.strokeStyle='#1a0e06';ctx.lineWidth=1;ctx.beginPath();ctx.arc(22,7,3,0.1*Math.PI,0.9*Math.PI);ctx.stroke();
  // 手臂举起准备扔
  ctx.save();ctx.translate(8,30);ctx.rotate(-45*Math.PI/180);
  ctx.fillStyle='#6a7a8a';ctx.fillRect(0,-3,16,6);ctx.fillStyle='#d4a878';ctx.fillRect(14,-3,8,6);
  // 手里拿着花盆
  ctx.fillStyle='#8a6a4a';ctx.fillRect(20,-5,8,10);ctx.fillStyle='#5a8a3a';ctx.fillRect(21,-8,6,4);
  ctx.restore();
}

function drawCharger(et,legA,t,z){
  // 热心搬家大哥：壮汉、扛着双开门冰箱、看不到路
  elLeg(14,-legA,'#2a2a3a');elLeg(28,legA,'#2a2a3a');
  // 身体（壮汉，背心）
  ctx.fillStyle='#aa8855';ctx.fillRect(6,22,32,30);
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(6,22,4,30);
  // 背心条纹
  ctx.fillStyle='#ccaa77';ctx.fillRect(10,24,24,4);ctx.fillRect(10,32,24,4);
  // 手臂前伸扛冰箱
  ctx.save();ctx.translate(4,26);ctx.rotate(-35*Math.PI/180);
  ctx.fillStyle='#aa8855';ctx.fillRect(0,-4,22,8);ctx.restore();
  ctx.save();ctx.translate(38,26);ctx.rotate(15*Math.PI/180);
  ctx.fillStyle='#aa8855';ctx.fillRect(-18,-4,22,8);ctx.restore();
  // 头（壮汉肤色）
  ctx.fillStyle='#d4a878';ctx.fillRect(14,-6,16,14);
  ctx.fillStyle='#3a2818';ctx.fillRect(14,-6,16,4); // 头发
  // 开心眯眼（看不到路但很开心）
  ctx.strokeStyle='#1a0e06';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(18,0,2.5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  ctx.beginPath();ctx.arc(26,0,2.5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  // 大微笑
  ctx.beginPath();ctx.arc(22,5,4,0.1*Math.PI,0.9*Math.PI);ctx.stroke();
  // 腮红
  ctx.fillStyle='rgba(255,150,150,.4)';ctx.fillRect(15,3,3,2);ctx.fillRect(26,3,3,2);
  // 扛着的双开门冰箱（遮住上半身视线）
  ctx.fillStyle='#ddddee';ctx.fillRect(-2,-20,48,44);
  ctx.fillStyle='#bbbccc';ctx.fillRect(-2,-20,48,4);ctx.fillRect(-2,20,48,4);
  ctx.strokeStyle='#999';ctx.lineWidth=1;ctx.strokeRect(-2,-20,48,44);
  // 冰箱门把手
  ctx.fillStyle='#888';ctx.fillRect(20,-16,2,8);ctx.fillRect(20,8,2,8);
  // 冲锋时的动态模糊
  if(z && z.state==='dash'){ctx.globalAlpha=.3;ctx.fillStyle='#ffaa44';ctx.fillRect(-20,22,30,30);ctx.globalAlpha=1;}
  if(z && z.state==='windup'){ctx.globalAlpha=.3+.3*Math.sin(t*.15);ctx.fillStyle='#ffaa44';ctx.fillRect(6,22,32,30);ctx.globalAlpha=1;}
}

function drawShielder(et,legA,t,z){
  // 强迫症保洁阿姨：穿围裙、提水桶、拿拖把，护盾是“刚拖的湿地”
  elLeg(16,-legA,'#3a3a4a');elLeg(26,legA,'#3a3a4a');
  // 身体（围裙装）
  ctx.fillStyle='#5588aa';ctx.fillRect(6,24,32,28);
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(6,24,5,28);
  // 围裙带
  ctx.fillStyle='#3a6688';ctx.fillRect(18,24,8,28);
  // 护盾 = 拖把挡在前面（保留护盾机制）
  ctx.save();ctx.translate(6,28);
  ctx.fillStyle='#8a6a4a';ctx.fillRect(-6,-16,4,30); // 拖把杆
  ctx.fillStyle='#ccaa66';ctx.fillRect(-10,-18,10,8); // 拖把头
  ctx.fillStyle='#ddc077';ctx.fillRect(-10,-16,10,4);
  // 护盾闪光
  if(z.shieldFlash>0){
    ctx.globalAlpha=z.shieldFlash;
    ctx.fillStyle='#aaddff';ctx.fillRect(-10,-18,10,30);
    ctx.globalAlpha=1;
  }
  ctx.restore();
  // 后手提水桶
  ctx.save();ctx.translate(38,30);ctx.rotate(20*Math.PI/180);
  ctx.fillStyle='#4499cc';ctx.fillRect(-14,-6,14,10); // 水桶
  ctx.fillStyle='#3388bb';ctx.fillRect(-14,-6,14,3);
  ctx.fillStyle='rgba(150,220,255,.6)';ctx.fillRect(-12,-4,10,3); // 水
  ctx.restore();
  // 头（阿姨肤色）
  ctx.fillStyle='#dcb088';ctx.fillRect(14,-2,16,14);
  // 头发（卷发头巾）
  ctx.fillStyle='#cc6688';ctx.fillRect(14,-4,16,6);
  // 眯眯笑眼
  ctx.strokeStyle='#1a0e06';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(18,3,2.5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  ctx.beginPath();ctx.arc(26,3,2.5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  // 开心微笑
  ctx.beginPath();ctx.arc(22,8,3,0.1*Math.PI,0.9*Math.PI);ctx.stroke();
}

function drawSummoner(et,t,z){
  // 庆祝狂人：抱看点燃的烟花、开心地冲过来、随时爆炸
  // 浮动效果保留
  // 身体（派对装）
  ctx.fillStyle='#cc4488';ctx.fillRect(8,10,28,46);
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(8,10,4,46);
  // 派对帽
  ctx.fillStyle='#ffcc44';ctx.beginPath();ctx.moveTo(14,-2);ctx.lineTo(22,-18);ctx.lineTo(30,-2);ctx.fill();
  ctx.fillStyle='#ff8844';ctx.fillRect(20,-20,4,4);
  // 头（开心脸）
  ctx.fillStyle='#dcb088';ctx.fillRect(12,-4,20,16);
  // 大笑眯眼
  ctx.strokeStyle='#1a0e06';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(17,2,2.5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  ctx.beginPath();ctx.arc(27,2,2.5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  // 张大嘴笑
  ctx.fillStyle='#1a0e06';ctx.fillRect(17,7,10,4);
  ctx.fillStyle='#ff5577';ctx.fillRect(18,8,8,2); // 舌头
  // 腮红
  ctx.fillStyle='rgba(255,100,100,.5)';ctx.fillRect(13,4,3,2);ctx.fillRect(28,4,3,2);
  // 抱着的大烟花（替代法杖）
  ctx.save();ctx.translate(36,24);ctx.rotate(.15*Math.sin(t*.04));
  ctx.fillStyle='#cc3333';ctx.fillRect(-4,-16,8,32); // 烟花筒
  ctx.fillStyle='#aa2222';ctx.fillRect(-4,-16,8,4);
  ctx.fillStyle='#ffcc44';ctx.fillRect(-3,-18,6,3);
  // 引线闪烁火花
  const spark=.5+.5*Math.sin(t*.3);
  ctx.shadowBlur=8;ctx.shadowColor='#ff8800';
  ctx.fillStyle=`rgba(255,${150+spark*100|0},0,.9)`;
  ctx.beginPath();ctx.arc(0,-20,2+spark,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
  // 底部飘浮
  const fw=Math.sin(t*.05)*.3;
  ctx.save();ctx.translate(22,56);ctx.rotate(fw);
  ctx.fillStyle='#cc4488';ctx.fillRect(-14,0,28,6);ctx.restore();
  // “召唤”状态改为“点燃”闪烁光环
  if(z && z.state==='summon'){
    ctx.globalAlpha=.4+.3*Math.sin(t*.12);
    ctx.strokeStyle='#ff66aa';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(22,30,20+Math.sin(t*.08)*5,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=1;
  }
}

// ═══════════════════════════════════════════

//  SPECIAL WEAPONS FX & DAMAGE PIPELINE
// ═══════════════════════════════════════════
window._plasmaVortices = [];
window._ionizationTrails = [];
window._sonicWaves = [];

function triggerPlasmaVortex(x, y, dmg){
  window._plasmaVortices.push({x, y, radius: 130, life: 45, maxLife: 45, dmg});
  vfxExplosion(x, y, 90);
  try {
    const a=getACtx();if(a){
      const osc=a.createOscillator(),g=a.createGain(),t=a.currentTime;
      osc.type='sawtooth';osc.frequency.setValueAtTime(320,t);osc.frequency.exponentialRampToValueAtTime(60,t+0.35);
      g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
      osc.connect(g);g.connect(a.destination);osc.start(t);osc.stop(t+0.36);
    }
  }catch(e){}
}

function updateAndDrawSpecialWeaponVFX(){
  // 1. 等离子引力坍缩漩涡
  if(window._plasmaVortices && window._plasmaVortices.length){
    for(let i = window._plasmaVortices.length - 1; i >= 0; i--){
      const v = window._plasmaVortices[i];
      v.life--;
      if(v.life <= 0){ window._plasmaVortices.splice(i, 1); continue; }
      const progress = 1 - v.life / v.maxLife;
      const alpha = Math.sin(progress * Math.PI);
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(progress * 14);
      ctx.globalAlpha = alpha * 0.75;
      const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, v.radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, 'rgba(180,90,255,0.7)');
      grad.addColorStop(0.7, 'rgba(0,220,255,0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, v.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#cceeff';
      ctx.lineWidth = 2.5;
      for(let s = 0; s < 4; s++){
        ctx.beginPath();
        ctx.arc(0, 0, v.radius * 0.65, s * Math.PI / 2, s * Math.PI / 2 + 1.2);
        ctx.stroke();
      }
      ctx.restore();
      if(v.life % 4 === 0){
        const targets = (gameState === 'building') ? buildingInteriorZombies : zombies;
        targets.forEach(z => {
          if(!z.alive) return;
          const zx = z.x + 22, zy = Z_TOP + 28;
          const dx = v.x - zx, dy = v.y - zy;
          const dist = Math.hypot(dx, dy);
          if(dist < v.radius + 30 && dist > 6){
            z.x += (dx / dist) * 4.5;
            hitZombie(z, zx, zy, v.dmg * 0.16, v.x, v.y, 0, 'energy');
            ignitZombie(z);
          }
        });
      }
    }
  }

  // 2. 电磁轨道炮残留电离闪电光轨
  if(window._ionizationTrails && window._ionizationTrails.length){
    for(let i = window._ionizationTrails.length - 1; i >= 0; i--){
      const tr = window._ionizationTrails[i];
      tr.life--;
      if(tr.life <= 0){ window._ionizationTrails.splice(i, 1); continue; }
      const p = tr.life / tr.maxLife;
      ctx.save();
      ctx.globalAlpha = p * 0.9;
      ctx.strokeStyle = '#5be4ff';
      ctx.lineWidth = 6 * p + 1.5;
      ctx.shadowBlur = 18 * p;
      ctx.shadowColor = '#00eeff';
      ctx.beginPath();
      ctx.moveTo(tr.x1, tr.y1);
      ctx.lineTo(tr.x2, tr.y2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * p;
      ctx.stroke();
      if(Math.random() < 0.6){
        const frac = Math.random();
        const sx = tr.x1 + (tr.x2 - tr.x1) * frac;
        const sy = tr.y1 + (tr.y2 - tr.y1) * frac;
        mkP({x: sx, y: sy, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, r: 2, rDecay: 0.1, decay: 0.08, color: '#00ffff', type: 'spark', alpha: 0.9});
      }
      ctx.restore();
      if(tr.life % 6 === 0){
        railHitscan(tr.x1, tr.y1, tr.x2, tr.y2, tr.dmg, 30);
      }
    }
  }

  // 3. 次声波震荡枪扩散锥形声纹
  if(window._sonicWaves && window._sonicWaves.length){
    for(let i = window._sonicWaves.length - 1; i >= 0; i--){
      const sw = window._sonicWaves[i];
      sw.radius += sw.speed;
      sw.life--;
      if(sw.life <= 0 || sw.radius >= sw.maxRadius){ window._sonicWaves.splice(i, 1); continue; }
      const p = sw.life / sw.maxLife;
      ctx.save();
      ctx.globalAlpha = p * 0.8;
      ctx.strokeStyle = '#ffe855';
      ctx.lineWidth = 3.5 * p + 1.2;
      ctx.shadowBlur = 14 * p;
      ctx.shadowColor = '#ffbb00';
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, sw.angle - 0.55, sw.angle + 0.55);
      ctx.stroke();
      ctx.restore();
      if(sw.dmg > 0 && sw.life % 3 === 0){
        const targets = (gameState === 'building') ? buildingInteriorZombies : zombies;
        targets.forEach(z => {
          if(!z.alive) return;
          const zx = z.x + 22, zy = Z_TOP + 28;
          const dx = zx - sw.x, dy = zy - sw.y;
          const dist = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx);
          const angDiff = Math.abs(ang - sw.angle);
          if(Math.abs(dist - sw.radius) < 32 && angDiff < 0.65){
            const pushDir = Math.cos(sw.angle) > 0 ? 1 : -1;
            z.x += pushDir * 60;
            z.armorBreakT = 240;
            z.hitStun = 100;
            hitZombie(z, zx, zy, sw.dmg * 0.45, sw.x, sw.y, 2.5, 'energy');
            spawnFloatText('震荡破甲!', zx, Z_TOP-18, '#ffe855');
          }
        });
      }
    }
  }
}

// ═══════════════════════════════════════════

//  BULLET DRAWING
// ═══════════════════════════════════════════
function drawBullets(){
  bullets.forEach(b=>{
    if(!b.active)return;
    ctx.save();const angle=Math.atan2(b.vy,b.vx);ctx.translate(b.x,b.y);ctx.rotate(angle);
    // ── 拖尾曳光 ──（美术升级：塔弹也有曳光）
    const trailMap={'pistol':18,'minigun':14,'smg':16,'smg_heavy':18,'sniper':26,'tesla':20,'plasma':22,
                    'turret':14,'_towerCannon':12,'_towerFreeze':14,'rocket':20,'revolver':16,'crossbow':0};
    if(trailMap[b.wpn]){
      const trailLen=trailMap[b.wpn];
      const trailColors={'pistol':'rgba(255,200,60,.65)','minigun':'rgba(255,238,128,.7)','smg':'rgba(255,220,100,.6)','smg_heavy':'rgba(255,200,80,.65)','sniper':'rgba(150,255,150,.7)','tesla':'rgba(120,220,255,.7)','plasma':'rgba(200,120,255,.7)',
                         'turret':'rgba(255,204,68,.75)','_towerCannon':'rgba(255,136,51,.7)','_towerFreeze':'rgba(155,228,255,.7)','rocket':'rgba(255,100,30,.8)','revolver':'rgba(255,215,0,.75)'};
      const g=ctx.createLinearGradient(-trailLen,0,0,0);
      g.addColorStop(0,'rgba(0,0,0,0)');
      g.addColorStop(1,trailColors[b.wpn]);
      ctx.fillStyle=g;ctx.fillRect(-trailLen,-1,trailLen,2);
    }
    // 超武与特餐特殊渲染
    if(b.wpn === 'tactical_frost'){
      ctx.shadowBlur=16;ctx.shadowColor='#5be4ff';
      ctx.fillStyle='rgba(160,240,255,0.92)';
      ctx.beginPath();ctx.arc(0,0,18,-0.65,0.65);ctx.quadraticCurveTo(6,0,0,-12);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(2,0,14,-0.4,0.4);ctx.stroke();
      ctx.restore();
      return;
    }
    if(b.isDualStorm){
      ctx.shadowBlur=14;ctx.shadowColor='#ffd700';
      ctx.fillStyle='#ffffff';ctx.fillRect(-8,-3,16,6);
      ctx.fillStyle='#ffd700';ctx.fillRect(-6,-2,12,4);
      ctx.restore();
      return;
    }
    if(b.isMicroMissile){
      ctx.shadowBlur=12;ctx.shadowColor='#5be4ff';
      ctx.fillStyle='#88eeff';ctx.fillRect(-7,-3,14,6);
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(7,0,3,0,Math.PI*2);ctx.fill();
      ctx.restore();
      return;
    }
    switch(b.wpn){
      case'pistol':ctx.fillStyle='#ffe050';ctx.shadowBlur=8;ctx.shadowColor='#ff9900';ctx.fillRect(-6,-2.5,12,5);ctx.beginPath();ctx.arc(6,0,2.5,0,Math.PI*2);ctx.fill();break;
      case'shotgun':ctx.fillStyle='#ff8830';ctx.shadowBlur=6;ctx.shadowColor='#ff6600';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();break;
      case'smg':ctx.fillStyle='#ffdd60';ctx.shadowBlur=6;ctx.shadowColor='#ffaa00';ctx.fillRect(-5,-2,10,4);ctx.beginPath();ctx.arc(5,0,2,0,Math.PI*2);ctx.fill();break;
      case'smg_heavy':ctx.fillStyle='#ffcc40';ctx.shadowBlur=7;ctx.shadowColor='#ff8800';ctx.fillRect(-6,-2.5,12,5);ctx.beginPath();ctx.arc(6,0,2.2,0,Math.PI*2);ctx.fill();break;
      case'crossbow':ctx.fillStyle='#d4a060';ctx.shadowBlur=5;ctx.shadowColor='#aa7733';ctx.fillRect(-10,-1.5,20,3);ctx.fillStyle='#888';ctx.fillRect(-10,-4,5,8);ctx.fillStyle='#444';ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-14,-3);ctx.lineTo(-14,3);ctx.fill();break;
      case'sniper':ctx.fillStyle='#aaffaa';ctx.shadowBlur=14;ctx.shadowColor='#66ff66';ctx.fillRect(-14,-2,28,4);ctx.fillStyle='#fff';ctx.fillRect(-6,-1.5,12,3);ctx.fillStyle='#88ff88';ctx.beginPath();ctx.arc(14,0,3,0,Math.PI*2);ctx.fill();break;
      case'railgun':ctx.fillStyle='#00eeff';ctx.shadowBlur=16;ctx.shadowColor='#00ccff';ctx.fillRect(-20,-2.5,40,5);ctx.fillStyle='#fff';ctx.fillRect(-10,-1.5,18,3);ctx.fillStyle='#00ffff';ctx.beginPath();ctx.arc(-20,0,3,0,Math.PI*2);ctx.fill();break;
      case'grenade':ctx.fillStyle='#3a8828';ctx.shadowBlur=7;ctx.shadowColor='#44aa22';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#88cc44';ctx.fillRect(-3,-5,6,4);ctx.fillStyle='#222';ctx.fillRect(-2,-1,4,2);break;
      case'flame':const ft=Date.now()*.02;ctx.fillStyle=`hsl(${20+Math.sin(ft)*15},100%,${50+Math.sin(ft*1.3)*15}%)`;ctx.shadowBlur=12;ctx.shadowColor='#ff6600';ctx.beginPath();ctx.ellipse(0,0,9,5,0,0,Math.PI*2);ctx.fill();break;
      case'tesla':ctx.fillStyle='#88ddff';ctx.shadowBlur=14;ctx.shadowColor='#00ccff';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#cceeff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.stroke();break;
      case'ice':ctx.fillStyle='#aaeeff';ctx.shadowBlur=12;ctx.shadowColor='#66ccff';ctx.beginPath();ctx.arc(0,0,4.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(-3,-1.5,6,3);break;
      case'poison':ctx.fillStyle='#88dd44';ctx.shadowBlur=10;ctx.shadowColor='#44aa22';ctx.beginPath();ctx.arc(0,0,4.5,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(150,255,80,${.5+.5*Math.sin(Date.now()*.02)})`;ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();break;
      case'minigun':ctx.fillStyle='#ffee80';ctx.shadowBlur=6;ctx.shadowColor='#ffcc00';ctx.fillRect(-5,-2,10,4);ctx.beginPath();ctx.arc(5,0,2,0,Math.PI*2);ctx.fill();break;
      case'rocket':ctx.fillStyle='#ff6600';ctx.shadowBlur=12;ctx.shadowColor='#ff3300';ctx.fillRect(-8,-3.5,16,7);ctx.fillStyle='#ffcc00';ctx.fillRect(-8,-2.5,5,5);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(8,0,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff4400';ctx.beginPath();ctx.moveTo(-8,-3.5);ctx.lineTo(-14,-2);ctx.lineTo(-14,2);ctx.lineTo(-8,3.5);ctx.fill();break;
      case'plasma':{
        const pt = frameT * 0.15;
        ctx.shadowBlur=22;ctx.shadowColor='#c044ff';
        const pGrad=ctx.createRadialGradient(0,0,2,0,0,12);
        pGrad.addColorStop(0,'#ffffff');pGrad.addColorStop(0.35,'#dd88ff');pGrad.addColorStop(0.75,'#7722ee');pGrad.addColorStop(1,'transparent');
        ctx.fillStyle=pGrad;
        ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#00ffff';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(0,0,10,pt,pt+Math.PI*1.2);ctx.stroke();
        ctx.strokeStyle='#ff88ff';
        ctx.beginPath();ctx.arc(0,0,8,-pt,-pt+Math.PI*1.2);ctx.stroke();
        break;
      }
      case'annihilator':{
        const at = frameT * 0.2;
        ctx.shadowBlur=26;ctx.shadowColor='#ff3300';
        ctx.fillStyle='#110011';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ff5500';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.arc(0,0,12,at,at+Math.PI*1.5);ctx.stroke();
        ctx.strokeStyle='#ffcc00';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(0,0,7,-at*1.5,-at*1.5+Math.PI*1.2);ctx.stroke();
        break;
      }
      case'stickybomb':{
        ctx.fillStyle='#2c2d35';ctx.fillRect(-6,-4,12,8);
        ctx.fillStyle='#4c4d55';ctx.fillRect(-4,-5,8,2);ctx.fillRect(-4,3,8,2);
        const blink = Math.floor(frameT/6)%2===0;
        ctx.fillStyle = blink ? '#ff2200' : '#550000';
        ctx.shadowBlur = blink ? 10 : 0; ctx.shadowColor = '#ff0000';
        ctx.beginPath();ctx.arc(0,0,2.2,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case'bloodblades':{
        ctx.shadowBlur=18;ctx.shadowColor='#ff0000';
        ctx.fillStyle='rgba(255,25,25,0.88)';
        ctx.beginPath();
        ctx.arc(0,0,22,-0.75,0.75);
        ctx.quadraticCurveTo(8,0,0,-16);
        ctx.closePath();ctx.fill();
        ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(2,0,15,-0.4,0.4);ctx.stroke();
        break;
      }
      case'boomerang':
        // 回旋镖：V形飞镖，旋转飞行
        ctx.rotate(b.spin||0);
        ctx.shadowBlur=10;ctx.shadowColor='#88ccff';
        ctx.fillStyle='#c8a060';
        // V形飞镖主体
        ctx.beginPath();
        ctx.moveTo(-12,-6);ctx.lineTo(0,0);ctx.lineTo(-12,6);ctx.lineTo(-8,0);ctx.closePath();
        ctx.fill();
        ctx.fillStyle='#88ccff';
        ctx.beginPath();
        ctx.moveTo(-10,-5);ctx.lineTo(-2,0);ctx.lineTo(-10,5);ctx.lineTo(-7,0);ctx.closePath();
        ctx.fill();
        // 边缘高光
        ctx.strokeStyle='#e0d0a0';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(-12,-6);ctx.lineTo(0,0);ctx.lineTo(-12,6);ctx.stroke();
        break;
      case'revolver':ctx.fillStyle='#ffd700';ctx.shadowBlur=10;ctx.shadowColor='#ff9900';ctx.fillRect(-7,-2.5,14,5);ctx.beginPath();ctx.arc(7,0,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(-3,-1,6,2);break;
      case'sawoff':ctx.fillStyle='#ff8830';ctx.shadowBlur=8;ctx.shadowColor='#ff4400';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffcc44';ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();break;
      case'harpoon':ctx.fillStyle='#c0c0c0';ctx.shadowBlur=8;ctx.shadowColor='#888';ctx.fillRect(-14,-1.5,28,3);ctx.fillStyle='#888';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(20,-4);ctx.lineTo(20,4);ctx.fill();ctx.strokeStyle='#444';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(-18,-3);ctx.moveTo(-14,0);ctx.lineTo(-18,3);ctx.stroke();break;
      case'sonic':ctx.fillStyle='#ffee44';ctx.shadowBlur=14;ctx.shadowColor='#ffaa00';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,238,68,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,8+Math.sin(Date.now()*.01)*2,0,Math.PI*2);ctx.stroke();break;
      case'napalm':ctx.fillStyle='#ff6600';ctx.shadowBlur=12;ctx.shadowColor='#ff3300';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();break;
      case'landmine':{ // v53补全：地雷弹体（原隐形）——旋转的盘状雷体+红灯
        ctx.rotate(frameT*.15);
        ctx.fillStyle='#6a5a3a';ctx.shadowBlur=6;ctx.shadowColor='#443';ctx.beginPath();ctx.ellipse(0,0,7,4,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#8a7a4a';ctx.beginPath();ctx.ellipse(0,-1,5,2.5,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=Math.floor(frameT/6)%2?'#ff2200':'#661100';ctx.shadowBlur=8;ctx.shadowColor='#ff3300';
        ctx.beginPath();ctx.arc(0,0,1.6,0,Math.PI*2);ctx.fill();break;}
      case'shockwave':ctx.fillStyle='#88ccff';ctx.shadowBlur=12;ctx.shadowColor='#4488ff';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(136,204,255,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.stroke();break;
      case'turret':ctx.fillStyle='#ffcc44';ctx.shadowBlur=8;ctx.shadowColor='#ff9900';ctx.fillRect(-5,-2,10,4);ctx.beginPath();ctx.arc(5,0,2,0,Math.PI*2);ctx.fill();break;
      case'_towerFreeze':ctx.fillStyle='#9be4ff';ctx.shadowBlur=10;ctx.shadowColor='#5be4ff';ctx.beginPath();ctx.arc(0,0,3.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#cfeeff';ctx.lineWidth=1;for(let s=0;s<3;s++){const a=frameT*0.1+s*Math.PI*2/3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*5,Math.sin(a)*5);ctx.stroke();}break;
      case'_towerCannon':ctx.fillStyle='#cc6622';ctx.shadowBlur=8;ctx.shadowColor='#ff8833';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffaa44';ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();break;
      case'_towerHeal':ctx.fillStyle='#88ff88';ctx.shadowBlur=12;ctx.shadowColor='#44ff44';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(-2,-0.8,4,1.6);ctx.fillRect(-0.8,-2,1.6,4);break;
      case'_sprite':ctx.fillStyle='#80c8ff';ctx.shadowBlur=10;ctx.shadowColor='#4090ff';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();break;
    }
    ctx.restore();
  });
  // ── 捕鲸飞叉：高韧性钢索连接玩家枪口与飞叉 ──
  bullets.forEach(b => {
    if(!b.active || b.wpn !== 'harpoon') return;
    try {
      const g = getGunTip();
      ctx.save();
      ctx.strokeStyle = 'rgba(190,215,240,0.75)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    } catch(e) {}
  });
  // ── 【个性化武器瞄准与战术辅助】绘制世界空间瞄准辅助 ──
  drawWorldAimAids();
}

// ═══════════════════════════════════════════

//  【个性化武器瞄准与战术辅助】WORLD AIM AIDS
// ═══════════════════════════════════════════
function drawWorldAimAids(){
  if(vehicle.entered || !gameRunning || typeof cw !== 'function') return;
  try {
    const curGun = cw();
    if(!curGun) return;
    const g = getGunTip();
    const wmx = lastMX, wmy = lastMY;
    const dx = wmx - g.x, dy = wmy - g.y;
    const aimAngle = Math.atan2(dy, dx);

    // 1. 高精狙击枪 (sniper) / 磁轨充能 (railcharger) / 电磁炮 (railgun) 激光准线
    if(curGun.id === 'sniper' || curGun.id === 'railcharger' || curGun.id === 'railgun'){
      const isSnip = curGun.id === 'sniper';
      const isCharger = curGun.id === 'railcharger';
      const isStill = (!keys.l && !keys.r && player.onGround);
      const sightLen = isSnip ? (isStill ? 1200 : 720) : (isCharger ? 1100 : 900);
      const ex = g.x + Math.cos(aimAngle) * sightLen;
      const ey = g.y + Math.sin(aimAngle) * sightLen;

      ctx.save();
      if(isSnip){
        if(isStill){
          // 站定红外锁定：艳红高能激光 + 终点瞄准光斑
          const grad = ctx.createLinearGradient(g.x, g.y, ex, ey);
          grad.addColorStop(0, 'rgba(255,40,60,0.9)');
          grad.addColorStop(0.7, 'rgba(255,20,40,0.5)');
          grad.addColorStop(1, 'rgba(255,0,0,0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.8;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ff2244';
          ctx.beginPath();
          ctx.moveTo(g.x, g.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // 瞄准终点红外光斑与精瞄圈
          ctx.fillStyle = '#ff2244';
          ctx.beginPath();
          ctx.arc(wmx, wmy, 3 + Math.sin(frameT * 0.2) * 1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 移动中：微弱虚线提示散布惩罚
          ctx.strokeStyle = 'rgba(255,170,50,0.45)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(g.x, g.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      } else if(isCharger){
        // 磁轨充能：电青色光矛，充能满时高能脉冲
        const isCharged = (window._railCharge >= 3);
        const grad = ctx.createLinearGradient(g.x, g.y, ex, ey);
        const c1 = isCharged ? 'rgba(150,255,240,0.95)' : 'rgba(0,220,255,0.7)';
        const c2 = isCharged ? 'rgba(0,255,200,0.4)' : 'rgba(0,140,220,0.2)';
        grad.addColorStop(0, c1);
        grad.addColorStop(0.8, c2);
        grad.addColorStop(1, 'rgba(0,200,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = isCharged ? 3.2 : 1.6;
        if(isCharged){ ctx.shadowBlur = 12; ctx.shadowColor = '#00ffee'; }
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else {
        // 普通电磁炮
        const grad = ctx.createLinearGradient(g.x, g.y, ex, ey);
        grad.addColorStop(0, 'rgba(0,240,255,0.85)');
        grad.addColorStop(0.6, 'rgba(0,180,240,0.3)');
        grad.addColorStop(1, 'rgba(0,100,200,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. 抛物线爆炸类武器 (手榴弹 grenade / 黏弹 stickybomb / 地雷 landmine / 凝固汽油 napalm)
    if(curGun.grav || curGun.id==='grenade' || curGun.id==='stickybomb' || curGun.id==='landmine' || curGun.id==='napalm'){
      ctx.save();
      const spd = curGun.speed || 11;
      let simVx = Math.cos(aimAngle) * spd;
      let simVy = Math.sin(aimAngle) * spd;
      let simX = g.x, simY = g.y;
      const pts = [{x: simX, y: simY}];
      const maxSteps = 45;
      for(let s = 0; s < maxSteps; s++){
        simX += simVx;
        simY += simVy;
        simVy += 0.27; // 重力加速度
        pts.push({x: simX, y: simY});
        if(simY >= GROUND_Y - 8) {
          simY = GROUND_Y - 8;
          break;
        }
      }

      // 弹道虚线
      const col = curGun.id==='stickybomb' ? '#66ff66' : curGun.id==='landmine' ? '#ff4422' : curGun.id==='napalm' ? '#ff6600' : '#ffcc00';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // 落点 AOE 范围预警圈（地面椭圆）
      const landPt = pts[pts.length - 1];
      const aoeR = curGun.aoe || 130;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.12 + Math.sin(frameT * 0.1) * 0.05;
      ctx.beginPath();
      ctx.ellipse(landPt.x, landPt.y + 4, aoeR, aoeR * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();

      // 落点中心光标
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(landPt.x, landPt.y + 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. 特斯拉 (tesla) 链电预锁定指示线
    if(curGun.id === 'tesla'){
      const targetPool = (gameState === 'building') ? buildingInteriorZombies : zombies;
      const chainTargets = [];
      targetPool.forEach(z => {
        if(!z.alive) return;
        const zx = z.x + 22, zy = Z_TOP + 28;
        const d = Math.hypot(zx - wmx, zy - wmy);
        if(d < 220) chainTargets.push({x: zx, y: zy, d});
      });
      chainTargets.sort((a,b) => a.d - b.d);
      const targets = chainTargets.slice(0, 4);
      if(targets.length > 0){
        ctx.save();
        ctx.strokeStyle = 'rgba(80,220,255,0.45)';
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#50ddff';
        targets.forEach(t => {
          ctx.beginPath();
          ctx.moveTo(wmx, wmy);
          const midX = (wmx + t.x)/2 + (Math.sin(frameT*0.3 + t.d)*6);
          const midY = (wmy + t.y)/2 + (Math.cos(frameT*0.3 + t.d)*6);
          ctx.lineTo(midX, midY);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
          // 目标脚下电弧圈
          ctx.beginPath();
          ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
      }
    }

    // 4. 战地哨笛 (warhorn) 伙伴光环与战术羁绊连线
    if(curGun.id === 'warhorn'){
      ctx.save();
      const px = player.x + CHAR_W/2, py = player.y + CHAR_H/2;
      // 战意金环
      const pulse = 0.5 + 0.5 * Math.sin(frameT * 0.08);
      ctx.strokeStyle = `rgba(255,215,80,${0.3 + pulse * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(px, py, 180 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();

      // 与活跃伙伴的战术连线
      hiredCompanions.forEach(c => {
        if(c.downed) return;
        const cx = c.x + 18, cy = Z_TOP + 20;
        ctx.strokeStyle = 'rgba(255,225,120,0.4)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        // 伙伴头顶号令徽标
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('📣', cx, cy - 14);
      });
      ctx.restore();
    }

    // 5. 霰弹枪 / 锯短霰弹 (shotgun / sawoff) 锥体扩散引导
    if(curGun.spread && (curGun.id === 'shotgun' || curGun.id === 'sawoff')){
      ctx.save();
      const coneDeg = (curGun.spreadDeg || 24) * Math.PI / 180;
      const coneR = (curGun.id === 'sawoff') ? 160 : 220;
      const a1 = aimAngle - coneDeg/2;
      const a2 = aimAngle + coneDeg/2;

      ctx.fillStyle = (curGun.id === 'sawoff') ? 'rgba(255,80,30,0.06)' : 'rgba(255,200,60,0.06)';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.arc(g.x, g.y, coneR, a1, a2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = (curGun.id === 'sawoff') ? 'rgba(255,100,50,0.25)' : 'rgba(255,210,80,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(a1) * coneR, g.y + Math.sin(a1) * coneR);
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(a2) * coneR, g.y + Math.sin(a2) * coneR);
      ctx.stroke();
      ctx.restore();
    }
  } catch(e) {}
}

