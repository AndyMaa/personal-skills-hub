import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { hash, jsonRead, selection } from './catalog.mjs';
import { resolveCodexCommand } from './codex-command.mjs';

const BEGIN = '# >>> Personal Skills Hub';
const END = '# <<< Personal Skills Hub';
const MD_BEGIN = '<!-- personal-skills-hub:start -->';
const MD_END = '<!-- personal-skills-hub:end -->';
const files = ['AGENTS.md', '.codex/config.toml', '.personal-skills-hub/project.json', '.personal-skills-hub/session.json', '.personal-skills-hub/launch.mjs', '.personal-skills-hub/Start Focused Codex.cmd'];
const read = async p => fs.readFile(p, 'utf8').catch(e => { if (e.code === 'ENOENT') return null; throw e; });
const slash = p => p.replaceAll('\\', '/');

function stripBlock(text, begin, end) {
  text ??= '';
  const start = text.indexOf(begin), stop = text.indexOf(end);
  if (start < 0 && stop < 0) return text;
  if (start < 0 || stop < start || text.indexOf(begin, start + begin.length) >= 0 || text.indexOf(end, stop + end.length) >= 0) {
    throw new Error('Hub 管理标记不完整或重复，请先修复对应文件。');
  }
  // Keep the exact surrounding content. The separator belongs to the managed block.
  return text.slice(0, start) + text.slice(stop + end.length).replace(/^\r?\n/, '');
}
function withBlock(text, begin, end, content) {
  const base = stripBlock(text, begin, end);
  return `${base}${base && !base.endsWith('\n') ? '\n' : ''}${begin}\n${content}\n${end}\n`;
}

export async function validateProject(input) {
  if (typeof input !== 'string' || !path.isAbsolute(input) || input.includes('\0')) throw new Error('请选择存在的项目文件夹，并使用绝对路径。');
  const project = await fs.realpath(input).catch(() => { throw new Error('项目文件夹不存在。'); });
  if (!(await fs.stat(project)).isDirectory()) throw new Error('项目路径必须是文件夹。');
  const forbidden = [path.parse(project).root, os.homedir(), path.join(os.homedir(), '.codex'), path.join(os.homedir(), '.agents')];
  if (forbidden.some(p => path.resolve(p).toLowerCase() === project.toLowerCase())) throw new Error('请选择具体的项目文件夹，不要选择磁盘根目录、用户目录或 Codex 配置目录。');
  // Never follow a project metadata junction/symlink into another workspace or user config.
  for (const relative of [...files, '.personal-skills-hub/history']) {
    let check = project;
    for (const part of relative.split('/')) {
      check = path.join(check, part);
      const stat = await fs.lstat(check).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
      if (stat?.isSymbolicLink()) throw new Error(`项目管理路径不能是符号链接或目录联接：${relative}`);
    }
  }
  return project;
}

async function snapshot(project) {
  const result = {};
  for (const file of files) result[file] = await read(path.join(project, file));
  return result;
}
const revision = state => hash(JSON.stringify(state));

export async function projectState(input) {
  const project = await validateProject(input);
  const before = await snapshot(project);
  const manifest = before[files[2]] ? JSON.parse(before[files[2]]) : null;
  return { project, manifest, revision: revision(before) };
}

export async function previewProject(catalog, input, ids, mode = 'guided') {
  if (!['focused', 'guided'].includes(mode)) throw new Error('未知的项目模式。');
  const project = await validateProject(input);
  const before = await snapshot(project);
  const current = before[files[2]] ? JSON.parse(before[files[2]]) : null;
  const chosen = selection(catalog, ids);
  if (chosen.conflicts.length) throw new Error(chosen.conflicts.map(c => c.message).join('\n'));
  const baseConfig = stripBlock(before[files[1]], BEGIN, END);
  if (/^\s*(?:\[\[\s*skills\s*\.\s*config\s*\]\]|\[\s*skills\s*\]|skills\s*=|skills\s*\.\s*config\s*=)/m.test(baseConfig) && mode === 'focused') {
    throw new Error('项目已有手写 skills 配置。为保留原规则，请先选「仅路由」模式，或手动合并现有 skills 配置后重试。');
  }
  const selectedPaths = new Set(chosen.skills.map(s => path.normalize(s.path)));
  const entries = [];
  if (mode === 'focused') {
    for (const skill of catalog.skills) {
      if (skill.protected && !chosen.ids.includes(skill.id)) continue;
      for (const copy of skill.copies) {
        entries.push({ path: copy.path, enabled: selectedPaths.has(path.normalize(copy.path)) });
      }
    }
  }
  const configBody = ['# Project-scoped skill selection. Built-in foundation skills remain available.',
    '# Some clients do not honor project-level skill switches; use the included CLI launcher.',
    ...entries.flatMap(e => ['[[skills.config]]', `path = ${JSON.stringify(slash(e.path))}`, `enabled = ${e.enabled}`, ''])].join('\n');
  const afterConfig = mode === 'focused' ? withBlock(before[files[1]], BEGIN, END, configBody) : stripBlock(before[files[1]], BEGIN, END);
  const policy = [
    '## Personal Skills Hub · 项目技能',
    '',
    '本项目的已选技能与适用范围如下。执行相关任务前，只读取匹配交付物的已选 SKILL.md；不用一次读取全部技能。',
    '用户明确指定的技能优先。系统和开发者要求优先于此项目清单。任务超出所选路线时，先说明缺少的能力并使用 Hub 调整；不要因宽泛关键词自动加载另一套同类制作系统。',
    '清单中的技能文件是指令入口。插件依赖的连接器、授权和本机运行时仍须实际可用；如果不可用，说明情况，不声称已启用。',
    '',
    ...chosen.skills.flatMap(s => [`### ${s.name} (${s.sourceLabel})`, `- 指令文件：${slash(s.path)}`, `- 适用：${s.use.replaceAll('\n', ' ')}`, `- 边界：${s.avoid.replaceAll('\n', ' ')}`, '']),
    ...(!chosen.skills.length ? ['当前未选择业务技能；需要时通过 Personal Skills Hub 添加。', ''] : []),
    `模式：${mode === 'focused' ? '聚焦 CLI（专用启动器通过会话参数限制未选业务技能；桌面端仍按本清单路由）' : '桌面版路由（只提供选用指引，不隐藏其他技能）'}。项目清单：.personal-skills-hub/project.json。`,
    '对于普通源码任务，不因本清单中存在媒体或演示技能而强行使用它们。'
  ].join('\n');
  const manifest = {
    schemaVersion: 1, project, mode, updatedAt: new Date().toISOString(),
    skills: chosen.skills.map(s => ({ id: s.id, key: s.key, name: s.name, path: s.path, hash: s.hash, source: s.sourceLabel })),
    // Preserve the baseline for a clean detach even after many reapplications.
    baseline: current?.baseline ?? before,
    lastTransaction: null
  };
  const launcher = mode === 'focused'
    ? (await fs.readFile(new URL('../assets/launch.mjs', import.meta.url), 'utf8')).replace('/* PSH_CODEX_RESOLVER */', resolveCodexCommand.toString())
    : null;
  const after = {
    [files[0]]: withBlock(before[files[0]], MD_BEGIN, MD_END, policy),
    [files[1]]: afterConfig || (before[files[1]] === null ? null : ''),
    [files[2]]: JSON.stringify(manifest, null, 2) + '\n',
    [files[3]]: mode === 'focused' ? JSON.stringify({ project, overrides: entries }, null, 2) + '\n' : null,
    [files[4]]: launcher,
    [files[5]]: mode === 'focused' ? '@echo off\r\nnode "%~dp0launch.mjs"\r\nif errorlevel 1 pause\r\n' : null
  };
  return {
    project, mode, skills: chosen.skills, ids: chosen.ids, warnings: chosen.warnings,
    disabled: entries.filter(e => !e.enabled).length, enabled: entries.filter(e => e.enabled).length,
    files: files.filter(file => before[file] !== after[file]).map(file => ({ path: file, before: before[file], after: after[file] })),
    revision: revision(before), before, after
  };
}

async function atomicWrite(file, content) {
  if (content === null) { await fs.unlink(file).catch(e => { if (e.code !== 'ENOENT') throw e; }); return; }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.psh-${crypto.randomUUID()}.tmp`;
  try { await fs.writeFile(temp, content, { flag: 'wx' }); await fs.rename(temp, file); }
  finally { await fs.unlink(temp).catch(() => {}); }
}

async function locked(project, fn) {
  const stateDir = path.join(project, '.personal-skills-hub');
  await fs.mkdir(stateDir, { recursive: true });
  const lockPath = path.join(stateDir, 'write.lock');
  const lock = await fs.open(lockPath, 'wx').catch(e => { if (e.code === 'EEXIST') throw new Error('这个项目正在写入，请稍后重试。若上次进程意外退出，请先确认没有 Hub 写入进程，再移除 write.lock。'); throw e; });
  try { return await fn(); } finally { await lock.close(); await fs.unlink(lockPath); }
}

async function commit(project, before, after, operation) {
  const id = crypto.randomUUID();
  const history = path.join(project, '.personal-skills-hub', 'history');
  await fs.mkdir(history, { recursive: true });
  const manifestText = after[files[2]];
  if (manifestText && operation !== 'undo') {
    const manifest = JSON.parse(manifestText);
    manifest.lastTransaction = id;
    after[files[2]] = JSON.stringify(manifest, null, 2) + '\n';
  }
  const transaction = { id, operation, createdAt: new Date().toISOString(), project, before, after, afterRevision: revision(after) };
  await atomicWrite(path.join(history, `${id}.json`), JSON.stringify(transaction, null, 2) + '\n');
  const touched = [];
  try {
    for (const file of files) {
      if (await read(path.join(project, file)) !== before[file]) throw new Error(`${file} 已被其他程序修改，操作已停止。`);
      await atomicWrite(path.join(project, file), after[file]);
      touched.push(file);
    }
  } catch (error) {
    for (const file of touched.reverse()) {
      if (await read(path.join(project, file)) === after[file]) await atomicWrite(path.join(project, file), before[file]);
    }
    throw error;
  }
  return { ok: true, project, transaction: id, operation, message: '已写入项目。桌面版请开启新项目聊天，按清单路由；聚焦 CLI 模式请运行项目中的专用启动器。' };
}

export async function applyProject(catalog, input, ids, mode, expectedRevision) {
  const project = await validateProject(input);
  return locked(project, async () => {
    const preview = await previewProject(catalog, project, ids, mode);
    if (expectedRevision && expectedRevision !== preview.revision) throw new Error('预览后项目文件已变化，请重新预览再添加。');
    // Catch a changed/deleted source instead of binding a stale catalog selection.
    for (const skill of preview.skills) if (hash(await fs.readFile(skill.path, 'utf8')) !== skill.hash) throw new Error(`${skill.name} 已变化，请重新扫描技能库。`);
    return { ...await commit(project, preview.before, preview.after, 'apply'), warnings: preview.warnings, skills: preview.ids, disabled: preview.disabled };
  });
}

export async function undoProject(input) {
  const project = await validateProject(input);
  return locked(project, async () => {
    const current = await snapshot(project);
    const manifest = current[files[2]] ? JSON.parse(current[files[2]]) : null;
    if (!manifest?.lastTransaction || !/^[a-f0-9-]{36}$/.test(manifest.lastTransaction)) throw new Error('这个项目没有可撤回的 Hub 操作。');
    const transaction = await jsonRead(path.join(project, '.personal-skills-hub/history', `${manifest.lastTransaction}.json`), null);
    if (!transaction || transaction.project !== project || revision(current) !== transaction.afterRevision) throw new Error('项目文件在添加后已被修改，为保留新内容，不能自动撤回。请使用「移除项目配置」仅移除 Hub 管理区块。');
    const result = await commit(project, current, { ...transaction.before }, 'undo');
    return { ...result, message: '已撤回上一次添加。重启 Codex / 开启新项目聊天后生效。' };
  });
}

export async function detachProject(input) {
  const project = await validateProject(input);
  return locked(project, async () => {
    const before = await snapshot(project);
    const manifest = before[files[2]] ? JSON.parse(before[files[2]]) : null;
    if (!manifest) throw new Error('这个项目还没有 Hub 配置。');
    if (!/^[a-f0-9-]{36}$/.test(manifest.lastTransaction || '')) throw new Error('Hub 清单中的历史记录 ID 无效。');
    const after = {};
    for (const [file, start, end] of [[files[0], MD_BEGIN, MD_END], [files[1], BEGIN, END]]) {
      const clean = stripBlock(before[file], start, end);
      const baseline = manifest.baseline?.[file];
      const original = baseline ?? '';
      const separator = original && !original.endsWith('\n') ? '\n' : '';
      after[file] = clean === original || clean === original + separator ? baseline ?? null : clean;
    }
    after[files[2]] = null;
    const expected = await jsonRead(path.join(project, '.personal-skills-hub/history', `${manifest.lastTransaction}.json`), null);
    for (const file of files.slice(3)) {
      // Preserve a user-edited launcher or session file rather than deleting it.
      if (expected?.after?.[file] !== before[file]) throw new Error(`${file} 已被修改，请先备份或恢复该 Hub 文件。`);
      after[file] = manifest.baseline?.[file] ?? null;
    }
    return commit(project, before, after, 'detach');
  });
}
