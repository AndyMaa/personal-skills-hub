# 验证记录

## 1.0.1 · GitHub 准备版

- 本机 Windows / Node.js 24.22.0：12 项自动测试通过，14 份 JavaScript 语法和 manifest 一致性检查通过。
- 新增覆盖：Windows npm CLI 入口及参数传递、无末尾换行文件恢复、分段 UTF-8 中文路径、无效 JSON 对象、端口错误和 CLI 参数错误。
- 从分享 ZIP 解压到临时路径，在独立 `CODEX_HOME` 中实际注册仓库 marketplace 并安装插件；状态 enabled，manifest 版本一致。
- 新生成的聚焦启动器通过实际 Codex `debug prompt-input` 验证：所选 PPT 技能存在，未选视频及其他 PPT 路线未进入可用技能清单。
- 浏览器验证：服务在同一端口重启后，用新会话地址重新打开，面板自动刷新并成功选中技能包；版本显示 1.0.1，控制台无错误。
- GitHub Actions 已配置 Windows、macOS、Linux × Node.js 22 / 24 的测试矩阵，以及独立的 ZIP 验证和构建产物上传。远端结果需仓库推送后确认。
- 本项目已有独立 Git 仓库边界，运行状态、项目快照和发布 ZIP 均被忽略。

以下为初始版本的验证记录。

验证日期：2026-11-01（Asia/Shanghai）。系统：Windows；Node.js 24.22.0；Codex 0.166.0-alpha.5.1。

## 已完成

- Node 自动测试：7 项通过。覆盖本地副本优先级、跨插件同名区分、辅助技能补齐、路线冲突、推荐、原文件保留、预览过期、来源变化、模式切换、撤回链、保留后续编辑、目录联接拦截，以及本地 API 的会话和跨站检查。
- skill-creator 的 `quick_validate.py` 通过（Windows 使用 `python -X utf8`）。
- 中文面板实测：本地 PPT 分类筛选、技能包选择、冲突出现时禁用添加、预览、应用以及撤回均通过。
- 使用 Codex 原生 CLI 安装插件成功；`codex plugin list --marketplace personal-skills-hub-local --json` 返回 installed=true、enabled=true。安装缓存内 skill 命令入口可正常扫描。
- 实际技能扫描：80 个不同来源的技能条目，83 份入口文件，3 组本地重复安装。
- 实际 Codex App Server `config/read` 能读取项目配置；**仅写项目 skills.config 时，skills/list 的本地技能仍全部 enabled=true**。
- 同一客户端通过 `-c skills.config=...` 启动 App Server 后，所选 `ppt-router`、`.agents/skills/ppt-master` 保持启用，另外 21 份本地技能入口 disabled，含另一个 ppt-master 副本。无技能加载错误。
- 因此默认桌面模式仅承诺项目路由；真正的启用限制通过生成的独立 CLI 启动器执行，不更改全局配置。

## 复验

```powershell
npm test
python -X utf8 "$env:USERPROFILE\.codex\skills\.system\skill-creator\scripts\quick_validate.py" skills/personal-skills-hub
```

本机原生验证：先创建 `.hub/native-project`，应用 `pptx` 技能包并指定 `--mode focused`，再运行 `node scripts/verify-codex.mjs`。该脚本调用 `initialize`、`config/read` 和 `skills/list`，不执行模型任务或修改全局设置。`--project-only` 用于复现当前客户端对项目技能开关的限制。

未知第三方技能的所有潜在冲突、连接器账户状态以及未来 Codex 版本行为不在自动测试保证范围内。

## 分享包验证

- 使用明确的源文件清单生成 `dist/personal-skills-hub-1.0.0.zip`；不收录 `.hub/`、截图、项目快照、插件缓存或原有第三方 skills。
- ZIP 完整性检查通过，保留 `.codex-plugin/plugin.json` 和所有运行时资源，另附 SHA-256 校验文件。
- 在新建临时目录完整解压后，安装器 `--check` 通过，包内原有 7 项 Node 功能测试全部通过。
- 模拟另一用户目录：空库返回 0 个技能；加入该用户自己的技能及重复副本后，识别与去重正确。
- 模拟找不到 Codex CLI：安装检查停止，未创建安装目录。
- 上述验证在本机 Windows 环境完成，未在第二台物理电脑或 macOS / Linux 上验证。

重新构建：`python -X utf8 scripts/package_share.py`。验证分享 ZIP：`python -X utf8 scripts/verify_share.py`。
