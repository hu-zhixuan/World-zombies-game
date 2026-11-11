// 素材清单：键 -> 图片地址和帧信息。构建时图片会内嵌进那一个 HTML。
import manifest from './manifest.json';

const urls = import.meta.glob('./*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export interface Asset { key: string; url: string; fw: number; fh: number; frames: number }
export const ASSETS: Asset[] = Object.entries(manifest).map(([key, m]) => ({ key, url: urls[`./${key}.png`], ...m }));
export const assetUrl = (key: string) => urls[`./${key}.png`];
