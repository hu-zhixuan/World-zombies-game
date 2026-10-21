// ═══════════════════════════════════════════

//  【白天模块 A1】TOWER DEFENSE SYSTEM（家园塔防+塔位选择）
// ═══════════════════════════════════════════
// 家园生命：蠢蛋冲过防线扣家园血，归零则失败
let homeHp = 100;
let HOME_HP_MAX = 100;
const HOME_X = 80;  // 家园核心区（保留用于家园血检测）
// 围墙包围所有房子：左墙紧贴游戏最左边，右墙守卫战场侧
const LEFT_WALL_X = 5;     // 左围墙紧贴游戏最左边（城堡直接延伸到屏幕左侧）
const RIGHT_WALL_X = 735;  // 右围墙—— 蠢蛋从右来先撞此墙
// 家园平台高度：大幅垫高阻击阵地（85px），构筑巍峨城堡高台，形成居高临下俯射尸潮的肉鸽城堡塔防
const HOME_PLATFORM_H = 85;  // 家园平台高出地面的像素数（由40垫高至85）
const PLATFORM_TOP = GROUND_Y - HOME_PLATFORM_H;  // 平台顶面 y（人物/建筑/防御塔踩在城垛平台上）
// 获取某 x 位置的地面 y（家园平台区=平台顶，战场区=地面）
// 城堡左边直接延伸到游戏最左边，因此整个左侧都是平台，玩家不会从左边掉下
function groundYAt(x){
  if(x >= 0 && x < RIGHT_WALL_X) return PLATFORM_TOP;  // 整个家园区（含最左边）站平台
  return GROUND_Y;  // 战场区站地面
}
// 家园围墙：物理防线，优先承受蠢蛋冲击，可升级/修复
let wallHp = 0;          // 当前围墙血量（0=无围墙）
let wallLevel = 0;       // 围墙等级（0=无，1/2/3=木/石/铁）
const WALL_HP_PER_LEVEL = [0, 180, 380, 650];  // 平衡性调整：围墙更强（围墙=生命线）
const WALL_UPGRADE_COST = [50, 90, 150];       // 升级到1/2/3级的金币（核心投资）
const WALL_REPAIR_COST = 30;                   // 修复围墙花费（稀缺资源）
// 部署的防御塔数组：{x,y,level,cooldown,angle,type}
let towers = [];
// 部署的陷阱数组：{x,y,type,charges}
let traps = [];
// ── 塔防静态注册表已集中归拢至 Section 01 CONFIG & REGISTRIES ──
let nextTowerSlot = 0;
let towersHpBonus = 0;  // v52塔防强化：全局塔血量加成（towerguard 天赋层数×40%，惰性计算见 getTowersHpBonus）
function getTowersHpBonus(){
  return (playerPerks.towerguard||0)*0.4 + (towersHpBonus||0);
}
// v52两界经济：防御造价随波次通胀（每波+8%，封顶+120%）——后期塔/墙要靠餐厅收入支撑，
// 形成"白天打肉→晚上经营赚钱→钱变防御战力→守得住才能打更多肉"的硬循环
function defenseCostMul(){
  return Math.min(2.2, 1 + Math.max(0, wave-1)*0.08);
}
// 自由放置模式：商店购买后进入，点击平台任意空位落位
let placementMode = null;  // null | {type:'tower'|'trap', towerType/trapType, cost, icon, name}
// 查找最近的可放置点（自由放置：返回点击x附近满足间距的可放置位置）
function findNearestEmptySlot(x){
  // 限制在平台范围内
  let clampedX = Math.max(TOWER_PLACE_MIN_X, Math.min(TOWER_PLACE_MAX_X, x));
  // 检查与已有塔的间距，若太近则向两侧寻找最近的有效点
  function isValid(tx){
    return towers.every(t => Math.abs(t.x - tx) >= TOWER_PLACE_MIN_GAP);
  }
  if(isValid(clampedX)) return {slotIdx:0, dist:Math.abs(clampedX-x), slotX:clampedX};
  // 向两侧搜索
  for(let off=5; off<=120; off+=5){
    if(clampedX+off<=TOWER_PLACE_MAX_X && isValid(clampedX+off))
      return {slotIdx:0, dist:off+Math.abs(clampedX-x), slotX:clampedX+off};
    if(clampedX-off>=TOWER_PLACE_MIN_X && isValid(clampedX-off))
      return {slotIdx:0, dist:off+Math.abs(clampedX-x), slotX:clampedX-off};
  }
  return {slotIdx:-1, dist:9999, slotX:-1};
}

// ── 塔放置提示（城堡塔防制 v47回退：据点买塔→回战场点平台任意空位）──
function showTowerPlacementPanel(towerType){
  const tt = TOWER_TYPES[towerType];
  if(towers.length >= getTowerMaxCount()){addBanner('⚠ 塔位已满（上限'+getTowerMaxCount()+'座）！');return;}
  if(coins < tt.cost){addBanner('💰 金币不足！');return;}
  // 直接进入放置模式，回战场点击城堡平台放置
  placementMode = {type:'tower', towerType:towerType, cost:tt.cost, icon:tt.icon, name:tt.name};
  addBanner(`${tt.icon} 已选择「${tt.name}」——回到战场点击城堡平台上的任意位置部署`);
}
// 检查陷阱放置位置是否有效
function isTrapPosValid(x){
  return x >= LEFT_WALL_X + 5 && x <= WORLD_W - 40;
}

function autoBuildTower(type){
  const tt = TOWER_TYPES[type]; if(!tt)return false;
  const buildCost = Math.round(tt.cost * (typeof defenseCostMul==='function'?defenseCostMul():1));
  if(coins < buildCost){addBanner('💰 金币不足（需'+buildCost+'，波次通胀）！');return false;}
  if(towers.length >= getTowerMaxCount()){addBanner('⚠ 塔位已满（上限'+getTowerMaxCount()+'座）！');return false;}
  // 查找平台上最近合法空位
  const {slotIdx, dist, slotX} = findNearestEmptySlot(RIGHT_WALL_X - 120);
  if(slotIdx < 0){
    addBanner('⚠ 平台已无空余基座，可在前线战场手动放置！');
    return false;
  }
  return placeTower(type, slotX);
}

function deployTower(type){
  const tt = TOWER_TYPES[type]; if(!tt)return false;
  const buildCost = Math.round(tt.cost * (typeof defenseCostMul==='function'?defenseCostMul():1));
  if(coins < buildCost){addBanner('💰 金币不足（需'+buildCost+'，波次通胀）！');return false;}
  if(towers.length >= getTowerMaxCount()){addBanner('⚠ 塔位已满（上限'+getTowerMaxCount()+'座）！');return false;}
  // 进入放置模式：玩家点击城堡平台任意空位落位
  placementMode = {type:'tower', towerType:type, cost:buildCost, icon:tt.icon, name:tt.name};
  addBanner(`${tt.icon} 点击部署：城堡平台=后排安全位 · 墙外战场=前排输出位（会被拆毁）`);
  return true;
}
function placeTower(type, x){
  const tt = TOWER_TYPES[type]; if(!tt)return false;
  // ═══ v52塔防强化：前排/后排双区位 ═══
  // 后排（安全区）：城堡平台 30~705，墙内、永不被攻击、射界被墙部分遮挡
  // 前排（风险区）：墙外战场 760~1400，射界开阔、先手接敌，但会被装甲敌人/Boss 拆毁
  const isFront = x > RIGHT_WALL_X + 40;
  let slotX, towerY;
  if(isFront){
    // 前排：战场地面自由落位（最小间距同后排），限制在合理战场段
    slotX = Math.max(RIGHT_WALL_X + 60, Math.min(1400, x));
    const clash = towers.some(t => Math.abs(t.x - slotX) < TOWER_PLACE_MIN_GAP);
    if(clash){addBanner('⚠ 前排该位置已有塔（间距不足50）！');return false;}
    towerY = GROUND_Y - 40;
  }else{
    // 后排：在玩家点击位置附近找最近的合法空位（满足间距约束）
    const {slotIdx:nearestSlot, dist:nearestDist, slotX:nearestX}=findNearestEmptySlot(x);
    if(nearestSlot<0){addBanner('⚠ 平台上没有空位了！');return false;}
    if(nearestDist>180){addBanner('⚠ 请点击城堡平台上的位置！');return false;}
    slotX = nearestX;
    towerY = PLATFORM_TOP - 40;
  }
  const buildCost=Math.round(tt.cost*defenseCostMul());  // v52两界经济：波次通胀
  if(coins < buildCost){addBanner('💰 金币不足（需'+buildCost+'，波次通胀）！');return false;}
  coins -= buildCost; updateCoinUI();
  // v52塔防强化：塔有HP可被攻击——每升1级 +40% 血量
  const thp = Math.round((tt.hp||150) * (1 + getTowersHpBonus()));
  const newTower={x:slotX, y:towerY, level:1, cooldown:0, angle:-Math.PI/4, type, slotIdx:0, recoil:0, hp:thp, hpMax:thp, hitFlash:0, front:isFront};
  towers.push(newTower);
  addBanner(isFront
    ? `${tt.icon} 前排「${tt.name}」部署！⚠ 射界开阔但会被敌人拆毁`
    : `${tt.icon} 在平台 x=${Math.round(slotX)} 部署「${tt.name}」`);
  sndReload();
  for(let i=0;i<10;i++){mkP({x:slotX,y:towerY+10,vx:(Math.random()-.5)*4,vy:-2-Math.random()*3,r:3,rDecay:.06,decay:.03,color:isFront?'#ffaa44':'#88ddff',type:'circle',grav:.2,alpha:.8});}
  return true;
}
function upgradeTower(idx){
  const t = towers[idx]; if(!t)return;
  const tt = TOWER_TYPES[t.type];
  if(t.level >= tt.maxLevel){addBanner('⚠ 已满级！');return;}
  const cost = Math.round(tt.cost * (t.level+1) * defenseCostMul());  // v52两界经济：波次通胀
  if(coins < cost){addBanner('💰 金币不足！');return;}
  coins -= cost; updateCoinUI();
  t.level++;
  // v52塔防强化：升级回满血+提升血量上限（+40%/级 + 塔体加固天赋）
  const tt2 = TOWER_TYPES[t.type];
  t.hpMax = Math.round((tt2.hp||150) * (1 + 0.4*(t.level-1) + getTowersHpBonus()));
  t.hp = t.hpMax;
  addBanner(`${tt.icon} 「${tt.name}」升级至 Lv.${t.level}！`);
  sndReload();
  // 升级特效（美术升级：金色进化冲击环+上升光柱）
  for(let i=0;i<12;i++){const a=Math.random()*Math.PI*2;mkP({x:t.x,y:t.y,vx:Math.cos(a)*(2+Math.random()*3),vy:Math.sin(a)*(2+Math.random()*3)-2,r:2+Math.random()*2,rDecay:.05,decay:.04,color:tt.color,type:'spark',grav:.16,alpha:1});}
  mkP({x:t.x,y:t.y,r:8,rDecay:-1,decay:.08,color:tt.color,type:'ring',alpha:.8,grav:0});
  // 金色进化冲击环（三层扩散，升级仪式感）
  [0,80,160].forEach((d,i)=>setTimeout(()=>{
    if(!gameRunning)return;
    mkP({x:t.x,y:t.y,r:10+i*8,rDecay:-(3+i*2),decay:.06,color:'rgba(255,216,64,.95)',type:'ring',alpha:.95,grav:0});
  },d));
  // 上升光柱粒子
  for(let i=0;i<10;i++){
    mkP({x:t.x+(Math.random()-.5)*20,y:t.y+8,vx:(Math.random()-.5)*.5,vy:-(2+Math.random()*3),r:1.5+Math.random()*2,rDecay:.04,decay:.03,color:i%2?'#ffd840':'#fff0a0',type:'circle',grav:-.02,alpha:.95,blur:true});
  }
  // 刷新弹窗（如开着）
  if(currentPopoverTower===idx)showTowerPopover(idx);
}
// 出售塔：返还50%总投入
function sellTower(idx){
  const t=towers[idx];if(!t)return;
  const tt=TOWER_TYPES[t.type];
  // 总投入 = 建造成本 + 升级成本之和
  let invested=tt.cost;
  for(let l=1;l<t.level;l++)invested+=tt.cost*l;
  const refund=Math.floor(invested*0.5);
  coins+=refund;updateCoinUI();
  // 移除塔
  towers.splice(idx,1);
  // 出售特效
  for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2;mkP({x:t.x,y:t.y,vx:Math.cos(a)*(2+Math.random()*4),vy:Math.sin(a)*(2+Math.random()*4)-2,r:2+Math.random()*2,rDecay:.05,decay:.04,color:'#f0c060',type:'spark',grav:.16,alpha:1});}
  addBanner(`💰 出售「${tt.name}」返还 ${refund} 金币`);
  sndCoin();
  closeTowerPopover();
}
// ── 塔弹窗（升级/出售）──
let currentPopoverTower=-1;

// ═══ v52塔防强化：塔生死系统 ═══
// 僵尸(重甲/坦克/精英)与Boss会攻击射程内最近的塔；塔损毁留残骸，原址可重建。
// TOWER_ATTACKER_TYPES：具备"拆塔AI"的敌人种类（装甲/坦克系——对建筑有仇恨）
function updateTowerUnderAttack(){
  if(gameState!=='world' || !towers.length) return;
  for(const z of zombies){
    if(!z.alive) continue;
    // 拆塔AI：装甲/坦克/精英类敌人才有建筑仇恨（armorPct>=0.35 或 精英 或 巨型行刑者）；普通丧尸只认墙
    const isDemolisher = z.elite || (z.armorPct||0) >= 0.35 || z.zType==='gargantuar';
    if(!isDemolisher) continue;
    // 找射程内最近的存活塔（攻击半径90）
    let target=null, bestD=90;
    for(const t of towers){
      if(!t || t.hp===undefined) continue;
      const d=Math.abs((z.x+22)-t.x);
      if(d<bestD){bestD=d;target=t;}
    }
    if(target){
      // 锁定塔：走到塔攻击距离即停下拆塔（每0.6秒一击），不越塔前进
      const stopAt = target.x - 42;   // 塔左边缘攻击距离
      if(z.x > stopAt) z.x = stopAt;  // 贴到攻击距离停下（不回拉）
      z.walkT += .05;
      if(frameT % 36 === 0){
        const dmg = Math.floor((z.elite?18:10) * (1 + wave*0.06));
        damageTower(target, dmg, z.x+22, Z_TOP+28);
      }
    }
  }
  // Boss 拆塔（攻击半径130，重击）
  if(bossActive && boss && boss.alive){
    let bt=null, bd=130;
    for(const t of towers){
      if(!t || t.hp===undefined) continue;
      const d=Math.abs(boss.x+40-t.x);
      if(d<bd){bd=d;bt=t;}
    }
    if(bt && frameT % 50 === 0){
      damageTower(bt, 40 + Math.floor(wave*3), boss.x+40, GROUND_Y-60);
    }
  }
}
// 塔受击：扣血+受击闪光+碎屑；血尽=损毁（留残骸标记，原址可重建）
function damageTower(t, dmg, fromX, fromY){
  if(!t || t.hp===undefined) return;
  t.hp -= dmg;
  t.hitFlash = 10;
  vfxHit(t.x, t.y-12, fromX, fromY);
  addShake(2);
  const tt = TOWER_TYPES[t.type];
  for(let i=0;i<4;i++){mkP({x:t.x+(Math.random()-.5)*20,y:t.y+(Math.random()-.5)*20,vx:(Math.random()-.5)*3,vy:-1-Math.random()*2,r:1.5+Math.random()*1.5,rDecay:.04,decay:.04,color:tt.color,type:'shard',angle:Math.random()*Math.PI,spin:.3,grav:.25,alpha:.8});}
  if(t.hp <= 0){
    destroyTower(t);
  }
}
// 塔损毁：爆炸特效+残骸记录+从数组移除（残骸位可原址重建=findNearestEmptySlot自然允许）
function destroyTower(t){
  const tt = TOWER_TYPES[t.type];
  const idx = towers.indexOf(t);
  if(idx >= 0){
    if(currentPopoverTower===idx) closeTowerPopover();
    else if(currentPopoverTower>idx){currentPopoverTower--;}
    towers.splice(idx, 1);
  }
  vfxExplosion(t.x, t.y-12); sndExplosion(); addShake(9);
  for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2;mkP({x:t.x,y:t.y-12,vx:Math.cos(a)*(2+Math.random()*5),vy:Math.sin(a)*(2+Math.random()*5)-3,r:2+Math.random()*3,rDecay:.05,decay:.05,color:Math.random()>.4?tt.color:'#888',type:'spark',grav:.2,alpha:1});}
  addBanner(`💥 「${tt.name}」被拆毁了！（可原址重建）`);
  // 记录残骸（绘制用：本场内残骸位置留焦痕）
  if(!window._towerWrecks) window._towerWrecks = [];
  window._towerWrecks.push({x:t.x, y:t.y, t:Date.now()});
  if(window._towerWrecks.length > 12) window._towerWrecks.shift();
}
// 维修塔（弹窗按钮）：按损血计费（0.15金币/HP，向上取整），回满
function repairTower(idx){
  const t = towers[idx]; if(!t || t.hp===undefined) return;
  const missing = t.hpMax - t.hp;
  if(missing <= 0){addBanner('🔧 塔完好无需维修');return;}
  const cost = Math.max(3, Math.ceil(missing * 0.15));
  if(coins < cost){addBanner('💰 金币不足（维修需 '+cost+'）！');return;}
  coins -= cost; updateCoinUI();
  t.hp = t.hpMax;
  const tt = TOWER_TYPES[t.type];
  addBanner(`🔧 「${tt.name}」维修完成（-${cost}金币）`);
  sndReload();
  // 维修特效：绿色修复光柱
  for(let i=0;i<10;i++){mkP({x:t.x+(Math.random()-.5)*24,y:t.y+Math.random()*20,vx:0,vy:-(1.5+Math.random()*2),r:1.5+Math.random(),rDecay:.03,decay:.03,color:'rgba(68,255,102,.8)',type:'circle',grav:-.02,alpha:.85});}
  mkP({x:t.x,y:t.y-10,r:20,rDecay:-.8,decay:.07,color:'rgba(68,255,102,.7)',type:'ring',alpha:.8,grav:0});
  if(currentPopoverTower===idx) showTowerPopover(idx);
}
// 关闭弹窗后恢复升级/出售按钮（保留：popover 按钮显示控制的统一入口）
function restoreTowerPopoverButtons(){
  document.getElementById('tp-upgrade').style.display='block';
  document.getElementById('tp-repair').style.display='block';  // v52：维修按钮一并恢复
  document.getElementById('tp-sell').style.display='block';
}
function showTowerPopover(idx){
  const t=towers[idx];if(!t){closeTowerPopover();return;}
  currentPopoverTower=idx;
  restoreTowerPopoverButtons();  // 建造菜单可能隐藏了按钮，这里恢复
  const tt=TOWER_TYPES[t.type], st=towerStat(t);
  const dtInfo=TOWER_DMG_TYPES[tt.dmgType]||TOWER_DMG_TYPES.physical;
  const pop=document.getElementById('tower-popover');
  document.getElementById('tp-title').textContent=`${tt.icon} ${tt.name} Lv.${t.level} ${dtInfo.icon}${dtInfo.name}`;
  // 统计信息
  let statTxt='';
  if(t.type==='turret')statTxt=`伤害 ${st.dmg} · 射速 ${(60/st.cooldown).toFixed(1)}/秒`;
  else if(t.type==='freeze')statTxt=`伤害 ${st.dmg} · 减速 ${Math.round((1-st.slowFactor)*100)}% · ${st.slowDur/60}秒`;
  else if(t.type==='cannon')statTxt=`伤害 ${st.dmg} · 爆炸范围 ${st.aoeRadius} · 无视50%护甲`;
  else if(t.type==='tesla')statTxt=`伤害 ${st.dmg} · 链电 ${st.chain}敌 · 衰减${Math.round((1-st.chainDecay)*100)}%`;
  else if(t.type==='repair')statTxt=`维修 ${st.heal} · ${(60/st.cooldown).toFixed(1)}/秒（墙满时治疗玩家）`;
  statTxt+=`\n射程 ${tt.range} · ${tt.desc}`;
  // v52塔防强化：弹窗显示塔血量
  if(t.hp!==undefined) statTxt+=`\n耐久 ${Math.max(0,Math.round(t.hp))}/${t.hpMax}`;
  document.getElementById('tp-stats').textContent=statTxt;
  // 升级按钮
  const upgBtn=document.getElementById('tp-upgrade');
  if(t.level>=tt.maxLevel){upgBtn.textContent='已满级';upgBtn.disabled=true;upgBtn.style.opacity=.4;}
  else{const cost=tt.cost*(t.level+1);upgBtn.textContent=`⬆ 升级至 Lv.${t.level+1} (💰${cost})`;upgBtn.disabled=false;upgBtn.style.opacity=1;upgBtn.onclick=()=>upgradeTower(idx);}
  // v52塔防强化：维修按钮（按损血计费，满血禁用；旧档塔无HP字段时补齐）
  const repBtn=document.getElementById('tp-repair');
  if(t.hp===undefined){t.hp=t.hpMax=Math.round((tt.hp||150)*(1+0.4*(t.level-1)));}
  const missing=Math.max(0,t.hpMax-t.hp);
  if(missing<=0){repBtn.textContent='🔧 耐久完好';repBtn.disabled=true;repBtn.style.opacity=.4;}
  else{const rc=Math.max(3,Math.ceil(missing*0.15));repBtn.textContent=`🔧 维修 (+${Math.round(missing)}耐久 💰${rc})`;repBtn.disabled=false;repBtn.style.opacity=1;repBtn.onclick=()=>repairTower(idx);}
  document.getElementById('tp-sell').onclick=()=>sellTower(idx);
  document.getElementById('tp-close').onclick=closeTowerPopover;
  // 定位到塔的屏幕位置
  const sx=t.x-cameraX, sy=t.y-20;
  pop.style.left=Math.max(8,Math.min(GW-200,sx-90))+'px';
  pop.style.top=Math.max(8,sy-120)+'px';
  pop.style.display='block';
}
function closeTowerPopover(){
  document.getElementById('tower-popover').style.display='none';
  currentPopoverTower=-1;
  restoreTowerPopoverButtons();  // 建造菜单可能隐藏了升级/出售按钮，统一恢复
}
// 跟随相机滚动重新定位塔弹窗（每帧调用）
function repositionTowerPopover(){
  if(currentPopoverTower<0)return;
  const t=towers[currentPopoverTower];
  if(!t){closeTowerPopover();return;}
  const pop=document.getElementById('tower-popover');
  if(pop.style.display==='none')return;
  const sx=t.x-cameraX, sy=t.y-20;
  pop.style.left=Math.max(8,Math.min(GW-200,sx-90))+'px';
  pop.style.top=Math.max(8,sy-120)+'px';
}
function deployTrap(type){
  const tt = TRAP_TYPES[type]; if(!tt)return false;
  if(coins < tt.cost){addBanner('💰 金币不足！');return false;}
  // 进入放置模式
  placementMode = {type:'trap', trapType:type, cost:tt.cost, icon:tt.icon, name:tt.name};
  addBanner(`${tt.icon} 点击战场地面放置「${tt.name}」（右键/Esc取消）`);
  return true;
}
function placeTrap(type, x){
  const tt = TRAP_TYPES[type]; if(!tt)return false;
  // 陷阱可放在战场侧或房子区间隙（不能紧贴墙）
  if(!isTrapPosValid(x)){addBanner('⚠ 放置位置无效！');return false;}
  if(coins < tt.cost){addBanner('💰 金币不足！');return false;}
  coins -= tt.cost; updateCoinUI();
  traps.push({x, y:GROUND_Y-8, type, charges:tt.charges});
  addBanner(`${tt.icon} 布置「${tt.name}」！`);
  sndReload();
  for(let i=0;i<8;i++){mkP({x,y:GROUND_Y-6,vx:(Math.random()-.5)*3,vy:-1-Math.random()*2,r:2,rDecay:.05,decay:.04,color:'#ddaa44',type:'circle',grav:.2,alpha:.8});}
  return true;
}
// 塔更新：遍历所有塔，找目标射击/减速/治疗
function updateTowers(){
  if(gameState!=='world')return;
  const dmgMult = 1 + (playerPerks.towermaster||0)*0.25 + (playerPerks.titanfall?towers.length*0.05:0);  // 塔专家 + 塔之共鸣
  // ── v52肉鸽：塔防天赋线 + 行囊智能芯片 ──
  const bpTurretBoost = (typeof getBackpackTurretBoost === 'function') ? getBackpackTurretBoost() : {range:0, rate:0};
  const atkSpeed = (1 + (playerPerks.overclock||0)*0.20) * (1 + bpTurretBoost.rate);                 // 塔超频+芯片：攻速提升
  const towerDmgMult = dmgMult;                                          // 基准
  const slowAura = playerPerks.freezeray ? 0.15 : 0;                     // 寒霜领域：塔弹附带减速
  const regenPerFrame = playerPerks.towerregen ? 0.01*(playerPerks.towerregen) : 0; // 自动保修：每秒1%/层（60帧）
  towers.forEach(t=>{
    if(t.cooldown>0)t.cooldown--;
    if(t.recoil>0)t.recoil-=0.08;  // 后坐力衰减
    // v52：自动保修
    if(regenPerFrame>0 && t.hp!==undefined && t.hp<t.hpMax && frameT%60===0){
      t.hp=Math.min(t.hpMax, t.hp+t.hpMax*regenPerFrame);
    }
    const tt = TOWER_TYPES[t.type];
    const st = towerStat(t);
    // v52：背水一战——残塔爆发；围城大师——本波强化倍率
    let towerShotDmgMult = towerDmgMult;
    if(playerPerks.laststand && t.hp!==undefined && t.hp/t.hpMax<0.3) towerShotDmgMult*=2;
    if(t._siegeBoost && t._siegeBoost>1) towerShotDmgMult*=t._siegeBoost;
    // 攻速：cooldown 除以攻速系数（越小越快）——发射时用 st.cooldown/atkSpeed
    const effectiveCooldown = Math.max(2, Math.floor(st.cooldown/atkSpeed));
    // ── first 目标制（塔防标准）：优先攻击最接近城墙的敌人 ──
    // （原"最近优先"导致塔各自为战；行军制下"最靠前"=威胁最大）
    let target=null, bestAdvance=-Infinity;
    // v52波次词条·迷雾潜行：塔索敌距离-20%（行囊芯片额外扩展+25%）
    const baseR = (waveMutation && waveMutation.id==='mist') ? tt.range*0.8 : tt.range;
    const mutRange = baseR * (1 + bpTurretBoost.range);
    zombies.forEach(z=>{
      if(!z.alive)return;
      const d=Math.abs(z.x+22 - t.x);
      if(d<=mutRange){
        const advance=-(z.x+22);  // x 越小=越接近城墙=越优先
        if(advance>bestAdvance){bestAdvance=advance;target=z;}
      }
    });
    if(bossActive&&boss&&boss.alive){
      const d=Math.abs(boss.x+40 - t.x);
      if(d<=mutRange){
        const advance=-(boss.x+40);
        if(advance>bestAdvance){bestAdvance=advance;target=boss;}
      }
    }
    if(target){
      const tx = target===boss ? target.x+40 : target.x+22;
      const ty = target===boss ? GROUND_Y-60 : Z_TOP+28;
      t.angle = Math.atan2(ty-t.y, tx-t.x);
      if(t.cooldown<=0){
        const mx=t.x+Math.cos(t.angle)*18, my=t.y+Math.sin(t.angle)*18;  // 枪口位置
        if(t.type==='turret'){
          t.cooldown = effectiveCooldown;
          const dmg = st.dmg*towerShotDmgMult;
          bullets.push({id:bId++,x:mx,y:my,vx:Math.cos(t.angle)*st.projSpeed,vy:Math.sin(t.angle)*st.projSpeed,
            active:true,dmg,piercing:false,grav:false,burn:false,maxRange:tt.range*(1+bpTurretBoost.range),sx:t.x,sy:t.y,wpn:'turret',dmgType:'physical',fromTower:true,
            frost:slowAura>0,frostFactor:1-slowAura,frostDur:60});  // v52寒霜领域：机枪弹附减速
          vfxMuzzle(mx,my,t.angle,'minigun');
          sndTowerShoot('turret');
        }else if(t.type==='freeze'){
          t.cooldown = effectiveCooldown;
          const dmg = st.dmg*towerShotDmgMult;
          // 发射冰冻弹（命中后减速+伤害）
          bullets.push({id:bId++,x:mx,y:my,vx:Math.cos(t.angle)*st.projSpeed,vy:Math.sin(t.angle)*st.projSpeed,
            active:true,dmg,piercing:false,grav:false,burn:false,maxRange:tt.range*(1+bpTurretBoost.range),sx:t.x,sy:t.y,wpn:'_towerFreeze',
            frost:true,frostFactor:st.slowFactor,frostDur:st.slowDur,fromTower:true,dmgType:'energy'});
          vfxMuzzle(mx,my,t.angle,'ice');
          sndTowerShoot('freeze');
        }else if(t.type==='cannon'){
          t.cooldown = effectiveCooldown;
          const dmg = st.dmg*towerShotDmgMult;
          // 发射炮弹（命中后范围爆炸）
          bullets.push({id:bId++,x:mx,y:my,vx:Math.cos(t.angle)*st.projSpeed,vy:Math.sin(t.angle)*st.projSpeed,
            active:true,dmg,piercing:false,grav:false,burn:false,maxRange:tt.range*(1+bpTurretBoost.range),sx:t.x,sy:t.y,wpn:'_towerCannon',
            aoe:st.aoeRadius,fromTower:true,dmgType:'explosive'});
          vfxMuzzle(mx,my,t.angle,'shotgun');
          sndTowerShoot('cannon');
        }else if(t.type==='tesla'){
          // ── 电弧塔：能量链电（无弹道，命中时链式跳跃）──
          t.cooldown = effectiveCooldown;
          const dmg = st.dmg*towerShotDmgMult;
          hitZombie(target, target.x+22, Z_TOP+28, dmg, t.x, t.y, 1, 'energy');
          // 链式跳跃：从目标向附近敌人扩散，每跳伤害×chainDecay（行囊电感磁圈额外+2次链跳）
          const bpExtraChain = (typeof backpackInventory !== 'undefined' && backpackInventory.tesla_coil > 0) ? 2 : 0;
          const maxChains = (st.chain || 4) + bpExtraChain;
          let chainDmg = dmg*st.chainDecay;
          let lastX = target.x+22, lastY = Z_TOP+28;
          const chained = new Set([target]);
          for(let hop=1; hop<maxChains; hop++){
            let next=null, nd=140;
            for(const z2 of zombies){
              if(!z2.alive||chained.has(z2))continue;
              const d=Math.hypot((z2.x+22)-lastX,(Z_TOP+28)-lastY);
              if(d<nd){nd=d;next=z2;}
            }
            if(!next)break;
            // 链电视觉（闪电折线）
            for(let s=0;s<4;s++){
              const px=lastX+(next.x+22-lastX)*s/4+(Math.random()-.5)*14;
              const py=lastY+(Z_TOP+28-lastY)*s/4+(Math.random()-.5)*14;
              mkP({x:px,y:py,r:2.5,rDecay:.15,decay:.12,color:'#ffe066',type:'circle',grav:0,alpha:.95,blur:true});
            }
            hitZombie(next, next.x+22, Z_TOP+28, chainDmg, lastX, lastY, 1, 'energy');
            chained.add(next);
            lastX=next.x+22; lastY=Z_TOP+28;
            chainDmg*=st.chainDecay;
          }
          if(target===boss)hitBoss(dmg, t.x, t.y, t.x, t.y, 'energy');  // Boss吃首跳伤害
          vfxMuzzle(mx,my,t.angle,'tesla');
          sndTowerShoot('tesla');
        }else if(t.type==='repair'){
          // ── 维修塔：优先修复围墙，墙满时微治疗玩家 ──
          t.cooldown = effectiveCooldown;
          const heal = Math.round(st.heal*dmgMult);
          if(wallLevel>0 && wallHp < WALL_HP_PER_LEVEL[wallLevel]){
            const wallMax = WALL_HP_PER_LEVEL[wallLevel];
            const healed = Math.min(heal, wallMax - wallHp);
            wallHp += healed;
            spawnFloatText('墙+'+healed, RIGHT_WALL_X, Z_TOP-12, '#44ff44');
            // 维修光束：塔→围墙
            vfxTowerHealBeam(t.x,t.y,RIGHT_WALL_X,Z_TOP+40);
            mkP({x:RIGHT_WALL_X,y:Z_TOP+40,r:10,rDecay:-1,decay:.1,color:'#44ff44',type:'ring',alpha:.7,grav:0});
          }else if(health<maxHp){
            const healed=Math.min(heal, maxHp-health);
            health=Math.min(maxHp,health+healed);updateHpUI();
            spawnFloatText('+'+healed+'💖', player.x+CHAR_W/2, player.y-10, '#44ff44');
            vfxTowerHealBeam(t.x,t.y,player.x+CHAR_W/2,player.y+CHAR_H/2);
            mkP({x:player.x+CHAR_W/2,y:player.y+CHAR_H/2,r:16,rDecay:-1.5,decay:.08,color:'#44ff66',type:'ring',alpha:.6,grav:0});
          }else{
            t.cooldown = Math.min(t.cooldown, 20);  // 无事可做时快速待机
          }
          sndTowerShoot('heal');
        }
        t.recoil=1;  // 触发后坐力动画
      }
    }else{
      t.angle += (-Math.PI/4 - t.angle)*0.03;  // 无目标时复位
    }
  });
  // 陷阱更新：蠢蛋踩到触发
  for(let i=traps.length-1;i>=0;i--){
    const tr=traps[i];
    const tt=TRAP_TYPES[tr.type];
    let triggered=false;
    for(const z of zombies){
      if(!z.alive)continue;
      if(Math.abs(z.x+22-tr.x)<24){
        triggered=true;
        if(tr.type==='spikes'){
          hitZombie(z,tr.x,Z_TOP+28,tt.dmg,tr.x-50,Z_TOP,1,'physical');
        }else if(tr.type==='mine'){
          vfxExplosion(tr.x,tr.y); sndExplosion(); addShake(8);
          zombies.forEach(z2=>{if(z2.alive&&Math.abs(z2.x+22-tr.x)<tt.aoe){hitZombie(z2,tr.x,Z_TOP+28,tt.dmg,tr.x-50,Z_TOP,1,'explosive');}});
        }
        break;
      }
    }
    if(triggered){
      tr.charges--;
      if(tr.charges<=0){traps.splice(i,1);}
    }
  }
    // ═══ v52塔防强化：塔可被攻击 ═══
  // 重甲/坦克/精英/Boss 类敌人若身边有塔（含墙外前排塔），优先转火攻击塔——塔有HP，拆毁留残骸位可原址重建。
  // 策略层：塔不再是无敌挂机 DPS，摆放位置（前排输出位 vs 后排安全位）成为真实抉择。
  updateTowerUnderAttack();
  // 围墙机制（重写）：围墙是硬屏障——墙有血时蠢蛋被挡住、持续啃墙(不掉血不死)，
    // 墙破后才放行蠢蛋进入家园区扣家园血。所有己方建筑在墙后（垫高平台），不直接受攻击。
  for(const z of zombies){
    if(!z.alive)continue;
    const deathPact = !!playerPerks.deathpact;  // 死亡契约：墙永不破
    // 右墙是主防线：蠢蛋从右往左走，当其左边缘触及墙线(z.x<=RIGHT_WALL_X)就被挡住
    // 提前在 z.x <= RIGHT_WALL_X+2 时就阻挡（防止高速穿墙）
    const reachedWall = z.x <= RIGHT_WALL_X + 2 && z.x > LEFT_WALL_X;
    if(reachedWall){
      if(wallHp > 0 || deathPact){
        // 墙挡住：把蠢蛋推回墙右侧紧贴墙(z.x=RIGHT_WALL_X+2，在墙外)，啃墙扣血
        z.x = RIGHT_WALL_X + 2;  // 推到墙右侧（蠢蛋左边缘贴墙右面）
        z.walkT += .05;
        if(frameT % 30 === 0){  // 每0.5秒啃一次
          // 僵尸啃墙伤害随波次提升（前期12，后期翻倍），行囊钛金板提供减伤
          const baseDmg = z.elite ? 25 : 12;
          const tdRed = (typeof getBackpackTdDmgReduction === 'function') ? getBackpackTdDmgReduction() : 0;
          const dmg = Math.floor(baseDmg * (1 + wave * 0.08) * (1 - tdRed));
          if(!deathPact) wallHp = Math.max(0, wallHp - dmg);
          vfxHit(RIGHT_WALL_X, Z_TOP+28, z.x+22, Z_TOP+28);
          addShake(2);
          const knockDir = 1;  // 碎片向右飞
          for(let i=0;i<3;i++){mkP({x:RIGHT_WALL_X,y:Z_TOP+20+Math.random()*40,vx:knockDir*(1+Math.random()*3),vy:-1-Math.random()*2,r:2+Math.random()*2,rDecay:.05,decay:.03,color:wallLevel>=2?'#888':'#a08060',type:'shard',angle:Math.random()*Math.PI,spin:.2,grav:.3,alpha:.8});}
          // 行囊被动：高压电感磁圈 反伤触碰围墙的近战僵尸
          if(typeof backpackInventory !== 'undefined' && backpackInventory.tesla_coil > 0){
            hitZombie(z, z.x+22, Z_TOP+28, 30, RIGHT_WALL_X, Z_TOP+28, 1.2, 'energy');
            for(let s=0;s<3;s++){ mkP({x:RIGHT_WALL_X+(z.x+22-RIGHT_WALL_X)*s/3, y:Z_TOP+28+(Math.random()-.5)*12, r:2.5, rDecay:.1, decay:.1, color:'#ffe066', type:'circle', grav:0, alpha:.9}); }
          }
          if(!deathPact && wallHp<=0){addBanner('🧱 围墙被攻破！家园暴露！');sndExplosion();addShake(8);}
        }
        // 先锋天赋：墙被啃时玩家+50%伤害5秒
        if(playerPerks.vanguard && frameT % 30 === 0){
          window._vanguardBuffT = 300;
          if(!window._vanguardWarned){addBanner('⚔️ 先锋反击！伤害提升！');window._vanguardWarned=true;setTimeout(()=>window._vanguardWarned=false,4000);}
        }
      }else{
        // 墙已破：放行蠢蛋进入家园区，到左墙(HOME_X前)才扣家园血
        if(z.x <= LEFT_WALL_X){
          const tdRed = (typeof getBackpackTdDmgReduction === 'function') ? getBackpackTdDmgReduction() : 0;
          const dmg = Math.floor((z.elite ? 25 : 12) * (1 - tdRed));
          homeHp = Math.max(0, homeHp - dmg);
          z.alive=false; if(z.burnTimer){clearInterval(z.burnTimer);}
          vfxHit(LEFT_WALL_X, Z_TOP+28, z.x, Z_TOP+28);
          addShake(4);
          if(homeHp<=0 && gameRunning){
            homeHp=0;updateHomeHpUI();triggerGameOver('家园核心被摧毁！');return;
          }
          updateHomeHpUI();
        }
      }
    }
  }
  // Boss 也受围墙阻挡
  if(boss&&boss.alive&&bossActive){
    if(boss.x < RIGHT_WALL_X && (wallHp>0||playerPerks.deathpact)){
      boss.x = RIGHT_WALL_X;
      if(frameT%40===0){wallHp=Math.max(0,wallHp-25);vfxHit(RIGHT_WALL_X,GROUND_Y-60,boss.x+40,GROUND_Y-80);addShake(3);}
    }
  }
  // 更新家园血条UI
  const hf=document.getElementById('home-hp-fill');
  if(hf) hf.style.width=(homeHp/HOME_HP_MAX*100)+'%';
  // 更新围墙血条UI
  const wf=document.getElementById('wall-hp-fill');
  if(wf){
    const wallMax = WALL_HP_PER_LEVEL[wallLevel]||1;
    wf.style.width=(wallHp/wallMax*100)+'%';
    // 根据围墙等级改变颜色（木=棕/石=灰/铁=铁蓝）
    const wallColors = [
      'linear-gradient(90deg,#3a2a1a,#5a4a30)',
      'linear-gradient(90deg,#5a4030,#b09060)',  // 木
      'linear-gradient(90deg,#666666,#aaaaaa)',  // 石
      'linear-gradient(90deg,#3a3a44,#6a6a74)',  // 铁
    ];
    wf.style.background = wallColors[wallLevel] || wallColors[1];
    const wlEl=document.getElementById('wall-level-display');
    if(wlEl){
      const wallNames = ['无','木墙','石墙','铁墙'];
      wlEl.textContent = wallLevel>0 ? '🧱 '+wallNames[wallLevel]+' Lv.'+wallLevel : '🧱 无围墙';
      // 颜色随等级变化
      wlEl.style.color = wallLevel>=3 ? '#aaaacc' : wallLevel===2 ? '#cccccc' : '#c8a060';
    }
  }
  // ── 围墙被攻破后：玩家持续受到伤害（僵尸涌入家园，角色被迫承受压力）──
  // 提升围墙重要性：墙破了角色每秒掉血，直到墙被修复
  if(wallHp <= 0 && wallLevel > 0 && gameRunning && !window._berserkActive){
    if(frameT % 60 === 0){  // 每秒1次
      const breachDmg = 3 + Math.floor(wave * 0.5);  // 随波次增长
      // 只有当有僵尸在场时才掉血（模拟被围攻）
      const nearbyZombies = zombies.filter(z => z.alive && z.x < RIGHT_WALL_X + 200).length;
      if(nearbyZombies > 0){
        health = Math.max(0, health - breachDmg);
        updateHpUI();
        redFlash = Math.min(1, redFlash + 0.3);
        spawnFloatText('围墙破! -'+breachDmg, player.x+CHAR_W/2, player.y-10, '#ff6644');
        if(frameT % 120 === 0) addBanner('⚠️ 围墙被攻破！僵尸涌入家园！快修墙或回据点！');
        if(health <= 0) endGame();
      }
    }
  }
}
// ── 塔辅助函数 ──
// 塔射击音效（与玩家武器区分，更"机械"）
function sndTowerShoot(type){
  if(type==='turret'){noiseFreqRamp(0.05,1200,300,'square',0.14,2200);whiteNoiseBurst(0.04,0.08,3000);}
  else if(type==='freeze'){noiseFreqRamp(0.10,1800,600,'sine',0.18,3500);whiteNoiseBurst(0.05,0.10,4000);}
  else if(type==='cannon'){noiseFreqRamp(0.12,400,100,'sawtooth',0.3,800);whiteNoiseBurst(0.08,0.2,1200);noise(0.1,80,'sine',0.4,0,0,300);}
  else if(type==='heal'){[0,80,160].forEach((t,i)=>setTimeout(()=>noiseFreqRamp(0.08,500+i*200,1000+i*200,'sine',0.14),t));}
  else if(type==='tesla'){[0,40,90].forEach(t=>setTimeout(()=>noiseFreqRamp(0.06,2400,900,'square',0.12),t));whiteNoiseBurst(0.05,0.08,5000);}
}
// 治疗塔光束：塔→玩家
function vfxTowerHealBeam(x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,dist=Math.sqrt(dx*dx+dy*dy)||1,nx=dx/dist,ny=dy/dist;
  for(let d=0;d<dist;d+=10){mkP({x:x1+nx*d,y:y1+ny*d,vx:(Math.random()-.5)*.8,vy:(Math.random()-.5)*.8,r:2+Math.random()*2,rDecay:.06,decay:.06,color:'#88ff88',type:'circle',grav:0,alpha:.85,blur:true});}
}
// 处理塔特殊子弹命中效果（冰冻/爆炸）
function applyTowerBulletHit(b,zx,zy){
  if(b.wpn==='_towerFreeze' && b.frost){
    mkP({x:zx,y:zy,r:3,rDecay:-.5,decay:.08,color:'rgba(150,230,255,.7)',type:'ring',alpha:.8,grav:0});
  }else if(b.wpn==='_towerCannon' && b.aoe){
    // ── 炮击塔命中必炸（原"≥2只才炸"导致对单体失效，违背塔定位）──
    const R=b.aoe;
    vfxExplosion(zx,zy);sndExplosion();addShake(4);
    zombies.forEach(z2=>{if(z2.alive){const d=Math.sqrt((z2.x+22-zx)**2+((Z_TOP+28)-zy)**2);if(d<R)hitZombie(z2,z2.x+22,Z_TOP+28,b.dmg,zx,zy,1,'explosive');}});
    if(boss&&boss.alive){const d=Math.sqrt((boss.x+40-zx)**2+((GROUND_Y-80)-zy)**2);if(d<R)hitBoss(b.dmg,zx,zy,zx,zy,'explosive');}
  }
}
// 围墙升级/修复函数
// free=true 时为免费升级（如军火库赠送），不扣金币、不校验金币
function upgradeWall(free){
  if(wallLevel >= 3){addBanner('⚠ 围墙已满级！');return;}
  if(!free){
    const cost = WALL_UPGRADE_COST[wallLevel];
    if(coins < cost){addBanner('💰 金币不足！');return;}
    coins -= cost; updateCoinUI();
  }
  wallLevel++;
  wallHp = WALL_HP_PER_LEVEL[wallLevel];  // 升级后满血
  addBanner(`🧱 围墙升级至 Lv.${wallLevel}（${wallLevel===1?'木墙':wallLevel===2?'石墙':'铁墙'}）！`);
  sndReload();
  // 升级特效（左右墙都喷粒子）
  [LEFT_WALL_X,RIGHT_WALL_X].forEach(wx=>{for(let i=0;i<8;i++){mkP({x:wx,y:Z_TOP+30+Math.random()*40,vx:(Math.random()-.5)*4,vy:-2-Math.random()*3,r:3,rDecay:.06,decay:.03,color:wallLevel>=2?'#aaa':'#c8a060',type:'circle',grav:.2,alpha:.8});}});
}
function repairWall(free){
  if(wallLevel === 0){addBanner('⚠ 请先建造围墙！');return;}
  const wallMax = WALL_HP_PER_LEVEL[wallLevel];
  if(wallHp >= wallMax){addBanner('围墙已满血！');return;}
  if(!free){
    if(coins < WALL_REPAIR_COST){addBanner('💰 金币不足！');return;}
    coins -= WALL_REPAIR_COST; updateCoinUI();
  }
  // 修复至满血（原+30改为满血修复）
  const repaired = wallMax - wallHp;
  wallHp = wallMax;
  addBanner('🔧 围墙修复至满血！(+' + Math.round(repaired) + ')');
  sndReload();
  // 修复特效
  for(let i=0;i<8;i++){mkP({x:RIGHT_WALL_X-10+Math.random()*20,y:GROUND_Y-60-Math.random()*80,vx:(Math.random()-.5)*3,vy:-2-Math.random()*3,r:3,rDecay:.06,decay:.04,color:'#88cc88',type:'circle',alpha:.8,blur:true});}
}
// 绘制家园城堡（高台地基+城墙护栏=围墙系统）
// 设计：整个家园区比地面高出 HOME_PLATFORM_H 的石砌台阶，建筑立在平台上，
// 城墙(护栏)立在平台边缘，防御塔部署在地面战场侧。形成"家园在高处，战场在低处"的塔防格局。
function drawWall(){
  const cLeft = LEFT_WALL_X - 20, cRight = RIGHT_WALL_X + 20;
  const screenL = cLeft - cameraX, screenR = cRight - cameraX;
  if(screenR <= 0 || screenL >= GW)return;
  const sL = cLeft, sR = cRight;

  // ── 1. 家园高台（石砌台阶，比地面高 HOME_PLATFORM_H）──
  const platTop = GROUND_Y - HOME_PLATFORM_H;  // 平台顶面 y
  ctx.save();
  // 平台立面（侧面，深石色，从地面到平台顶）
  const stoneA = wallLevel>=2 ? '#4a4a52' : '#3a3a40';
  const stoneB = wallLevel>=2 ? '#3a3a40' : '#2a2a30';
  const stoneC = wallLevel>=2 ? '#5a5a64' : '#4a4a50';
  ctx.fillStyle = stoneB;
  ctx.fillRect(sL, platTop, sR-sL, HOME_PLATFORM_H);
  // 平台顶面（亮色，建筑坐落其上）
  ctx.fillStyle = stoneA;
  ctx.fillRect(sL, platTop, sR-sL, 4);
  ctx.fillStyle = stoneC;
  ctx.fillRect(sL, platTop, sR-sL, 2);
  // 平台立面砖纹（横线+错缝竖线）
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1;
  for(let y=platTop+10; y<GROUND_Y; y+=10){
    ctx.beginPath(); ctx.moveTo(sL,y); ctx.lineTo(sR,y); ctx.stroke();
  }
  for(let row=0,y=platTop; y<GROUND_Y; y+=10,row++){
    const off = row%2 ? 14 : 0;
    ctx.strokeStyle='rgba(0,0,0,.25)';
    for(let x=sL+off; x<sR; x+=28){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+10);ctx.stroke();}
  }
  // 平台顶面边缘亮线（阳光感）
  ctx.fillStyle = stoneC;
  ctx.fillRect(sL, platTop, sR-sL, 1);
  // 平台底部与地面接缝阴影
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(sL, GROUND_Y-3, sR-sL, 3);
  // 平台右侧悬崖绝壁加固斜撑墩（凸显险峻高台感）
  ctx.fillStyle = stoneB;
  ctx.beginPath();
  ctx.moveTo(sR-4, platTop);
  ctx.lineTo(sR+10, GROUND_Y);
  ctx.lineTo(sR-16, GROUND_Y);
  ctx.lineTo(sR-16, platTop);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.stroke();

  // 绝壁暗面与阴影
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(sL, platTop, 4, HOME_PLATFORM_H);       // 左边缘暗面
  ctx.fillRect(sR-4, platTop, 4, HOME_PLATFORM_H);     // 右边缘暗面

  // 内侧登城战术木梯（在玩家侧，方便视觉理解高低差）
  const ladderX = sR - 38;
  ctx.strokeStyle = '#6b4c2b'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(ladderX, platTop+2); ctx.lineTo(ladderX, GROUND_Y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ladderX+14, platTop+2); ctx.lineTo(ladderX+14, GROUND_Y); ctx.stroke();
  ctx.strokeStyle = '#8d6338'; ctx.lineWidth = 1.8;
  for(let ly = platTop + 10; ly < GROUND_Y; ly += 9){
    ctx.beginPath(); ctx.moveTo(ladderX, ly); ctx.lineTo(ladderX+14, ly); ctx.stroke();
  }
  ctx.restore();

  // ── 2. 城墙/护栏（立在平台顶面边缘，=围墙系统）──
  const deathPact = !!playerPerks.deathpact;
  const wallBuilt = (wallLevel > 0 && wallHp > 0) || deathPact;
  // 材质按等级：木=棕石，石=灰石，铁=深铁石
  const wMat = wallLevel>=3 ? {a:'#555560',b:'#3a3a44',c:'#6a6a74'} :
               wallLevel===2 ? {a:'#888888',b:'#666666',c:'#aaaaaa'} :
               {a:'#8a7050',b:'#5a4a30',c:'#b09060'};

  // 绘制一段城墙（含城垛）—— worldX:世界x, h:墙高(从平台顶算), isMain:是否主墙
  function drawCurtainWall(worldX, h, isMain){
    const screenX = worldX - cameraX;
    if(screenX < -40 || screenX > GW+40)return;
    const sx = worldX;
    const wTop = platTop - h;  // 墙顶在平台顶之上
    const wW = isMain ? 22 : 16;
    ctx.save();
    // 城墙主体（从平台顶向上 h 像素）
    ctx.fillStyle = wMat.a; ctx.fillRect(sx-wW/2, wTop, wW, h);
    ctx.fillStyle = wMat.b; ctx.fillRect(sx-wW/2, wTop, 4, h);  // 左暗面
    ctx.fillStyle = wMat.c; ctx.fillRect(sx+wW/2-4, wTop, 4, h); // 右亮面
    // 砖纹
    ctx.strokeStyle = wMat.b; ctx.lineWidth = 1;
    for(let i=0;i<Math.ceil(h/14);i++){ctx.beginPath();ctx.moveTo(sx-wW/2,wTop+i*14);ctx.lineTo(sx+wW/2,wTop+i*14);ctx.stroke();}
    // ── 城垛/护栏（merlons 锯齿状）── 这是"围墙"的视觉本体
    const merlonH = 10, merlonW = 6, gap = 5;
    let mx = sx - wW/2;
    ctx.fillStyle = wMat.a;
    while(mx <= sx + wW/2 - merlonW){
      ctx.fillRect(mx, wTop - merlonH, merlonW, merlonH);
      ctx.fillStyle = wMat.c; ctx.fillRect(mx, wTop-merlonH, merlonW, 2);
      ctx.fillStyle = wMat.a;
      mx += merlonW + gap;
    }
    // 主墙加箭眼
    if(isMain && h > 40){
      ctx.fillStyle = '#000';
      for(let i=0;i<2;i++){ctx.fillRect(sx-2, wTop+15+i*20, 4, 8);}
    }
    // 破损裂纹（按血量比例）
    if(wallBuilt && !deathPact){
      const wallMax = WALL_HP_PER_LEVEL[wallLevel]||1;
      const hpR = wallHp/wallMax;
      if(hpR < 0.66){
        ctx.strokeStyle='#000';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(sx-2,wTop+8);ctx.lineTo(sx+3,wTop+h*0.4);ctx.lineTo(sx-1,wTop+h*0.7);ctx.stroke();
      }
      if(hpR < 0.33){
        ctx.strokeStyle='#000';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(sx+2,wTop+4);ctx.lineTo(sx-4,wTop+h*0.5);ctx.lineTo(sx+4,wTop+h*0.85);ctx.stroke();
        ctx.fillStyle='#000';ctx.fillRect(sx-wW/2+2, wTop+h*0.6, wW-4, h*0.3);
        ctx.fillStyle=wMat.b;
        for(let i=0;i<3;i++){ctx.fillRect(sx-wW/2+Math.random()*wW, platTop-4+Math.random()*8, 3,3);}
      }
    }
    // 等级旗帜
    if(wallBuilt){
      ctx.fillStyle = wallLevel===1?'#c8a060':wallLevel===2?'#ccc':'#888';
      ctx.fillRect(sx-1, wTop-merlonH-10, 2, 10);
      ctx.fillStyle = wallLevel===1?'#daa520':wallLevel===2?'#fff':'#aaa';
      ctx.beginPath();ctx.moveTo(sx+1,wTop-merlonH-10);ctx.lineTo(sx+9,wTop-merlonH-8);ctx.lineTo(sx+1,wTop-merlonH-6);ctx.fill();
    }
    ctx.restore();
  }

  // ── 3. 角楼（平台两端，比城墙更高）──
  function drawCornerTower(worldX){
    const screenX = worldX - cameraX;
    if(screenX < -40 || screenX > GW+40)return;
    const sx = worldX;
    const tw = 22, th = HOME_PLATFORM_H + 55;  // 从地面到塔顶
    const tTop = GROUND_Y - th;
    ctx.save();
    // 塔身（梯形，上窄下宽，跨越平台高度）——美术升级：石块渐变+砖缝+苔藓
    const towerGrad = ctx.createLinearGradient(sx-tw/2, 0, sx+tw/2, 0);
    towerGrad.addColorStop(0, wMat.c);
    towerGrad.addColorStop(0.35, wMat.a);
    towerGrad.addColorStop(1, wMat.b);
    ctx.fillStyle = towerGrad;
    ctx.beginPath();
    ctx.moveTo(sx-tw/2, GROUND_Y); ctx.lineTo(sx-tw/2+3, tTop);
    ctx.lineTo(sx+tw/2-3, tTop); ctx.lineTo(sx+tw/2, GROUND_Y); ctx.closePath(); ctx.fill();
    // 砖缝横线
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=.8;
    for(let by=tTop+8; by<GROUND_Y; by+=11){
      ctx.beginPath();ctx.moveTo(sx-tw/2+2,by);ctx.lineTo(sx+tw/2-2,by);ctx.stroke();
    }
    // 苔藓（底部向上侵蚀，有机绿色）
    ctx.fillStyle='rgba(70,100,40,.35)';
    ctx.fillRect(sx-tw/2+2, GROUND_Y-14, 5, 12);
    ctx.fillRect(sx+tw/2-8, GROUND_Y-9, 4, 8);
    ctx.fillStyle='rgba(90,120,50,.3)';
    ctx.fillRect(sx-2, GROUND_Y-6, 6, 5);
    ctx.fillStyle = wMat.a; ctx.fillRect(sx-tw/2+3, tTop, tw-6, th*0.3);
    // 塔顶圆锥（渐变+描边）
    const coneGrad = ctx.createLinearGradient(sx-tw/2, 0, sx+tw/2, 0);
    coneGrad.addColorStop(0, wallLevel>=2?'#777':'#7a5a40');
    coneGrad.addColorStop(0.5, wallLevel>=2?'#555':'#6a4a30');
    coneGrad.addColorStop(1, wallLevel>=2?'#3a3a3a':'#4a3420');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();ctx.moveTo(sx-tw/2,tTop);ctx.lineTo(sx,tTop-14);ctx.lineTo(sx+tw/2,tTop);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(sx-tw/2,tTop);ctx.lineTo(sx,tTop-14);ctx.lineTo(sx+tw/2,tTop);ctx.closePath();ctx.stroke();
    // ── 美术升级：塔顶旗帜（波涛飘动）──
    const flagWave1=Math.sin(frameT*0.07)*2, flagWave2=Math.sin(frameT*0.07+.9)*3;
    ctx.strokeStyle='#5a4a30';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(sx,tTop-14);ctx.lineTo(sx,tTop-26);ctx.stroke();
    ctx.fillStyle=wallLevel>=3?'#88aacc':wallLevel===2?'#cc4444':'#c8a060';
    ctx.beginPath();
    ctx.moveTo(sx,tTop-26);
    ctx.quadraticCurveTo(sx+5,tTop-26+flagWave1, sx+11,tTop-24+flagWave1);
    ctx.lineTo(sx+11,tTop-19+flagWave2);
    ctx.quadraticCurveTo(sx+5,tTop-19+flagWave2, sx,tTop-18);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(sx+4,tTop-23+flagWave1*.5,2,2);  // 旗面徽记
    // 箭眼
    ctx.fillStyle='#000';
    ctx.fillRect(sx-2,tTop+12,4,6);ctx.fillRect(sx-2,tTop+28,4,6);
    ctx.restore();
  }

  // ── 美术升级：火把（城墙两侧+角楼，火焰粒子+光晕照明地面）──
  function drawWallTorch(worldX, baseY){
    // 彻底移除城墙火把/灯光/光晕微粒
  }
  function rDecay_random(){return Math.random();}

  // 画角楼
  if(wallBuilt || wallLevel>0){
    drawCornerTower(LEFT_WALL_X);
    drawCornerTower(RIGHT_WALL_X);
  }
  // 画城墙
  if(wallBuilt){
    const mainH = wallLevel===1 ? 50 : wallLevel===2 ? 65 : 80;
    const backH = wallLevel===1 ? 40 : wallLevel===2 ? 50 : 60;
    drawCurtainWall(RIGHT_WALL_X, mainH, true);   // 右=主防御
    drawCurtainWall(LEFT_WALL_X, backH, false);   // 左=后墙
    // 美术升级：主墙两侧火把（夜里氛围+照明）
    // drawWallTorch(RIGHT_WALL_X - 46, platTop);
    // drawWallTorch(RIGHT_WALL_X + 12, platTop);
    // drawWallTorch(LEFT_WALL_X - 12, platTop);
  }else{
    drawWallGap(RIGHT_WALL_X);
    drawWallGap(LEFT_WALL_X);
  }
}
// 画墙缺口标记
function drawWallGap(worldX){
  const screenX = worldX - cameraX;
  if(screenX < -30 || screenX > GW+30)return;
  const sx = worldX;
  const platTop = GROUND_Y - HOME_PLATFORM_H;
  ctx.save();
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(sx-10, platTop-20, 20, 20+HOME_PLATFORM_H);
  ctx.fillStyle = '#5a5a60';
  ctx.fillRect(sx-8, platTop-22, 5, 6);
  ctx.fillRect(sx+3, platTop-16, 4, 5);
  ctx.fillStyle='rgba(0,0,0,.4)';
  ctx.fillRect(sx-6, platTop-6, 12, 4);
  ctx.restore();
}
// 绘制所有塔
// 鼠标悬停的塔索引（用于显示射程圈）
let hoveredTowerIdx=-1;

// ═══════════════════════════════════════════════════════════
// 高地哨塔极简建造/升级交互（走到基座旁按 [E] 一键秒造，无图纸复杂配装）
// ═══════════════════════════════════════════════════════════
function tryInteractTowerBase(){
  if(gameState !== 'world') return false;
  if(player.y > PLATFORM_TOP + 15) return false; // 仅在高地平台上有效
  const bases = (typeof FORTRESS_BASE_SLOTS !== 'undefined') ? FORTRESS_BASE_SLOTS : [170, 310, 450, 590];
  for(const bx of bases){
    if(Math.abs(player.x - bx) < 45){
      const existingTower = towers.find(t => Math.abs(t.x - bx) < 25);
      if(!existingTower){
        // 建造 1 级机枪哨塔（60 金币）
        if(coins < 60){
          addBanner('💰 金币不足！建造机枪哨塔需要 60 金币 (击杀或深夜食堂营业获取)');
          return true;
        }
        coins -= 60;
        updateCoinUI();
        const tt = TOWER_TYPES.turret;
        const newT = {
          x: bx,
          y: PLATFORM_TOP - 6,
          type: 'turret',
          level: 1,
          cooldown: 0,
          recoil: 0,
          angle: 0,
          hp: tt.hp,
          hpMax: tt.hp
        };
        towers.push(newT);
        addBanner('🗼 轻型机枪哨塔架设就位！(自动警戒射击)');
        spawnFloatText('🛠️ 哨塔就绪!', bx, PLATFORM_TOP - 25, '#388bfd');
        sndLevelUp();
        return true;
      } else {
        // 升级已有哨塔
        if(existingTower.level >= 3){
          addBanner('🗼 该机枪哨塔已达最高战备等级 (Lv.3)');
          return true;
        }
        const upCost = 45;
        if(coins < upCost){
          addBanner('💰 金币不足！升级哨塔需 ' + upCost + ' 金币');
          return true;
        }
        coins -= upCost;
        updateCoinUI();
        existingTower.level++;
        addBanner('🗼 机枪哨塔升至 Lv.' + existingTower.level + '！(射速与威力提升)');
        spawnFloatText('⚡ 哨塔 Lv.' + existingTower.level + '!', existingTower.x, existingTower.y - 25, '#388bfd');
        sndLevelUp();
        return true;
      }
    }
  }
  return false;
}

function drawTowers(){
  // 鼠标悬停的塔索引（用于显示射程圈）
  hoveredTowerIdx = -1;
  const mwx = lastMX;
  for(let i=0; i<towers.length; i++){
    const t = towers[i];
    if(Math.abs(mwx - t.x) < 25 && Math.abs(lastMY - t.y) < 30){ hoveredTowerIdx = i; break; }
  }

  // ── 绘制高地城垛的哨塔基座（4处固定点位，结构工整，贴合要塞地貌）──
  if(typeof FORTRESS_BASE_SLOTS === 'undefined'){
    window.FORTRESS_BASE_SLOTS = [170, 310, 450, 590];
  }

  FORTRESS_BASE_SLOTS.forEach(bx => {
    // 视口剔除：世界坐标在屏幕外时不绘制
    if(bx - cameraX < -60 || bx - cameraX > GW + 60) return;
    const sx = bx;  // 画布已在全局平移 (shakeX - cameraX)，此处直接使用世界坐标 bx，杜绝双重减去 cameraX 的位移偏移 BUG
    const by = PLATFORM_TOP - 6;
    const hasTower = towers.some(t => Math.abs(t.x - bx) < 25);
    
    ctx.save();
    // 嵌入城墙顶部的合金固定基槽
    ctx.fillStyle = '#161a22';
    ctx.fillRect(sx - 18, by, 36, 6);
    ctx.fillStyle = '#262f3d';
    ctx.fillRect(sx - 16, by, 32, 2);
    // 左右重型固定六角螺栓
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(sx - 16, by + 3, 2, 2);
    ctx.fillRect(sx + 14, by + 3, 2, 2);

    if(!hasTower){
      // 空基座：冷蓝微弱呼吸灯
      const blink = 0.35 + 0.35 * Math.sin(frameT * 0.05 + bx);
      ctx.fillStyle = `rgba(56, 139, 253, ${blink})`;
      ctx.fillRect(sx - 3, by + 2, 6, 2);

      // 玩家靠近时浮动微型提示
      if(Math.abs(player.x - bx) < 45 && player.y <= PLATFORM_TOP + 10){
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = '#388bfd';
        ctx.lineWidth = 1;
        ctx.fillRect(sx - 56, by - 24, 112, 18);
        ctx.strokeRect(sx - 56, by - 24, 112, 18);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px "Microsoft YaHei UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('[E] 建造基地防线与哨塔', sx, by - 11);
      }
    }
    ctx.restore();
  });

  // ── 绘制已部署的战术防御哨塔（5种防御塔全部具备专属差异化建模与动效！）──
  towers.forEach((t, idx) => {
    if(t.x - cameraX < -60 || t.x - cameraX > GW + 60) return;
    const tt = TOWER_TYPES[t.type] || TOWER_TYPES.turret;
    const isHover = (idx === hoveredTowerIdx);
    const recoil = (t.recoil > 0 ? t.recoil * 2.5 : 0);
    const lvl = t.level || 1;
    const type = t.type || 'turret';

    ctx.save();
    ctx.translate(t.x, t.y);

    // 射程警戒环（悬停时轻微显现）
    if(isHover){
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = tt.color || '#388bfd';
      ctx.beginPath(); ctx.arc(0, -8, tt.range, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = tt.color || '#388bfd';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, -8, tt.range, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // ── 哨塔底座（尺寸适中：宽32px，高10px，贴合城垛）──
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 10, 17, 3, 0, 0, Math.PI*2); ctx.fill();

    // 钢架装甲底座：按防御塔类型专属定制渐变
    const baseGrad = ctx.createLinearGradient(-16, 0, 16, 10);
    if(type === 'freeze'){
      baseGrad.addColorStop(0, '#102236'); baseGrad.addColorStop(0.5, '#193556'); baseGrad.addColorStop(1, '#0c1a2b');
    } else if(type === 'cannon'){
      baseGrad.addColorStop(0, '#2b1f14'); baseGrad.addColorStop(0.5, '#3d2b1b'); baseGrad.addColorStop(1, '#21170d');
    } else if(type === 'tesla'){
      baseGrad.addColorStop(0, '#29220c'); baseGrad.addColorStop(0.5, '#3d3313'); baseGrad.addColorStop(1, '#201b08');
    } else if(type === 'repair'){
      baseGrad.addColorStop(0, '#102619'); baseGrad.addColorStop(0.5, '#173d28'); baseGrad.addColorStop(1, '#0b1c12');
    } else {
      baseGrad.addColorStop(0, '#1c2127'); baseGrad.addColorStop(0.5, '#2e3540'); baseGrad.addColorStop(1, '#191d23');
    }
    ctx.fillStyle = baseGrad;
    ctx.fillRect(-16, 0, 32, 10);

    // 战术斜切倒角装饰边
    const accentCol = (type === 'freeze') ? '#38bdf8' : (type === 'cannon') ? '#f97316' : (type === 'tesla') ? '#eab308' : (type === 'repair') ? '#34d399' : '#3d4756';
    ctx.fillStyle = accentCol;
    ctx.fillRect(-16, 0, 32, 2);

    // 侧面装饰与警示标识
    if(type === 'cannon'){
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-12, 3, 4, 4); ctx.fillRect(-4, 3, 4, 4); ctx.fillRect(4, 3, 4, 4);
    } else if(type === 'freeze'){
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-10, 4, 20, 2);
    } else if(type === 'tesla'){
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-10, 4, 20, 2);
    } else if(type === 'repair'){
      ctx.fillStyle = '#34d399';
      ctx.fillRect(-4, 3, 8, 2); ctx.fillRect(-1, 0, 2, 8); // 绿十字
    } else {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-12, 3, 4, 4); ctx.fillRect(-4, 3, 4, 4); ctx.fillRect(4, 3, 4, 4);
    }

    // 等级钢印
    if(lvl >= 2){
      ctx.fillStyle = accentCol;
      ctx.fillRect(-15, 8, 3, 2);
    }
    if(lvl >= 3){
      ctx.fillStyle = accentCol;
      ctx.fillRect(12, 8, 3, 2);
    }

    // ── 炮台伺服云台与专属 5 大类型塔身渲染 ──
    ctx.translate(0, -4);

    if(type === 'turret'){
      // 1. 机枪塔 (CIWS)：伺服圆盘 + 旋转机匣 + 双联精钢机枪管 + 弹鼓
      ctx.fillStyle = '#15191f';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(-1.5, -1, 3, 2);

      ctx.rotate(t.angle || 0);
      ctx.translate(-recoil, 0);

      // 炮塔机匣箱体
      const bodyGrad2 = ctx.createLinearGradient(0, -5, 12, 5);
      bodyGrad2.addColorStop(0, '#28313d'); bodyGrad2.addColorStop(1, '#181e26');
      ctx.fillStyle = bodyGrad2; ctx.fillRect(-6, -5, 12, 10);
      // 侧装轻机枪供弹盒
      ctx.fillStyle = '#334155'; ctx.fillRect(-4, -8, 8, 3);
      // 双联机枪管
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, -3.5, 14, 2.5);
      ctx.fillRect(6, 1.0, 14, 2.5);
      // 枪口消焰器
      ctx.fillStyle = '#475569';
      ctx.fillRect(18, -4.5, 2.5, 4.5);
      ctx.fillRect(18, 0.0, 2.5, 4.5);

      if(t.cooldown > (TOWER_TYPES.turret.stats[lvl-1].cooldown - 3)){
        ctx.fillStyle = '#ffedd5'; ctx.beginPath(); ctx.arc(22, -2.5, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(23, -2.5, 4.0, 0, Math.PI*2); ctx.fill();
      }
    } else if(type === 'freeze'){
      // 2. 冰霜塔：低温冷凝核心 + 悬浮六角冰晶发射器 + 寒气雾霭
      ctx.fillStyle = '#0e2238';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 4.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(-2, -1, 4, 2);

      ctx.rotate(t.angle || 0);
      ctx.translate(-recoil, 0);

      // 冷凝管柱架
      ctx.fillStyle = '#1e3a5f'; ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; ctx.strokeRect(-6, -6, 12, 12);
      // 液氮导管
      ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-4, -9); ctx.lineTo(4, -9); ctx.lineTo(4, -6); ctx.stroke();
      // 悬浮晶核 (旋转六角形)
      ctx.save();
      ctx.translate(6, 0);
      const spin = frameT * 0.08;
      ctx.rotate(spin);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 8;
      ctx.beginPath();
      for(let k=0; k<6; k++){
        const a = k * Math.PI / 3;
        const rx = Math.cos(a) * (6 + lvl);
        const ry = Math.sin(a) * (6 + lvl);
        if(k === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // 寒气微粒喷射
      if(t.cooldown > (TOWER_TYPES.freeze.stats[lvl-1].cooldown - 5)){
        ctx.fillStyle = 'rgba(125, 211, 252, 0.7)';
        ctx.beginPath(); ctx.arc(16, 0, 6 + lvl, 0, Math.PI*2); ctx.fill();
      }
    } else if(type === 'cannon'){
      // 3. 炮击塔：重型榴弹迫击炮身 + 防盾钢板 + 液压后坐制退筒
      ctx.fillStyle = '#1f1915';
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI*2); ctx.fill();

      ctx.rotate(t.angle || 0);
      ctx.translate(-recoil * 1.5, 0);

      // 弧形防盾钢板
      ctx.fillStyle = '#3d2e24';
      ctx.beginPath(); ctx.arc(-2, 0, 8, -Math.PI*0.4, Math.PI*0.4); ctx.lineWidth = 3; ctx.strokeStyle = '#f97316'; ctx.stroke();
      // 重装机匣
      ctx.fillStyle = '#261e18'; ctx.fillRect(-7, -6, 12, 12);
      // 粗壮重炮管（口径宽阔）
      ctx.fillStyle = '#0f0c09'; ctx.fillRect(4, -4.5, 17, 9);
      ctx.fillStyle = '#3d2e24'; ctx.fillRect(4, -5.5, 17, 1); ctx.fillRect(4, 4.5, 17, 1);
      // 炮口制退器与加强箍
      ctx.fillStyle = '#f97316'; ctx.fillRect(17, -5.5, 4, 11);
      ctx.fillStyle = '#000'; ctx.fillRect(20, -3.5, 2, 7);

      if(t.cooldown > (TOWER_TYPES.cannon.stats[lvl-1].cooldown - 5)){
        ctx.fillStyle = '#ffeedd'; ctx.beginPath(); ctx.arc(24, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(26, 0, 8, 0, Math.PI*2); ctx.fill();
      }
    } else if(type === 'tesla'){
      // 4. 电弧塔：高压绝缘方塔 + 3重叠层铜质感应线圈 + 顶端放电等离子球
      ctx.fillStyle = '#1a1608';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 4.5, 0, 0, Math.PI*2); ctx.fill();

      // 绝缘尖塔柱
      ctx.fillStyle = '#2d2715'; ctx.fillRect(-4, -16, 8, 16);
      // 3层感应铜线圈
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-7, -5, 14, 2.5);
      ctx.fillRect(-6, -10, 12, 2.5);
      ctx.fillRect(-5, -15, 10, 2.5);
      // 顶端磁暴放电等离子核心
      const glowPulse = 0.7 + 0.3 * Math.sin(frameT * 0.2);
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#eab308'; ctx.shadowBlur = 10 * glowPulse;
      ctx.beginPath(); ctx.arc(0, -18, 4.5 + lvl * 0.5, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      // 闪烁微电弧
      if(Math.random() < 0.4){
        ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo((Math.random()-0.5)*16, -18 + (Math.random()-0.5)*12);
        ctx.stroke();
      }
    } else if(type === 'repair'){
      // 5. 维修塔：纳米工程白绿机身 + 旋转雷达天线 + 纳米光环
      ctx.fillStyle = '#0f2418';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 4.5, 0, 0, Math.PI*2); ctx.fill();

      // 医疗防护机身
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(-6, -12, 12, 12);
      ctx.fillStyle = '#059669';
      // 绿十字徽标
      ctx.fillRect(-4, -8, 8, 3); ctx.fillRect(-1.5, -10.5, 3, 8);
      // 旋转雷达天线
      const radarA = frameT * 0.05;
      ctx.save();
      ctx.translate(0, -14);
      ctx.rotate(radarA);
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 5, -Math.PI*0.4, Math.PI*0.4); ctx.stroke();
      ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // 纳米波纹扩散圈
      const waveR = (frameT * 0.4) % 18;
      const waveA = 1 - (waveR / 18);
      ctx.strokeStyle = `rgba(52, 211, 153, ${waveA * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, waveR, waveR * 0.4, 0, 0, Math.PI*2); ctx.stroke();
    }

    ctx.restore();

    // 玩家靠近已有塔时的维护提示（使用世界坐标 sx2 = t.x，杜绝双重减去 cameraX）
    if(Math.abs(player.x - t.x) < 35 && player.y <= PLATFORM_TOP + 10){
      ctx.save();
      const sx2 = t.x;
      const maxed = lvl >= tt.maxLevel;
      const upgCost = Math.round(tt.cost * (lvl + 1) * (typeof defenseCostMul==='function'?defenseCostMul():1));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = accentCol || '#475569';
      ctx.lineWidth = 1;
      ctx.fillRect(sx2 - 58, t.y - 34, 116, 18);
      ctx.strokeRect(sx2 - 58, t.y - 34, 116, 18);
      ctx.fillStyle = maxed ? '#94a3b8' : '#f8fafc';
      ctx.font = '9.5px "Microsoft YaHei UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(maxed ? `${tt.icon}${tt.name} Lv.${lvl}(已满级)` : `[E] 升级${tt.name} Lv.${lvl}→${lvl+1} (💰${upgCost})`, sx2, t.y - 21);
      ctx.restore();
    }
  });
}

const BUILDINGS = [
  // ── 家园城堡内：仅保留安全小屋（带室内餐厅与卧室）──
  {
    id: 'cabin',
    name: '我的安全小屋',
    x: 120,
    w: 90,
    icon: '🪵',
    desc: '你的个人避难所。可以在里面升级防御塔、防线，或在舒适的大床上睡一觉。',
    color: '#8c5a3c',
    world: 'home'
  }
];

// ── 旧城区远征探险副本定义（Dave the Diver 出海探险制）──
const EXPEDITION_DESTINATIONS = {
  clinic: {
    id: 'clinic',
    name: '废弃红十字诊所',
    subtitle: 'Abandoned Red Cross Clinic',
    icon: '🏥',
    dangerLevel: '变异感染区 (中等)',
    dangerBadge: '⚠️ 变异感染区',
    color: '#c0392b',
    desc: '旧城区的红十字医疗庇护所。变异感染蔓延时被紧急封锁。搜刮可获军用急救包、救治伤员提升最大生命值，并通过试验台注入肉鸽天赋！',
    loots: [
      { id: 'medkit_spec', name: '军用战地急救包', count: '×3', icon: '💉' },
      { id: 'hp_boost', name: '最大生命值/外科护甲', count: '+20HP', icon: '❤️' },
      { id: 'talent', name: '临床试验天赋注入', count: '随机1项', icon: '🧬' }
    ]
  },
  tavern: {
    id: 'tavern',
    name: '幸存者营地',
    subtitle: 'Survivor Camp',
    icon: '🏕️',
    dangerLevel: '流民聚集点 (低~中)',
    dangerBadge: '⛺ 荒野流民营',
    color: '#d35400',
    desc: '旧城区荒野边缘的幸存流民据点。可在此招募身怀绝技的佣兵随从（阿强、小丽、大壮）协同作战，更可搜刮交换珍稀霜降厚肉、异变肉料与名厨秘制调料！',
    loots: [
      { id: 'companion', name: '特勤随从招募(阿强/小丽/大壮)', count: '3选2', icon: '🧔' },
      { id: 'meat_tank', name: '霜降厚肉', count: '×2', icon: '🥓' },
      { id: 'meat_elite', name: '异化基因肉', count: '×1', icon: '💜' },
      { id: 'spice_wasteland', name: '废土秘制香料', count: '×3', icon: '🌶️' }
    ]
  },
  armory: {
    id: 'armory',
    name: '军火废弃工坊',
    subtitle: 'Abandoned Armory Workshop',
    icon: '🛠️',
    dangerLevel: '重装盘踞区 (高危)',
    dangerBadge: '💀 重装盘踞区',
    color: '#475569',
    desc: '国民防卫队的军械前哨维修所。盘踞着重装装甲丧尸。搜刮可获得便携压缩弹药盒、枪械改装以及大量战备合金与建筑原木！',
    loots: [
      { id: 'ammo_crate_item', name: '便携压缩弹药盒', count: '×2', icon: '📦' },
      { id: 'scrap', name: '特种合金废铁', count: '×6', icon: '⚙️' },
      { id: 'wood', name: '建筑原木', count: '×6', icon: '🪵' },
      { id: 'weapon_mod', name: '全武器伤害改装/扩容', count: '+15%', icon: '🔧' }
    ]
  }
};
let buildingReturnState = null; // 'hub' 时退出建筑回到据点，否则回到 world

function getNearbyBuilding() {
  if (vehicle.entered) return null;
  const px = player.x + CHAR_W/2;
  for (const b of BUILDINGS) {
    if (b.id === 'cabin') {
      if (px >= 0 && px <= 255) return b;
    } else {
      const bc = b.x + b.w/2;
      if (Math.abs(px - bc) < 55) return b;
    }
  }
  return null;
}

// [player, keys, cabinHoldTimer, cabinHoldActive, CABIN_HOLD_MAX 已统一定义于 Section 01 顶层]

// 判定玩家是否靠近安全小屋大门交互范围（小屋x:120~210，大门中心165；左至地图边缘0，右至255全域判定）
function isPlayerNearCabin(){
  if(gameState !== 'world') return false;
  const px = player.x + CHAR_W / 2;
  return px >= 0 && px <= 255;
}

// 统一尸潮威胁状态判定（压迫感尸潮或夜晚缓冲尸潮）
function isHordeThreatActive(){
  return !!(overwhelmingHordeActive || wavePhase === 'horde' || window.__waveSpecial === 'overwhelming_horde' || wavePhase === 'buffer' || (wavePhase === 'spawning' && window.__waveSpecial === 'buffer'));
}

// 避难闭锁充能音效（频率随进度爬升，倒计时节奏反馈）
function playHoldTickSound(prog){
  try {
    const a = getACtx();
    if(!a) return;
    const now = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sawtooth';
    const freq = 240 + (prog || 0) * 440;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq + 60, now + 0.08);
    const vol = (0.12 + (prog || 0) * 0.12) * (typeof SFX_VOL !== 'undefined' ? SFX_VOL : 0.8);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o.connect(g); g.connect(a.destination);
    o.start(now); o.stop(now + 0.09);
  }catch(e){}
}

// 避难长按粒子涌动视觉反馈
function spawnCabinHoldParticles(){
  if(typeof mkP !== 'function') return;
  const px = player.x + CHAR_W/2, py = player.y + CHAR_H/2;
  mkP({
    x: px + (Math.random() - 0.5) * 36,
    y: py + (Math.random() - 0.5) * 36,
    vx: (Math.random() - 0.5) * 2,
    vy: -1.5 - Math.random() * 2,
    r: 2 + Math.random() * 2,
    rDecay: 0.05,
    decay: 0.04,
    color: Math.random() < 0.6 ? '#00f0ff' : '#ffe066',
    type: 'spark',
    grav: -0.05,
    alpha: 0.95
  });
  mkP({
    x: 165 + (Math.random() - 0.5) * 30,
    y: (typeof PLATFORM_TOP !== 'undefined' ? PLATFORM_TOP : 435) - 20 + (Math.random() - 0.5) * 25,
    vx: (Math.random() - 0.5) * 1.5,
    vy: -1 - Math.random() * 2,
    r: 2.5,
    rDecay: 0.06,
    decay: 0.035,
    color: '#00f0ff',
    type: 'ring',
    grav: 0,
    alpha: 0.85
  });
}

// 开始长按闭锁
function startCabinHold(){
  if(gameState !== 'world' || (!isHordeThreatActive() && wavePhase !== 'cleared')) return;
  if(!isPlayerNearCabin()){
    addBanner('🏃 距离小屋太远！快向左撤回据点小屋门前！');
    return;
  }
  if(!cabinHoldActive){
    cabinHoldTimer = 0;
    cabinHoldActive = true;
    playHoldTickSound(0);
  }
}

// 取消/松开长按
function cancelCabinHold(){
  if(!cabinHoldActive && cabinHoldTimer === 0) return;
  const wasActive = cabinHoldActive;
  const oldTimer = cabinHoldTimer;
  cabinHoldActive = false;
  cabinHoldTimer = 0;
  if(wasActive && oldTimer > 15 && oldTimer < CABIN_HOLD_MAX){
    addBanner('❌ 破障闭锁中断！请持续按住大门闭锁');
  }
}

// 点击顶部撤退HUD反馈
function handleEmergencyRetreatClick(){
  if((!isHordeThreatActive() && wavePhase !== 'cleared') || gameState !== 'world') return;
  if(!isPlayerNearCabin()){
    addBanner('🏃 距离避难小屋太远！快向左撤回据点小屋门前！');
  } else {
    if(wavePhase === 'cleared'){
      addBanner('🚪 按 [E] 键即可进入避难所据点小屋！');
    } else {
      addBanner('🚪 请按住 [E] 键持续闭锁入屋！');
    }
  }
}

// Vehicle
const vehicle={exists:false,entered:false,x:650,y:GROUND_Y-44,vx:0,facingR:false,hp:150,maxHp:150,turretAngle:0,gunTimer:0};

// Sprite companion
const sprite={exists:false,x:0,y:0,tx:0,ty:0,attackTimer:180,healTimer:480,level:1,shieldTimer:0,shieldReady:true};

// Boss
// [boss 已在 Section 01 顶层声明]
// [wavePhase, shopOpen, bossActive 等波次状态已统一定义于 Section 01 顶层]
let envNarratedIdx=0;          // 环境旁白已触发索引（按x升序）

// DOM refs
const gameWrap=document.getElementById('game-wrap');
const scEl=document.getElementById('sc');
const hpvEl=document.getElementById('hpv');
const bestEl=document.getElementById('bst');
const killsEl=document.getElementById('kls');
const waveTxt=document.getElementById('wave-txt');
const rldBtn=document.getElementById('rld-btn');
const rldW=document.getElementById('rldw');
const rldF=document.getElementById('rldf');
const coinDisp=document.getElementById('coin-display');
const vehiclePrompt=document.getElementById('vehicle-prompt');
const bossHpBar=document.getElementById('boss-hpbar');
const bossHpFill=document.getElementById('boss-hpfill');
const comboHud=document.getElementById('combo-hud');
const comboVignette=document.getElementById('combo-vignette');
const wpFill=document.getElementById('wp-fill');

const cw=()=>WEAPONS[curWpnIdx];
const getMinigun=()=>WEAPONS.find(w=>w.id==='minigun');
const minigunIdx=()=>{const i=WEAPONS.findIndex(w=>w.id==='minigun');return i>=0?i:-1;};
const wpnIdxById=(id)=>{const i=WEAPONS.findIndex(w=>w.id===id);return i;};
const hasWeaponId=(id)=>{const i=wpnIdxById(id);return i>=0&&ownedWeaponsSet.has(i);};

// ── 扭蛋机系统（据点大厅，200金币随机盲盒）──
const GACHA_POOL = [
  {type:'coins', amount:20,  weight:22, icon:'💰', name:'20金币', color:'#ffcc44'},
  {type:'coins', amount:40, weight:16, icon:'💰', name:'40金币', color:'#ffcc44'},
  {type:'coins', amount:80, weight:8,  icon:'💰', name:'80金币（回本）', color:'#ffcc44'},
  {type:'health', amount:30, weight:12, icon:'💉', name:'医疗包+30HP', color:'#88ff88'},
  {type:'health', amount:60, weight:6,  icon:'💖', name:'大医疗包+60HP', color:'#88ff88'},
  {type:'ammo',  weight:10, icon:'📦', name:'全武器弹药补满', color:'#ffaa44'},
  {type:'wood',  amount:5,  weight:8, icon:'🪵', name:'5木材', color:'#d2b48c'},
  {type:'scrap', amount:5,  weight:8, icon:'⚙️', name:'5废铁', color:'#b0c4de'},
  {type:'weapon_random', weight:12, icon:'🎁', name:'随机武器掉落！', color:'#5be4ff'},
  {type:'upgrade', upg:'damage', weight:4, icon:'💢', name:'火力强化+1', color:'#ff6644'},
  {type:'upgrade', upg:'armor',  weight:4, icon:'🛡', name:'护甲强化+1', color:'#5be4ff'},
  {type:'meat_elite', amount:3, weight:3, icon:'💜', name:'3异变肉', color:'#aa44cc'},
  {type:'jackpot', amount:150, weight:1, icon:'🏆', name:'头奖！150金币！', color:'#ff4444'},
  // 危险奖品：僵尸和炸弹（参考 Dave 的意外事件）
  {type:'zombie ambush', weight:4, icon:'🧟', name:'僵尸突袭！', color:'#88aa44'},
  {type:'bomb', weight:3, icon:'💣', name:'炸弹！被炸伤', color:'#ff4444'},
];

function playGachaMachine(){
  if(coins < 200){
    addBanner('❌ 金币不足！扭蛋机需要200金币');
    return;
  }
  coins -= 200;
  updateCoinUI();
  const totalWeight = GACHA_POOL.reduce((s,g) => s + g.weight, 0);
  let r = Math.random() * totalWeight;
  let prize = GACHA_POOL[0];
  for(const g of GACHA_POOL){
    r -= g.weight;
    if(r <= 0){ prize = g; break; }
  }
  let resultText = '';
  switch(prize.type){
    case 'coins': coins += prize.amount; updateCoinUI(); resultText = `+${prize.amount}金币`; break;
    case 'health': health = Math.min(maxHp, health + prize.amount); updateHpUI(); resultText = `+${prize.amount}HP`; break;
    case 'ammo': wAmmo = WEAPONS.map(w => Math.floor(w.maxAmmo * (1 + upgrades.ammo * 0.5))); updateAmmoUI(); refreshWBar(); resultText = '全武器弹药补满'; break;
    case 'wood': woodPlanks += prize.amount; resultText = `+${prize.amount}木材`; break;
    case 'scrap': scrapMetal += prize.amount; resultText = `+${prize.amount}废铁`; break;
    case 'weapon_random':{
      // 随机掉落武器：优先掉未拥有的，如果全拥有则随机掉一把已拥有的（替换）
      var allWeapons = WEAPONS.map((w,i)=>({w,i}));
      var unowned = allWeapons.filter(({w,i}) => !ownedWeaponsSet.has(i) && !w.superWeapon);
      var pick;
      if(unowned.length > 0){
        // 优先稀有/史诗
        var rareUnowned = unowned.filter(({w}) => w.rarity==='rare' || w.rarity==='epic');
        pick = rareUnowned.length > 0 ? rareUnowned[Math.floor(Math.random()*rareUnowned.length)] : unowned[Math.floor(Math.random()*unowned.length)];
      } else {
        // 全拥有了，随机掉一把已拥有的（相当于重抽，给弹药）
        var owned = allWeapons.filter(({w,i}) => ownedWeaponsSet.has(i));
        pick = owned[Math.floor(Math.random()*owned.length)];
      }
      // 直接给武器：如果武器栏没满，直接添加；如果满了，替换当前武器
      if(ownedWeapons.length < MAX_OWNED_WEAPONS && !ownedWeaponsSet.has(pick.i)){
        ownedWeapons.push(pick.i); refreshOwnedSet();
        wAmmo[pick.i] = Math.floor(pick.w.maxAmmo * (1 + upgrades.ammo * 0.5));
        curWpnIdx = pick.i; buildWeaponBar(); refreshWBar(); updateAmmoUI();
        resultText = `${pick.w.icon} ${pick.w.name}！新武器！`;
      } else if(ownedWeaponsSet.has(pick.i)){
        // 已拥有这把，补满弹药 + 退还50金币
        wAmmo[pick.i] = Math.floor(pick.w.maxAmmo * (1 + upgrades.ammo * 0.5));
        coins += 50; updateCoinUI(); refreshWBar(); updateAmmoUI();
        resultText = `${pick.w.icon} ${pick.w.name} 弹药补满！+50金币`;
      } else {
        // 武器栏满了，掉落为新武器：把当前武器丢地上，换新的
        var curSlot = ownedWeapons.indexOf(curWpnIdx);
        if(curSlot < 0) curSlot = 0;
        var oldIdx = ownedWeapons[curSlot];
        // 旧武器掉到地上（可捡回）
        if(oldIdx !== undefined){
          var crate = createLootItem(player ? player.x : 400, GROUND_Y - 30, 'weapon_crate', oldIdx);
          if(crate){ lootDrops.push(crate); }
        }
        ownedWeapons[curSlot] = pick.i; refreshOwnedSet();
        curWpnIdx = pick.i;
        wAmmo[pick.i] = Math.floor(pick.w.maxAmmo * (1 + upgrades.ammo * 0.5));
        buildWeaponBar(); refreshWBar(); updateAmmoUI();
        resultText = `${pick.w.icon} ${pick.w.name}！旧武器已丢地上`;
      }
      break;
    }
    case 'upgrade':
      if(upgrades[prize.upg] < 3){ upgrades[prize.upg]++; resultText = `${prize.name}！`; }
      else { coins += 100; updateCoinUI(); resultText = '强化已满，转100金币'; }
      break;
    case 'meat_elite': meatInventory.elite += prize.amount; resultText = `+${prize.amount}异变肉`; break;
    case 'jackpot': coins += prize.amount; updateCoinUI(); resultText = `🏆 头奖！+${prize.amount}金币！`; break;
    case 'zombie ambush':{
      // 僵尸突袭：在据点刷出几只僵尸
      resultText = '🧟 扭蛋里钻出僵尸！';
      var ambushCount = 3 + Math.floor(Math.random()*3); // 3-5只
      for(var i=0; i<ambushCount; i++){
        var zx = (player ? player.x : 400) + (Math.random()<0.5 ? -150-i*40 : 150+i*40);
        if(typeof spawnZombie === 'function') spawnZombie(zx);
      }
      addBanner('🧟 警告！扭蛋机里钻出 ' + ambushCount + ' 只僵尸！');
      break;
    }
    case 'bomb':{
      // 炸弹：玩家受伤 + 屏幕震动
      var bombDmg = 15 + Math.floor(Math.random()*10);
      health = Math.max(1, health - bombDmg);
      updateHpUI();
      addShake(20);
      redFlash = 1.0;
      resultText = `💣 炸弹爆炸！-${bombDmg}HP`;
      // 爆炸特效
      if(typeof vfxExplosion === 'function' && player){
        vfxExplosion(player.x, player.y - 20, 40);
      }
      break;
    }
  }
  // 显示扭蛋结果弹窗
  showGachaResult(prize, resultText);
  sndCoin();
  addBanner(`🎰 扭蛋机：${prize.icon} ${resultText}`);
}

function showGachaResult(prize, resultText){
  const ov = document.createElement('div');
  ov.id = 'gacha-result-overlay';
  ov.style.cssText = 'position:absolute;inset:0;z-index:200;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;pointer-events:none;';
  ov.innerHTML = `
    <div style="text-align:center;transform:scale(0);animation:enhanceBurst .8s cubic-bezier(.34,1.56,.64,1) forwards;">
      <div style="font-size:4rem;margin-bottom:10px;filter:drop-shadow(0 0 20px ${prize.color});">${prize.icon}</div>
      <div style="font-family:var(--font-display);font-weight:800;font-size:1.8rem;color:${prize.color};text-shadow:0 0 30px ${prize.color},0 4px 8px #000;letter-spacing:2px;">${resultText}</div>
      <div style="color:#b0a284;font-size:.8rem;margin-top:8px;">扭蛋机抽奖结果</div>
    </div>
  `;
  const wrap = document.getElementById('game-wrap') || document.body;
  wrap.appendChild(ov);
  for(let i=0;i<30;i++){
    const a = (i/30)*Math.PI*2;
    mkP({x:420,y:200,vx:Math.cos(a)*(3+Math.random()*4),vy:Math.sin(a)*(3+Math.random()*4),r:3+Math.random()*2,rDecay:.05,decay:.04,color:prize.color,type:'circle',alpha:.8,blur:true});
  }
  setTimeout(() => { ov.remove(); }, 1500);
}

// ── Shared: find nearest enemy from a world position ──
function findNearestEnemy(fx,fy,maxDist){
  let nearest=null,nd=maxDist||9999;
  const targetZombies = (gameState === 'building') ? buildingInteriorZombies : zombies;
  targetZombies.forEach(z=>{
    if(!z.alive)return;
    const d=Math.sqrt((z.x+22-fx)**2+((Z_TOP+28)-fy)**2);
    if(d<nd){nd=d;nearest={x:z.x+22,y:Z_TOP+28,alive:true};}
  });
  if(gameState !== 'building' && boss&&boss.alive){
    const d=Math.sqrt((boss.x+40-fx)**2+((GROUND_Y-80)-fy)**2);
    if(d<nd){nd=d;nearest={x:boss.x+40,y:GROUND_Y-80,alive:true,isBoss:true};}
  }
  return nearest;
}

// ═══════════════════════════════════════════

//  ROGUE-LIKE PERK SYSTEM（肉鸽天赋，升级三选一）
