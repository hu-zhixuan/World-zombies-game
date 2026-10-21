# 十五波围城：最后据点（World-zombies-game）

单文件 HTML5 塔防 + 深夜食堂经营游戏。源码拆在 `src/` 里，`build.js` 把它们纯拼接成一个可直接双击打开的 HTML。

## 目录

```
build.js               构建脚本：src/ -> dist/zombie-game-v56.html
test_suite.js          回归测试（node 里用 vm + mock DOM 跑，无需浏览器）
src/
  index.template.html  页面骨架，含 /*@@STYLE1@@*/ /*@@STYLE2@@*/ /*@@SCRIPT@@*/ 三个占位符
  style1.css style2.css  桌面版样式
  style_phone.css      手机界面（body.phone）：HUD、操控键、菜单面板、各弹层的小屏排版；与 style2 一起拼进第二个 <style>
  js/                  所有 JS，同一个全局作用域，拼接顺序见 _order.json
    01*  配置与注册表（武器、剧情、僵尸、菜谱配方）
    02*  引擎（音频、输入、尸潮、转场、梦境、主循环）
    03*  战斗与防守（渲染、塔、伙伴、射击、波次）
    04*  据点、工坊、旧城远征
    05*  深夜食堂（菜单、VIP、热搜、客人、声望、引擎、烹饪、转场）
    06*  HUD、存档、启动入口
dist/                  构建产物（已提交，直接打开 zombie-game-v56.html 就能玩）
android/               安卓外壳工程（WebView 加载同一份 HTML），.github/workflows/ 里是自动发布
archive/               历史版本（v55）
tools/                 一次性迁移脚本，已用完，仅留档（见 tools/README.md）
docs/                  架构索引（基于 v55，行号已过时，仅作结构参考）
```

## 下载与发布

- 在 GitHub 的 **Releases** 页面下载：`wave15-*.apk`（安卓，Android 8.0+，横屏）和 `zombie-game-*.html`（电脑版，双击用 Chrome / Edge 打开）。
- 发新版：打一个标签并推送，GitHub Actions 会自动测试、编译 APK、创建 Release：
  ```bash
  git tag v56.1 && git push origin v56.1
  ```
- 安卓版是一个很薄的 WebView 外壳（`android/`），里面装的就是电脑版同一份 HTML，所以只维护一套游戏代码。
- 默认用仓库里的 debug 密钥签名（每次签名一致，可覆盖升级）。要上架应用商店或换正式密钥：在仓库 Settings → Secrets 配
  `KEYSTORE_BASE64`、`KEYSTORE_PASSWORD`、`KEY_ALIAS`、`KEY_PASSWORD`，工作流会自动改用它。
- 本地编 APK：装好 JDK 17+ 和 Android SDK（platform 34、build-tools 34），设置 `ANDROID_HOME`，然后 `npm run apk`，
  产物在 `android/app/build/outputs/apk/release/`。

## 常用命令

```bash
npm run build   # 生成 dist/zombie-game-v56.html
npm test        # 跑回归测试
```

只改 `src/`，不要手改 `dist/` 里的 HTML；改完重新 `npm run build`。
新增 JS 文件要同时登记到 `src/js/_order.json`。
