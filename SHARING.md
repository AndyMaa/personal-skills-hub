# Personal Skills Hub · 分享安装说明

这是一个在本机运行的 Codex 个人插件，用来整理已安装的 skills、比较适用边界、选择项目技能组合，并生成可撤回的项目使用规则。

## 收到压缩包后怎么安装

本分享包提供 Windows 便捷安装入口。先准备：

- 已安装并登录的 Codex 桌面应用。
- [Node.js](https://nodejs.org/) 22 或更新版本，安装后在终端运行 `node --version` 应显示版本号。
- 支持 `codex plugin` 命令的 Codex CLI，且 `codex --version` 能在终端运行。只有桌面应用、找不到 codex 命令时，需要先配置 CLI；安装方法见 [OpenAI 官方 Codex CLI 文档](https://learn.chatgpt.com/docs/cli)。

安装步骤：

1. 将 ZIP 完整解压到本机文件夹；不要在压缩软件的预览窗口里直接运行安装器。
2. Windows 双击 `Install Codex Plugin.cmd`，等待显示安装成功。安装器先检查环境，再复制插件和注册个人本地插件市场。
3. 重启 Codex。
4. 打开“插件”，找到 **Personal Skills Hub**，点击“立即试用”。
5. 进入要工作的项目，发送：“打开 Personal Skills Hub，为当前项目选择需要的 skills。”

也可以在解压目录的终端中运行：

```text
node src/install.mjs --check
node src/install.mjs
```

`--check` 仅检查环境，不写入安装文件。无需执行 `npm install`，本插件运行时没有第三方 npm 依赖。

1.0.1 起，Windows 安装器和生成的聚焦启动器支持独立 `codex.exe`，以及官方 npm 安装产生的 `codex.cmd` 入口；命令参数不通过 shell 拼接。

如果暂时只想使用管理面板，Windows 双击 `Open Personal Skills Hub.cmd`；终端中也可运行 `node src/cli.mjs serve --open --port 0`。使用 `Open Personal Skills Hub.vbs` 可隐藏启动窗口。

安装器会将插件复制到当前用户的 Codex 插件目录，原解压文件夹之后可移动。若只是直接启动面板而没有安装插件，应保留解压后的源文件。

## 对方会看到哪些技能

Hub 会扫描使用者自己的 `.agents/skills`、`.codex/skills` 和 Codex 插件缓存。不同电脑显示的技能数量可以不同；没有安装的技能不会因为使用 Hub 自动下载。

本包包含 Hub 自己的入口 skill、分类规则、中文面板、安装器和项目配置工具。它不附带作者电脑上的其他 skills、项目文件、账号授权、技能目录快照、运行日志或会话凭据。使用第三方服务时，使用者需要自行安装和连接对应插件。

在自己的电脑上配置的项目清单含本机路径。换电脑时，应在新电脑重新扫描并添加项目技能组合。

## 两种项目模式

- **Codex 桌面路由**：默认模式，为项目写入已选技能及适用边界；其他技能仍可见。添加后开启新的项目聊天。
- **聚焦 CLI**：生成专用启动器，在它启动的 Codex CLI 会话中限制未选业务技能。该限制不自动应用到桌面聊天。

这一区别来自已测试客户端的实际行为，详见 `README.md` 与 `VALIDATION.md`。目前实测 Windows；其他系统可尝试终端命令，但尚未做跨系统验证。

## 分享给朋友与公开上架

给朋友或小团队使用：直接发送这个 ZIP，对方按上述步骤本地安装。已有的本机插件链接和 localhost 地址不能替代跨电脑安装包。

通过 Git 仓库分发：可将解压内容放入仓库，再使用 [OpenAI 本地 / Git marketplace 机制](https://developers.openai.com/plugins/build/plugins) 维护安装入口。

仓库已附 `.agents/plugins/marketplace.json`。上传后可运行 `codex plugin marketplace add AndyMaa/personal-skills-hub`，再运行 `codex plugin add personal-skills-hub@personal-skills-hub`；安装其他 fork 时请替换仓库所有者。详见 [GitHub 发布步骤](docs/publishing.md)。

让其他人在公开插件目录中搜索和安装：需要准备发布身份与信息，按 [OpenAI 插件提交流程](https://developers.openai.com/plugins/deploy/submission) 提交审核。本 Hub 依赖本机执行，需要遵循 [Desktop only 插件说明](https://developers.openai.com/plugins/deploy/desktop-only)。这个朋友分享包用于本地安装，不代表已上架公开目录。

## 更新和卸载

收到新版本后，解压并再次运行安装器，再重启 Codex。已选项目组合保存在各项目自己的 `.personal-skills-hub/` 中，收藏和自定义组合保存在使用者的浏览器中。

卸载可以在 Codex 插件管理中完成。项目内已写入的规则独立保留；如需移除这些规则，先通过 Hub 的“移除项目配置”功能清理对应项目。
