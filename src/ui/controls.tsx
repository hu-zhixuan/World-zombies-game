// 触屏按键与键盘：左下元气骑士式浮动摇杆（支持下滑穿层），右下主攻击键 / 营地智能交互键。
import { useRef } from 'preact/hooks';
import { audio } from '../app/audio';
import { game } from '../app/game';
import { CLASSES, DRINKS, MAX_STAR, MEALS, RARITY_NAME, RYE_FALLBACK, WEAPONS, magSize, type MealId } from '../content/data';
import { ALLIES, QUALITY_META } from '../content/story';
import { MAX_CARRY, crateSalvageCoins, curWeapon, formatRecipeCost, nearbyCampTarget, nearbyStation, nearbyWeaponCrate, pourQuality } from '../sim/sim';
import { GROUND_Y } from '../sim/types';
import { getScene } from '../view/scene';
import { Bar, Icon } from './parts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 左下角浮动摇杆：点进热区任意位置都能抓到摇杆，7% 极小死区 + 下拉穿层下跳 */
export function Pad() {
  const padRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const restRef = useRef<{ x: number; y: number }>({ x: 74, y: 330 });

  const reset = () => {
    const el = padRef.current;
    originRef.current = null;
    if (el) {
      el.classList.remove('active');
      el.removeAttribute('data-dir');
      el.removeAttribute('data-down');
      el.style.setProperty('--bx', '0px');
      el.style.setProperty('--by', '0px');
      el.style.setProperty('--x', '0');
      el.style.setProperty('--y', '0');
    }
    game.held.move = 0;
    game.held.down = false;
  };

  const apply = (cx: number, cy: number, isDown: boolean) => {
    const el = padRef.current;
    if (!el) return;
    if (isDown || !originRef.current) {
      el.style.setProperty('--bx', '0px');
      el.style.setProperty('--by', '0px');
      const r = el.getBoundingClientRect();
      const restCX = r.left + r.width / 2, restCY = r.top + r.height / 2;
      restRef.current = { x: restCX, y: restCY };
      if (Math.hypot(cx - restCX, cy - restCY) <= r.width * 0.56) {
        originRef.current = { x: restCX, y: restCY };
      } else {
        const ox = clamp(cx, 60, Math.max(120, window.innerWidth * 0.34));
        const oy = clamp(cy, Math.max(140, window.innerHeight - 210), window.innerHeight - 62);
        originRef.current = { x: ox, y: oy };
        el.style.setProperty('--bx', `${Math.round(ox - restCX)}px`);
        el.style.setProperty('--by', `${Math.round(oy - restCY)}px`);
      }
    }

    const origin = originRef.current!;
    let dx = cx - origin.x, dy = cy - origin.y;
    const dist = Math.hypot(dx, dy);
    const leash = 54;
    if (!isDown && dist > leash) {
      const nextOX = clamp(cx - (dx / dist) * leash, 56, Math.max(130, window.innerWidth * 0.36));
      const nextOY = clamp(cy - (dy / dist) * leash, Math.max(140, window.innerHeight - 210), window.innerHeight - 58);
      originRef.current = { x: nextOX, y: nextOY };
      el.style.setProperty('--bx', `${Math.round(nextOX - restRef.current.x)}px`);
      el.style.setProperty('--by', `${Math.round(nextOY - restRef.current.y)}px`);
      dx = cx - nextOX; dy = cy - nextOY;
    }

    const R = 44;
    const nx = clamp(dx / R, -1, 1), ny = clamp(dy / R, -1, 1);
    const mag = Math.hypot(nx, ny);
    const kx = mag > 1 ? nx / mag : nx;
    const ky = mag > 1 ? ny / mag : ny;
    el.classList.add('active');
    el.style.setProperty('--x', kx.toFixed(3));
    el.style.setProperty('--y', (ky * 0.72).toFixed(3));

    const ax = Math.abs(nx);
    const dead = 0.07;
    const move = ax < dead ? 0 : Math.sign(nx) * Math.min(1, 0.38 + ((ax - dead) / 0.72) * 0.62);
    const downHeld = ny > 0.58 && ny > ax * 0.9;
    game.held.move = move;
    game.held.down = downHeld;
    if (move > 0) el.setAttribute('data-dir', 'right');
    else if (move < 0) el.setAttribute('data-dir', 'left');
    else el.removeAttribute('data-dir');
    if (downHeld) el.setAttribute('data-down', '1');
    else el.removeAttribute('data-down');
  };

  return (
    <div class="pad-zone" id="pad-zone"
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); apply(e.clientX, e.clientY, true); }}
      onPointerMove={(e) => { if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) apply(e.clientX, e.clientY, false); }}
      onPointerUp={reset} onPointerCancel={reset}>
      <div class="pad" id="pad" ref={padRef}><i /></div>
    </div>
  );
}

function FanKey(props: {
  id: string; cls: string; onDown: () => void; onUp?: () => void;
  cooling?: boolean; lit?: boolean; empty?: boolean; progress?: number; children: preact.ComponentChildren;
}) {
  const down = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    el.classList.add('down');
    props.onDown();
  };
  const up = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('down');
    props.onUp?.();
  };
  return (
    <button id={props.id}
      ref={(el) => { if (el && props.progress !== undefined) el.style.setProperty('--p', String(Math.max(0, Math.min(1, props.progress)))); }}
      class={`fkey ${props.cls} ${props.lit ? 'lit' : props.cooling ? 'cooling' : ''} ${props.empty ? 'empty' : ''}`}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
      {props.children}
    </button>
  );
}

/** 可拖拽爆炎弹轮盘键：按住拖动实时改变抛物线远近/高低弧度，松手投出（快点也能直接智能投向敌群） */
function GrenadeKey(props: { count: number }) {
  const centerRef = useRef<{ x: number; y: number } | null>(null);
  const lastCellRef = useRef('');

  const clearAim = (el: HTMLElement) => {
    centerRef.current = null;
    game.grenadeAim = null;
    el.classList.remove('aiming', 'down');
    el.style.setProperty('--gx', '0');
    el.style.setProperty('--gy', '0');
  };

  const down = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (props.count <= 0 || game.run.inside || game.run.phase !== 'fight') {
      audio.onEvent({ t: 'empty' });
      return;
    }
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    centerRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    game.grenadeAim = { dx: 0, dy: 0 };
    lastCellRef.current = '0,0';
    el.classList.add('aiming', 'down');
    audio.unlock();
  };

  const move = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!centerRef.current || !el.hasPointerCapture(e.pointerId)) return;
    const maxDrag = 54;
    const dx = clamp((e.clientX - centerRef.current.x) / maxDrag, -1, 1);
    const dy = clamp((e.clientY - centerRef.current.y) / maxDrag, -1, 1);
    const mag = Math.hypot(dx, dy);
    el.style.setProperty('--gx', (mag > 1 ? dx / mag : dx).toFixed(3));
    el.style.setProperty('--gy', (mag > 1 ? dy / mag : dy).toFixed(3));
    game.grenadeAim = { dx, dy };
    const cell = `${Math.round(dx * 4)},${Math.round(dy * 4)}`;
    if (cell !== lastCellRef.current) {
      lastCellRef.current = cell;
      audio.aimTick();
    }
  };

  const up = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!centerRef.current) return;
    const aim = game.grenadeAim ? { ...game.grenadeAim } : null;
    clearAim(el);
    game.press('grenade', aim);
  };

  const cancel = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (centerRef.current) clearAim(el);
  };

  return (
    <button id="key-grenade" class={`fkey fkey-nade ${props.count <= 0 ? 'empty' : ''}`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
      <Icon k="ic_grenade" />
      <span>爆炎弹</span>
      <b>{props.count}</b>
      <i class="nade-knob" />
    </button>
  );
}

/** 营地右下角：与战斗一致的圆弧握持键位（大号上下文互动键 #key-act + 跳跃键 #key-jump 在上 + 室内冲刺/闪避 #key-dodge 在下） */
export function CampKeys() {
  const run = game.run;
  const ct = nearbyCampTarget(run);
  let icon = run.inside ? 'ic_kitchen' : 'ic_rooftop';
  let label = '交互';
  let tip = '';

  const dishIcon = (id: MealId | 'rye', isRye?: boolean) => (isRye || id === 'rye' ? RYE_FALLBACK.icon : MEALS[id].icon);

  if (ct) {
    switch (ct.kind) {
      case 'grindMortar':
        icon = 'ic_mortar';
        label = ct.sauce <= 0 ? '急磨辣酱' : '磨辣酱';
        tip = `辛香辣酱 ${ct.sauce}/${ct.maxSauce}`;
        break;
      case 'pourFinish': {
        const q = pourQuality(run.pourMinigame!.fill, run.diner.upgrades.includes('fast_tap'));
        icon = DRINKS[ct.drink].icon;
        label = '止沫停杯';
        tip = `${DRINKS[ct.drink].name} · ${QUALITY_META[q].label}`;
        break;
      }
      case 'pourStart':
        icon = DRINKS[ct.drink].icon;
        label = `打${ct.drink === 'beer' ? '黑啤' : '热茶'}`;
        tip = ct.guest ? `${ct.guest.name} · ${DRINKS[ct.drink].name}` : DRINKS[ct.drink].name;
        break;
      case 'serveDrink':
        icon = DRINKS[run.carryingDrink!.drink].icon;
        label = `递酒·${ct.guest.name}`;
        tip = `${QUALITY_META[run.carryingDrink!.quality].label}·${ct.guest.dishName}`;
        break;
      case 'serveCarried':
        icon = dishIcon(run.carryingDish!.dish, run.carryingDish!.isRye);
        label = `上菜·${ct.guest.name}`;
        tip = `${QUALITY_META[run.carryingDish!.quality].label}·${ct.guest.dishName}`;
        break;
      case 'cleanTable':
        icon = 'ic_dirty_plate';
        label = '收拾桌面';
        tip = `清理空盘 (+${run.cls === 'chef' ? 4 : 3}金)`;
        break;
      case 'pickCounter':
        icon = dishIcon(ct.counterDish.dish, ct.counterDish.isRye);
        label = '端走热菜';
        tip = `传菜台 · ${ct.counterDish.dishName}`;
        break;
      case 'guestTalk':
        icon = ct.guest.orderKind === 'drink' && ct.guest.drink ? DRINKS[ct.guest.drink].icon : dishIcon(ct.guest.dish, ct.guest.isRye);
        label = '搭话';
        tip = ct.guest.served ? `${ct.guest.name}` : `${ct.guest.name} · ${ct.guest.dishName} (${ct.guest.isRye ? '应急' : formatRecipeCost(MEALS[ct.guest.dish].cost)})`;
        break;
      case 'allyTalk':
        icon = 'ic_star';
        label = '交谈';
        tip = `${ALLIES[ct.ally].name}`;
        break;
      case 'kitchen':
        icon = 'ic_kitchen';
        label = '酒馆';
        break;
      case 'pass':
        icon = 'ic_clean_plate';
        label = '传菜台';
        break;
      case 'drink':
        icon = 'ic_beer';
        label = '打酒';
        break;
      case 'shop':
        icon = 'ic_shop';
        label = '军械行商';
        break;
      case 'workshop':
        icon = 'ic_anvil';
        label = '防线工坊';
        break;
      case 'turretSlot': {
        const sl = run.turrets[ct.slot];
        icon = 'ic_anvil';
        label = sl?.type ? '改建炮塔' : '实地建塔';
        tip = sl?.type ? `Lv.${sl.level}` : '';
        break;
      }
      case 'wallSpot':
        icon = 'ic_wall';
        label = run.wall.hp < run.wall.maxHp ? '修墙' : '升级壁垒';
        tip = `防线 ${run.wall.hp}/${run.wall.maxHp}`;
        break;
      case 'fortSpot':
        icon = 'ic_fort';
        label = run.home.hp < run.home.maxHp ? '修大屋' : '加固要塞';
        tip = `大屋 ${run.home.hp}/${run.home.maxHp}`;
        break;
      case 'doorOut':
        icon = 'ic_wall';
        label = '出门巡防';
        break;
      case 'doorIn':
        icon = 'ic_kitchen';
        label = '回酒馆';
        break;
    }
  } else if (run.carryingDish) {
    const dest = run.guests.find((o) => o.id === run.carryingDish!.guestId);
    icon = dishIcon(run.carryingDish.dish, run.carryingDish.isRye);
    label = '端菜中';
    tip = `→ ${dest?.name ?? '餐桌'}`;
  } else if (run.carryingDrink) {
    const dest = run.guests.find((o) => o.id === run.carryingDrink!.guestId);
    icon = DRINKS[run.carryingDrink.drink].icon;
    label = '端饮中';
    tip = `→ ${dest?.name ?? '餐桌'}`;
  }

  const dodgeMax = run.inside && run.dinerShift.mode === 'open' ? 26 : 60;
  const dodgeCd = run.player.dodgeCd;
  const dodgeProgress = dodgeCd > 0 ? 1 - dodgeCd / dodgeMax : 1;

  return (
    <div class="keys-fan camp-fan">
      <div class={`camp-act-tip ${tip ? 'on' : 'idle'}`} id="camp-act-tip">{tip}</div>
      <FanKey id="key-act" cls="fkey-fire fkey-act" lit={!!ct} empty={!ct} onDown={() => game.press('interact')}>
        <Icon k={icon} />
        <span>{label}</span>
      </FanKey>
      {!run.inside && (
        <FanKey id="key-jump" cls="fkey-jump fkey-camp-jump" onDown={() => game.press('jump')}>
          <Icon k="ic_rooftop" />
          <span>跳跃</span>
        </FanKey>
      )}
      <FanKey id="key-dodge" cls="fkey-dodge fkey-camp-dodge" progress={dodgeProgress} cooling={dodgeCd > 0} onDown={() => game.press('dodge')}>
        <Icon k="ic_secondwind" />
        <span>{dodgeCd > 0 ? `${Math.ceil(dodgeCd / 60)}s` : (run.inside ? '冲刺' : '闪避')}</span>
      </FanKey>
    </div>
  );
}

/** 右下角元气骑士式弧形战术键区：大号主攻击键 + 闪避(下) / 跳跃(上) / 拖拽抛物线爆炎弹 / 技能 */
export function Keys() {
  const run = game.run, p = run.player, clsDef = CLASSES[run.cls];
  const w = curWeapon(run), def = WEAPONS[w.id];
  const cdTotal = clsDef.cd || 1;
  const cdLeft = run.skill.cd;
  const skillProgress = run.skill.t > 0 ? 1 : cdLeft > 0 ? 1 - cdLeft / cdTotal : 1;
  const dodgeProgress = p.dodgeCd > 0 ? 1 - p.dodgeCd / 60 : 1;

  return (
    <div class="keys-fan">
      <FanKey id="key-fire" cls="fkey-fire" lit={game.held.fire}
        onDown={() => {
          game.held.fire = true;
          game.press('fire');
          if (w.ammo <= 0 && p.reloadT === 0) game.press('reload');
          game.notify();
        }}
        onUp={() => { game.held.fire = false; game.notify(); }}>
        <Icon k={def.icon} />
        <span>攻击</span>
      </FanKey>
      <FanKey id="key-jump" cls="fkey-jump" onDown={() => game.press('jump')}>
        <Icon k="ic_rooftop" />
        <span>跳跃</span>
      </FanKey>
      <FanKey id="key-dodge" cls="fkey-dodge" progress={dodgeProgress} cooling={p.dodgeCd > 0} onDown={() => game.press('dodge')}>
        <Icon k="ic_secondwind" />
        <span>{p.dodgeCd > 0 ? `${Math.ceil(p.dodgeCd / 60)}s` : '闪避'}</span>
      </FanKey>
      <GrenadeKey count={p.grenades} />
      <FanKey id="key-skill" cls="fkey-skill" progress={skillProgress} cooling={cdLeft > 0 && run.skill.t === 0} lit={run.skill.t > 0} onDown={() => game.press('skill')}>
        <Icon k={clsDef.icon} />
        <span>{run.skill.t > 0 ? `${Math.ceil(run.skill.t / 60)}s` : cdLeft > 0 ? `${Math.ceil(cdLeft / 60)}s` : clsDef.skill}</span>
      </FanKey>
    </div>
  );
}

/** 地面未拾取武器名称飘标（白/绿/蓝/紫/橙/红按品质着色，随镜头精确贴合兵器上方且不拦截瞄准点击） */
export function GroundLootTags() {
  const run = game.run;
  if (run.inside) return null;
  const scene = getScene();
  if (!scene) return null;
  const drops = run.crates.filter((c) => c.kind !== 'supply' && (c.y ?? 0) >= -8);
  if (drops.length === 0) return null;

  return (
    <div class="loot-tags" id="ground-loot-tags">
      {drops.map((c) => {
        const def = WEAPONS[c.weapon];
        const pt = scene.worldToScreen(c.x, GROUND_Y - 38);
        const star = c.star ?? 1;
        return (
          <div key={c.id} class="loot-tag" data-rarity={def.rarity}
            ref={(el) => {
              if (!el) return;
              el.style.setProperty('--x', String(Math.round(pt.x)));
              el.style.setProperty('--y', String(Math.round(pt.y)));
            }}>
            <span class="rarity-dot" />
            <b>{def.name}</b>
            {star > 1 && <em>★{star}</em>}
          </div>
        );
      })}
    </div>
  );
}

/** 走近地面掉落兵器时的底部轻交互拾取条（绝不自动顶掉旧枪，点选「拾取 / 选择替换 / 拆金」） */
export function PickupBar() {
  const run = game.run, p = run.player;
  const wc = nearbyWeaponCrate(run);
  if (!wc) return null;
  const def = WEAPONS[wc.weapon];
  const owned = p.weapons.find((w) => w.id === wc.weapon);
  const fullBag = !owned && p.weapons.length >= MAX_CARRY;
  const canStarUp = !!owned && owned.star < MAX_STAR;
  const salvage = crateSalvageCoins(wc);
  const actLabel = owned
    ? (canStarUp ? `融合 ★${owned.star + 1}` : `满星折 ${salvage}金`)
    : fullBag
      ? '选择替换'
      : '拾取装备';

  return (
    <div class="pickup-bar" id="pickup-bar" data-rarity={def.rarity}>
      <Icon k={def.icon} />
      <div class="pickup-meta">
        <span class="pickup-top">
          <em class="rarity-pill" data-rarity={def.rarity}>{RARITY_NAME[def.rarity]}</em>
          <b>{def.name}{(wc.star ?? 1) > 1 ? ` ★${wc.star}` : ''}</b>
        </span>
        <small>{def.trait}</small>
      </div>
      <button id="btn-pickup-crate" class="btn small primary"
        onPointerDown={(e) => { e.stopPropagation(); game.openWeaponSwap(wc.id); }}>
        {actLabel}
      </button>
      <button id="btn-salvage-crate" class="btn small ghost"
        onPointerDown={(e) => { e.stopPropagation(); game.send({ t: 'salvageCrate', crateId: wc.id }); }}>
        拆 +{salvage}金
      </button>
    </div>
  );
}

/** 底部中间：元气骑士式并排双武器槽位（直接点选切换，品质光框发光着色 + 连珠火铳蓄热 + 独立换弹键） */
export function WeaponChip() {
  const run = game.run, p = run.player, curW = curWeapon(run);
  const reloading = p.reloadT > 0;
  return (
    <div class="weapon-wrap">
      <div class="weapon-dock" id="weapon-chip">
        {[0, 1].map((idx) => {
          const slot = p.weapons[idx];
          if (!slot) {
            return (
              <div key={idx} class="wslot empty" id={`weapon-slot-${idx}`}>
                <span class="wslot-num">{idx + 1}</span>
                <small class="wslot-empty-lbl">空副槽</small>
              </div>
            );
          }
          const def = WEAPONS[slot.id];
          const isCur = idx === p.cur;
          const mag = magSize(slot.id, slot.star);
          const slotReload = isCur && reloading;
          const isSmg = slot.id === 'smg';
          const hot = isCur && isSmg && p.smgHeat >= 0.65;
          return (
            <button
              key={idx}
              id={`weapon-slot-${idx}`}
              class={`wslot ${isCur ? 'cur' : 'sub'} ${slotReload ? 'reloading' : ''}`}
              data-rarity={def.rarity}
              data-hot={hot ? '1' : '0'}
              onPointerDown={() => {
                if (isCur && p.weapons.length > 1) return;
                game.send({ t: 'selectWeapon', index: idx });
              }}
            >
              <span class="wslot-top">
                <span class="wslot-num">{idx + 1}</span>
                <b class="wslot-name">{def.name}</b>
                <em class="wslot-star">{'★'.repeat(slot.star)}</em>
              </span>
              <span class="wslot-bot">
                <Icon k={def.icon} />
                <span class="wslot-info">
                  <Bar cls="ammo" v={slotReload ? 1 - p.reloadT / def.reload : slot.ammo / mag} />
                  {isCur && isSmg && (
                    <span class="bar heat" id="hud-smg-heat" ref={(el) => { el?.style.setProperty('--v', Math.max(0, Math.min(1, p.smgHeat)).toFixed(2)); }}><b /></span>
                  )}
                  <small>{slotReload ? '换弹' : `${slot.ammo}/${mag}`}{hot ? '·热' : ''}</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button id="key-reload" class={`btn-reload ${reloading ? 'cooling' : ''}`} data-rarity={WEAPONS[curW.id].rarity} onPointerDown={() => game.press('reload')}>换弹</button>
    </div>
  );
}

/** 营地夜晚极简底栏：仅保留「酒馆」与「迎战第 N 天」触发键（营业中自动隐藏，专心上菜） */
export function CampBar() {
  const run = game.run;
  if (run.inside && run.dinerShift.mode === 'open') return null;
  const near = run.inside ? nearbyStation(run) : null;
  const unserved = run.guests.filter((g) => !g.served).length;
  return (
    <div class="camp-bar" id="camp-bar">
      <button id="btn-kitchen" class={`camp-btn ${near === 'kitchen' ? 'near' : ''}`} onClick={() => game.open('kitchen')}>
        <Icon k="ic_kitchen" />{unserved > 0 ? `酒馆 · ${unserved}客` : '酒馆'}
      </button>
      {run.endless ? (
        <>
          <button id="btn-endless-night" class="camp-btn primary" onClick={() => game.send({ t: 'nextEndlessNight' })}>
            <Icon k="ic_flame" />入夜 · 第 {run.day + 1} 档
          </button>
          <button id="btn-next" class="camp-btn" onClick={() => game.send({ t: 'nextDay' })}>
            <Icon k="ic_rooftop" />外出猎材
          </button>
        </>
      ) : (
        <button id="btn-next" class="camp-btn primary" onClick={() => game.send({ t: 'nextDay' })}>
          <Icon k="ic_rooftop" />迎战第 {run.day + 1} 天
        </button>
      )}
    </div>
  );
}

export function bindKeyboard() {
  const dirs = { left: false, right: false, down: false };
  const sync = () => {
    game.held.move = (dirs.right ? 1 : 0) - (dirs.left ? 1 : 0);
    game.held.down = dirs.down;
  };
  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { dirs.left = down; sync(); }
    else if (k === 'd' || k === 'arrowright') { dirs.right = down; sync(); }
    else if (k === 's' || k === 'arrowdown') { dirs.down = down; sync(); }
    else if (k === 'j') { game.held.fire = down; }
    else if (down && !e.repeat) {
      const curPanel = game.panel();
      if (curPanel === 'story' && (k === ' ' || k === 'enter' || k === 'f')) { game.nextStory(); return; }
      if (k === 'w' || k === 'arrowup' || k === ' ') game.press('jump');
      else if (k === 'k' || k === 'shift') game.press('dodge');
      else if (k === 'r') game.press('reload');
      else if (k === 'q') game.press('swap');
      else if (k === '1') game.send({ t: 'selectWeapon', index: 0 });
      else if (k === '2') game.send({ t: 'selectWeapon', index: 1 });
      else if (k === 'e') game.press('grenade');
      else if (k === 'u') game.press('skill');
      else if (k === 'f' || k === 'enter') game.press('interact');
      else if (k === 'escape') {
        if (curPanel === null) game.open('pause');
        else if (curPanel === 'pause' || curPanel === 'shop' || curPanel === 'build' || curPanel === 'kitchen' || curPanel === 'lore' || curPanel === 'weaponSwap') game.close();
      }
    }
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));
  window.addEventListener('blur', () => { dirs.left = dirs.right = dirs.down = false; game.releaseAll(); });
}
