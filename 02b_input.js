// ═══════════════════════════════════════════

//  【白天模块 A3】INPUT（键盘/鼠标/触摸输入）
// ═══════════════════════════════════════════
function handleInteractAction() {
  // ── v51模块二：开箱对比卡——E收下/Q保留（最优先）──
  if(typeof unboxActive !== 'undefined' && unboxActive){
    closeUnboxCard(true);
    return;
  }
  // Hub世界：站点交互优先于NPC闲聊，防止游走NPC遮挡站点交互
  if (gameState === 'hub') {
    if (typeof hubInteractCooldown !== 'undefined' && Date.now() < hubInteractCooldown) {
      return;
    }
    const st = getNearbyHubStation();
    if (st) {
      triggerHubInteraction();
      return;
    }
    if (typeof tryHubNpcTalk === 'function' && tryHubNpcTalk()) return;
    return;
  }
  // ── v49批3：救援倒地伙伴（战斗世界最优先）──
  if (gameState === 'world' && rescueNearestCompanion()) return;
  // 优先：附近有武器宝箱 → E 拾取（任何阶段都可以拾取武器）
  if (gameState !== 'building') {
    if (tryPickupWeaponCrate()) return;
  }
  // ── 尸潮来袭迫退/波次清场进入机制：走到小屋门前入屋 ──
  if (gameState === 'world' && !cinActive) {
    if (isPlayerNearCabin()) {
      if (wavePhase === 'cleared') {
        // 波次已清场：直接推门进入秘密小屋据点，即按即入！
        enterCabinShelter();
        return;
      }
      if (isHordeThreatActive()) {
        startCabinHold();
        return;
      }
    } else if (isHordeThreatActive() || wavePhase === 'cleared') {
      addBanner('🏃 距离小屋太远！快向左撤回据点小屋门前！');
      return;
    }
  }
  if (gameState === 'world' && !cinActive) {
    const px = player.x + CHAR_W/2;
    if(player.y <= PLATFORM_TOP + 14){
      const bases = (typeof FORTRESS_BASE_SLOTS !== 'undefined') ? FORTRESS_BASE_SLOTS : [170, 310, 450, 590];
      const nearSlot = bases.find(bx => Math.abs(px - bx) < 38);
      if(nearSlot && !towers.some(t => Math.abs(t.x - nearSlot) < 25)){
        openManageUI();
        return;
      }
    }
  }
  if (gameState === 'building') {
    triggerInteriorInteraction();
  } else {
    const nearB = getNearbyBuilding();
    if (nearB) {
      if (nearB.id === 'cabin') {
        if (wavePhase === 'cleared') {
          enterCabinShelter();
        } else if (isHordeThreatActive()) {
          startCabinHold();
        } else {
          addBanner('🔒 波次战斗进行中，小屋门锁着！清完这波或等尸潮来袭时再进');
        }
        return;
      }
      enterBuilding(nearB);
    } else {
      toggleVehicle();
    }
  }
}

