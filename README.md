# 十五波围城：最后据点（World-zombies-game）

单文件 HTML5 塔防 + 深夜食堂经营游戏。源码拆在 `src/` 里，`build.js` 把它们纯拼接成一个可直接双击打开的 HTML。

## 目录

```
build.js               构建脚本：src/ -> dist/zombie-game-v56.html
test_suite.js          回归测试（node 里用 vm + mock DOM 跑，无需浏览器）
src/
  index.template.html  页面骨架，含 /*@@STYLE1@@*/ /*@@STYLE2@@*/ /*@@SCRIPT@@*/ 三个占位符
  style1.css style2.css
  js/                  所有 JS，同一个全局作用域，拼接顺序见 _order.json
    01*  配置与注册表（武器、剧情、僵尸、菜谱配方）
    02*  引擎（音频、输入、尸潮、转场、梦境、主循环）
    03*  战斗与防守（渲染、塔、伙伴、射击、波次）
    04*  据点、工坊、旧城远征
    05*  深夜食堂（菜单、VIP、热搜、客人、声望、引擎、烹饪、转场）
    06*  HUD、存档、启动入口
dist/                  构建产物（已提交，直接打开 zombie-game-v56.html 就能玩）
archive/               历史版本（v55）
tools/                 一次性迁移脚本，已用完，仅留档（见 tools/README.md）
docs/                  架构索引（基于 v55，行号已过时，仅作结构参考）
```

## 常用命令

```bash
npm run build   # 生成 dist/zombie-game-v56.html
npm test        # 跑回归测试
```

只改 `src/`，不要手改 `dist/` 里的 HTML；改完重新 `npm run build`。
新增 JS 文件要同时登记到 `src/js/_order.json`。
