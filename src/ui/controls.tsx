// 触屏按键和键盘。只负责把「按了什么」告诉游戏，不直接改状态。
import { useRef } from 'preact/hooks';
import { game } from '../app/game';
import { CLASSES, WEAPONS, magSize } from '../content/data';
import { curWeapon } from '../sim/sim';
import { Bar, Icon, Stars } from './parts';

/** 左下角摇杆：只管左右移动 */
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
    el.style.setProperty('--x', String(x)); el.style.setProperty('--y', String(y * 0.4));
    game.held.move = Math.abs(x) < 0.22 ? 0 : x > 0 ? 1 : -1;
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

function Key(props: { id: string; cls?: string; label?: string; onDown: () => void; onUp?: () => void; cooling?: boolean; lit?: boolean; children?: preact.ComponentChildren }) {
  const down = (e: PointerEvent) => { const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId); el.classList.add('down'); props.onDown(); };
  const up = (e: PointerEvent) => { (e.currentTarget as HTMLElement).classList.remove('down'); props.onUp?.(); };
  return (
    <button id={props.id} class={`key ${props.cls ?? ''} ${props.lit ? 'lit' : props.cooling ? 'cooling' : ''}`} onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
      {props.children ?? props.label}
    </button>
  );
}

/** 右下角按键：开火按住就连发，瞄准全自动——不需要拖，也不会误触成别的方向 */
export function Keys() {
  const run = game.run, w = curWeapon(run);
  return (
    <div class="keys">
      <Key id="key-reload" cls="small" label="换弹" onDown={() => game.press('reload')} cooling={run.player.reloadT > 0} />
      <Key id="key-skill" label={CLASSES[run.cls].skill.slice(0, 1)} onDown={() => game.press('skill')} cooling={run.skill.cd > 0} lit={run.skill.t > 0} />
      <Key id="key-jump" label="跳" onDown={() => game.press('jump')} />
      <Key id="key-dodge" label="闪" onDown={() => game.press('dodge')} cooling={run.player.dodgeCd > 0} />
      <Key id="key-fire" cls="fire" onDown={() => { game.held.fire = true; }} onUp={() => { game.held.fire = false; }}>
        <Icon k={WEAPONS[w.id].icon} />
      </Key>
    </div>
  );
}

/** 底部中间：当前武器、星级、弹药。点一下换枪 */
export function WeaponChip() {
  const run = game.run, w = curWeapon(run), def = WEAPONS[w.id];
  const reloading = run.player.reloadT > 0, mag = magSize(w.id, w.star);
  return (
    <button class="weapon" id="weapon-chip" onPointerDown={() => game.press('swap')}>
      <Icon k={def.icon} />
      <span class="col">
        <Stars n={w.star} />
        <Bar cls="ammo" v={reloading ? 1 - run.player.reloadT / def.reload : w.ammo / mag} />
      </span>
      <small>{reloading ? '换弹中' : `${w.ammo}/${mag}`}{run.player.weapons.length > 1 ? ' · 点击换枪' : ''}</small>
    </button>
  );
}

export function bindKeyboard() {
  const dirs = { left: false, right: false };
  const sync = () => { game.held.move = (dirs.right ? 1 : 0) - (dirs.left ? 1 : 0); };
  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { dirs.left = down; sync(); }
    else if (k === 'd' || k === 'arrowright') { dirs.right = down; sync(); }
    else if (k === 'j' || k === ' ') game.held.fire = down;
    else if (down && !e.repeat) {
      if (k === 'w' || k === 'arrowup') game.press('jump');
      else if (k === 'k' || k === 'shift') game.press('dodge');
      else if (k === 'r') game.press('reload');
      else if (k === 'q') game.press('swap');
      else if (k === 'escape') { if (game.panel() === null) game.open('pause'); else if (game.panel() === 'pause' || game.panel() === 'workshop') game.close(); }
    }
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));
  window.addEventListener('blur', () => { dirs.left = dirs.right = false; game.releaseAll(); });
}
