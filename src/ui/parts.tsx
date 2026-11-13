// 界面的基础零件。所有面板都用这几样拼，不各写各的。
import type { ComponentChildren } from 'preact';
import { assetUrl } from '../assets';
import { MAX_STAR } from '../content/data';

export const Icon = (p: { k: string; cls?: string }) => <img class={`icon ${p.cls ?? ''}`} src={assetUrl(p.k)} alt="" draggable={false} />;

export const Stars = (p: { n: number }) => (
  <span class="stars">{'★'.repeat(p.n)}<i>{'★'.repeat(MAX_STAR - p.n)}</i></span>
);

/** 进度条。比例通过 CSS 变量传进去，不写行内样式 */
export const Bar = (p: { v: number; cls?: string }) => (
  <span class={`bar ${p.cls ?? ''}`} ref={(el) => { el?.style.setProperty('--v', String(Math.max(0, Math.min(1, p.v)))); }}><b /></span>
);

export const Chip = (p: { icon?: string; children: ComponentChildren; id?: string; cls?: string }) => (
  <span class={`chip ${p.cls ?? ''}`} id={p.id}>{p.icon && <Icon k={p.icon} />}{p.children}</span>
);

/** 面板。head 是放在标题右边的东西（钱包、关闭按钮），内容再多也不会把关闭按钮挤出屏幕 */
export const Panel = (p: { id: string; title: string; sub?: string; cls?: string; head?: ComponentChildren; children: ComponentChildren }) => (
  <div class="veil">
    <section class={`panel ${p.cls ?? ''}`} id={p.id}>
      {(p.title || p.head) && <div class={`panel-head ${p.head ? 'split' : ''}`}><h2>{p.title}</h2>{p.head}</div>}
      {p.sub && <p>{p.sub}</p>}
      {p.children}
    </section>
  </div>
);

export const Btn = (p: { id?: string; kind?: 'primary' | 'danger' | 'small' | 'ghost'; disabled?: boolean; onClick: () => void; children: ComponentChildren }) => (
  <button id={p.id} class={`btn ${p.kind ?? ''}`} disabled={p.disabled} onClick={p.onClick}>{p.children}</button>
);
