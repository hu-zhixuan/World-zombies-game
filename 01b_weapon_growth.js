// ═══════════════════════════════════════════
//  武器成长（v56 精简）
//  旧的「武器升级 → Lv3 特性 → 双分支进化」系统自 v53 起已失效
//  （WEAPON_MAX_LV=1、weaponNeed=999999，进化队列永不入队），v56 已整体移除。
//  现存活跃的进化路径只有战术工坊的「超进化」(SUPER_WEAPON_EVOLUTIONS)，
//  它与存档仍通过 weaponLevels 记录 {isSuperEvolved, evoName, ...}。
// ═══════════════════════════════════════════
let weaponLevels = {};
function ensureWeaponLevel(id){
  if(!weaponLevels[id]) weaponLevels[id] = {lv:1, xp:0, waveKills:0};
  return weaponLevels[id];
}

// 弹匣容量 = 基础 ×(1+弹药升级50%/点) ×(1+扩容弹鼓50%/层) ×(1+改造台25%/级)
function weaponMagSize(w){
  let base = Math.floor(w.maxAmmo * (1 + upgrades.ammo * 0.5));
  // v52肉鸽·武器线：扩容弹鼓 +50%/层
  if(playerPerks.bigmag) base = Math.floor(base * (1 + playerPerks.bigmag*0.5));
  // ── 小胡武器改造台：弹夹扩容改装 (+25%/级) ──
  if(typeof getWeaponMod === 'function'){
    const mMod = getWeaponMod(w.id, 'mag');
    if(mMod > 0) base = Math.floor(base * (1 + mMod * 0.25));
  }
  return base;
}

