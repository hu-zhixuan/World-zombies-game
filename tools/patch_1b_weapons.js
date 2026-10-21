// 阶段 1b-①：移除武器 Lv3 特性 / 旧进化的所有死分支（wlvl() 恒为 1，'>=3' 永远为假）
// 每条补丁都断言“恰好命中 1 次”，命中数不对立即报错，避免静默漏改。
const fs = require('fs');
const path = require('path');
const J = f => path.join(__dirname, '..', 'src', 'js', f);
const cache = {};
function rep(file, oldS, newS) {
  const p = J(file);
  cache[p] = cache[p] ?? fs.readFileSync(p, 'utf8');
  const n = cache[p].split(oldS).length - 1;
  if (n !== 1) throw new Error(`[${file}] 期望命中 1 次，实际 ${n} 次:\n${oldS.slice(0, 120)}`);
  cache[p] = cache[p].split(oldS).join(newS);
}

// ── 02g_gameloop.js ──
rep('02g_gameloop.js',
`    // v53 Lv3「急速冷却」：散热+50%（原版 coolplus 是死文案）
    const coolMul=(wlvl('minigun')>=3)?1.5:1;
    const decayRate = (upgrades.armoryCooling ? 2.25 : 1.5) * coolMul;`,
`    const decayRate = (upgrades.armoryCooling ? 2.25 : 1.5);`);
rep('02g_gameloop.js',
`            // 双联弹：第二枚黏附最近的另一敌人（无邻敌则同目标再挂一枚半伤弹）
            if(wlvl('stickybomb')>=3){
              let near2=null,nd2=999;
              zombies.forEach(z2=>{if(z2.alive&&z2!==z&&!z2._sticky){const d=Math.abs((z2.x+22)-zx);if(d<nd2){nd2=d;near2=z2;}}});
              const tgt=near2||z;
              tgt._sticky={t:120,dmg:b.dmg*(near2?1:0.5),aoe:90,x:tgt.x+22,y:Z_TOP+28};
              tgt.spdMul=Math.min(tgt.spdMul||1,0.7);
              mkP({x:tgt.x+22,y:Z_TOP+28,r:5,rDecay:.3,decay:.08,color:'rgba(255,200,80,.9)',type:'circle',alpha:.9,grav:0,blur:true});
              spawnFloatText('双联黏弹!', tgt.x+22, Z_TOP-24, '#ffcc66');
            }
            break;`,
`            break;`);
rep('02g_gameloop.js', `const shAoe=(wlvl('ice')>=3?75:50);`, `const shAoe=50;`);
rep('02g_gameloop.js',
`            const canDual=(wlvl('poison')>=3);
            const stacks=(z.poisonStacks||0);
            if((!z.poisoned) || (canDual && stacks<2)){`,
`            const stacks=(z.poisonStacks||0);
            if(!z.poisoned){`);
rep('02g_gameloop.js', `spawnFloatText(canDual&&stacks>=1?'双重感染!':'中毒!', zx, Z_TOP-20, '#66cc33');`, `spawnFloatText('中毒!', zx, Z_TOP-20, '#66cc33');`);
rep('02g_gameloop.js', `const gLife=(wlvl('napalm')>=3&&b.wpn==='napalm')?Math.round(480*1.8):480;`, `const gLife=480;`);
rep('02g_gameloop.js',
`            // ── v53火箭Lv3「子母弹」：爆点溅射4枚小火箭（各40%伤害小爆） ──
            // 原版 cluster 特性只写了 aoe×1.2 从未生成子弹——现在真的有子弹。
            if(b.wpn==='rocket' && wlvl('rocket')>=3 && !b._clustered){
              for(let k=0;k<4;k++){
                const sa=Math.PI*2*k/4+Math.random()*.5;
                const b2=mkBullet(b.x,b.y,Math.cos(sa)*6,Math.sin(sa)*6-3,WEAPONS.find(w2=>w2.id==='rocket')||w);
                b2.dmg*=0.4;b2.aoe=55;b2.grav=true;b2._clustered=true;  // 小火箭不再二次溅射
                b2.piercing=false;
              }
              spawnFloatText('子母弹!',b.x,Z_TOP-30,'#ffaa33');
            }
`, ``);

// ── 03a / 03f ──
rep('03a_player_rendering.js', `chainTargets.slice(0, (wlvl('tesla')>=3?6:4))`, `chainTargets.slice(0, 4)`);
rep('03f_companions.js',
`  // ── v53湮灭者Lv3「末日终结」：对Boss伤害+30%（原版 doom 特性死文案）──
  if(WEAPONS[curWpnIdx] && WEAPONS[curWpnIdx].id==='annihilator' && wlvl('annihilator')>=3) dmg*=1.3;
`, ``);

// ── 03g 近战 ──
rep('03g_dodge_melee.js',
`    // v53 Lv3「血刃风暴」：狂战士双刃门槛7→5连斩·吸血5%（原版固定7刀/吸血3%）
    const spinAt = (playerClass&&playerClass.id==='berserker'&&wlvl('bloodblades')>=3)?5:7;`,
`    const spinAt = 7;`);
rep('03g_dodge_melee.js',
`meleeSpinCd = (playerClass&&playerClass.id==='berserker'&&wlvl('bloodblades')>=3)?240:300;  // 血刃风暴冷却也略降`,
`meleeSpinCd = 300;`);

// ── 03h 开火 / 子弹 ──
rep('03h_zombies_and_firing.js',
`        // v53 Lv3「连锁充能」：爆射后保留1格充能（原版清零重攒）
        window._railCharge = wlvl('railcharger')>=3 ? 1 : 0;`,
`        window._railCharge = 0;`);
rep('03h_zombies_and_firing.js',
`      // v53 Lv3「长号令」：狂暴时长+3秒(5→8s)·冷却-1.5s（reloadMs 是使用间隔，改武器对象即时生效）
      const hornLv3 = wlvl('warhorn')>=3;
      if(hornLv3 && !w._hornTuned){ w._hornTuned=true; w.reloadMs=Math.max(1500,w.reloadMs-1500); }
`, ``);
rep('03h_zombies_and_firing.js',
`      // v53 Lv3「大地震颤」：护盾3→6秒·范围+30%（130→169）
      const qkRange = wlvl('quakehammer')>=3 ? 169 : 130;
      player.playerShield = wlvl('quakehammer')>=3 ? 360 : 180;`,
`      const qkRange = 130;
      player.playerShield = 180;`);
rep('03h_zombies_and_firing.js', `spawnFloatText(wlvl('quakehammer')>=3?'🛡 护盾6秒·大地震颤':'🛡 护盾3秒',`, `spawnFloatText('🛡 护盾3秒',`);
rep('03h_zombies_and_firing.js',
`      // 吸血3%（v53 Lv3「血刃风暴」：吸血5%）
      const lsRate = wlvl('bloodblades')>=3 ? 0.05 : 0.03;`,
`      // 吸血3%
      const lsRate = 0.03;`);
rep('03h_zombies_and_firing.js', `const railDmg = getDamage(w.damage) * weaponDamageMult(curWpnIdx);`, `const railDmg = getDamage(w.damage);`);
rep('03h_zombies_and_firing.js', `(wlvl('railgun')>=3?120:60)`, `60`);
rep('03h_zombies_and_firing.js', `const chargeWin=wlvl('crossbow')>=3?120:200;`, `const chargeWin=200;`);
rep('03h_zombies_and_firing.js',
`    // ── v49批2：手枪Lv3特性「速射三连发」──
    if(w.id==='pistol' && wlvl('pistol')>=3){
      const ang=aimBase;
      [(-2.5)*Math.PI/180, 2.5*Math.PI/180].forEach(off=>{
        const b2=mkBullet(fx,fy,Math.cos(ang+off)*w.speed,Math.sin(ang+off)*w.speed,w);
        b2.dmg*=0.65;
      });
    }
`, ``);
rep('03h_zombies_and_firing.js', `getDamage((wDef?wDef.damage:10))*weaponDamageMult(curWpnIdx)*mul;`, `getDamage((wDef?wDef.damage:10))*mul;`);
rep('03h_zombies_and_firing.js',
`  // ── v49批2：武器等级伤害倍率 + 流派被动 + Lv3特性接入 ──
  const wIdx = WEAPONS.indexOf(w);
  const wlv = weaponDamageMult(wIdx);
  let b = _bulletFreeList.pop();`,
`  let b = _bulletFreeList.pop();`);
rep('03h_zombies_and_firing.js', `b.dmg = getDamage(w.damage)*wlv;`, `b.dmg = getDamage(w.damage);`);
rep('03h_zombies_and_firing.js', `  b.wlv = wlvl(w.id);\n`, ``);
{
  // Lv3 特性强化整段 + 手枪三连发空壳
  const p = J('03h_zombies_and_firing.js');
  let s = cache[p];
  const a = s.indexOf('  // Lv3 特性强化\n  if(weaponTraitActive(wIdx)){');
  const bMark = `  if(w.id==='pistol' && weaponTraitActive(wIdx) && (WEAPON_TRAITS.pistol.id==='burst')){\n    // 实现为轻量双伴随弹（fireWeapon 处做三连发更干净——这里标记，fireWeapon 读取）\n  }\n`;
  const e = s.indexOf(bMark);
  if (a < 0 || e < 0 || e < a) throw new Error('Lv3 trait block not found');
  const endIdx = e + bMark.length;
  // 保留“行囊被动”之前的注释行：从 '// 手枪三连发（Lv3）' 注释一并移除
  const cmt = '  // 手枪三连发（Lv3）：单发变三连（伤害各60%）\n';
  const cmtIdx = s.lastIndexOf(cmt, e);
  s = s.slice(0, a) + s.slice(endIdx);
  if (cmtIdx !== -1 && cmtIdx >= a) { /* 已在被删区间内 */ }
  cache[p] = s;
}

// ── 03i ──
rep('03i_reload_combat.js',
`  // v49批2：狙击Lv3「双重穿甲」——当前武器为狙击且Lv3+时无视目标50%护甲
  const curW = WEAPONS[curWpnIdx];
  if(curW && curW.id==='sniper' && wlvl('sniper')>=3) effArmor *= 0.5;
`, ``);
rep('03i_reload_combat.js',
`  // v53 Lv3「地狱椒」：50%→100%（每杀必掉异变肉）
  const chiliW = WEAPONS[curWpnIdx];
  if(chiliW && chiliW.id==='chiliflamer' && Math.random() < (wlvl('chiliflamer')>=3?1:0.5)){`,
`  const chiliW = WEAPONS[curWpnIdx];
  if(chiliW && chiliW.id==='chiliflamer' && Math.random() < 0.5){`);
rep('03i_reload_combat.js',
`    // Lv3特性「感应雷」：引爆范围+50%且敌人靠近(<aoe*0.6)提前引爆；基础版=1.5s定时
    const sense=wlvl('landmine')>=3;
    fuseList.push({x:b.x,y:GROUND_Y-4,t:90,total:90,dmg:b.dmg,aoe:sense?aoe*1.5:aoe,kind:'landmine',sense});`,
`    // 基础版=1.5s定时
    const sense=false;
    fuseList.push({x:b.x,y:GROUND_Y-4,t:90,total:90,dmg:b.dmg,aoe:aoe,kind:'landmine',sense});`);

// ── 03j 波清结算：移除进化弹窗与武器经验 ──
rep('03j_wave_system.js',
`  // ── 武器进化二选一 ──
  setTimeout(()=>{ if(gameRunning) tryShowWeaponEvolution(); }, 3800);

  // 武器波清经验结算
  if(typeof flushWeaponWaveXp === 'function') flushWeaponWaveXp();

`, ``);

// ── 01a / 04b / 06b：_evoActive / _evoQueue / WEAPON_MAX_LV 残留 ──
rep('01a_runtime_weapons.js', `    window._evoActive = false;\n`, ``);
rep('04b_workshop_expedition.js',
`  rec.lv = WEAPON_MAX_LV;
  rec.evoBranch = 'super_evolved';
  rec.evoQueued = true;
  if(typeof _evoQueue !== 'undefined' && Array.isArray(_evoQueue)){
    _evoQueue = _evoQueue.filter(id => id !== wid);
  }
`,
`  rec.evoBranch = 'super_evolved';
  rec.evoQueued = true;
`);
rep('06b_save_boot.js', `  if(typeof _evoQueue !== 'undefined') _evoQueue = [];\n  window._evoActive = false;\n`, ``);

for (const [p, s] of Object.entries(cache)) fs.writeFileSync(p, s);
console.log('patched files:', Object.keys(cache).map(p => path.basename(p)).join(', '));
