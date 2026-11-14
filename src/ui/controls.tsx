// 触屏按键与键盘：左下元气骑士式浮动摇杆，右下主攻击键（按住开火 + 自动锁敌）+ 弧形战术键（跳/闪/可拖拽控抛物线手雷/技能）。
import { useRef } from 'preact/hooks';
import { audio } from '../app/audio';
import { game } from '../app/game';
import { CLASSES, WEAPONS, magSize } from '../content/data';
import { curWeapon, nearbyExterior, nearbyStation } from '../sim/sim';
import { Bar, Icon, Stars } from './parts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 左下角浮动摇杆：点进热区任意位置都能抓到摇杆，7% 极小死区 + 随指微漂防换向卡顿 */
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
      el.style.setProperty('--bx', '0px');
      el.style.setProperty('--by', '0px');
      el.style.setProperty('--x', '0');
      el.style.setProperty('--y', '0');
    }
    game.held.move = 0;
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
    let nx = clamp(dx / R, -1, 1), ny = clamp(dy / R, -1, 1);
    const mag = Math.hypot(nx, ny);
    const kx = mag > 1 ? nx / mag : nx;
    const ky = mag > 1 ? ny / mag : ny;
    el.classList.add('active');
    el.style.setProperty('--x', kx.toFixed(3));
    el.style.setProperty('--y', (ky * 0.55).toFixed(3));

    const ax = Math.abs(nx);
    const dead = 0.07;
    const move = ax < dead ? 0 : Math.sign(nx) * Math.min(1, 0.38 + ((ax - dead) / 0.72) * 0.62);
    game.held.move = move;
    if (move > 0) el.setAttribute('data-dir', 'right');
    else if (move < 0) el.setAttribute('data-dir', 'left');
    else el.removeAttribute('data-dir');
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

/** 可拖拽手榴弹轮盘键：按住拖动实时改变抛物线远近/高低弧度，松手投出（快点也能直接智能投向敌群） */
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
      <span>手雷</span>
      <b>{props.count}</b>
      <i class="nade-knob" />
    </button>
  );
}

/** 靠近室外大门时弹出的情景交互按钮（室内交互统一整合至底部 CampDock 高亮，不重复遮挡屏幕） */
export function InteractHint() {
  const run = game.run;
  if (run.inside && run.phase === 'camp') return null;
  let label = '';
  if (run.inside) {
    const st = nearbyStation(run);
    if (st === 'kitchen') label = '深夜食堂';
    else if (st === 'shop') label = '军火商店';
    else if (st === 'workshop') label = '防线工坊';
    else if (st === 'door') label = '走出木门';
  } else {
    const ext = nearbyExterior(run);
    if (ext === 'door' && run.phase === 'camp') label = '进入酒馆';
  }
  if (!label) return null;
  return (
    <button id="btn-interact" class="btn-act" onPointerDown={() => game.press('interact')}>{label}</button>
  );
}

/** 右下角元气骑士式弧形战术键区：大号主攻击键（按住自动锁敌开火，不按绝不乱打）+ 跳/闪/拖曳抛物线手雷/技能 */
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

/** 底部中间：当前武器、星级、弹药/加特林蓄热 + 独立换弹键 */
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

/** 营地夜晚底栏：可一边走动，靠近功能区时自动微光提示对应按钮，不弹窗不挡视野 */
export function CampDock() {
  const run = game.run;
  const near = run.inside ? nearbyStation(run) : null;
  const unserved = run.guests.filter((g) => !g.served).length;
  return (
    <div class="camp-dock" id="camp-dock">
      <button id="btn-kitchen" class={`camp-btn ${near === 'kitchen' ? 'near' : ''}`} onClick={() => game.open('kitchen')}>
        <Icon k="ic_kitchen" />深夜食堂{unserved > 0 ? `(${unserved}客)` : run.meat > 0 ? `(${run.meat}肉)` : ''}
      </button>
      <button id="btn-shop" class={`camp-btn ${near === 'shop' ? 'near' : ''}`} onClick={() => game.open('shop')}>
        <Icon k="ic_shop" />军火商店
      </button>
      <button id="btn-build" class={`camp-btn ${near === 'workshop' ? 'near' : ''}`} onClick={() => game.open('build')}>
        <Icon k="ic_anvil" />防线工坊
      </button>
      <button id="btn-inout" class={`camp-btn sub ${near === 'door' ? 'near' : ''}`} onClick={() => game.send({ t: run.inside ? 'exitHouse' : 'enterHouse' })}>
        {run.inside ? '出门看防线' : '回酒馆'}
      </button>
      <button id="btn-next" class="camp-btn primary" onClick={() => game.send({ t: 'nextDay' })}>
        迎战第 {run.day + 1} 天
      </button>
    </div>
  );
}

export function bindKeyboard() {
  const dirs = { left: false, right: false };
  const sync = () => { game.held.move = (dirs.right ? 1 : 0) - (dirs.left ? 1 : 0); };
  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { dirs.left = down; sync(); }
    else if (k === 'd' || k === 'arrowright') { dirs.right = down; sync(); }
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
  window.addEventListener('blur', () => { dirs.left = dirs.right = false; game.releaseAll(); });
}
