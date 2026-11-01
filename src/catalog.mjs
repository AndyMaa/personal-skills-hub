import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { classify, categories, presets } from './rules.mjs';

export const exists = async p => !!(await fs.lstat(p).catch(() => null));
export const jsonRead = async (p, fallback) => {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
};
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');

export function frontmatter(text) {
  const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('缺少 YAML frontmatter');
  const lines = match[1].split(/\r?\n/);
  const get = key => {
    const index = lines.findIndex(line => line.startsWith(`${key}:`));
    if (index < 0) return '';
    let value = lines[index].slice(key.length + 1).trim();
    if (/^[>|][+-]?$/.test(value) || !value) {
      value = lines.slice(index + 1).filter((line, i, all) => !all.slice(0, i + 1).some(l => /^\S/.test(l))).join(' ').trim();
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      try { return JSON.parse(value); } catch { return value.slice(1, -1); }
    }
    if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
    return value;
  };
  const name = get('name'), description = get('description');
  if (!name || !description) throw new Error('缺少 name 或 description');
  return { name, description: description.replace(/\s+/g, ' ').trim() };
}

async function directories(p) {
  return (await fs.readdir(p, { withFileTypes: true }).catch(() => []))
    .filter(d => d.isDirectory() || d.isSymbolicLink()).map(d => d.name).sort();
}

export async function scanCatalog({ home = os.homedir(), codexHome = process.env.CODEX_HOME || path.join(home, '.codex'), extraRoots = [] } = {}) {
  const warnings = [], entries = [];
  async function add(dir, kind, provider = '', marketplace = '', priority = 0) {
    const file = path.join(dir, 'SKILL.md');
    try {
      const raw = await fs.readFile(file, 'utf8');
      const meta = frontmatter(raw);
      if (meta.name === 'personal-skills-hub') return;
      entries.push({ ...meta, dir: path.resolve(dir), path: file, realDir: await fs.realpath(dir), kind, provider, marketplace, priority, hash: hash(raw), modified: (await fs.stat(file)).mtimeMs });
    } catch (e) { if (e.code !== 'ENOENT') warnings.push(`${file}: ${e.message}`); }
  }
  async function localRoot(root, kind, priority) {
    for (const name of await directories(root)) {
      if (name.startsWith('.')) continue;
      const dir = path.join(root, name);
      await add(dir, kind, '', '', priority);
      for (const nested of await directories(path.join(dir, 'skills'))) await add(path.join(dir, 'skills', nested), kind, '', '', priority - 1);
    }
  }
  await localRoot(path.join(home, '.agents', 'skills'), 'local', 30);
  await localRoot(path.join(codexHome, 'skills'), 'local', 20);
  for (const root of extraRoots) await localRoot(root, 'local', 40);
  await localRoot(path.join(codexHome, 'skills', '.system'), 'system', 10);
  const cache = path.join(codexHome, 'plugins', 'cache');
  for (const marketplace of await directories(cache)) {
    for (const provider of await directories(path.join(cache, marketplace))) {
      const root = path.join(cache, marketplace, provider);
      const versions = (await directories(root)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      // One version per plugin. Avoid surfacing stale versions as duplicate skills.
      for (const version of versions) {
        const skillRoot = path.join(root, version, 'skills');
        if (!(await exists(skillRoot))) continue;
        for (const name of await directories(skillRoot)) await add(path.join(skillRoot, name), 'plugin', provider, marketplace, 10);
        break;
      }
    }
  }
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.kind === 'plugin' ? `${entry.provider}/${entry.name.toLowerCase()}` : entry.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    if (!groups.get(key).some(x => x.path === entry.path)) groups.get(key).push(entry);
  }
  const skills = [...groups.entries()].map(([key, copies]) => {
    copies.sort((a, b) => b.priority - a.priority || b.modified - a.modified || a.path.localeCompare(b.path));
    const main = copies[0];
    const protectedSkill = main.kind === 'system' || ['openai-bundled', 'openai-primary-runtime'].includes(main.marketplace);
    const details = classify(main.name.toLowerCase(), main.description, main.provider);
    return { ...main, ...details, id: hash(key).slice(0, 16), key, protected: protectedSkill, copies, duplicate: copies.length > 1, identical: copies.every(c => c.hash === main.hash), sourceLabel: main.kind === 'system' ? 'Codex 内置' : main.kind === 'local' ? '本地技能' : main.provider.startsWith('app-6a42') ? 'OpenArt 插件' : `${main.provider} 插件` };
  }).sort((a, b) => Number(a.protected) - Number(b.protected) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return { skills, categories, presets, warnings, scannedAt: new Date().toISOString(), stats: { skills: skills.length, files: entries.length, duplicates: skills.filter(s => s.duplicate).length, local: skills.filter(s => s.kind === 'local').length, plugin: skills.filter(s => s.kind === 'plugin').length } };
}

export function resolveNames(catalog, names) {
  const found = [], missing = [];
  for (const name of names) {
    const normalized = name.toLowerCase();
    const matches = catalog.skills.filter(s => s.key.toLowerCase() === normalized || s.id === normalized || s.name.toLowerCase() === normalized);
    const exact = matches.find(s => s.key.toLowerCase() === normalized || s.id === normalized);
    if (!matches.length) missing.push(name);
    else if (exact) found.push(exact.id);
    else if (matches.length === 1) found.push(matches[0].id);
    else throw new Error(`技能名 ${name} 有多个来源，请使用完整 key：${matches.map(s => s.key).join(', ')}`);
  }
  return { ids: [...new Set(found)], missing };
}

export function selection(catalog, ids) {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('skills 必须是技能 ID 数组');
  const selected = new Map();
  const add = id => {
    if (selected.has(id)) return;
    const skill = catalog.skills.find(s => s.id === id);
    if (!skill) throw new Error(`技能不存在，请重新扫描：${id}`);
    selected.set(id, skill);
    for (const name of skill.companions || []) {
      const companion = catalog.skills.find(s => s.name === name && s.kind === 'local');
      if (!companion) throw new Error(`${skill.name} 缺少辅助技能 ${name}`);
      add(companion.id);
    }
  };
  ids.forEach(add);
  const list = [...selected.values()], conflicts = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.name === b.name || (a.group && a.group === b.group)) conflicts.push({ ids: [a.id, b.id], message: `${a.name} 与 ${b.name} 属于相同制作路线，请保留一个。` });
  }
  const warnings = list.filter(s => s.kind === 'plugin').map(s => `${s.sourceLabel}：请确保原插件已安装并连接；本 Hub 只管理 skill，不提供或启用连接器。`);
  return { skills: list, ids: list.map(s => s.id), conflicts, warnings: [...new Set(warnings)] };
}

export function recommend(catalog, brief) {
  const text = String(brief).toLowerCase();
  const ranked = presets.map(p => ({ ...p, score: p.tags.reduce((n, t) => n + (text.includes(t) ? (/^(ppt|pptx|html|slides)$/.test(t) ? 1 : 2) : 0), 0) })).filter(p => p.score).sort((a, b) => b.score - a.score);
  if (!ranked.length) return { ids: [], message: '暂未匹配到明确路线，请先选择项目类型，或搜索技能。', candidates: [] };
  const best = ranked[0];
  const resolved = resolveNames(catalog, best.names);
  return { ...selection(catalog, resolved.ids), preset: best.id, message: `建议采用「${best.title}」路线。可按具体交付要求调整。`, missing: resolved.missing, candidates: ranked.slice(0, 3).map(p => ({ id: p.id, title: p.title })) };
}
