# 十五波围城：最后据点

塔防打僵尸 + 深夜食堂的手机游戏。正在从头重做成 v57（像素风）；旧版 v56 的代码在 `legacy/`，只当参考。

- 做成什么游戏：`docs/redesign_proposal.md`
- 怎么搭的：`docs/architecture.md`
- 现在做到哪、下一步：`docs/next_steps.md`
- 素材出处和许可：`assets/CREDITS.md`

## 常用命令

```
npm ci            # 装依赖
npm run dev       # 本地开发（浏览器打开提示的地址）
npm test          # 规则、数值、界面规矩的自动测试（不开浏览器）
npm run build     # 打包成 dist/index.html 一个文件
npm run e2e       # 手机尺寸下用真实触摸走完一轮，卡住或点不到就报错
```

## 目录

```
src/content/   数据：武器、僵尸、天赋；legacy/ 子目录是从旧版原样抽出来的剧情和内容表
src/sim/       规则：纯 TypeScript，不碰浏览器，能自己跑完一整局
src/view/      画面：Phaser 场景，只读状态、播特效
src/ui/        界面：顶栏、触屏按键、面板（Preact）；tokens.css 是唯一能定义颜色和尺寸的地方
src/app/       把上面几层接起来；全游戏只有一份状态
src/assets/    整理好的素材图（由 tools/assets/prepare.py 生成）
tests/         自动测试
tools/e2e/     真实触摸走查脚本
android/       安卓 WebView 壳，加载打包出来的那一个 HTML
legacy/        旧版 v56.4（node legacy/build.js 仍可构建）
```

## 发版

推送 `v*` 标签或在 Actions 里手动运行 Release 工作流：跑测试、打包、编 APK、建 Release。标签名里带 `preview` 的会标成预发布。
