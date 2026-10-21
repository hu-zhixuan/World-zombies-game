# tools/ —— 一次性迁移脚本（已用完）

这三个脚本是 v55 单文件 -> `src/` 拆分、以及后续武器死分支清理时用的，**仅留档，不要再运行**：

- `split_v55.js`：把 `archive/zombie-game-v55.html` 切成 `src/`。**会覆盖当前 `src/`**。
- `verify_split.js`：断言构建产物与 v55 逐字节一致。`src/` 已经演进到 v56，这个断言现在必然失败。
- `patch_1b_weapons.js`：已应用的补丁，每条要求恰好命中 1 次，重跑会直接报错。

日常开发只需要根目录的 `build.js` 和 `test_suite.js`。
