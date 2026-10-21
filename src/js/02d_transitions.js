// ═══════════════════════════════════════════════════════════════════
//  【安全门快速战术过渡】彻底杜绝任何黑屏卡死 Bug
// ═══════════════════════════════════════════════════════════════════
function playTacticalDoorTransition(onComplete){
  if(typeof resetInputAndInteractionState === 'function') resetInputAndInteractionState();
  // 1. 强制复位所有旧过渡层，防止任何残留遮罩锁屏
  const daveOv = document.getElementById('dave-transition');
  if(daveOv){
    daveOv.className = '';
    daveOv.style.opacity = '0';
    daveOv.style.pointerEvents = 'none';
    daveOv.style.display = 'none';
  }
  const transOv = document.getElementById('transition-overlay');
  if(transOv){
    transOv.className = '';
    transOv.style.opacity = '0';
    transOv.style.pointerEvents = 'none';
    transOv.style.display = 'none';
  }

  // 2. 战术快门过渡
  let wipe = document.getElementById('tactical-door-wipe');
  if(!wipe){
    wipe = document.createElement('div');
    wipe.id = 'tactical-door-wipe';
    wipe.style.cssText = 'position:fixed;inset:0;z-index:350;background:#06080d;pointer-events:none;opacity:0;transition:opacity 0.20s ease;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    wipe.innerHTML = `
      <div style="font-size:3.2rem;margin-bottom:8px;filter:drop-shadow(0 0 16px rgba(0,240,255,0.7));">🚪</div>
      <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:#f0f6fc;letter-spacing:4px;text-shadow:0 0 20px rgba(0,240,255,0.6);">安全门闭锁 · 撤入秘密小屋</div>
      <div style="font-size:0.8rem;color:#64748b;margin-top:4px;letter-spacing:2px;">DOOR SEALED · SAFE REFUGE ENTERED</div>
    `;
    document.body.appendChild(wipe);
  }

  wipe.style.display = 'flex';
  wipe.style.pointerEvents = 'auto';
  wipe.style.opacity = '1';

  setTimeout(()=>{
    try {
      if(onComplete) onComplete();
    } catch(err) {
      console.error('[playTacticalDoorTransition] callback error:', err);
    }
    // 场景切换后迅速淡出并彻底隐藏
    setTimeout(()=>{
      wipe.style.opacity = '0';
      wipe.style.pointerEvents = 'none';
      setTimeout(()=>{
        if(wipe){
          wipe.style.opacity = '0';
          wipe.style.display = 'none';
        }
      }, 220);
    }, 180);
  }, 220);
}

