#!/usr/bin/env python3
"""把选用的开源素材整理成游戏用的图（src/assets/）。只在换素材时手动跑，CI 不跑。

用法：python3 tools/assets/prepare.py [缓存目录]   （需要 Pillow；缓存目录默认 .asset_cache/）
来源全部是 OpenGameArt 上的公开素材包，出处和许可见 assets/CREDITS.md。
这个脚本只做裁切和拼条，不改像素。
"""
import io, json, os, re, shutil, sys, urllib.request, zipfile
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.asset_cache')
OUT = os.path.join(ROOT, 'src', 'assets')

ZIP_PACKS = {  # 缓存子目录 -> OpenGameArt 页面
    'gotthicvania-swamp': 'gotthicvania-swamp',
    'cemetery': 'gothicvania-cemetery-pack',
    'gothicvania-town': 'gothicvania-town',
    'warped-city': 'warped-city',
    'kenneyui': 'ui-pack-pixel-adventure',
    'kyrise': 'kyrises-free-16x16-rpg-icon-pack',
    'guns': 'tiny-gun-icons-16x16',
    'zombies': 'animated-pixel-zombie-characters',
    'bridge': 'gothicvania-bridge-expansion-pack-1',
    'church': 'gothicvania-church-pack',
    'patreons': 'gothicvania-patreons-collection',
    'warped2': 'warped-city-2',
}

FILE_PACKS = {  # 单图下载 -> OpenGameArt 页面
    'cannon_wire.png': 'cannon-and-barbed-wire',
    'turret_body.png': 'pixel-turret-animation',
    'medieval_interior.png': 'medieval-tileset',
}

UA = {'User-Agent': 'Mozilla/5.0'}

def fetch_zip(pack, slug):
    d = os.path.join(CACHE, pack)
    if os.path.isdir(d) and os.listdir(d): return
    page = urllib.request.urlopen(urllib.request.Request('https://opengameart.org/content/' + slug, headers=UA), timeout=60).read().decode('utf8', 'ignore')
    zips = re.findall(r'https://opengameart\.org/sites/default/files/[^"]+\.zip', page)
    if not zips: raise SystemExit('no zip found for ' + slug)
    url = zips[0]
    print('download', url)
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
    os.makedirs(d, exist_ok=True)
    zipfile.ZipFile(io.BytesIO(data)).extractall(d)

def fetch_file(fname, slug):
    extras = os.path.join(CACHE, 'extras')
    dst = os.path.join(extras, fname)
    if os.path.isfile(dst): return
    page = urllib.request.urlopen(urllib.request.Request('https://opengameart.org/content/' + slug, headers=UA), timeout=60).read().decode('utf8', 'ignore')
    imgs = re.findall(r'https://opengameart\.org/sites/default/files/[^"]+\.png', page)
    if not imgs: raise SystemExit('no png found for ' + slug)
    print('download', imgs[0])
    os.makedirs(extras, exist_ok=True)
    open(dst, 'wb').write(urllib.request.urlopen(urllib.request.Request(imgs[0], headers=UA), timeout=120).read())

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

def slice_grid(im, count, fw, offset_x=0, out_w=None, flip=False):
    """把定宽条带拆帧，按每帧最下方中心对齐到统一画框（不缩放像素）。"""
    out_w = out_w or fw
    out_h = im.height
    frames = []
    for i in range(count):
        cell = im.crop((offset_x + i * fw, 0, offset_x + (i + 1) * fw, out_h))
        if flip: cell = cell.transpose(Image.FLIP_LEFT_RIGHT)
        box = cell.getbbox()
        canvas = Image.new('RGBA', (out_w, out_h))
        if box:
            cw = box[2] - box[0]
            ch = box[3] - box[1]
            dx = (out_w - cw) // 2
            dy = out_h - ch
            canvas.paste(cell.crop(box), (dx, dy))
        frames.append(canvas)
    return frames

def build_tavern_interior(mi):
    """用 Medieval Tileset（CC-BY 3.0, Ataos）拼出一张 528x240 的酒馆内景。
    只做图块拼接与裁切，不改像素。左灶台、中吧台商店、右防线工坊铁砧、最右出击木门。"""
    W, H = 528, 240
    FLOOR_Y = 196
    room = Image.new('RGBA', (W, H), (28, 19, 24, 255))

    def paste(box, dx, dy, rep_x=1, flip=False):
        tile = mi.crop(box)
        if flip: tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
        for i in range(rep_x):
            room.paste(tile, (dx + i * tile.width, dy), tile)

    # 墙体（用暖木板铺满 FLOOR_Y 以上，避免黑带断层）
    wall_strip = mi.crop((0, 128, 64, 176))
    for x in range(0, W, 64):
        room.paste(wall_strip, (x, FLOOR_Y - 144), wall_strip)
        room.paste(wall_strip, (x, FLOOR_Y - 96), wall_strip)
        room.paste(wall_strip, (x, FLOOR_Y - 48), wall_strip)
    # 顶层暗色横梁
    for x in range(0, W, 16):
        paste((0, 112, 16, 128), x, 0)
        paste((16, 112, 32, 128), x, 16)
        paste((0, 112, 16, 128), x, 32)
    # 地板（橡木地板 + 地底基座）
    floor_tile = mi.crop((0, 176, 48, 224))
    for x in range(0, W, 48):
        room.paste(floor_tile, (x, FLOOR_Y), floor_tile)

    # 亮暖木窗户
    win_lg = (128, 136, 160, 164)
    paste(win_lg, 122, FLOOR_Y - 82)
    paste(win_lg, 246, FLOOR_Y - 82)
    paste(win_lg, 392, FLOOR_Y - 82)

    # ── 1. 左区（x ~ 24..168）：小厨房灶台与木桌 ──
    paste((240, 0, 256, 64), 42, FLOOR_Y - 92)    # 烟囱壁炉管
    paste((48, 288, 96, 320), 26, FLOOR_Y - 32)   # 燃烧烤炉
    paste((16, 256, 40, 288), 78, FLOOR_Y - 32)   # 明火小灶台
    paste((224, 192, 240, 224), 108, FLOOR_Y - 32)  # 储酒木桶
    paste((96, 184, 144, 224), 128, FLOOR_Y - 36)   # 长餐桌
    paste((192, 208, 208, 224), 134, FLOOR_Y - 40)  # 桌上烤肉盘
    paste((208, 208, 224, 224), 152, FLOOR_Y - 40)  # 桌上佳肴盘
    paste((176, 208, 192, 224), 124, FLOOR_Y - 14)  # 小圆凳

    # ── 2. 中区（x ~ 188..316）：金币商店吧台与货架 ──
    shelf_bg = mi.crop((160, 128, 192, 176))
    for sx in (192, 224, 256): room.paste(shelf_bg, (sx, FLOOR_Y - 80), shelf_bg)
    paste((192, 128, 288, 176), 192, FLOOR_Y - 80)  # 货架上的药水与瓶罐
    paste((48, 224, 144, 256), 192, FLOOR_Y - 32)   # 吧台柜台
    paste((176, 288, 192, 304), 214, FLOOR_Y - 42)  # 账簿
    paste((256, 192, 272, 208), 264, FLOOR_Y - 40)  # 金币宝箱
    paste((192, 288, 240, 320), 296, FLOOR_Y - 32)  # 补给箱

    # ── 3. 右区（x ~ 344..436）：防线工坊铁砧 ──
    paste((192, 240, 208, 256), 360, FLOOR_Y - 30)  # 锻造铁砧
    paste((208, 256, 224, 272), 360, FLOOR_Y - 16)  # 铁砧木桩底座
    paste((224, 240, 256, 256), 382, FLOOR_Y - 16)  # 煤炭堆
    paste((240, 272, 256, 304), 412, FLOOR_Y - 32)  # 零件堆叠箱
    paste((224, 256, 240, 272), 346, FLOOR_Y - 52)  # 墙挂锻锤

    # ── 4. 最右（x ~ 448..516）：离开小屋木门 + 通往屋顶木梯 ──
    paste((208, 0, 224, 64), 444, FLOOR_Y - 112)   # 阁楼木梯
    paste((208, 0, 224, 64), 444, FLOOR_Y - 64)    # 梯子下段
    paste((64, 128, 96, 176), 472, FLOOR_Y - 48)    # 暖木出口大门
    return room

def build_roof_deck(mi):
    """用 Medieval Tileset 的木桥栅栏图块拼出一整条平坦的屋顶防御平台。"""
    seg = mi.crop((256, 0, 304, 32))
    w = seg.width * 5  # 240px 宽
    deck = Image.new('RGBA', (w, seg.height))
    for i in range(5):
        deck.paste(seg, (i * seg.width, 0), seg)
    return deck

def main():
    for pack, slug in ZIP_PACKS.items(): fetch_zip(pack, slug)
    for fname, slug in FILE_PACKS.items(): fetch_file(fname, slug)
    os.makedirs(OUT, exist_ok=True)
    # 清理不再使用的旧镇民僵尸贴图，以免打包进单个 HTML
    for old in ['z_hat', 'z_bearded', 'z_oldman', 'z_woman', 'z_roamer']:
        p = os.path.join(OUT, old + '.png')
        if os.path.exists(p): os.remove(p)

    # ── 主角：持枪猎人（Gothicvania Swamp）──
    for anim, stem, n in [('idle', 'idle', 6), ('run', 'run', 14), ('shoot', 'shoot', 3), ('jump', 'jump', 2),
                          ('fall', 'fall', 2), ('hurt', 'Hurt', 2), ('crouch', 'crouch', 3)]:
        strip('hero_' + anim, [img('gotthicvania-swamp', 'Player', anim, f'{stem}{i}.png') for i in range(1, n + 1)])

    # ── 真正的小怪、地狱犬、燃烧食尸鬼、Boss（方案二 哥特堡垒风）──
    # Animated Pixel Zombie Characters (Boom Shaka, CC-BY 3.0): 原图朝右，向左迎战需水平翻转并统一对齐到底部中心
    strip('z_roamer_a', slice_grid(img('zombies', 'Green1_96x54', 'Zombie_Run.png'), 7, 96, 1, 56, flip=True))
    strip('z_roamer_b', slice_grid(img('zombies', 'Green2_96x54', 'Zombie2_Run_2.png'), 7, 96, 1, 56, flip=True))
    strip('z_roamer_c', slice_grid(img('zombies', 'Green3_96x54', 'Zombie3_Run_2.png'), 7, 96, 1, 56, flip=True))
    strip('z_bruiser',  slice_grid(img('zombies', 'Green4_96x54', 'Zombie4_Run_2.png'), 7, 96, 1, 56, flip=True))
    strip('z_crawler',  slice_grid(img('zombies', 'Green1_96x54', 'Zombie_crawl_2.png'), 7, 96, 1, 56, flip=True))
    strip('z_collapse', slice_grid(img('zombies', 'Green1_96x54', 'Zombie_death.png'), 8, 96, 1, 64, flip=True))
    strip('z_death', [img('cemetery', 'Sprites', 'enemy-death', f'enemy-death-{i}.png') for i in range(1, 6)])

    # 地狱犬、燃烧食尸鬼、Boss 地狱兽 / 恶魔
    strip('z_hound', slice_grid(img('patreons', 'Hell-Hound-Files', 'PNG', 'hell-hound-run.png'), 5, 67, 0, 56, flip=False))
    strip('z_ghoul', [img('church', 'burning-ghoul', 'sprites', 'v1', f'burning-ghoul-{i}.png') for i in range(1, 9)])
    strip('boss_beast', slice_grid(img('patreons', 'Hell-Beast-Files', 'PNG', 'with-stroke', 'hell-beast-idle.png'), 6, 55, 0, 58, flip=False))
    strip('boss_demon', slice_grid(img('patreons', 'demon-Files', 'PNG', 'demon-idle.png'), 6, 160, 0, 150, flip=False))
    strip('fx_fireball', [img('church', 'fx', 'fireball', 'fireball-sprites', f'fireball{i}.png') for i in range(1, 4)])
    strip('fx_boom', [img('warped2', 'Sprites', 'explosion-a', f'explosion-a{i}.png') for i in range(1, 9)])

    # ── 塔、炮弹、铁丝网、子弹、命中 ──
    strip('turret', [img('warped-city', 'misc', 'turret', f'turret-{i}.png') for i in range(1, 7)])
    save('ic_turret', img('warped-city', 'misc', 'turret', 'turret-1.png'))
    tb = img('extras', 'turret_body.png')
    strip('turret_tesla', [tb.crop((8, 12, 44, 42)), tb.crop((62, 12, 98, 42))])
    save('ic_turret_tesla', tb.crop((8, 12, 44, 42)))
    strip('turret_frost', [img('warped2', 'egg turret', 'Shoot', f'shoot{i}.png') for i in range(1, 5)])
    save('ic_turret_frost', img('warped2', 'egg turret', 'Idle', 'idle1.png'))
    cw = img('extras', 'cannon_wire.png')
    cannon_im = cw.crop((0, 4, 34, 32)).transpose(Image.FLIP_LEFT_RIGHT)
    save('turret_cannon', cannon_im)
    save('ic_turret_cannon', cannon_im)
    save('barbed_wire', cw.crop((24, 30, 74, 64)))

    strip('shot', [img('warped-city', 'misc', 'shot', f'shot-{i}.png') for i in range(1, 4)])
    strip('shot_hit', [img('warped-city', 'misc', 'shot-hit', f'shot-hit-{i}.png') for i in range(1, 4)])

    # ── 场景与堡垒酒馆（Gothicvania Town + Bridge Expansion + Medieval Tileset）──
    save('bg_sky', img('gothicvania-town', 'PNG', 'environment', 'layers', 'background.png'))
    save('bg_town', img('gothicvania-town', 'PNG', 'environment', 'layers', 'middleground.png'))
    for key, f in [('house_a', 'house-a'), ('house_b', 'house-b'), ('house_c', 'house-c'), ('crate_stack', 'crate-stack'),
                   ('crate', 'crate'), ('barrel', 'barrel'), ('wagon', 'wagon'), ('lamp', 'street-lamp'), ('well', 'well'), ('sign', 'sign')]:
        save(key, img('gothicvania-town', 'props-sliced', f + '.png'))
    for key, f in [('ground', 'ground'), ('ground_b', 'ground-b'), ('ground_wall', 'ground-wall'), ('wall', 'wall')]:
        save(key, img('gothicvania-town', 'sliced-tileset', f + '.png'))

    house_full = img('bridge', 'Props', 'house.png')
    save('fort_house', house_full.crop((0, 0, house_full.width, 203)))  # 裁掉底部桥面，让屋柱立在街道地面上
    castle_full = img('bridge', 'Props', 'castle.png')
    save('fort_keep', castle_full.crop((176, 60, 272, 266)))           # 城堡石堡墙体（含亮灯圆窗）
    save('castle_banner', castle_full.crop((386, 12, 434, 82)))

    mi = img('extras', 'medieval_interior.png')
    save('roof_deck', build_roof_deck(mi))
    save('prop_ladder', mi.crop((208, 0, 224, 64)))
    save('tavern_interior', build_tavern_interior(mi))

    # ── 界面：Kenney UI Pack - Pixel Adventure ──
    ui = img('kenneyui', 'Large tiles', 'Thick outline', 'tilemap_packed.png')
    cell = lambda c, r, w=1: ui.crop((c * 32, r * 32, (c + w) * 32, (r + 1) * 32))
    for key, c, r, w in [('ui_card', 0, 0, 1), ('ui_panel', 1, 0, 1), ('ui_slot', 3, 0, 1), ('ui_btn', 4, 0, 1),
                         ('ui_round', 1, 3, 1), ('ui_round_lit', 0, 3, 1), ('ui_banner', 4, 3, 3)]:
        save(key, cell(c, r, w))

    # ── 图标：Kyrise V1.2 16x16 + Medieval Tileset 小图块 ──
    ic = img('kyrise', 'spritesheet', 'spritesheet_16x16.png')
    for key, c, r in [('ic_coin', 8, 6), ('ic_scrap', 0, 10), ('ic_hp', 1, 13), ('ic_wall', 6, 15), ('ic_zombie', 8, 9),
                      ('ic_crate', 14, 8), ('ic_pierce', 8, 0), ('ic_ricochet', 13, 11), ('ic_overkill', 1, 8),
                      ('ic_lifesteal', 9, 12), ('ic_incendiary', 4, 8), ('ic_overclock', 0, 12),
                      ('ic_frostbite', 0, 8), ('ic_chainkill', 1, 11), ('ic_vanguard', 9, 15), ('ic_bloodfrenzy', 8, 12),
                      ('ic_glasscannon', 1, 7), ('ic_secondwind', 11, 12), ('ic_star', 15, 7), ('ic_chef', 9, 7),
                      ('ic_armor', 7, 15), ('ic_fort', 10, 15), ('ic_grenade', 14, 11), ('ic_meat', 10, 7),
                      ('ic_rooftop', 11, 0), ('ic_shrapnel', 12, 11), ('ic_fortify', 13, 15), ('ic_shock', 2, 7)]:
        save(key, ic.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)))

    save('ic_kitchen', mi.crop((208, 208, 224, 224)))
    save('ic_shop', mi.crop((176, 288, 192, 304)))
    save('ic_anvil', mi.crop((192, 240, 208, 256)))

    # ── 枪械图标（Sogomn Tiny Gun Icons, CC0）──
    for k, fname in [('wp_pistol', 'desert_hawk.png'), ('wp_revolver', 'jb007.png'), ('wp_smg', 'md5.png'),
                     ('wp_shotgun', 'sg1.png'), ('wp_assault', 'poshlinov.png'), ('wp_rifle', 'hitpro.png'),
                     ('wp_tesla', 'gh55b.png'), ('wp_rocket', 'mg6000.png')]:
        save(k, img('guns', fname))

    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1, sort_keys=True)
    print('wrote', len(manifest), 'images to', os.path.relpath(OUT, ROOT))

if __name__ == '__main__': main()
