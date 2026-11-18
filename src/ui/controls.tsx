// 触屏按键与键盘：左下元气骑士式浮动摇杆（支持下滑穿层），右下主攻击键 / 营地智能交互键。
import { useRef } from 'preact/hooks';
import { audio } from '../app/audio';
import { game } from '../app/game';
import { CLASSES, DRINKS, MEALS, WEAPONS, magSize } from '../content/data';
import { ALLIES, QUALITY_META } from '../content/story';
import { curWeapon, nearbyCampTarget, nearbyStation, pourQuality } from '../sim/sim';
import { Bar, Icon, Stars } from './parts';

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

  if (ct) {
    switch (ct.kind) {
      case 'cookFinish':
        icon = MEALS[ct.guest.dish].icon;
        label = '火候出锅';
        tip = `${ct.guest.dishName} → ${ct.guest.name}`;
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
      case 'cookStart':
        icon = MEALS[ct.guest.dish].icon;
        label = '开灶烹制';
        tip = `${ct.guest.name} · ${ct.guest.dishName} (${ct.guest.meatCost}肉)`;
        break;
      case 'serveDrink':
        icon = DRINKS[run.carryingDrink!.drink].icon;
        label = `递酒·${ct.guest.name}`;
        tip = `${QUALITY_META[run.carryingDrink!.quality].label}·${ct.guest.dishName}`;
        break;
      case 'serveCarried':
        icon = MEALS[ct.guest.dish].icon;
        label = `上菜·${ct.guest.name}`;
        tip = `${QUALITY_META[run.carryingDish!.quality].label}·${ct.guest.dishName}`;
        break;
      case 'cleanTable':
        icon = 'ic_dirty_plate';
        label = '收拾桌面';
        tip = `清理空盘 (+${run.cls === 'chef' ? 4 : 3}金)`;
        break;
      case 'pickCounter':
        icon = MEALS[ct.counterDish.dish].icon;
        label = '端走热菜';
        tip = `传菜台 · ${ct.counterDish.dishName}`;
        break;
      case 'guestTalk':
        icon = ct.guest.orderKind === 'drink' && ct.guest.drink ? DRINKS[ct.guest.drink].icon : MEALS[ct.guest.dish].icon;
        label = '搭话';
        tip = ct.guest.served ? `${ct.guest.name}` : `${ct.guest.name} · 等「${ct.guest.dishName}」`;
        break;
      case 'allyTalk':
        icon = 'ic_star';
        label = '交谈';
        tip = `${ALLIES[ct.ally].name}`;
        break;
      case 'kitchen':
        icon = 'ic_kitchen';
        label = '食堂总览';
        tip = '食堂';
        break;
      case 'pass':
        icon = 'ic_clean_plate';
        label = '传菜台';
        tip = `传菜台 (${run.dinerShift.counterDishes.length})`;
        break;
      case 'drink':
        icon = 'ic_beer';
        label = '打酒泡茶';
        tip = '酒桶：麦芽黑啤';
        break;
      case 'shop':
        icon = 'ic_shop';
        label = '军械行商';
        tip = '行商';
        break;
      case 'workshop':
        icon = 'ic_anvil';
        label = '防线工坊';
        tip = '工坊';
        break;
      case 'doorOut':
        icon = 'ic_wall';
        label = '出门看墙';
        tip = '出门';
        break;
      case 'doorIn':
        icon = 'ic_kitchen';
        label = '回酒馆';
        tip = '入堂';
        break;
    }
  } else if (run.carryingDish) {
    const dest = run.guests.find((o) => o.id === run.carryingDish!.guestId);
    icon = MEALS[run.carryingDish.dish].icon;
    label = '端菜中';
    tip = `送往 ${dest?.name ?? '餐桌'}`;
  } else if (run.carryingDrink) {
    const dest = run.guests.find((o) => o.id === run.carryingDrink!.guestId);
    icon = DRINKS[run.carryingDrink.drink].icon;
    label = '端饮中';
    tip = `送往 ${dest?.name ?? '餐桌'}`;
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
      <FanKey id="key-jump" cls="fkey-jump fkey-camp-jump" onDown={() => game.press('jump')}>
        <Icon k="ic_rooftop" />
        <span>跳跃</span>
      </FanKey>
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

/** 底部中间：当前武器、星级、弹药/连珠火铳蓄热 + 独立换弹键 */
export function WeaponChip() {
  const run = game.run, p = run.player, w = curWeapon(run), def = WEAPONS[w.id];
  const reloading = p.reloadT > 0, mag = magSize(w.id, w.star);
  const isSmg = w.id === 'smg', hot = isSmg && p.smgHeat >= 0.65;
  return (
    <div class="weapon-wrap">
      <button class={`weapon ${reloading ? 'reloading' : ''}`} data-hot={hot ? '1' : '0'} id="weapon-chip" onPointerDown={() => game.press('swap')}>
        <Icon k={def.icon} />
        <span class="col">
          <Stars n={w.star} />
          <Bar cls="ammo" v={reloading ? 1 - p.reloadT / def.reload : w.ammo / mag} />
          {isSmg && (
            <span class="bar heat" id="hud-smg-heat" ref={(el) => { el?.style.setProperty('--v', Math.max(0, Math.min(1, p.smgHeat)).toFixed(2)); }}><b /></span>
          )}
        </span>
        <small>{reloading ? '换弹中' : `${w.ammo}/${mag}`}{hot ? ' · 高热' : p.weapons.length > 1 ? ` · 切(${p.cur + 1}/${p.weapons.length})` : ` · ${def.trait}`}</small>
      </button>
      <button id="key-reload" class={`btn-reload ${reloading ? 'cooling' : ''}`} onPointerDown={() => game.press('reload')}>换弹</button>
    </div>
  );
}

/** 营地夜晚极简底栏：仅保留「食堂/特餐」总览与「迎战第 N 天」触发键，其余全部走近用右下互动键交互 */
export function CampBar() {
  const run = game.run;
  const near = run.inside ? nearbyStation(run) : null;
  const unserved = run.guests.filter((g) => !g.served).length;
  const sub = run.dinerShift.mode === 'open'
    ? '营业中'
    : run.meal
      ? '特餐已备'
      : unserved > 0
        ? `${unserved}客`
        : '总览';
  return (
    <div class="camp-bar" id="camp-bar">
      <button id="btn-kitchen" class={`camp-btn ${near === 'kitchen' ? 'near' : ''}`} onClick={() => game.open('kitchen')}>
        <Icon k="ic_kitchen" />食堂 · {sub}
      </button>
      <button id="btn-next" class="camp-btn primary" onClick={() => game.send({ t: 'nextDay' })}>
        <Icon k="ic_rooftop" />迎战第 {run.day + 1} 天
      </button>
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
      else if (k === 'e') game.press('grenade');
      else if (k === 'u') game.press('skill');
      else if (k === 'f' || k === 'enter') game.press('interact');
      else if (k === 'escape') {
        if (curPanel === null) game.open('pause');
        else if (curPanel === 'pause' || curPanel === 'shop' || curPanel === 'build' || curPanel === 'kitchen' || curPanel === 'lore') game.close();
      }
    }
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));
  window.addEventListener('blur', () => { dirs.left = dirs.right = dirs.down = false; game.releaseAll(); });
}
