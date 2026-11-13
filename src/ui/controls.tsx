// 触屏按键与键盘：左下摇杆走位，右下主攻击键（按住/点击自动瞄准锁定最近敌人开火）与扇形战术键（跳跃、闪避、手雷、技能）。
import { useRef } from 'preact/hooks';
import { game } from '../app/game';
import { CLASSES, WEAPONS, magSize } from '../content/data';
import { curWeapon, nearbyExterior, nearbyStation } from '../sim/sim';
import { Bar, Icon, Stars } from './parts';

/** 左下角摇杆：控制左右走位（房内走动、室外跳跃登顶与闪避） */
export function Pad() {
  const ref = useRef<HTMLDivElement>(null);
  const set = (e: PointerEvent | null) => {
    const el = ref.current!;
    let x = 0, y = 0;
    if (e) {
      const r = el.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
    }
    el.style.setProperty('--x', String(x));
    el.style.setProperty('--y', String(y * 0.4));
    game.held.move = Math.abs(x) < 0.2 ? 0 : x > 0 ? 1 : -1;
  };
  return (
    <div class="pad" id="pad" ref={ref}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); set(e); }}
      onPointerMove={(e) => { if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) set(e); }}
      onPointerUp={() => set(null)} onPointerCancel={() => set(null)}>
      <i />
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

/** 靠近酒馆功能区或大门时弹出的情景交互按钮（上下房顶由玩家自己按跳跃键跳上阶梯） */
export function InteractHint() {
  const run = game.run;
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

/** 右下角主攻击键（按住/点击自动瞄准索敌开火）+ 扇形战术键（跳跃、闪避、手雷、职业大招） */
export function Keys() {
  const run = game.run, p = run.player, clsDef = CLASSES[run.cls];
  const w = curWeapon(run), def = WEAPONS[w.id];
  const cdTotal = clsDef.cd || 1;
  const cdLeft = run.skill.cd;
  const skillProgress = run.skill.t > 0 ? 1 : cdLeft > 0 ? 1 - cdLeft / cdTotal : 1;

  return (
    <div class="keys-fan">
      <FanKey id="key-fire" cls="fkey-fire" lit={game.held.fire || run.autoFire}
        onDown={() => { game.held.fire = true; }}
        onUp={() => { game.held.fire = false; }}>
        <Icon k={def.icon} />
        <span>攻击</span>
      </FanKey>
      <FanKey id="key-jump" cls="fkey-jump" onDown={() => game.press('jump')}>
        <span>跳跃</span>
      </FanKey>
      <FanKey id="key-dodge" cls="fkey-dodge" onDown={() => game.press('dodge')} cooling={p.dodgeCd > 0}>
        <span>{p.dodgeCd > 0 ? `${Math.ceil(p.dodgeCd / 60)}s` : '闪避'}</span>
      </FanKey>
      <FanKey id="key-grenade" cls="fkey-nade" empty={p.grenades <= 0} onDown={() => game.press('grenade')}>
        <Icon k="ic_grenade" />
        <span>手雷</span>
        <b>{p.grenades}</b>
      </FanKey>
      <FanKey id="key-skill" cls="fkey-skill" progress={skillProgress} cooling={cdLeft > 0 && run.skill.t === 0} lit={run.skill.t > 0} onDown={() => game.press('skill')}>
        <span>{run.skill.t > 0 ? `${Math.ceil(run.skill.t / 60)}s` : cdLeft > 0 ? `${Math.ceil(cdLeft / 60)}s` : clsDef.skill}</span>
      </FanKey>
    </div>
  );
}

/** 底部中间：当前武器、星级、弹药 + 独立换弹键 */
export function WeaponChip() {
  const run = game.run, w = curWeapon(run), def = WEAPONS[w.id];
  const reloading = run.player.reloadT > 0, mag = magSize(w.id, w.star);
  return (
    <div class="weapon-wrap">
      <button class="weapon" id="weapon-chip" onPointerDown={() => game.press('swap')}>
        <Icon k={def.icon} />
        <span class="col">
          <Stars n={w.star} />
          <Bar cls="ammo" v={reloading ? 1 - run.player.reloadT / def.reload : w.ammo / mag} />
        </span>
        <small>{reloading ? '换弹中' : `${w.ammo}/${mag}`}{run.player.weapons.length > 1 ? ` · 切枪(${run.player.cur + 1}/${run.player.weapons.length})` : ` · ${def.trait}`}</small>
      </button>
      <button id="key-reload" class={`btn-reload ${reloading ? 'cooling' : ''}`} onPointerDown={() => game.press('reload')}>换弹</button>
    </div>
  );
}

/** 营地夜晚底栏：可一边走动，一边直接点开深夜食堂/商店/工坊/出门或迎战下一天 */
export function CampDock() {
  const run = game.run;
  const unserved = run.guests.filter((g) => !g.served).length;
  return (
    <div class="camp-dock" id="camp-dock">
      <button id="btn-kitchen" class="camp-btn" onClick={() => game.open('kitchen')}>
        <Icon k="ic_kitchen" />深夜食堂{unserved > 0 ? `(${unserved}客)` : run.meat > 0 ? `(${run.meat}肉)` : ''}
      </button>
      <button id="btn-shop" class="camp-btn" onClick={() => game.open('shop')}>
        <Icon k="ic_shop" />军火商店
      </button>
      <button id="btn-build" class="camp-btn" onClick={() => game.open('build')}>
        <Icon k="ic_anvil" />防线工坊
      </button>
      <button id="btn-inout" class="camp-btn sub" onClick={() => game.send({ t: run.inside ? 'exitHouse' : 'enterHouse' })}>
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
      if (k === 'w' || k === 'arrowup' || k === ' ') game.press('jump');
      else if (k === 'k' || k === 'shift') game.press('dodge');
      else if (k === 'r') game.press('reload');
      else if (k === 'q') game.press('swap');
      else if (k === 'e') game.press('grenade');
      else if (k === 'u') game.press('skill');
      else if (k === 'f' || k === 'enter') game.press('interact');
      else if (k === 'escape') {
        const p = game.panel();
        if (p === null) game.open('pause');
        else if (p === 'pause' || p === 'shop' || p === 'build' || p === 'kitchen') game.close();
      }
    }
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));
  window.addEventListener('blur', () => { dirs.left = dirs.right = false; game.releaseAll(); });
}
