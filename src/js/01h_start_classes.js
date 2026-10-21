// ═══════════════════════════════════════════════════════════════════
//  01.4 当代大学生小胡 6 套帅气战术装扮 (START_CLASSES)
// ═══════════════════════════════════════════════════════════════════
//  当代大学生小胡的 6 套帅气战术装扮（主角统一为帅气勇敢的小胡）
// ═══════════════════════════════════════════
const START_CLASSES = [
  {
    id: 'marksman',
    icon: '🎯',
    name: '狙击目镜小胡',
    title: '神射手战术装扮',
    color: '#388bfd',
    desc: '当代工科大学生小胡戴上高科技单边战术目镜，眼神坚毅冷峻！暴击率+20% · 暴击伤害+50% · 爆头回膛',
    classWeapon: 'railcharger',
    weaponName: '磁轨充能狙击',
    perks: { precision: 2 }
  },
  {
    id: 'berserker',
    icon: '🪓',
    name: '热血发带小胡',
    title: '狂战士战术装扮',
    color: '#f85149',
    desc: '系上赤红热血战术发带的阳光小胡，英姿勃发无所畏惧！近战伤害+100% · 近战吸血5% · 极速双刃斩杀',
    classWeapon: 'bloodblades',
    weaponName: '嗜血狂暴双刃',
    perks: { lifesteal: 1 }
  },
  {
    id: 'demolition',
    icon: '💥',
    name: '防暴护目镜小胡',
    title: '爆破专家战术装扮',
    color: '#ff9944',
    desc: '配戴防暴护目镜与斜跨战术弹药带，机敏自信！爆炸/AoE伤害+30% · 爆炸范围+20% · 抗爆免伤50%',
    classWeapon: 'stickybomb',
    weaponName: '集束黏弹发射器',
    perks: { incendiary: 1 }
  },
  {
    id: 'beastmaster',
    icon: '🐺',
    name: '战地风衣小胡',
    title: '驭兽师战术装扮',
    color: '#a371f7',
    desc: '身披坚韧防风战术风衣与狼牙哨笛，沉稳勇敢！开局自带机枪手大壮 · 伙伴伤害+50% · 伙伴HP+50%',
    classWeapon: 'warhorn',
    weaponName: '战地冲锋哨笛',
    perks: {},
    companion: 'gunner'
  },
  {
    id: 'warden',
    icon: '🛡',
    name: '外骨骼机甲小胡',
    title: '铁壁守卫战术装扮',
    color: '#ffd700',
    desc: '装备轻量外骨骼护肩与合金护腕，顶天立地！开局石墙 · 塔伤害+30% · 裂地金钟御敌神盾',
    classWeapon: 'quakehammer',
    weaponName: '撼地神盾援护锤',
    perks: { towermaster: 1 }
  },
  {
    id: 'chef',
    icon: '🍳',
    name: '暗黑主厨小胡',
    title: '暗黑厨神战术装扮',
    color: '#dd88ff',
    desc: '系上利落暗色战术围裙与帅气头巾，从容自若！开局肉块+5 · 菜品战斗增益翻倍 · 火焰伤害加成',
    classWeapon: 'chiliflamer',
    weaponName: '魔鬼辣椒喷焰枪',
    perks: {},
    meatBonus: 5
  }
];

