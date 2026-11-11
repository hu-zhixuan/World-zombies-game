#!/usr/bin/env python3
"""把选用的开源素材整理成游戏用的图（src/assets/）。只在换素材时手动跑，CI 不跑。

用法：python3 tools/assets/prepare.py [缓存目录]   （需要 Pillow；缓存目录默认 .asset_cache/）
来源全部是 OpenGameArt 上的公开素材包，出处和许可见 assets/CREDITS.md。
这个脚本只做裁切和拼条，不改像素。
"""
import io, json, os, re, sys, urllib.request, zipfile
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.asset_cache')
OUT = os.path.join(ROOT, 'src', 'assets')
PACKS = {  # 缓存子目录 -> OpenGameArt 页面
    'gotthicvania-swamp': 'gotthicvania-swamp',
    'cemetery': 'gothicvania-cemetery-pack',
    'gothicvania-town': 'gothicvania-town',
    'warped-city': 'warped-city',
    'kenneyui': 'ui-pack-pixel-adventure',
    'kyrise': 'kyrises-free-16x16-rpg-icon-pack',
    'guns': 'tiny-gun-icons-16x16',
}

def fetch(pack, slug):
    d = os.path.join(CACHE, pack)
    if os.path.isdir(d) and os.listdir(d): return
    page = urllib.request.urlopen('https://opengameart.org/content/' + slug, timeout=60).read().decode('utf8', 'ignore')
    zips = re.findall(r'https://opengameart.org/sites/default/files/[^"]+\.zip', page)
    print('download', zips[-1] if pack == 'kyrise' else zips[0])
    data = urllib.request.urlopen(zips[0], timeout=300).read()
    os.makedirs(d, exist_ok=True)
    zipfile.ZipFile(io.BytesIO(data)).extractall(d)

def find(pack, *parts):
    """在包里按路径片段找文件，不依赖压缩包顶层目录名。"""
    hits = []
    for base, _, files in os.walk(os.path.join(CACHE, pack)):
        if '__MACOSX' in base: continue
        for f in files:
            p = os.path.join(base, f)
            if p.replace('\\', '/').endswith('/'.join(parts)): hits.append(p)
    if not hits: raise SystemExit('missing ' + pack + ': ' + '/'.join(parts))
    return sorted(hits)[0]

def img(pack, *parts): return Image.open(find(pack, *parts)).convert('RGBA')

manifest = {}
def save(key, im, frames=1):
    im.save(os.path.join(OUT, key + '.png'), optimize=True)
    manifest[key] = {'fw': im.width // frames, 'fh': im.height, 'frames': frames}

def strip(key, frames):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames): s.paste(f, (i * w, 0))
    save(key, s, len(frames))

def main():
    for pack, slug in PACKS.items(): fetch(pack, slug)
    os.makedirs(OUT, exist_ok=True)
    # 主角：持枪猎人（Gothicvania Swamp）
    for anim, stem, n in [('idle', 'idle', 6), ('run', 'run', 14), ('shoot', 'shoot', 3), ('jump', 'jump', 2),
                          ('fall', 'fall', 2), ('hurt', 'Hurt', 2), ('crouch', 'crouch', 3)]:
        strip('hero_' + anim, [img('gotthicvania-swamp', 'Player', anim, f'{stem}{i}.png') for i in range(1, n + 1)])
    # 僵尸
    # 感染的镇民（Gothicvania Town 的镇民，游戏里染成绿色）。原图朝右，游戏里翻转
    for key, d, n in [('z_hat', 'hat-man-walk', 6), ('z_bearded', 'bearded-walk', 6), ('z_oldman', 'oldman-walk', 12), ('z_woman', 'woman-walk', 6)]:
        strip(key, [img('gothicvania-town', 'sprites', d, f'{d}-{i}.png') for i in range(1, n + 1)])
    strip('z_roamer', [img('gotthicvania-swamp', 'walk thing', f'thing{i}.png') for i in range(1, 5)])
    strip('z_death', [img('cemetery', 'Sprites', 'enemy-death', f'enemy-death-{i}.png') for i in range(1, 6)])
    # 塔、子弹、命中
    strip('turret', [img('warped-city', 'misc', 'turret', f'turret-{i}.png') for i in range(1, 7)])
    save('ic_turret', img('warped-city', 'misc', 'turret', 'turret-1.png'))
    strip('shot', [img('warped-city', 'misc', 'shot', f'shot-{i}.png') for i in range(1, 4)])
    strip('shot_hit', [img('warped-city', 'misc', 'shot-hit', f'shot-hit-{i}.png') for i in range(1, 4)])
    # 场景：黄昏小镇（Gothicvania Town）
    save('bg_sky', img('gothicvania-town', 'PNG', 'environment', 'layers', 'background.png'))
    save('bg_town', img('gothicvania-town', 'PNG', 'environment', 'layers', 'middleground.png'))
    for key, f in [('house_a', 'house-a'), ('house_b', 'house-b'), ('house_c', 'house-c'), ('crate_stack', 'crate-stack'),
                   ('crate', 'crate'), ('barrel', 'barrel'), ('wagon', 'wagon'), ('lamp', 'street-lamp'), ('well', 'well'), ('sign', 'sign')]:
        save(key, img('gothicvania-town', 'props-sliced', f + '.png'))
    for key, f in [('ground', 'ground'), ('ground_b', 'ground-b'), ('ground_wall', 'ground-wall'), ('wall', 'wall')]:
        save(key, img('gothicvania-town', 'sliced-tileset', f + '.png'))
    # 界面：Kenney UI Pack - Pixel Adventure（32px 一格，无间隔的那张）
    ui = img('kenneyui', 'Large tiles', 'Thick outline', 'tilemap_packed.png')
    cell = lambda c, r, w=1: ui.crop((c * 32, r * 32, (c + w) * 32, (r + 1) * 32))
    for key, c, r, w in [('ui_card', 0, 0, 1), ('ui_panel', 1, 0, 1), ('ui_slot', 3, 0, 1), ('ui_btn', 4, 0, 1),
                         ('ui_round', 1, 3, 1), ('ui_round_lit', 0, 3, 1), ('ui_banner', 4, 3, 3)]:
        save(key, cell(c, r, w))
    # 图标：Kyrise 16x16（列, 行）
    ic = img('kyrise', 'spritesheet', 'spritesheet_16x16.png')
    for key, c, r in [('ic_coin', 8, 6), ('ic_scrap', 0, 10), ('ic_hp', 1, 13), ('ic_wall', 6, 15), ('ic_zombie', 8, 9),
                      ('ic_crate', 14, 8), ('ic_pierce', 8, 0), ('ic_ricochet', 13, 11), ('ic_overkill', 1, 8),
                      ('ic_lifesteal', 9, 12), ('ic_incendiary', 4, 8), ('ic_overclock', 0, 12),
                      ('ic_frostbite', 0, 8), ('ic_chainkill', 1, 11), ('ic_vanguard', 9, 15), ('ic_bloodfrenzy', 8, 12),
                      ('ic_glasscannon', 1, 7), ('ic_secondwind', 11, 12), ('ic_star', 15, 7)]:
        save(key, ic.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)))
    save('wp_pistol', img('guns', 'desert_hawk.png'))
    save('wp_smg', img('guns', GUN_SMG))
    save('wp_shotgun', img('guns', 'sg1.png'))
    save('wp_rifle', img('guns', 'hitpro.png'))
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1, sort_keys=True)
    print('wrote', len(manifest), 'images to', os.path.relpath(OUT, ROOT))

GUN_SMG = 'md5.png'
if __name__ == '__main__': main()
