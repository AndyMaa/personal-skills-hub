# 发布到 GitHub

建议仓库名称：`personal-skills-hub`。许可证：MIT。

## 首次上传

项目目录应是独立 Git 仓库。先在 GitHub 创建一个空仓库，再在本项目目录执行：

```sh
git status --short
git add .
git diff --cached --stat
git commit -m "Prepare Personal Skills Hub 1.0.1"
git remote add origin https://github.com/AndyMaa/personal-skills-hub.git
git push -u origin main
```

使用自己的 fork 时，将 `AndyMaa` 替换为自己的 GitHub 用户名。已有 origin 时先检查 `git remote -v`。运行 `git rev-parse --show-toplevel` 应指向本项目目录。

`.hub/`、`.personal-skills-hub/`、`dist/`、环境变量文件和运行日志已加入忽略规则。首次提交前审阅 `git diff --cached`；README 预览图使用项目自有界面截图。

## 别人如何安装

仓库根目录包含 `.agents/plugins/marketplace.json`。上传后可使用：

```sh
codex plugin marketplace add AndyMaa/personal-skills-hub
codex plugin add personal-skills-hub@personal-skills-hub
```

或者下载仓库并运行 `node src/install.mjs`。这两种来源使用不同的 marketplace 名称；已使用本地分享版的用户选择其中一种来源即可。

## 发布可下载 ZIP

```sh
npm run check
npm test
npm run package:share
npm run verify:share
```

将 `dist/` 中对应版本的 ZIP 与 `.sha256` 文件附到 GitHub Release。源码里的三个 manifest 版本由 `npm run check` 校验一致。CI 在 Windows、macOS、Linux 的 Node.js 22 / 24 上运行测试，另行验证 ZIP；远端 Actions 的结果需上传仓库后查看。

可选地创建版本标签，再使用 GitHub 的 Releases 页面发布；ZIP 也可从 CI 的构建产物下载。GitHub Release 与公开插件商店是不同的发布渠道。

## 已知限制

桌面模式按项目指令路由，不承诺过滤其他技能。聚焦限制通过专用 CLI 启动器生效。连接器授权保留在使用者自己的账户中。

本地 Windows 行为已有实测；跨系统测试由 CI 配置覆盖，未运行远端 Actions 前不要将其写成已通过。
