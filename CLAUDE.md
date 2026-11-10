# 十五波围城：最后据点

单文件 HTML5 游戏（塔防打僵尸 + 深夜食堂），外加一个安卓 WebView 壳。作者主要在**安卓手机上用 APK 玩**，用中文沟通，不是程序员：汇报时说人话，讲「玩家会感觉到什么变化」，少讲代码。

## 现在在做什么

正在把游戏重构成「肉鸽 + 塔防」，方向已经和作者定好，分 5 期：

- 方向和已拍板的决定：`docs/redesign_proposal.md`（不要重新讨论已拍板的条目）
- 下一步具体怎么做：`docs/next_steps.md`（**开工前先读这个**）

## 常用命令

```
npm test                       # 先构建再跑 test_suite.js（node vm + 假 DOM）
npm run build                  # 拼出 dist/zombie-game-v56.html（dist 要一起提交）
node tools/e2e/cabin_walk.js   # 真实触摸走一整轮据点，卡住则退出码 1
node tools/e2e/aim_lock.js     # 手机瞄准回归，截图在 tools/e2e/shots/
```

## 代码结构

- `build.js` 按 `src/js/_order.json` 的顺序把 `src/js/*.js` 直接拼进 `src/index.template.html`，三份 CSS 同理。没有模块系统：**所有 JS 在同一个全局作用域**，`let/const` 跨文件共享，重名会直接报错。
- 文件名只是大概分区，别按文件名猜内容。几个容易找错的：
  - 伤害公式 `getDamage`、移速、经验升级在 `05i_rest_transitions.js`
  - 鼠标开火、射速 `getFireInterval`、切枪在 `02e_dreamland.js`
  - 僵尸生成和血量在 `03h_zombies_and_firing.js`，受击结算 `hitZombie` 在 `03i_reload_combat.js`
- `docs/code_architecture_index.md` 是 v55 单文件时代写的，行号全部过期，只能当概念参考。
- 手机界面：`body.phone` + `isPhoneUI()`；触屏按钮用 `bindPress(el, down, up)`；逻辑画布 1100×500，世界宽 2520，有 `cameraX`。

## 踩过的坑（都真实发生过）

1. **看不见的层会吞掉所有操作。** `forceDismissAllOverlays()` 用行内 `display:none` 关层；之后再显示这个层必须先清行内样式再加 `.open`，否则层在逻辑上开着、画面上看不见，玩家怎么点都没反应（v56.3 的「回小屋必卡死」）。新加弹层时照 `showCinematic` 的写法做。
2. **防卡死看门狗**（`checkStuckWatchdog`，`02f_mobile_controls.js`）靠一串状态判断「是不是卡住了」。新加任何会暂停游戏的面板，都要确认看门狗把它算作「面板开着」，否则它会在玩家选东西时强行切场景。
3. **假 DOM 测试的盲区。** `test_suite.js` 里所有 `getElementById` 返回同一个假元素，`style.display` 是全局共享的。它测得了数值和状态机，测不了「按钮能不能点到」。涉及触屏和弹层的改动，必须用 `tools/e2e/` 那种真实触摸（CDP `Input.dispatchTouchEvent`）验证；脚本里用 JS `.click()` 会绕过遮挡，测不出问题。
4. **手机右下角是按钮区**，僵尸从右边进场正好在按钮底下。新 UI 不要往右下角放东西。
5. **CSS 类名先搜再起。** `.end-card` / `.end-title` 已被餐厅结算卡占用，撞名会把别的界面改坏。
6. **跨局残留。** 挂在 `window._xxx` 上的状态要在 `RuntimeBattleContext.reset()` 里清，否则重开一局还带着上一局的数据。

## 发版流程

每期做完要发一个 Release，作者才能在手机上试。**合并和发版前先问作者。**

1. 在指定的开发分支上提交、推送，开 PR，等 CI（`ci.yml`：`npm test` + `npm run build`）通过。
2. 合并进 main。
3. 这个环境直接推 tag 会被拒（403）。改用手动触发 `release.yml`（workflow_dispatch，`ref: main`，输入 `tag: v56.x`），它会跑测试、打 APK、建 Release（`wave15-<tag>.apk` + `zombie-game-<tag>.html`）并在 main 上打 tag。
4. PR 合并后，下一期从最新 main 重新拉分支，不要在已合并的历史上接着提交。

版本号显示在 `src/index.template.html` 的几处 `v56` 文案里；APK 版本由 release 工作流的环境变量决定，不用手改。
