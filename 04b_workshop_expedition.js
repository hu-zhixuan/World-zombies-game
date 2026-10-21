// ══════════════════════════════════════════════════════════════════════════
//  【潜水员戴夫 & 吸血鬼幸存者深度融合系统】
//  1. 小胡军备改装台 (Duff's Weapon Workshop)
//  2. 战前战备特餐机制 (Tactical Cat Meal / Feast)
//  3. 超级武器觉醒进化 (Super Weapon Evolution)
//  4. 主菜单要塞夜景动态背景与存档看板
// ══════════════════════════════════════════════════════════════════════════

// ── 1. 小胡军备改装系统 (Duff's Workshop) ──
let duffWeaponMods = {}; // { [weaponId]: { damage:0..5, mag:0..5, reload:0..5, tactical:0..5 } }
let wsActiveSlot = 0; // 0: 主武器, 1: 副武器

// 4 大精炼实用配件成本（扩容弹夹 / 红点瞄准镜 / 消音制退器 / 元素符石）
const DUFF_MOD_COSTS = [
  { coins: 40, scrap: 2 },
  { coins: 85, scrap: 5 },
  { coins: 160, scrap: 10 },
];

function getWeaponMod(wid, type){
  if(!duffWeaponMods[wid]) duffWeaponMods[wid] = { mag:0, sight:0, muzzle:0, rune:0, damage:0, reload:0, tactical:0 };
  if(type === 'damage') return duffWeaponMods[wid].sight || duffWeaponMods[wid].damage || 0;
  if(type === 'reload') return duffWeaponMods[wid].muzzle || duffWeaponMods[wid].reload || 0;
  if(type === 'tactical') return duffWeaponMods[wid].rune || duffWeaponMods[wid].tactical || 0;
  return duffWeaponMods[wid][type] || 0;
}

function setWeaponMod(wid, type, val){
  if(!duffWeaponMods[wid]) duffWeaponMods[wid] = { mag:0, sight:0, muzzle:0, rune:0, damage:0, reload:0, tactical:0 };
  const v = Math.min(3, Math.max(0, val));
  duffWeaponMods[wid][type] = v;
  if(type === 'sight') duffWeaponMods[wid].damage = v;
  if(type === 'muzzle') duffWeaponMods[wid].reload = v;
  if(type === 'rune') duffWeaponMods[wid].tactical = v;
  if(type === 'damage') duffWeaponMods[wid].sight = v;
  if(type === 'reload') duffWeaponMods[wid].muzzle = v;
  if(type === 'tactical') duffWeaponMods[wid].rune = v;
}

function isDuffWorkshopOpen(){
  const m = document.getElementById('duff-workshop-modal');
  return !!(m && (m.classList.contains('open') || m.style.display === 'flex'));
}

function openDuffWorkshop(){
  const m = document.getElementById('duff-workshop-modal');
  if(!m) return;
  if(typeof clearWaveDlg === 'function') clearWaveDlg();
  if(typeof closeDlg === 'function') closeDlg();
  m.classList.add('open');
  m.style.display = 'flex';
  renderDuffWorkshopUI();
  try{ sndShopOpen(); }catch(e){}
}

function closeDuffWorkshop(){
  const m = document.getElementById('duff-workshop-modal');
  if(!m) return;
  m.classList.remove('open');
  m.style.display = 'none';
  try{ sndShopClose(); }catch(e){}
}

function toggleDuffWorkshop(){
  if(isDuffWorkshopOpen()) closeDuffWorkshop();
  else openDuffWorkshop();
}

function switchWorkshopSlot(slot){
  wsActiveSlot = slot;
  renderDuffWorkshopUI();
  renderCabinWorkshopUI();
}

function upgradeWeaponMod(wid, type){
  const currentRank = getWeaponMod(wid, type);
  if(currentRank >= 3){
    addBanner('⚠ 该项配件已达最高等级(Lv.3)！');
    return;
  }
  const cost = DUFF_MOD_COSTS[currentRank];
  if(coins < cost.coins){
    addBanner(`💰 金币不足！需要 ${cost.coins} 金币 (夜间餐厅经营赚取)`);
    return;
  }
  if(scrapMetal < cost.scrap){
    addBanner(`⚙️ 机械零件不足！需要 ${cost.scrap} 零件 (白天击杀与远征搜刮)`);
    return;
  }
  coins -= cost.coins;
  scrapMetal -= cost.scrap;
  updateCoinUI();
  const hudScrap = document.getElementById('hud-scrap');
  if(hudScrap) hudScrap.textContent = '⚙️ ' + scrapMetal;

  setWeaponMod(wid, type, currentRank + 1);
  const w = WEAPONS.find(x => x.id === wid);

  if((type === 'mag' || type === 'reload' || type === 'muzzle') && w && WEAPONS[curWpnIdx] && WEAPONS[curWpnIdx].id === wid && isReloading){
    if(typeof cancelReload === 'function') cancelReload();
    wAmmo[curWpnIdx] = weaponMagSize(w);
  }

  const typeNames = { mag:'扩容弹夹', sight:'红点瞄准镜', muzzle:'消音制退器', rune:'元素符石', damage:'红点瞄准镜', reload:'消音制退器', tactical:'元素符石' };
  addBanner(`🛠️ 小胡战术工坊：${w ? w.name : ''}「${typeNames[type]||type}」装配至 Lv.${currentRank + 1}！`);
  spawnFloatText('🔧 配件装配完成!', player.x + CHAR_W/2, player.y - 25, '#5be4ff');
  sndLevelUp();
  for(let i=0; i<12; i++){
    const ang = Math.random() * Math.PI * 2;
    mkP({ x:player.x+CHAR_W/2, y:player.y+20, vx:Math.cos(ang)*3, vy:Math.sin(ang)*3-1.5, r:2+Math.random()*2, rDecay:.05, decay:.04, color:'#5be4ff', type:'spark', grav:.1, alpha:1 });
  }

  renderDuffWorkshopUI();
  renderCabinWorkshopUI();
  refreshWBar();
  updateAmmoUI();
}

function renderDuffWorkshopUI(){
  const coinEl = document.getElementById('ws-coins');
  const scrapEl = document.getElementById('ws-scrap');
  if(coinEl) coinEl.textContent = '💰 ' + coins;
  if(scrapEl) scrapEl.textContent = '⚙️ ' + scrapMetal;

  const slotsContainer = document.getElementById('ws-slots-container');
  const detailsContainer = document.getElementById('ws-details');
  if(!slotsContainer || !detailsContainer) return;

  const owned = (ownedWeapons && ownedWeapons.length > 0) ? ownedWeapons : [0];
  if(wsActiveSlot >= owned.length) wsActiveSlot = 0;

  // Render slot buttons
  slotsContainer.innerHTML = owned.map((wIdx, sIdx) => {
    const w = WEAPONS[wIdx];
    if(!w) return '';
    const isActive = (sIdx === wsActiveSlot);
    const rec = ensureWeaponLevel(w.id);
    const isEvo = !!rec.isSuperEvolved;
    const name = isEvo ? (rec.evoName || w.name) : w.name;
    const rarity = isEvo ? 'legendary' : w.rarity;
    const rarCol = isEvo ? '#ffd700' : (WEAPON_RARITY[rarity]?.color || '#888');
    return `
      <div class="ws-slot-card ${isActive ? 'active' : ''}" onclick="switchWorkshopSlot(${sIdx})">
        <span style="font-size:1.7rem;line-height:1;background:rgba(0,0,0,0.45);padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);">${w.icon}</span>
        <div style="flex:1;overflow:hidden;">
          <div style="font-family:var(--font-display);font-size:0.88rem;font-weight:800;color:#f5deb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            [${sIdx+1}] ${name}
          </div>
          <div style="font-size:0.62rem;color:${rarCol};font-weight:700;margin-top:2px;">
            ${isEvo ? '🌟 终极天灾超武' : (WEAPON_RARITY[w.rarity]?.badge || '战术装备') + ' · ' + (w.tag || '武器')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const currentWIdx = owned[wsActiveSlot] || 0;
  const curW = WEAPONS[currentWIdx];
  if(!curW){ detailsContainer.innerHTML = '请选择武器'; return; }

  const rec = ensureWeaponLevel(curW.id);
  const isEvo = !!rec.isSuperEvolved;
  const curName = isEvo ? (rec.evoName || curW.name) : curW.name;
  const curRarCol = isEvo ? '#ffd700' : (WEAPON_RARITY[curW.rarity]?.color || '#888');

  // 4 tracks data
  const tracks = [
    {
      key: 'mag', name: '扩容弹夹', icon: '📦',
      currentBonus: getWeaponMod(curW.id, 'mag') > 0 ? `+${getWeaponMod(curW.id, 'mag') * 35}% 弹量` : '未装配',
      nextBonus: getWeaponMod(curW.id, 'mag') < 3 ? `+${(getWeaponMod(curW.id, 'mag') + 1) * 35}% 弹量` : '已满级',
      desc: '大幅扩充枪械弹匣容量，提升持续泼水压制力',
    },
    {
      key: 'sight', name: '红点瞄准镜', icon: '🎯',
      currentBonus: getWeaponMod(curW.id, 'sight') > 0 ? `暴击+${getWeaponMod(curW.id, 'sight') * 12}% · 爆头判定宽容` : '未装配',
      nextBonus: getWeaponMod(curW.id, 'sight') < 3 ? `暴击+${(getWeaponMod(curW.id, 'sight') + 1) * 12}% · 爆头判定强化` : '已满级',
      desc: '战术全息红点光瞄，大幅强化暴击几率与爆头手感',
    },
    {
      key: 'muzzle', name: '消音制退器', icon: '🔇',
      currentBonus: getWeaponMod(curW.id, 'muzzle') === 1 ? '换弹-25% · 抖动减半' : getWeaponMod(curW.id, 'muzzle') === 2 ? '换弹-45% · 绝对平稳' : getWeaponMod(curW.id, 'muzzle') >= 3 ? '换弹-60% · 极速拔换' : '未装配',
      nextBonus: getWeaponMod(curW.id, 'muzzle') === 0 ? '换弹-25% · 抖动减半' : getWeaponMod(curW.id, 'muzzle') === 1 ? '换弹-45% · 绝对平稳' : getWeaponMod(curW.id, 'muzzle') === 2 ? '换弹-60% · 极速换弹' : '已满级',
      desc: '特种气流制退器，削减装填动作与后坐枪口抖动',
    },
    {
      key: 'rune', name: '元素符石', icon: '💎',
      currentBonus: getWeaponMod(curW.id, 'rune') === 1 ? '🔥 火舌灼烧融甲' : getWeaponMod(curW.id, 'rune') === 2 ? '❄️ 霜魄急冻减速40%' : getWeaponMod(curW.id, 'rune') >= 3 ? '⚡ 雷暴超导连锁3敌' : '未装配',
      nextBonus: getWeaponMod(curW.id, 'rune') === 0 ? '🔥 火舌灼烧融甲' : getWeaponMod(curW.id, 'rune') === 1 ? '❄️ 霜魄急冻减速40%' : getWeaponMod(curW.id, 'rune') === 2 ? '⚡ 雷暴超导连锁3敌' : '已满级',
      desc: '将异化元素符石嵌入枪身，赋予子弹狂暴的元素异能',
    },
  ];

  const tracksHtml = tracks.map(t => {
    const rank = getWeaponMod(curW.id, t.key);
    const pipsHtml = [1,2,3].map(p => `<span class="ws-pip ${p <= rank ? 'filled' : ''}"></span>`).join('');
    const cost = rank < 3 ? DUFF_MOD_COSTS[rank] : null;
    const canAfford = cost ? (coins >= cost.coins && scrapMetal >= cost.scrap) : false;
    const btnText = rank >= 3 ? 'MAX 已满配' : `装配 💰${cost.coins} ⚙️${cost.scrap}`;
    const disabledAttr = (rank >= 3 || !canAfford) ? 'disabled' : '';

    return `
      <div class="ws-mod-track">
        <div style="display:flex;align-items:center;gap:12px;min-width:170px;">
          <span style="font-size:1.5rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${t.icon}</span>
          <div>
            <div style="font-family:var(--font-display);font-size:0.88rem;font-weight:800;color:#f5deb3;">${t.name}</div>
            <div style="display:flex;gap:4px;margin-top:4px;">${pipsHtml}</div>
          </div>
        </div>
        <div style="flex:1;font-size:0.7rem;color:#c0d0e4;line-height:1.4;">
          <div>当前效果: <b style="color:#5be4ff;">${t.currentBonus}</b> ${rank < 3 ? `➔ 下级: <b style="color:#ffd700;text-shadow:0 0 6px rgba(255,215,0,0.4);">${t.nextBonus}</b>` : ''}</div>
          <div style="color:#8094a8;font-size:0.63rem;margin-top:2px;">${t.desc}</div>
        </div>
        <button class="btn-ws-upgrade" ${disabledAttr} onclick="upgradeWeaponMod('${curW.id}', '${t.key}')">${btnText}</button>
      </div>
    `;
  }).join('');

  // Evolution section
  const evoData = SUPER_WEAPON_EVOLUTIONS[curW.id];
  let awakenSectionHtml = '';
  if(evoData){
    const isAwakened = !!rec.isSuperEvolved;
    const isReady = isAwakened || (rec.lv >= 5) || (getWeaponMod(curW.id,'damage')>=3 && getWeaponMod(curW.id,'mag')>=3 && getWeaponMod(curW.id,'reload')>=3 && getWeaponMod(curW.id,'tactical')>=3) || (activeTacticalMeal && activeTacticalMeal.id === 'dragon');

    awakenSectionHtml = `
      <div class="ws-awaken-box">
        <div style="display:flex;align-items:center;gap:14px;">
          <span style="font-size:2.4rem;line-height:1;filter:drop-shadow(0 0 10px rgba(255,215,0,0.6));">${evoData.icon}</span>
          <div>
            <div style="font-family:var(--font-display);font-size:1.05rem;font-weight:900;color:#ffd700;letter-spacing:1px;text-shadow:0 0 12px rgba(255,215,0,0.5);display:flex;align-items:center;gap:8px;">
              <span>【超级武器觉醒】${evoData.name}</span>
              <span style="font-size:0.58rem;padding:2px 6px;border-radius:3px;background:rgba(255,215,0,0.2);border:1px solid #ffd700;color:#ffd700;">终极形态</span>
            </div>
            <div style="font-size:0.7rem;color:#f0d8a8;max-width:460px;line-height:1.5;margin-top:3px;">
              ${evoData.desc}
            </div>
          </div>
        </div>
        <div>
          ${isAwakened ? `
            <div style="padding:8px 16px;border-radius:6px;background:rgba(255,215,0,0.25);border:1.5px solid #ffd700;color:#ffd700;font-weight:800;font-size:0.85rem;text-shadow:0 0 8px #ffd700;">
              🌟 已觉醒天灾超武
            </div>
          ` : isReady ? `
            <button class="btn-ws-upgrade" style="background:linear-gradient(180deg,#ff8800,#cc4400);border-color:#ffd700;box-shadow:0 0 18px rgba(255,140,0,0.8);font-size:0.88rem;padding:10px 20px;" onclick="evolveWeapon('${curW.id}')">
              ⚡ 立即觉醒超武！
            </button>
          ` : `
            <div style="font-size:0.65rem;color:#b0a088;background:rgba(0,0,0,0.45);padding:8px 12px;border-radius:6px;border:1px solid #5a4830;">
              🔒 需装配配件达到 Lv.3 / 或享用战备特餐
            </div>
          `}
        </div>
      </div>
    `;
  }

  const curDmg = Math.round(curW.damage * (1 + getWeaponMod(curW.id, 'damage') * 0.15));
  const curMag = Math.round(curW.maxAmmo * (1 + getWeaponMod(curW.id, 'mag') * 0.25));
  const curRld = Math.round(curW.reloadMs * Math.pow(0.85, getWeaponMod(curW.id, 'reload')));

  detailsContainer.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(16,24,38,0.9) 0%,rgba(10,16,26,0.96) 100%);border:1px solid rgba(91,228,255,0.35);padding:12px 18px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.45);">
      <div style="display:flex;align-items:center;gap:14px;">
        <span style="font-size:2.2rem;background:rgba(0,0,0,0.4);border:1px solid rgba(91,228,255,0.25);border-radius:10px;padding:8px 12px;">${curW.icon}</span>
        <div>
          <div style="font-family:var(--font-display);font-size:1.2rem;font-weight:900;color:#f5deb3;display:flex;align-items:center;gap:8px;">
            ${curName}
            <span style="font-size:0.65rem;padding:2px 8px;border-radius:4px;background:${curRarCol}22;border:1px solid ${curRarCol};color:${curRarCol};font-weight:700;">
              ${isEvo ? '🌟 超武' : (WEAPON_RARITY[curW.rarity]?.badge || curW.rarity)}
            </span>
            <span style="font-size:0.58rem;padding:2px 7px;border-radius:3px;background:rgba(91,228,255,0.12);border:1px solid rgba(91,228,255,0.4);color:#5be4ff;font-family:var(--font-display);">小胡工科改装机修槽</span>
          </div>
          <div style="font-size:0.68rem;color:#9cb0c6;margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
            <span>💥 威力: <b style="color:#f5deb3;">${curDmg}</b></span>
            <span>📦 弹匣: <b style="color:#f5deb3;">${curMag}</b></span>
            <span>⚡ 换弹: <b style="color:#f5deb3;">${curRld}ms</b></span>
            <span>🎯 暴击: <b style="color:#ffd700;">+${getWeaponMod(curW.id, 'tactical') * 6}%</b></span>
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:var(--font-display);font-size:1.05rem;color:${curRarCol};font-weight:900;text-shadow:0 0 10px ${curRarCol}66;">
          ${isEvo ? '🌟 终极超武' : (WEAPON_RARITY[curW.rarity]?.badge || '战术武器')}
        </div>
        <div style="font-size:0.64rem;color:#a0b4cc;margin-top:2px;">特色: <span style="color:#5be4ff;">${curW.tag}</span> · 纯粹机制</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      ${tracksHtml}
    </div>

    ${awakenSectionHtml}
  `;
}

// 内嵌在据点指挥所 cabin-scr 里的工坊面板同步渲染
function renderCabinWorkshopUI(){
  const container = document.getElementById('cabin-ws-content');
  if(!container) return;
  const owned = (ownedWeapons && ownedWeapons.length > 0) ? ownedWeapons : [0];
  if(wsActiveSlot >= owned.length) wsActiveSlot = 0;
  const currentWIdx = owned[wsActiveSlot] || 0;
  const curW = WEAPONS[currentWIdx];
  if(!curW) return;

  const rec = ensureWeaponLevel(curW.id);
  const isEvo = !!rec.isSuperEvolved;
  const curName = isEvo ? (rec.evoName || curW.name) : curW.name;

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-family:var(--font-display);font-size:0.95rem;color:#5be4ff;font-weight:700;">
        🛠️ 小胡军备改造台 (资金 💰${coins} | 零件 ⚙️${scrapMetal})
      </div>
      <div style="display:flex;gap:6px;">
        ${owned.map((idx, sIdx)=>`
          <button style="padding:3px 10px;border-radius:4px;font-size:0.7rem;cursor:pointer;background:${sIdx===wsActiveSlot?'#5be4ff':'#223244'};color:${sIdx===wsActiveSlot?'#000':'#fff'};border:1px solid #5be4ff;" onclick="switchWorkshopSlot(${sIdx})">
            [${sIdx+1}] ${WEAPONS[idx].icon} ${WEAPONS[idx].name}
          </button>
        `).join('')}
      </div>
    </div>
    <div style="font-size:0.68rem;color:#ffd700;margin-bottom:8px;">
      当前改装: ${curName} (Lv.${rec.lv}) · 点击下方按钮直接在弹窗中全面多维改装
    </div>
    <button class="btn-ws-upgrade" style="width:100%;padding:10px;font-size:0.85rem;" onclick="openDuffWorkshop()">
      🔧 打开小胡军备改造台深度改装面板 [M]
    </button>
  `;
}

// 兼容别名暴露
window.openHuWorkshop = openDuffWorkshop;
window.closeHuWorkshop = closeDuffWorkshop;
window.toggleHuWorkshop = toggleDuffWorkshop;
window.isHuWorkshopOpen = isDuffWorkshopOpen;

// ── 2. 战前战备特餐机制 (Tactical Cat Meal / Feast) ──
const TACTICAL_FEASTS = [
  {
    id: 'spicy',
    name: '麻辣爆烤',
    icon: '🌶️🍖',
    cost: { normal: 2, fast: 1, tank: 0, elite: 0 },
    badge: '翻滚烈焰',
    color: '#ff4422',
    desc: '食用后全身血液沸腾。闪避翻滚时在身后留下一道灼热烈焰火海，踏入的僵尸每秒受到140点持续灼烧。',
    effectDesc: '空格翻滚留火海(4秒持续·每秒140点伤害) + 移速+15%',
  },
  {
    id: 'frost',
    name: '极光霜冻排',
    icon: '❄️🥩',
    cost: { normal: 0, fast: 1, tank: 2, elite: 0 },
    badge: '极寒剑气',
    color: '#55ccff',
    desc: '深层极寒凝结的变异排骨。挥砍与射击发射穿透冰霜剑气，命中敌人强效减速70%并引发碎冰连环震荡爆破。',
    effectDesc: '挥砍/射击释放冰霜剑气 + 命中减速70% + 碎冰范围AoE爆破',
  },
  {
    id: 'stew',
    name: '十全大补汤',
    icon: '🍲✨',
    cost: { normal: 3, fast: 0, tank: 1, elite: 0 },
    badge: '护体冲击波',
    color: '#ffd700',
    desc: '耗费大量高蛋白慢火熬制的军用秘汤。持续自动回复生命，受创时爆发强力环形冲击波震飞周围所有僵尸。',
    effectDesc: '每1.5秒自动回2血 + 受创爆发150px冲击波震飞眩晕2秒',
  },
  {
    id: 'thunder',
    name: '爆裂雷光拼盘',
    icon: '⚡🍢',
    cost: { normal: 0, fast: 2, tank: 0, elite: 1 },
    badge: '天谴连锁雷',
    color: '#dd66ff',
    desc: '带电异变核心与瘦肉爆炒的激流料理。射击暴击或爆头时引动天降落雷，在多只僵尸间跳跃超导电离。',
    effectDesc: '暴击/爆头引动天降落雷(80点雷伤)并在周围4目标超导跳跃',
  },
  {
    id: 'dragon',
    name: '龙息炙烤盛宴',
    icon: '🐉🔥',
    cost: { normal: 2, fast: 0, tank: 2, elite: 1 },
    badge: '地狱龙息',
    color: '#ff8800',
    desc: '汇聚所有肉类的终极战争大餐。开火时25%概率触发大范围扇形龙息焦土，伤害+35%并直接激活超武觉醒！',
    effectDesc: '开火25%概率喷射龙息焦土 + 全伤害+35% + 立即激活超武觉醒',
  },
];

let activeTacticalMeal = null; // 当前生效的战前特餐

function isTacticalFeastOpen(){
  const m = document.getElementById('tactical-feast-modal');
  return !!(m && (m.classList.contains('open') || m.style.display === 'flex'));
}

function openTacticalFeastModal(){
  const m = document.getElementById('tactical-feast-modal');
  if(!m) return;
  if(typeof clearWaveDlg === 'function') clearWaveDlg();
  if(typeof closeDlg === 'function') closeDlg();
  m.classList.add('open');
  m.style.display = 'flex';
  renderTacticalFeastUI();
  try{ sndShopOpen(); }catch(e){}
}

function closeTacticalFeastModal(){
  const m = document.getElementById('tactical-feast-modal');
  if(!m) return;
  m.classList.remove('open');
  m.style.display = 'none';
  try{ sndShopClose(); }catch(e){}
}

function toggleTacticalFeastModal(){
  if(isTacticalFeastOpen()) closeTacticalFeastModal();
  else openTacticalFeastModal();
}

function cookTacticalFeast(feastId){
  const feast = TACTICAL_FEASTS.find(f => f.id === feastId);
  if(!feast) return;

  // Verify cost
  for(const k of ['normal', 'fast', 'tank', 'elite']){
    const need = feast.cost[k] || 0;
    if((meatInventory[k] || 0) < need){
      addBanner(`❌ 食材不足！需要 ${MEAT_TYPES[k].name}×${need} (当前只有 ${meatInventory[k]||0})`);
      return;
    }
  }

  // Deduct meats
  for(const k of ['normal', 'fast', 'tank', 'elite']){
    const need = feast.cost[k] || 0;
    meatInventory[k] -= need;
  }

  activeTacticalMeal = feast;
  addBanner(`🍲 战备特餐「${feast.name}」烹饪享用完成！获得【${feast.badge}】战备加持！`);
  spawnFloatText(`享用 ${feast.name}! 🍲`, player.x + CHAR_W/2, player.y - 30, feast.color);
  sndLevelUp();
  try{ sndCookSizzle(); }catch(e){}

  updateTacticalMealHUD();
  renderTacticalFeastUI();
  renderCabinFeastUI();
  if(typeof renderDuffWorkshopUI === 'function') renderDuffWorkshopUI();
}

function updateTacticalMealHUD(){
  const hud = document.getElementById('tactical-meal-hud');
  const icon = document.getElementById('tm-hud-icon');
  const text = document.getElementById('tm-hud-text');
  if(!hud) return;

  if(activeTacticalMeal){
    hud.style.display = 'flex';
    hud.style.borderColor = activeTacticalMeal.color || '#ff6b6b';
    if(icon) icon.textContent = activeTacticalMeal.icon;
    if(text) text.textContent = `${activeTacticalMeal.name} (${activeTacticalMeal.badge})`;
  } else {
    hud.style.display = 'none';
  }
}

function renderTacticalFeastUI(){
  const meatSummary = document.getElementById('tf-meat-summary');
  if(meatSummary){
    meatSummary.innerHTML = `
      <span style="background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;">🥩普通×${meatInventory.normal||0}</span>
      <span style="background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;">🍗瘦肉×${meatInventory.fast||0}</span>
      <span style="background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;">🍖厚肉×${meatInventory.tank||0}</span>
      <span style="background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;color:#dd88ff;">🧪异变×${meatInventory.elite||0}</span>
    `;
  }

  const statusEl = document.getElementById('tf-active-status');
  if(statusEl){
    if(activeTacticalMeal){
      statusEl.innerHTML = `当前生效特餐: <b style="color:${activeTacticalMeal.color};">${activeTacticalMeal.name} (${activeTacticalMeal.badge})</b>`;
    } else {
      statusEl.innerHTML = '当前生效特餐: <b style="color:#aaa;">暂无 (出击前烹调享用一份)</b>';
    }
  }

  const grid = document.getElementById('tf-grid');
  if(!grid) return;

  grid.innerHTML = TACTICAL_FEASTS.map(f => {
    const isActive = (activeTacticalMeal && activeTacticalMeal.id === f.id);
    let canAfford = true;
    const costBadges = ['normal', 'fast', 'tank', 'elite'].map(k => {
      const need = f.cost[k] || 0;
      if(need === 0) return '';
      const has = meatInventory[k] || 0;
      if(has < need) canAfford = false;
      const col = has >= need ? '#88ffaa' : '#ff7777';
      const name = { normal:'普通', fast:'瘦肉', tank:'厚肉', elite:'异变' }[k];
      return `<span style="background:rgba(0,0,0,0.45);border:1px solid ${col};color:${col};padding:1px 6px;border-radius:4px;font-size:0.65rem;">${name}${has}/${need}</span>`;
    }).filter(x => x).join(' ');

    return `
      <div class="feast-card ${isActive ? 'active-feast' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.8rem;line-height:1;">${f.icon}</span>
            <div>
              <div style="font-family:var(--font-display);font-size:0.95rem;font-weight:800;color:#f5deb3;">${f.name}</div>
              <span style="font-size:0.6rem;padding:1px 6px;border-radius:8px;background:${f.color}33;border:1px solid ${f.color};color:#fff;">${f.badge}</span>
            </div>
          </div>
          ${isActive ? '<span style="color:#ffd700;font-size:0.65rem;font-weight:700;">★ 生效中</span>' : ''}
        </div>
        <div style="font-size:0.66rem;color:#d8c0b8;line-height:1.45;background:rgba(0,0,0,0.3);padding:6px 8px;border-radius:6px;">
          ${f.desc}
        </div>
        <div style="font-size:0.62rem;color:#ffd875;font-weight:700;">
          机制: ${f.effectDesc}
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:2px;">
          <span style="font-size:0.62rem;color:#a89088;">消耗:</span>
          ${costBadges}
        </div>
        <button class="btn-feast-cook" ${(!canAfford || isActive) ? 'disabled' : ''} onclick="cookTacticalFeast('${f.id}')">
          ${isActive ? '当前已享用' : canAfford ? '烹调享用 🍲' : '食材不足 🔒'}
        </button>
      </div>
    `;
  }).join('');
}

function renderCabinFeastUI(){
  const container = document.getElementById('cabin-tf-content');
  if(!container) return;
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-family:var(--font-display);font-size:0.95rem;color:#ff6b6b;font-weight:700;">
        🍲 战前战备特餐 (战术猫饭)
      </div>
      <div style="font-size:0.7rem;color:#ffd875;">
        当前: ${activeTacticalMeal ? activeTacticalMeal.name : '未享用'}
      </div>
    </div>
    <div style="font-size:0.68rem;color:#d8c0b8;margin-bottom:8px;">
      小胡军用秘制灶台已点火！消耗肉块烹调大餐，赋予防线强力战斗机制。
    </div>
    <button class="btn-feast-cook" style="width:100%;padding:10px;font-size:0.85rem;" onclick="openTacticalFeastModal()">
      🍲 打开战前特餐料理面板
    </button>
  `;
}

// ── 3. 超级武器觉醒系统 (Super Weapon Evolution) ──
const SUPER_WEAPON_EVOLUTIONS = {
  pistol: {
    name: '双生风暴狂徒',
    icon: '🌪️🔫',
    tag: '狂暴',
    tagClass: 'tag-mini',
    rarity: 'legendary',
    desc: '双枪全自动狂暴速射，子弹分裂跳弹，爆头轰鸣金色冲击波震晕周围尸群',
    apply: (w) => {
      w.name = '双生风暴狂徒';
      w.icon = '🌪️🔫';
      w.tag = '狂暴';
      w.tagClass = 'tag-mini';
      w.rarity = 'legendary';
      w.autofire = true;
      w.fireInterval = 30;
      w.maxAmmo = 60;
      w.damage = Math.round(w.damage * 1.8);
      w.reloadMs = 500;
      w.isSuperEvolved = true;
      w.evoType = 'dual_storm';
    }
  },
  shotgun: {
    name: '地狱龙息炮',
    icon: '🐉💥',
    tag: '毁灭',
    tagClass: 'tag-fire',
    rarity: 'legendary',
    desc: '轰出14枚烈焰龙息重弹，地面留存熔岩火海，全屏震退掀翻一切冲撞尸潮',
    apply: (w) => {
      w.name = '地狱龙息炮';
      w.icon = '🐉💥';
      w.tag = '毁灭';
      w.tagClass = 'tag-fire';
      w.rarity = 'legendary';
      w.pellets = 14;
      w.damage = Math.round(w.damage * 2.2);
      w.maxAmmo = 12;
      w.reloadMs = 950;
      w.burn = true;
      w.burnGround = true;
      w.traitKnockback = 5.5;
      w.isSuperEvolved = true;
      w.evoType = 'dragon_cannon';
    }
  },
  crossbow: {
    name: '电磁穿云弩',
    icon: '⚡🏹',
    tag: '神威',
    tagClass: 'tag-elec',
    rarity: 'legendary',
    desc: '超音速全域电磁贯穿光矛，沿途生成持续雷暴电离裂隙撕裂全图',
    apply: (w) => {
      w.name = '电磁穿云弩';
      w.icon = '⚡🏹';
      w.tag = '神威';
      w.tagClass = 'tag-elec';
      w.rarity = 'legendary';
      w.damage = Math.round(w.damage * 2.5);
      w.piercing = true;
      w.pierceCount = 99;
      w.speed = 46;
      w.maxAmmo = 12;
      w.reloadMs = 700;
      w.isSuperEvolved = true;
      w.evoType = 'pierce_cloud';
    }
  },
  smg: {
    name: '加特林风暴裁决',
    icon: '🌀🔫',
    tag: '裁决',
    tagClass: 'tag-mini',
    rarity: 'legendary',
    desc: '极限射速金属风暴倾泻弹海，伴随追踪穿甲微型导弹全屏轰炸',
    apply: (w) => {
      w.name = '加特林风暴裁决';
      w.icon = '🌀🔫';
      w.tag = '裁决';
      w.tagClass = 'tag-mini';
      w.rarity = 'legendary';
      w.autofire = true;
      w.fireInterval = 20;
      w.damage = Math.round(w.damage * 1.8);
      w.maxAmmo = 120;
      w.reloadMs = 800;
      w.isSuperEvolved = true;
      w.evoType = 'gatling_whirlwind';
    }
  },
  smg_heavy: {
    name: '重装泰坦歼灭者',
    icon: '🛡️🔫',
    tag: '歼灭',
    tagClass: 'tag-mini',
    rarity: 'legendary',
    desc: '大口径泰坦贫铀穿甲弹，90%强效碎骨压制，摧枯拉朽击碎护甲',
    apply: (w) => {
      w.name = '重装泰坦歼灭者';
      w.icon = '🛡️🔫';
      w.tag = '歼灭';
      w.rarity = 'legendary';
      w.damage = Math.round(w.damage * 2.4);
      w.maxAmmo = 90;
      w.fireInterval = 36;
      w.traitSlow = 0.2;
      w.isSuperEvolved = true;
    }
  },
  sniper: {
    name: '天基轨道死光',
    icon: '🛰️🎯',
    tag: '灭世',
    tagClass: 'tag-elec',
    rarity: 'legendary',
    desc: '全屏相对论光速穿刺，弹道尽头引动天基死光巨柱降维打击',
    apply: (w) => {
      w.name = '天基轨道死光';
      w.icon = '🛰️🎯';
      w.tag = '灭世';
      w.rarity = 'legendary';
      w.damage = Math.round(w.damage * 2.8);
      w.maxAmmo = 8;
      w.reloadMs = 1200;
      w.traitCritMul = 6.0;
      w.traitCritBonus = 0.6;
      w.isSuperEvolved = true;
      w.evoType = 'orbital_death_ray';
    }
  },
  flame: {
    name: '熔核日冕喷涌者',
    icon: '☀️🔥',
    tag: '日冕',
    tagClass: 'tag-fire',
    rarity: 'legendary',
    desc: '太阳耀斑风暴席卷，彻底融毁目标全部护甲，生成全屏熔岩焦土',
    apply: (w) => {
      w.name = '熔核日冕喷涌者';
      w.icon = '☀️🔥';
      w.tag = '日冕';
      w.rarity = 'legendary';
      w.damage = Math.round(w.damage * 2.5);
      w.maxAmmo = 160;
      w.maxRange = 450;
      w.fireInterval = 24;
      w.burnGround = true;
      w.isSuperEvolved = true;
    }
  },
  tesla: {
    name: '雷神超导线圈',
    icon: '⚡🌐',
    tag: '天神',
    tagClass: 'tag-elec',
    rarity: 'legendary',
    desc: '全屏超导雷暴网络，跳跃10个目标并殉爆球状闪电连锁电离',
    apply: (w) => {
      w.name = '雷神超导线圈';
      w.icon = '⚡🌐';
      w.tag = '天神';
      w.rarity = 'legendary';
      w.damage = Math.round(w.damage * 2.2);
      w.chain = 10;
      w.chainDecay = 0.95;
      w.maxAmmo = 24;
      w.reloadMs = 1000;
      w.isSuperEvolved = true;
    }
  },
  grenade: {
    name: '末日裂解集束弹',
    icon: '💣💥',
    tag: '灭绝',
    tagClass: 'tag-expl',
    rarity: 'legendary',
    desc: '投掷后炸裂为6枚二次高爆子母弹，形成地毯式震荡毁灭轰炸区',
    apply: (w) => {
      w.name = '末日裂解集束弹';
      w.icon = '💣💥';
      w.tag = '灭绝';
      w.rarity = 'legendary';
      w.damage = Math.round(w.damage * 2.3);
      w.aoe = 220;
      w.maxAmmo = 8;
      w.reloadMs = 1100;
      w.isSuperEvolved = true;
      w.evoType = 'cluster_apocalypse';
    }
  },
};

function evolveWeapon(wid){
  const w = WEAPONS.find(x => x.id === wid);
  const evo = SUPER_WEAPON_EVOLUTIONS[wid];
  if(!w || !evo) return false;
  const rec = ensureWeaponLevel(wid);
  const curW = WEAPONS[curWpnIdx];
  if(curW && curW.id === wid && isReloading){
    if(typeof cancelReload === 'function') cancelReload();
  }

  const oldName = w.name;
  evo.apply(w);
  rec.isSuperEvolved = true;
  rec.evoName = evo.name;
  rec.evoBranch = 'super_evolved';
  rec.evoQueued = true;

  // Refill magazine
  const wIdx = WEAPONS.indexOf(w);
  if(wIdx >= 0 && ownedWeaponsSet.has(wIdx)){
    wAmmo[wIdx] = weaponMagSize(w);
  }

  // Cinematic audio-visual celebration
  addBanner(`🌟【超武觉醒】你的「${oldName}」已蜕变进化为【${evo.name}】！天灾火力降临！`);
  spawnFloatText(`✨ 超武觉醒: ${evo.name}!`, player.x + CHAR_W/2, player.y - 45, '#ffd700');
  addShake(14);
  critFlash = 1.0;
  sndLevelUp();
  sndWave();
  for(let i=0; i<30; i++){
    const ang = Math.random() * Math.PI * 2;
    const sp = 4 + Math.random() * 6;
    mkP({x:player.x+CHAR_W/2, y:player.y+CHAR_H/2, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, r:3+Math.random()*4, rDecay:.04, decay:.03, color:i%2?'#ffd700':'#ff6644', type:'spark', grav:0.05, alpha:1});
  }

  refreshWBar();
  updateAmmoUI();
  if(typeof renderDuffWorkshopUI === 'function') renderDuffWorkshopUI();
  return true;
}


//  BACKPACK & INVENTORY SYSTEM (避难所战术行囊系统)
//  支持掉落多样化物品：赋能餐厅经营、房屋设计、城堡塔防与肉鸽战斗
// ═══════════════════════════════════════════

const INVENTORY_ITEMS = {
  // ── 🥩 核心食材（夜晚营业与特餐） ──
  meat_normal: {
    id: 'meat_normal', name: '鲜美僵尸肉', icon: '🥩', cat: 'restaurant', rarity: 'common',
    desc: '最基础的末日肉材。经过特制香料腌制后口感劲道，香气浓郁。',
    useDesc: '【餐厅核心食材】用于烹饪烤肉串与肉饼，夜晚营业的核心消耗品。',
    value: 4, stackMax: 999
  },
  meat_fast: {
    id: 'meat_fast', name: '韧性瘦肉', icon: '🍗', cat: 'restaurant', rarity: 'uncommon',
    desc: '狂奔感染者身上的紧实腿肉，低脂高蛋白，久煮不烂，肉香回甘。',
    useDesc: '【高阶料理食材】用于熬制高阶浓汤与精制肉煲，大幅提升客单价。',
    value: 8, stackMax: 999
  },
  meat_tank: {
    id: 'meat_tank', name: '霜降厚肉', icon: '🥓', cat: 'restaurant', rarity: 'rare',
    desc: '巨型行刑者身上积聚的雪花油花肉，肥瘦相间，高温炙烤滋滋流油。',
    useDesc: '【顶级牛排食材】铁板炙烤厚肉排核心食材，食客品尝后给高额小费。',
    value: 16, stackMax: 999
  },
  meat_elite: {
    id: 'meat_elite', name: '异化基因肉', icon: '💜', cat: 'restaurant', rarity: 'epic',
    desc: '击败变异精英首领掉落的发光异变肉质，蕴藏充沛生化能量。',
    useDesc: '【VIP贵宾专享】制作小胡招牌「异变火锅」的核心原料，暴利佳品。',
    value: 35, stackMax: 999
  },

  // ── 🏰 据点城堡建材 ──
  wood: {
    id: 'wood', name: '建筑原木', icon: '🪵', cat: 'cabin', rarity: 'common',
    desc: '坚硬韧性木料，易于加工，用于房屋扩建与拒马陷阱升级。',
    useDesc: '【城堡基础建材】避难所升级、工兵拒马陷阱加固必备材料。',
    value: 4, stackMax: 999
  },
  scrap: {
    id: 'scrap', name: '特种合金废铁', icon: '⚙️', cat: 'cabin', rarity: 'common',
    desc: '装甲车辆切割下的高强度合金件，用于重型防线与机枪塔构件。',
    useDesc: '【防线强化构件】用于围墙钢铁装甲、机枪塔机匣与炮火基座。',
    value: 4, stackMax: 999
  },

  // ── ⚔️ 战术生存补给 ──
  medkit_spec: {
    id: 'medkit_spec', name: '军用急救包', icon: '💉', cat: 'tactical', rarity: 'uncommon',
    desc: '配有止血纳米凝胶与抗感染血清的战地特勤医疗包。',
    useDesc: '【战备医疗】点击立即使用：瞬间恢复 50 HP 并净化负面状态。',
    usable: true,
    value: 25, stackMax: 50
  },
  ammo_crate_item: {
    id: 'ammo_crate_item', name: '便携弹药盒', icon: '📦', cat: 'tactical', rarity: 'uncommon',
    desc: '轻量化军规通用弹药包，撕开封条即可为随身双武器快速压弹。',
    useDesc: '【战备弹药】点击立即使用：补满手头所有武器弹药并赋予伤害加成。',
    usable: true,
    value: 30, stackMax: 30
  }
};

let backpackInventory = {
  meat_normal: 5,
  meat_fast: 2,
  meat_tank: 0,
  meat_elite: 0,
  wood: 4,
  scrap: 4,
  medkit_spec: 1,
  ammo_crate_item: 1,
};

function resetBackpackInventory(){
  backpackInventory = {
    meat_normal: 5,
    meat_fast: 2,
    meat_tank: 0,
    meat_elite: 0,
    wood: 4,
    scrap: 4,
    medkit_spec: 1,
    ammo_crate_item: 1,
  };
}

let bpSelectedItemId = 'meat_normal';
let bpActiveTab = 'all';

function syncBackpackToGlobals(){
  if(typeof meatInventory !== 'undefined'){
    meatInventory.normal = backpackInventory.meat_normal || 0;
    meatInventory.fast = backpackInventory.meat_fast || 0;
    meatInventory.tank = backpackInventory.meat_tank || 0;
    meatInventory.elite = backpackInventory.meat_elite || 0;
  }
  woodPlanks = backpackInventory.wood || 0;
  scrapMetal = backpackInventory.scrap || 0;
  const wEl = document.getElementById('hud-wood');
  const sEl = document.getElementById('hud-scrap');
  if(wEl) wEl.textContent = '🪵 ' + woodPlanks;
  if(sEl) sEl.textContent = '⚙️ ' + scrapMetal;
}

function syncGlobalsToBackpack(){
  if(typeof meatInventory !== 'undefined'){
    backpackInventory.meat_normal = meatInventory.normal || 0;
    backpackInventory.meat_fast = meatInventory.fast || 0;
    backpackInventory.meat_tank = meatInventory.tank || 0;
    backpackInventory.meat_elite = meatInventory.elite || 0;
  }
  backpackInventory.wood = woodPlanks || 0;
  backpackInventory.scrap = scrapMetal || 0;
}

function addItemToBackpack(id, qty, notify){
  if(!INVENTORY_ITEMS[id]) return;
  qty = qty || 1;
  backpackInventory[id] = (backpackInventory[id] || 0) + qty;
  syncBackpackToGlobals();
  if(notify && typeof player !== 'undefined'){
    const def = INVENTORY_ITEMS[id];
    const rarCol = {common:'#e8e8e8', uncommon:'#5bba6f', rare:'#4a9fe8', epic:'#b06bd6', legendary:'#ffa033'}[def.rarity] || '#ffd875';
    spawnFloatText(`🎒 +${qty} ${def.name} ${def.icon}`, player.x+CHAR_W/2, player.y-35, rarCol);
    addBanner(`🎒 获得物品：「${def.name}」${def.icon} ×${qty}（已收入行囊）`);
  }
  if(isBackpackOpen()) renderBackpackUI();
}

function removeItemFromBackpack(id, qty){
  qty = qty || 1;
  if((backpackInventory[id] || 0) < qty) return false;
  backpackInventory[id] -= qty;
  if(backpackInventory[id] <= 0) delete backpackInventory[id];
  syncBackpackToGlobals();
  if(isBackpackOpen()) renderBackpackUI();
  return true;
}

function getBackpackItemCount(id){
  syncGlobalsToBackpack();
  return backpackInventory[id] || 0;
}

function isBackpackOpen(){
  const m = document.getElementById('backpack-modal');
  return !!(m && m.classList.contains('open'));
}

function toggleBackpack(){
  if(isBackpackOpen()) closeBackpack();
  else openBackpack();
}

function openBackpack(){
  const m = document.getElementById('backpack-modal');
  if(!m) return;
  if(typeof clearWaveDlg === 'function') clearWaveDlg();
  if(typeof closeDlg === 'function') closeDlg();
  syncGlobalsToBackpack();
  m.classList.add('open');
  m.style.display = 'flex';
  renderBackpackUI();
  try{ sndShopOpen(); }catch(e){}
}

function closeBackpack(){
  const m = document.getElementById('backpack-modal');
  if(!m) return;
  m.classList.remove('open');
  m.style.display = 'none';
  try{ sndShopClose(); }catch(e){}
}

function isExpeditionOpen(){
  const m = document.getElementById('expedition-modal');
  return !!(m && m.classList.contains('open'));
}

function toggleExpeditionModal(){
  if(isExpeditionOpen()) closeExpeditionModal();
  else openExpeditionModal();
}

function openExpeditionModal(){
  const m = document.getElementById('expedition-modal');
  if(!m) return;
  if(typeof clearWaveDlg === 'function') clearWaveDlg();
  if(typeof closeDlg === 'function') closeDlg();
  m.classList.add('open');
  m.style.display = 'flex';
  renderExpeditionUI();
  try{ sndShopOpen(); }catch(e){}
}

function closeExpeditionModal(){
  const m = document.getElementById('expedition-modal');
  if(!m) return;
  m.classList.remove('open');
  m.style.display = 'none';
  try{ sndShopClose(); }catch(e){}
}

function renderExpeditionUI(){
  const grid = document.getElementById('exp-grid');
  if(!grid) return;
  const isHub = (gameState === 'hub');
  const cardsHtml = Object.keys(EXPEDITION_DESTINATIONS).map(k => {
    const d = EXPEDITION_DESTINATIONS[k];
    const lootsHtml = d.loots.map(l => `
      <div class="exp-loot-item">
        <span>${l.icon} ${l.name}</span>
        <span class="exp-loot-tag">${l.count}</span>
      </div>
    `).join('');
    const btnText = isHub ? `出征探险 ${d.icon}` : `出征探险 (限据点整备期) 🔒`;
    const btnStyle = isHub ? '' : 'opacity:0.75;filter:grayscale(0.4);cursor:not-allowed;';
    return `
      <div class="exp-card" style="border-top: 3px solid ${d.color};">
        <div class="exp-card-header">
          <div class="exp-card-icon">${d.icon}</div>
          <div>
            <div class="exp-card-name">${d.name}</div>
            <div class="exp-card-subtitle">${d.subtitle}</div>
          </div>
        </div>
        <span class="exp-badge" style="background:${d.color}33;border:1px solid ${d.color};color:#ffdd88;">${d.dangerBadge}</span>
        <div class="exp-desc">${d.desc}</div>
        <div class="exp-loots-title">🎁 核心搜刮目标:</div>
        <div class="exp-loots-list">${lootsHtml}</div>
        <button class="exp-embark-btn" style="${btnStyle}" onclick="startExpedition('${k}')">${btnText}</button>
      </div>
    `;
  }).join('');
  grid.innerHTML = cardsHtml;
}

function startExpedition(destKey){
  const dest = EXPEDITION_DESTINATIONS[destKey];
  if(!dest) return;
  if(gameState !== 'hub'){
    if(gameState === 'world'){
      addBanner('🔒 战斗中无法出征！请在防守结束后回据点整备时再探险');
    } else if(gameState === 'restaurant'){
      addBanner('🔒 餐厅营业中无法出征！打烊后回到据点再探险');
    } else if(gameState === 'building'){
      addBanner('🔒 已在探险副本中！');
    } else {
      addBanner('🔒 只能在据点整备期发起远征！');
    }
    return;
  }
  closeExpeditionModal();
  if(typeof playTransition === 'function'){
    playTransition('day-night', '旧城区远征', `前往【${dest.name}】搜刮物资`, dest.icon, () => {
      _launchExpedition(destKey);
    }, 1200);
  } else {
    _launchExpedition(destKey);
  }
}

function _launchExpedition(destKey){
  const dest = EXPEDITION_DESTINATIONS[destKey];
  buildingReturnState = 'hub';
  activeBuilding = dest;
  gameState = 'building';
  scoutView = false;
  cameraX = 0;
  bullets = [];
  bossProjList = [];
  particles.length = 0;
  lootDrops = [];
  
  player.x = 80;
  player.y = CHAR_GY;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.facingRight = true;
  
  buildingInteriorZombies = [];
  buildingInteriorCleared[destKey] = false;
  buildingInteriorLooted[destKey] = false;
  if(destKey === 'clinic'){
    buildingInteriorLooted.clinicPerk = false;
    buildingInteriorLooted.clinicBox2 = false;
  }
  if(destKey === 'armory'){
    buildingInteriorLooted.armoryTower = false;
  }
  if(destKey === 'tavern'){
    buildingInteriorLooted.tavernFood = false;
  }
  
  const count = 4 + Math.floor(wave / 3);
  for (let i = 0; i < count; i++) {
    const zx = 280 + i * 110 + Math.random() * 40;
    let td;
    if(destKey === 'clinic'){
      td = (i % 2 === 0) ? ZTYPES[1] : ZTYPES[3];
    } else if(destKey === 'tavern'){
      td = (i % 3 === 0) ? ZTYPES[1] : ZTYPES[0];
    } else {
      td = (i % 2 === 0) ? ZTYPES[2] : ZTYPES[3];
    }
    const elite = (Math.random() < 0.25) ? (Math.floor(Math.random() * 3) + 1) : 0;
    const expHpMul = wave >= 13 ? 6.5 : wave >= 10 ? 5.0 : wave >= 7 ? 3.8 : wave >= 4 ? 2.6 : wave >= 2 ? 1.8 : 1.3;
    const hp = Math.floor((td.hp + Math.floor(wave * 8)) * expHpMul * (elite ? 1.8 : 1));
    const spd = td.speed * (1 + (wave - 1) * 0.05);
    
    const z = {
      x: zx, hp, maxHp: hp, spd, alive: true, type: td.type,
      pts: td.pts * (elite ? 2 : 1), coinReward: (td.coins + (elite ? 8 : 0)),
      walkT: Math.random(), facingR: false, hitFlash: 0, burnTimer: null, burning: false,
      elite, state: 'idle', stateTimer: 0, shieldFlash: 0, floatOffset: 0
    };
    buildingInteriorZombies.push(z);
  }
  
  sndWave();
  addBanner(`🗺️ 远征出击：抵达【${dest.name}】！击败盘踞僵尸并搜刮物资！`);
}

function switchBpTab(tab){
  bpActiveTab = tab;
  document.querySelectorAll('.bp-tab').forEach(t => t.classList.remove('active'));
  const btn = document.getElementById('bptab-' + tab);
  if(btn) btn.classList.add('active');
  renderBackpackUI();
}

function renderBackpackUI(){
  syncGlobalsToBackpack();
  const grid = document.getElementById('bp-grid');
  if(!grid) return;
  grid.innerHTML = '';

  let totalCount = 0;
  Object.keys(backpackInventory).forEach(k => { totalCount += (backpackInventory[k] || 0); });
  const statItems = document.getElementById('bp-stat-items');
  const statWood = document.getElementById('bp-stat-wood');
  const statScrap = document.getElementById('bp-stat-scrap');
  const statCoins = document.getElementById('bp-stat-coins');
  if(statItems) statItems.textContent = `物品: ${totalCount}`;
  if(statWood) statWood.textContent = `🪵 ${woodPlanks}`;
  if(statScrap) statScrap.textContent = `⚙️ ${scrapMetal}`;
  if(statCoins) statCoins.textContent = `💰 ${coins}`;

  const itemKeys = Object.keys(INVENTORY_ITEMS).filter(k => {
    const it = INVENTORY_ITEMS[k];
    if(bpActiveTab === 'all') return true;
    return it.cat === bpActiveTab;
  });

  if(!bpSelectedItemId || !INVENTORY_ITEMS[bpSelectedItemId]){
    bpSelectedItemId = itemKeys[0] || 'meat_normal';
  }

  itemKeys.forEach(k => {
    const def = INVENTORY_ITEMS[k];
    const count = backpackInventory[k] || 0;
    const slot = document.createElement('div');
    const isSelected = (k === bpSelectedItemId);
    const rarCol = {common:'#e8e8e8', uncommon:'#5bba6f', rare:'#4a9fe8', epic:'#b06bd6', legendary:'#ffa033'}[def.rarity] || '#888';

    slot.className = 'bp-slot' + (isSelected ? ' selected' : '') + (count === 0 ? ' empty' : '');
    slot.style.borderColor = isSelected ? '#ffd700' : rarCol;
    if(count === 0) slot.style.opacity = '0.38';

    const catBadge = {restaurant:'料理', cabin:'据点', tactical:'战术'}[def.cat] || '';
    slot.innerHTML = `
      <span class="bp-slot-badge">${catBadge}</span>
      <span class="bp-slot-icon">${def.icon}</span>
      <span class="bp-slot-qty">${count > 0 ? '×' + count : '0'}</span>
    `;
    slot.onclick = () => { selectBpItem(k); };
    grid.appendChild(slot);
  });

  renderBpInspector();
}

function selectBpItem(id){
  bpSelectedItemId = id;
  renderBackpackUI();
}

function renderDualWieldInspector(){
  for(let slotI = 0; slotI < 2; slotI++){
    const slotEl = document.getElementById('bp-dual-slot-' + slotI);
    if(!slotEl) continue;
    const wIdx = (typeof ownedWeapons !== 'undefined' && ownedWeapons[slotI] !== undefined) ? ownedWeapons[slotI] : -1;
    const w = (wIdx >= 0 && typeof WEAPONS !== 'undefined' && WEAPONS[wIdx]) ? WEAPONS[wIdx] : null;
    if(w){
      const isCur = (wIdx === curWpnIdx);
      const rInfo = (typeof WEAPON_RARITY !== 'undefined' && WEAPON_RARITY[w.rarity]) || { color: '#888', name: '军规' };
      slotEl.className = 'bp-weapon-card' + (isCur ? ' active' : '');
      slotEl.innerHTML = `
        <span class="bp-w-icon" style="font-size:1.4rem;">${w.icon}</span>
        <div class="bp-w-info" style="margin-left:6px;line-height:1.3;">
          <div class="bp-w-name" style="font-size:0.75rem;font-weight:bold;color:${rInfo.color};">${w.name}</div>
          <div class="bp-w-meta" style="font-size:0.62rem;color:#8b949e;">${slotI === 0 ? '主手 [1]' : '副手 [2]'} · ${w.damage}伤 · 弹夹${w.maxAmmo}</div>
        </div>
      `;
    } else {
      slotEl.className = 'bp-weapon-card empty';
      slotEl.innerHTML = `<span class="bp-w-empty-text" style="font-size:0.65rem;color:#6e7681;">[ 空槽位 ${slotI + 1} ]</span>`;
    }
  }
}
window.renderDualWieldInspector = renderDualWieldInspector;

function renderBpInspector(){
  const empty = document.getElementById('bp-inspector-empty');
  const content = document.getElementById('bp-inspector-content');
  if(!empty || !content) return;
  const def = INVENTORY_ITEMS[bpSelectedItemId];
  if(!def){
    empty.style.display = 'block';
    content.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  content.style.display = 'flex';

  const count = backpackInventory[bpSelectedItemId] || 0;
  const rarCol = {common:'#d0d7de', uncommon:'#388bfd', rare:'#a371f7', epic:'#f85149', legendary:'#ffa033'}[def.rarity] || '#888';
  const rarCn = {common:'制式普通', uncommon:'战术精良', rare:'特种稀有', epic:'神兵史诗', legendary:'传说级'}[def.rarity] || '普通';

  document.getElementById('bp-insp-icon').textContent = def.icon;
  document.getElementById('bp-insp-name').textContent = def.name;
  document.getElementById('bp-insp-name').style.color = rarCol;
  document.getElementById('bp-insp-rarity').textContent = rarCn;
  document.getElementById('bp-insp-rarity').style.color = rarCol;
  document.getElementById('bp-insp-qty').textContent = `行囊持有: ${count}`;
  document.getElementById('bp-insp-desc').textContent = def.useDesc || def.desc;

  // 极简单张战术信息卡与双持装备看板（支持全新结构与向后兼容）
  const effBox = document.getElementById('bp-insp-effects');
  if(effBox){
    effBox.innerHTML = `
      <div class="bp-effect-card" style="border-left:3px solid ${rarCol};background:rgba(0,0,0,0.35);padding:8px 10px;border-radius:6px;font-size:0.72rem;color:#d0d7de;line-height:1.45;">
        <div style="color:#ffd700;font-weight:bold;margin-bottom:3px;">🎯 战术战略效能</div>
        <div>${def.useDesc || def.desc}</div>
      </div>
    `;
  }

  // 填充现代双持槽位面板
  renderDualWieldInspector();

  const actBox = document.getElementById('bp-insp-actions');
  actBox.innerHTML = '';
  if(def.usable){
    const useBtn = document.createElement('button');
    useBtn.className = 'bp-btn-use';
    useBtn.textContent = `✨ 立即使用 (${count})`;
    useBtn.disabled = (count <= 0);
    useBtn.onclick = () => { useBackpackItem(def.id); };
    actBox.appendChild(useBtn);
  } else {
    const tip = document.createElement('div');
    tip.style.cssText = 'font-size:0.62rem;color:#8b949e;text-align:center;padding:5px;background:rgba(0,0,0,0.25);border-radius:4px;';
    tip.textContent = '随身常驻战备物资 · 夜晚营业与工事建设核心基石';
    actBox.appendChild(tip);
  }
}

function useBackpackItem(id){
  const count = backpackInventory[id] || 0;
  if(count <= 0){ addBanner('❌ 行囊中该物品数量不足！'); return; }

  if(id === 'medkit_spec'){
    if(health >= maxHp){ addBanner('生命值已满，无需使用急救包'); return; }
    removeItemFromBackpack(id, 1);
    health = Math.min(maxHp, health + 50);
    updateHpUI();
    try{ sndHeal(); }catch(e){}
    spawnFloatText('💉 +50 HP 治愈!', player.x+CHAR_W/2, player.y-25, '#2ecc71');
    addBanner('💉 使用了军用急救包：恢复 50 点生命值并净化异常！');
  } else if(id === 'adrenaline_shot'){
    removeItemFromBackpack(id, 1);
    window._vanguardBuffT = 900;
    try{ sndBuff(); }catch(e){}
    spawnFloatText('⚡ 极速肾上腺素爆发!', player.x+CHAR_W/2, player.y-25, '#ffaa00');
    addBanner('⚡ 注入高效肾上腺素：15秒内移速+40%、装弹+60%、射速+25%！');
  } else if(id === 'ammo_crate_item'){
    removeItemFromBackpack(id, 1);
    ownedWeapons.forEach(wi => {
      const w = WEAPONS[wi];
      if(w.id !== 'minigun'){
        const maxA = weaponMagSize(w);
        wAmmo[wi] = Math.min(maxA, (wAmmo[wi] || 0) + Math.ceil(maxA * 0.5));
      }
    });
    updateAmmoUI(); refreshWBar();
    try{ sndReload(); }catch(e){}
    spawnFloatText('📦 战术备弹补给(+50%)+高爆充能!', player.x+CHAR_W/2, player.y-25, '#ffd875');
    addBanner('📦 使用压缩弹药盒：已补充所有武器 50% 备弹，并赋予伤害加成！');
  } else if(id === 'hardened_cement'){
    removeItemFromBackpack(id, 1);
    homeHpMax = (window.homeHpMax || 100) + 30;
    homeHp = Math.min(homeHpMax, (homeHp || 100) + 50);
    wallHp = wallMaxHp || 100;
    updateHomeHpUI();
    try{ sndExplosion(); }catch(e){}
    spawnFloatText('🧱 城堡永久加固 +30 HP!', player.x+CHAR_W/2, player.y-25, '#c8a878');
    addBanner('🧱 快干特种水泥生效：城堡生命上限永久+30，前线围墙满血修复！');
  } else if(id === 'recipe_scroll'){
    removeItemFromBackpack(id, 1);
    unlockSecretRecipe();
  }
  renderBackpackUI();
}

function unlockSecretRecipe(){
  window._secretRecipeUnlocked = true;
  spawnFloatText('📜 绝密食谱已领悟!', player.x+CHAR_W/2, player.y-35, '#ffa033');
  addBanner('📜 绝密食谱领悟！全新名菜「霸王末日能量煲」已加入餐厅菜单！');
  try{ sndVictory(); }catch(e){}
}

function reinforceHomeStructure(){
  homeHpMax = (window.homeHpMax || 100) + 30;
  homeHp = Math.min(homeHpMax, (homeHp || 100) + 50);
  wallHp = wallMaxHp || 100;
  updateHomeHpUI();
}

function useCombatMedkit(){
  health = Math.min(maxHp, health + 50);
  updateHpUI();
}

function useAdrenalineShot(){
  window._vanguardBuffT = 900;
}

function useAmmoCrateItem(){
  ownedWeapons.forEach(wi => {
    const w = WEAPONS[wi];
    if(w.id !== 'minigun'){
      const maxA = weaponMagSize(w);
      wAmmo[wi] = Math.min(maxA, (wAmmo[wi] || 0) + Math.ceil(maxA * 0.5));
    }
  });
  updateAmmoUI(); refreshWBar();
}

function sortBackpack(){
  addBanner('🔄 行囊物品已按稀有度与用途自动整理');
  renderBackpackUI();
  try{ sndCoin(); }catch(e){}
}

function transferAllBackpack(){
  syncBackpackToGlobals();
  addBanner('📦 已将行囊内所有食材同步至餐厅厨房，建材同步至据点仓库！');
  renderBackpackUI();
  try{ sndCoin(); }catch(e){}
}

// ── 行囊被动效果查询接口 ──
function getBackpackTdDmgReduction(){
  return (backpackInventory.titanium_plate > 0) ? 0.15 : 0;
}
function getBackpackTurretBoost(){
  return (backpackInventory.turret_chip > 0) ? { range: 0.25, rate: 0.20 } : { range: 0, rate: 0 };
}
function getBackpackTowerCapBonus(){
  return (backpackInventory.tactical_blueprint > 0) ? 1 : 0;
}
function getBackpackMagnetBonus(){
  return (backpackInventory.magnetic_core > 0) ? 120 : 0;
}
function getBackpackDropRateBonus(){
  return (backpackInventory.lucky_clover > 0) ? 0.25 : 0;
}
function getBackpackCritBonus(){
  return (backpackInventory.lucky_clover > 0) ? 0.10 : 0;
}
function getBackpackDishPriceBonus(){
  return (backpackInventory.spice_wasteland > 0) ? 0.25 : 0;
}
function getBackpackVipTipBonus(){
  return (backpackInventory.vintage_wine > 0) ? 0.50 : 0;
}
function getBackpackEatSpeedBonus(){
  return (backpackInventory.secret_sauce > 0) ? 0.30 : 0;
}

// ═══════════════════════════════════════════

//  系统4: 城堡内部防御 — 城墙上的射击孔
