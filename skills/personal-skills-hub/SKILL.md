---
name: personal-skills-hub
description: 按项目整理和选择已经安装的 Codex skills，比较相似技能的适用范围，打开本地技能面板，应用或撤回项目技能组合。用户要管理已有 skills、避免选错技能、配置项目技能包时使用；不代替被选技能执行具体业务，也不负责联网下载新技能。
---

# Personal Skills Hub

此插件扫描本机技能库，合并同名本地副本，展示适用边界，并生成项目级使用清单。

插件根目录是本 SKILL.md 所在目录的上两级。命令入口为本技能的 `scripts/hub.mjs`。通过 Node.js 22+ 执行；路径含空格时必须用当前 shell 的正确引用方式。

## 使用面板

用户要求打开 Hub 或挑选技能时，运行：

```text
node "<本技能绝对路径>/scripts/hub.mjs" serve --open --project "<当前项目绝对路径>"
```

把进程作为后台进程启动（Windows 的 Start-Process 使用 `-WindowStyle Hidden`）；输出中包含本地地址及会话 token，不要把这个临时 token 写入项目文件。默认端口 47831 被占用时，使用 `--port 0` 申请空闲端口。服务启动后保留进程供用户选择，展示可访问的本地地址。

## 在对话中选择和应用

1. 用 `scan --json` 读取实时目录，不假设安装目录、来源版本或连接器可用。不要一次读取所有 SKILL.md。
2. 按交付物选择技能。用 `recommend "项目需求"` 获取基于规则的起点；建议不是语义模型判断，检查它与需求是否一致。格式不明确并影响选型时才澄清。
3. 对相似候选，读取其 SKILL.md 中真正影响选择的段落。每个产出阶段选择一种主要生成/剪辑系统；辅助技能由 Hub 补齐。用户明确指定的来源优先。同名跨插件技能用目录中的完整 `key` 区分。
4. 用 `preview --project "..." --preset <id>`，或 `--skills <逗号分隔的完整key>` 检查配置。用户已要求添加时直接 `apply`；仅询问推荐时，给出理由和可用组合，不自行修改项目。
5. 报告选择理由、写入的项目路径及生效条件。已有聊天不会因此清除已加载的技能上下文；需在受信任的项目中重启 Codex 或开启新聊天。

常用命令：

```text
node "<本技能绝对路径>/scripts/hub.mjs" scan --json
node "<本技能绝对路径>/scripts/hub.mjs" recommend "把研究报告做成可编辑 PPTX"
node "<本技能绝对路径>/scripts/hub.mjs" apply --project "<项目绝对路径>" --preset research
node "<本技能绝对路径>/scripts/hub.mjs" apply --project "<项目绝对路径>" --skills ppt-router,ppt-master
node "<本技能绝对路径>/scripts/hub.mjs" status --project "<项目绝对路径>"
node "<本技能绝对路径>/scripts/hub.mjs" undo --project "<项目绝对路径>"
node "<本技能绝对路径>/scripts/hub.mjs" detach --project "<项目绝对路径>"
```

`guided`（默认）为 Codex 桌面版写入项目路由指引，其他技能仍可见。不要声称已实现技能隔离。实测 Codex 0.166.0-alpha.5.1 的项目 skills.config 不改变实际技能启用状态；会话启动参数有效。

用户明确要求限制未选技能时，用 `--mode focused`。它同时生成项目配置及独立的 CLI 启动器：`<项目>/.personal-skills-hub/Start Focused Codex.cmd`（Windows）或 `node "<项目>/.personal-skills-hub/launch.mjs"`。该启动器通过会话参数限制未选业务技能，保留系统、官方运行时和基础工具。限制只对从它启动的 CLI 会话生效，桌面版仍按项目清单路由。项目已有手写 skills 配置时，focused 拒绝覆盖，改用 guided 或在用户要求下合并配置。

所有操作仅管理目标项目中的 `AGENTS.md` 区块、`.codex/config.toml` 区块和 `.personal-skills-hub/` 清单、启动器及历史。原技能文件、全局技能启用状态及连接器不被修改。缓存中存在某个插件技能，不代表该插件已连接；应用不安装或授权其工具。当前缓存以外新下载的技能需重新扫描后才能纳入限制。

撤回会校验文件是否被其他程序修改，拒绝覆盖用户后续编辑。此时使用 `detach` 仅移除管理区块；不要强行覆盖或恢复整个项目。
