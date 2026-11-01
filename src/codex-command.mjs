// This function is also embedded in the generated project launcher.
// Keep its dependencies inside the function so that the launcher stays portable.
export async function resolveCodexCommand({ env = process.env, platform = process.platform } = {}) {
  if (platform !== 'win32') return { command: 'codex', args: [] };
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const exists = async file => fs.access(file).then(() => true, () => false);
  for (const entry of (env.PATH || env.Path || '').split(';').filter(Boolean)) {
    const directory = entry.replace(/^"|"$/g, '');
    const executable = path.join(directory, 'codex.exe');
    if (await exists(executable)) return { command: executable, args: [] };
    if (await exists(path.join(directory, 'codex.cmd'))) {
      const npmEntry = path.join(directory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (await exists(npmEntry)) return { command: process.execPath, args: [npmEntry] };
      throw new Error('找到了 codex.cmd，但没有找到 npm 的 Codex 入口。请修复 Codex CLI 安装，或使用官方独立安装器。');
    }
  }
  return { command: 'codex', args: [] };
}
