# 暮夜酒馆（十五波围城）

<p align="center"><img src="poster.jpg" alt="暮夜酒馆：十五波围城" width="760"></p>

<p align="center">
  <b>白天在三层酒馆防线迎战尸潮，深夜掌勺炒菜开食堂赚钱反哺战备。</b><br>
  暗黑奇幻像素风肉鸽塔防 × 深夜食堂经营｜安卓 APK &amp; 电脑免安装单文件版
</p>

### 🎮 [立即试玩 / 下载最新 v65.0（Release）](https://github.com/hu-zhixuan/World-zombies-game/releases/latest)

打开页面后点 **Assets** 即可下载对应版本（单机离线可玩，零联网依赖）：
- **安卓手机**：下载 `wave15-v65.0.apk`（Android 8.0 及以上，横屏游玩；新版本直接覆盖安装）
- **电脑端**：下载 `zombie-game-v65.0.html`，**双击用 Chrome / Edge 打开**即可开玩，无需安装

---

## ✨ 游戏特色与玩法循环

结合《元气骑士》的爽快射击手操、《泰拉瑞亚》的三层立体攻防，以及《潜水员戴夫》的「白天打猎 × 夜晚开店」双循环经营：

- **昼夜双循环，以战养馆**：白天守城打僵尸掉落食材与战利品；入夜回到「暮夜酒馆」，在左墙灶台掌勺把握火候炒菜端盘、招呼食客堂食赚金币，第二天强化武器与防线——**打得越深食材越好，菜卖得越好火力越猛**。
- **屋顶 / 门廊 / 庭院三层立体攻防**：支持单向挑台立定与摇杆穿层下跳，居高临下享屋顶高地增益（增伤 / 射程 / 暴击 / 掩体减伤），同时应对地面尸群与空中魔蝠、怨灵。
- **8 把特色暮夜兵器 × 爽快肉鸽**：猎手双铳、重锤左轮、连珠火铳、双管龙息铳、寒霜连铳、猩红圣铳、秘蓝法杖、焦土爆炎炮——同档武器 3～5 枪干脆放倒一只普通僵尸，拒绝后期刮痧；每局随机武器掉落 + 三选一强化，15 波守城冲刺每 5 天首领战，通关后还可继续挑战破晓无尽模式。
- **四位战友协同 × 要塞沙盘炮塔**：老兵张、药师小林、铁匠阿强、哨兵小赵在各层亲自迎敌、控场、修墙；打开防线工坊即可按空间布局建造火铳塔、寒霜水晶塔、雷鸣臼炮、黑铁重炮并自由切换索敌重心。
- **开源真实视听体验**：内置 40 个真人开源采样音效与 3 首无缝循环 BGM（酒馆 / 守夜摇滚 / 首领金属），支持离线流畅播放。

---

## 🛠️ 开发者指南（Developer Guide）

基于 **TypeScript + Phaser 3.90 + Preact + Vite Singlefile** 构建，规则层（`src/sim/`）与画面层完全解耦，构建产物为单个离线 HTML（`dist/index.html`）并内嵌于 Android WebView 壳中。

- 设计与交接文档：玩法方案 [docs/redesign_proposal.md](docs/redesign_proposal.md) ｜ 分层架构 [docs/architecture.md](docs/architecture.md) ｜ 阶段记录 [docs/next_steps.md](docs/next_steps.md) ｜ 素材许可 [assets/CREDITS.md](assets/CREDITS.md)
- 旧版 v56.4 代码完整保留在 `legacy/`（`node legacy/build.js` 仍可构建）。

### 常用命令
```bash
npm ci            # 安装依赖
npm run dev       # 本地开发（浏览器打开提示地址）
npm test          # 规则、数值、界面规矩自动测试（Vitest，无浏览器）
npm run build     # 类型检查并打包为单个离线 HTML（dist/index.html）
npm run e2e       # 手机横屏尺寸真实触摸走查（CDP）
```

### 目录结构
```text
src/content/   武器、僵尸、天赋与剧情配置表（legacy/ 为旧版抽取数据）
src/sim/       纯 TypeScript 规则模拟层（支持 60Hz 无头跑局与机器人测试）
src/view/      Phaser 3.90 画面渲染与特效
src/ui/        Preact 触屏界面与面板（tokens.css 统一定义色板与尺寸）
src/app/       全局状态机与面板栈协调
src/assets/    整理后的开源像素与音频素材
tests/         单元测试与 UI 规范校验
tools/e2e/     手机横屏真实触摸 E2E 脚本
android/       Android WebView 打包工程
```

### 发版方式
推送 `v*` 标签或在 GitHub Actions 手动运行 `Release` 工作流，自动执行测试、构建单文件 HTML、编译签名 APK 并生成 GitHub Release（标签含 `preview` 自动标为预发布）。
