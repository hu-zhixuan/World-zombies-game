// 飘字（伤害数字、金币）。用网页元素而不是往画布里写字，放大后才清楚。
import { getScene } from '../view/scene';

const MAX = 28;
export const floaters = {
  add(worldX: number, worldY: number, text: string, kind: 'dmg' | 'coin' | 'hurt' | 'burn' | 'crit') {
    const layer = document.getElementById('floaters'), scene = getScene();
    if (!layer || !scene) return;
    if (layer.childElementCount >= MAX) layer.firstElementChild!.remove();
    const p = scene.worldToScreen(worldX + (Math.random() - 0.5) * 10, worldY);
    const el = document.createElement('span');
    el.className = 'fl ' + kind; el.textContent = text;
    el.style.setProperty('--x', String(Math.round(p.x))); el.style.setProperty('--y', String(Math.round(p.y)));
    el.addEventListener('animationend', () => el.remove());
    layer.appendChild(el);
  },
};
