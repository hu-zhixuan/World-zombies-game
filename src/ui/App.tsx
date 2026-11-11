import { useEffect, useReducer, useState } from 'preact/hooks';
import { game } from '../app/game';
import { DAY_HEAL, LAST_DAY, MAX_STAR, RARITY_NAME, STAR_COST, STAR_PERKS, TURRET, WALL_REPAIR_COST, WEAPONS, newZombieOn, nextUnlock, perkDef } from '../content/data';
import { dayRemaining } from '../sim/sim';
import type { GameEvent } from '../sim/types';
import { Keys, Pad, WeaponChip } from './controls';
import { Bar, Btn, Chip, Icon, Panel, Stars } from './parts';

function Hud() {
  const run = game.run, p = run.player;
  return (
    <header class="hud">
      <div class="hud-left">
        <Chip icon="ic_hp" id="hud-hp"><Bar v={p.hp / p.maxHp} />{Math.ceil(p.hp)}</Chip>
        <Chip icon="ic_wall" id="hud-wall"><Bar cls="wall" v={run.wall.hp / run.wall.maxHp} />路障</Chip>
        {run.perks.length > 0 && <div class="perks" id="hud-perks">{run.perks.map((id) => <Icon key={id} k={perkDef(id).icon} />)}</div>}
      </div>
      <div class="hud-mid">
        <Chip id="hud-day">第 {run.day} 天</Chip>
        <Chip icon="ic_zombie" id="hud-left">{run.phase === 'clear' ? '清场！' : `还剩 ${dayRemaining(run)}`}</Chip>
      </div>
      <div class="hud-right">
        <Chip icon="ic_coin" id="hud-coins">{run.coins}</Chip>
        <Chip icon="ic_scrap" id="hud-scrap">{run.scrap}</Chip>
        <button class="btn-icon" id="btn-pause" onClick={() => game.open('pause')}>暂停</button>
      </div>
    </header>
  );
}

/** 局外成长：星星和下一个解锁。死了也有收获 */
function Progress(p: { gain?: number }) {
  const stars = game.meta.stars, next = nextUnlock(stars);
  return (
    <div class="note" id="meta-progress">
      <Icon k="ic_star" />{p.gain !== undefined && <>这一局 <b>+{p.gain}</b> · </>}星星 <b>{stars}</b>
      {next ? <> · 再攒 <b>{next.stars - stars}</b> 颗解锁「{WEAPONS[next.weapon].name}」</> : <> · 武器已全部解锁</>}
    </div>
  );
}

const Purse = () => <div class="purse"><Chip icon="ic_coin">{game.run.coins}</Chip><Chip icon="ic_scrap">{game.run.scrap}</Chip></div>;

function PerkPanel() {
  const run = game.run;
  return (
    <Panel id="panel-perk" title={`第 ${run.day} 天清场`} sub="选一个天赋，带到明天">
      <div class="row">
        {run.perkChoices.map((id) => {
          const perk = perkDef(id);
          return (
            <button class="card" key={id} data-perk={id} data-rarity={perk.rarity} onClick={() => game.send({ t: 'pickPerk', id })}>
              <Icon k={perk.icon} cls="x3" /><strong>{perk.name}</strong><em>{RARITY_NAME[perk.rarity]}</em><span>{perk.desc}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function CampPanel() {
  const run = game.run, p = run.player, fresh = newZombieOn(run.day + 1);
  const rested = Math.min(p.maxHp, Math.round(p.hp + p.maxHp * DAY_HEAL));
  return (
    <Panel id="panel-camp" title="营地" sub={`明天是第 ${run.day + 1} 天${fresh ? ` · 新僵尸：${fresh.name}` : ''}`}>
      <div class="note"><Icon k="ic_hp" />休息一晚：{Math.ceil(p.hp)} → <b>{rested}</b> / {p.maxHp}</div>
      <Purse />
      <div class="row">
        <Btn id="btn-workshop" onClick={() => game.open('workshop')}>工坊</Btn>
        <Btn id="btn-next" kind="primary" onClick={() => game.send({ t: 'nextDay' })}>出发</Btn>
      </div>
    </Panel>
  );
}

function WorkshopPanel() {
  const run = game.run, t = run.turret;
  const turretMax = t.level >= TURRET.levels.length;
  return (
    <Panel id="panel-workshop" cls="wide" title="工坊" head={<><Purse /><Btn id="btn-close" kind="primary" onClick={() => game.close()}>好了</Btn></>}>
      <div class="list grid2">
        {run.player.weapons.map((w) => {
          const def = WEAPONS[w.id], max = w.star >= MAX_STAR, cost = STAR_COST[w.star];
          return (
            <div class="item" key={w.id}>
              <Icon k={def.icon} cls="gun" />
              <span class="grow"><b>{def.name}</b><Stars n={w.star} /><small>{Object.entries(STAR_PERKS).map(([n, t]) => `★${n} ${t}`).join(' · ')}</small></span>
              <Btn kind="small" id={`btn-star-${w.id}`} disabled={max || run.coins < cost} onClick={() => game.send({ t: 'buyStar', weapon: w.id })}>
                {max ? '已满星' : <>升星 <Icon k="ic_coin" />{cost}</>}
              </Btn>
            </div>
          );
        })}
        <div class="item">
          <Icon k="ic_turret" cls="x2" />
          <span class="grow"><b>{TURRET.name}</b><small>{t.level} 级</small></span>
          <Btn kind="small" id="btn-turret" disabled={turretMax || run.scrap < TURRET.upgradeScrap[t.level]} onClick={() => game.send({ t: 'upgradeTurret' })}>
            {turretMax ? '已满级' : <>升级 <Icon k="ic_scrap" />{TURRET.upgradeScrap[t.level]}</>}
          </Btn>
        </div>
        <div class="item">
          <Icon k="ic_wall" cls="x2" />
          <span class="grow"><b>路障</b><small>{run.wall.hp}/{run.wall.maxHp}</small></span>
          <Btn kind="small" id="btn-repair" disabled={run.wall.hp >= run.wall.maxHp || run.coins < WALL_REPAIR_COST} onClick={() => game.send({ t: 'repairWall' })}>
            修好 <Icon k="ic_coin" />{WALL_REPAIR_COST}
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

function Toasts() {
  const [items, setItems] = useState<{ id: number; text: string; big?: boolean }[]>([]);
  const [hurt, setHurt] = useState(0);
  useEffect(() => game.onEvent((e: GameEvent) => {
    let text = '', big = false;
    if (e.t === 'dayStart') { text = `第 ${e.day} 天 · 僵尸从右边来`; big = true; }
    else if (e.t === 'dayClear') text = game.run.crates.length ? '清场！去把地上的箱子捡了' : '清场！';
    else if (e.t === 'pickup' && e.isNew) { text = `新武器：${WEAPONS[e.weapon].name}`; big = true; }
    else if (e.t === 'star') { text = `${WEAPONS[e.weapon].name} 升到 ${'★'.repeat(e.star)}${STAR_PERKS[e.star] ? ' · ' + STAR_PERKS[e.star] : ''}`; big = true; }
    else if (e.t === 'hurt') setHurt((n) => n + 1);
    if (!text) return;
    const id = Math.random();
    setItems((list) => [...list.slice(-2), { id, text, big }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2400);
  }), []);
  return (
    <>
      {hurt > 0 && <div class="hurt-flash" key={hurt} />}
      <div class="toasts">{items.map((t) => <div class={`toast ${t.big ? 'big' : ''}`} key={t.id}>{t.text}</div>)}</div>
    </>
  );
}

export function App() {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => game.subscribe(() => redraw(0)), []);
  const panel = game.panel(), run = game.run;
  return (
    <>
      {panel !== 'title' && <Hud />}
      {panel === null && <><Pad /><WeaponChip /><Keys /></>}
      <Toasts />
      {panel === 'title' && (
        <Panel id="panel-title" cls="title" title="">
          <h1>十五波围城</h1>
          <p>黄昏了，僵尸要来了。守住路障，活过每一天。（试玩版 · 前 {LAST_DAY} 天）</p>
          <Progress />
          <Btn id="btn-start" kind="primary" onClick={() => game.restart()}>开始</Btn>
        </Panel>
      )}
      {panel === 'perk' && <PerkPanel />}
      {panel === 'camp' && <CampPanel />}
      {panel === 'workshop' && <WorkshopPanel />}
      {panel === 'pause' && (
        <Panel id="panel-pause" title="暂停">
          <div class="row">
            <Btn id="btn-resume" kind="primary" onClick={() => game.close()}>继续</Btn>
            <Btn id="btn-restart" kind="danger" onClick={() => game.restart()}>重新开始</Btn>
          </div>
        </Panel>
      )}
      {panel === 'dead' && (
        <Panel id="panel-dead" title="据点失守" sub={`撑到了第 ${run.day} 天，击杀 ${run.kills} 只`}>
          <Progress gain={game.lastGain} />
          <Btn id="btn-again" kind="primary" onClick={() => game.restart()}>再来一局</Btn>
        </Panel>
      )}
      {panel === 'won' && (
        <Panel id="panel-won" title="守住了！" sub={`试玩版到此为止。${LAST_DAY} 天里击杀 ${run.kills} 只。`}>
          <Progress gain={game.lastGain} />
          <Btn id="btn-again" kind="primary" onClick={() => game.restart()}>再来一局</Btn>
        </Panel>
      )}
    </>
  );
}
