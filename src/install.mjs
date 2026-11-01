import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveCodexCommand } from './codex-command.mjs';
const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const marketplaceRoot = path.join(codexHome, 'plugins', 'personal-skills-hub-local');
const pluginRoot = path.join(marketplaceRoot, 'plugins', 'personal-skills-hub');
const marketplace = { name: 'personal-skills-hub-local', interface: { displayName: 'Personal Skills Hub · 本地插件' }, plugins: [{ name: 'personal-skills-hub', source: { source: 'local', path: './plugins/personal-skills-hub' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }] };
const payload = ['src', 'web', 'skills', 'assets', '.codex-plugin', 'plugin.json', 'package.json', 'README.md', 'README.en.md', 'SHARING.md', 'VALIDATION.md', 'LICENSE'];
let copying = false;
try {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node.js 22 或更新版本。');
  for (const name of payload) await fs.access(path.join(root, name));
  // Check the recipient's CLI before writing any plugin files or user configuration.
  const executable = await resolveCodexCommand();
  const codex = args => exec(executable.command, [...executable.args, ...args], { windowsHide: true, timeout: 60000 });
  try {
    await codex(['plugin', 'add', '--help']);
    await codex(['plugin', 'marketplace', 'add', '--help']);
  } catch (e) {
    throw new Error(`需要支持 plugin 命令的 Codex CLI，并确保 codex 在 PATH 中可运行。请先在终端检查 codex --version。\n${e.code === 'ENOENT' ? '当前没有找到 codex 命令。' : e.stderr || e.message}`);
  }
  if (process.argv.includes('--check')) {
    console.log(`安装环境检查通过：Node.js ${process.versions.node}；Codex CLI 支持本地插件。未写入安装文件。`);
  } else {
    copying = true;
    await fs.mkdir(pluginRoot, { recursive: true });
    for (const name of payload) {
      await fs.cp(path.join(root, name), path.join(pluginRoot, name), { recursive: true });
    }
    const catalogDir = path.join(marketplaceRoot, '.agents/plugins');
    await fs.mkdir(catalogDir, { recursive: true });
    await fs.writeFile(path.join(catalogDir, 'marketplace.json'), JSON.stringify(marketplace, null, 2) + '\n');
    const added = await codex(['plugin', 'marketplace', 'add', marketplaceRoot, '--json']);
    console.log(added.stdout.trim());
    const installed = await codex(['plugin', 'add', 'personal-skills-hub@personal-skills-hub-local', '--json']);
    console.log(installed.stdout.trim());
    console.log('Personal Skills Hub 已安装。重启 Codex后，在插件页面找到 Personal Skills Hub，点击“立即试用”。');
  }
} catch (e) {
  console.error(`安装未完成：${e.stderr || e.message}${copying ? `\n插件目录：${pluginRoot}\n本地市场目录：${marketplaceRoot}` : '\n尚未写入安装文件，请处理上述环境问题后重试。'}`);
  process.exitCode = 1;
}
