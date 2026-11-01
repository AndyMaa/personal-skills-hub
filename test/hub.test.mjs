import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { scanCatalog, frontmatter, resolveNames, selection, recommend } from '../src/catalog.mjs';
import { previewProject, applyProject, projectState, undoProject, detachProject } from '../src/project.mjs';
import { startServer } from '../src/server.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'personal-skills-hub-test-'));
  t.after(async () => { assert.ok(root.startsWith(path.join(os.tmpdir(), 'personal-skills-hub-test-'))); await fs.rm(root, { recursive: true, force: true }); });
  const home = path.join(root, 'home'), codexHome = path.join(home, '.codex'), project = path.join(root, '项目 with spaces');
  await fs.mkdir(project, { recursive: true });
  const writeSkill = async (relative, name, description = 'A useful test skill') => {
    const dir = path.join(home, relative);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`);
    return dir;
  };
  await writeSkill('.agents/skills/ppt-master', 'ppt-master');
  await writeSkill('.codex/skills/ppt-master', 'ppt-master', 'Old copy');
  await writeSkill('.agents/skills/ppt-router', 'ppt-router');
  await writeSkill('.agents/skills/cyber-ppt', 'cyber-ppt');
  await writeSkill('.agents/skills/frontend-slides', 'frontend-slides');
  for (const name of ['hyperframes', 'hyperframes-cli', 'hyperframes-registry', 'media-use', 'ffmpeg-skill']) await writeSkill(`.agents/skills/${name}`, name);
  await writeSkill('.codex/skills/.system/skill-creator', 'skill-creator');
  await writeSkill('.codex/plugins/cache/custom/fal/1.0.0/skills/ugc', 'ugc');
  await writeSkill('.codex/plugins/cache/custom/fal/2.0.0/skills/ugc', 'ugc', 'Newest fal');
  await writeSkill('.codex/plugins/cache/custom/app-6a42/1.0.0/skills/ugc', 'ugc', 'OpenArt');
  const scanOptions = { home, codexHome };
  const catalog = await scanCatalog(scanOptions);
  return { root, home, codexHome, project: await fs.realpath(project), catalog, writeSkill, scanOptions };
}

test('catalog: metadata, duplicate preference, plugin namespaces, latest version and helper expansion', async t => {
  const f = await fixture(t), ppt = f.catalog.skills.find(s => s.name === 'ppt-master');
  assert.equal(ppt.copies.length, 2); assert.match(ppt.path, /\.agents/); assert.equal(ppt.identical, false);
  assert.equal(f.catalog.skills.filter(s => s.name === 'ugc').length, 2);
  assert.match(f.catalog.skills.find(s => s.key === 'fal/ugc').path, /2\.0\.0/);
  assert.throws(() => resolveNames(f.catalog, ['ugc']), /多个来源/);
  const motion = selection(f.catalog, resolveNames(f.catalog, ['hyperframes']).ids);
  assert.equal(motion.ids.length, 4);
  const conflict = selection(f.catalog, resolveNames(f.catalog, ['ppt-master', 'cyber-ppt']).ids);
  assert.equal(conflict.conflicts.length, 1);
  assert.equal(recommend(f.catalog, '把研究报告做成可编辑 PPTX').preset, 'research');
  assert.equal(frontmatter('---\r\nname: folded\r\ndescription: >\r\n  first line\r\n  second line\r\nmetadata:\r\n  role: router\r\n---\r\n').description, 'first line second line');
});

test('project: apply selected sources, disable copies, preserve foundation and existing files, undo exactly', async t => {
  const f = await fixture(t);
  const original = '# My project\n\nKeep these instructions exactly.\n';
  await fs.writeFile(path.join(f.project, 'AGENTS.md'), original);
  await fs.mkdir(path.join(f.project, '.codex'));
  await fs.writeFile(path.join(f.project, '.codex/config.toml'), 'model = "example"\n');
  const ids = resolveNames(f.catalog, ['ppt-router', 'ppt-master']).ids;
  const preview = await previewProject(f.catalog, f.project, ids, 'focused');
  assert.ok(preview.disabled > 0);
  const config = preview.after['.codex/config.toml'];
  assert.match(config, /model = "example"/); assert.match(config, /enabled = true/); assert.match(config, /enabled = false/);
  assert.doesNotMatch(config, /skill-creator/);
  const sourceBefore = await fs.readFile(f.catalog.skills.find(s => s.name === 'ppt-master').path, 'utf8');
  await applyProject(f.catalog, f.project, ids, 'focused', preview.revision);
  const state = await projectState(f.project);
  assert.equal(state.manifest.skills.length, 2);
  assert.equal(state.manifest.mode, 'focused');
  assert.ok((await fs.readFile(path.join(f.project, 'AGENTS.md'), 'utf8')).startsWith(original));
  assert.equal(await fs.readFile(f.catalog.skills.find(s => s.name === 'ppt-master').path, 'utf8'), sourceBefore);
  await undoProject(f.project);
  assert.equal(await fs.readFile(path.join(f.project, 'AGENTS.md'), 'utf8'), original);
  assert.equal(await fs.readFile(path.join(f.project, '.codex/config.toml'), 'utf8'), 'model = "example"\n');
  assert.equal((await projectState(f.project)).manifest, null);
});

test('project: stale preview and changed source fail before mutation', async t => {
  const f = await fixture(t), ids = resolveNames(f.catalog, ['ppt-master']).ids;
  const preview = await previewProject(f.catalog, f.project, ids);
  await fs.writeFile(path.join(f.project, 'AGENTS.md'), 'Changed outside Hub\n');
  await assert.rejects(applyProject(f.catalog, f.project, ids, 'focused', preview.revision), /文件已变化/);
  assert.equal((await projectState(f.project)).manifest, null);
  await fs.appendFile(f.catalog.skills.find(s => s.id === ids[0]).path, '\nChanged source');
  await assert.rejects(applyProject(f.catalog, f.project, ids, 'focused'), /已变化/);
  assert.equal(await fs.readFile(path.join(f.project, 'AGENTS.md'), 'utf8'), 'Changed outside Hub\n');
});

test('project: conflict rejection, guided mode with existing skills table, and clean detach', async t => {
  const f = await fixture(t);
  await assert.rejects(previewProject(f.catalog, f.project, resolveNames(f.catalog, ['ppt-master', 'cyber-ppt']).ids), /相同制作路线/);
  await fs.mkdir(path.join(f.project, '.codex'));
  const existing = '[skills]\nmax_context_tokens = 1000\n';
  await fs.writeFile(path.join(f.project, '.codex/config.toml'), existing);
  const ids = resolveNames(f.catalog, ['ppt-master']).ids;
  await assert.rejects(applyProject(f.catalog, f.project, ids, 'focused'), /手写 skills/);
  await applyProject(f.catalog, f.project, ids, 'guided');
  assert.equal(await fs.readFile(path.join(f.project, '.codex/config.toml'), 'utf8'), existing);
  await fs.appendFile(path.join(f.project, 'AGENTS.md'), '\nNew user instruction\n');
  await assert.rejects(undoProject(f.project), /已被修改/);
  await detachProject(f.project);
  assert.equal(await fs.readFile(path.join(f.project, 'AGENTS.md'), 'utf8'), '\nNew user instruction\n');
  assert.equal(await fs.readFile(path.join(f.project, '.codex/config.toml'), 'utf8'), existing);
  assert.equal((await projectState(f.project)).manifest, null);
});

test('project: repeated apply supports undo chain and mode switching without duplicate blocks', async t => {
  const f = await fixture(t);
  await applyProject(f.catalog, f.project, resolveNames(f.catalog, ['ppt-master']).ids, 'focused');
  const first = await fs.readFile(path.join(f.project, 'AGENTS.md'), 'utf8');
  await applyProject(f.catalog, f.project, resolveNames(f.catalog, ['frontend-slides']).ids, 'guided');
  assert.equal((await fs.readFile(path.join(f.project, 'AGENTS.md'), 'utf8')).split('<!-- personal-skills-hub:start -->').length, 2);
  assert.equal(await fs.readFile(path.join(f.project, '.codex/config.toml'), 'utf8'), '');
  await undoProject(f.project);
  assert.equal(await fs.readFile(path.join(f.project, 'AGENTS.md'), 'utf8'), first);
  await undoProject(f.project);
  assert.equal((await projectState(f.project)).manifest, null);
});

test('project: reject junctions pointing at global configuration', async t => {
  const f = await fixture(t), target = path.join(f.root, 'external');
  await fs.mkdir(target);
  await fs.symlink(target, path.join(f.project, '.codex'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(applyProject(f.catalog, f.project, resolveNames(f.catalog, ['ppt-master']).ids, 'focused'), /联接/);
  assert.deepEqual(await fs.readdir(target), []);
});

test('project: detach restores files that originally had no trailing newline', async t => {
  const f = await fixture(t);
  const instructions = '# Instructions without a trailing newline';
  const config = 'model = "example"';
  await fs.writeFile(path.join(f.project, 'AGENTS.md'), instructions);
  await fs.mkdir(path.join(f.project, '.codex'));
  await fs.writeFile(path.join(f.project, '.codex/config.toml'), config);
  await applyProject(f.catalog, f.project, resolveNames(f.catalog, ['ppt-master']).ids, 'focused');
  await detachProject(f.project);
  assert.equal(await fs.readFile(path.join(f.project, 'AGENTS.md'), 'utf8'), instructions);
  assert.equal(await fs.readFile(path.join(f.project, '.codex/config.toml'), 'utf8'), config);
});

test('server: authenticated local API, cross-site rejection, no arbitrary file serving and actual apply', async t => {
  const f = await fixture(t);
  const { server, token, url } = await startServer({ port: 0, scanOptions: f.scanOptions });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = url.split('/#')[0];
  const post = (route, body, headers = {}) => fetch(`${base}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Token': token, ...headers }, body: JSON.stringify(body) });
  assert.equal((await fetch(`${base}/api/catalog`, { method: 'POST' })).status, 403);
  assert.equal((await post('catalog', {}, { Origin: 'https://untrusted.example' })).status, 403);
  const badHostStatus = await new Promise((resolve, reject) => {
    const req = http.request(`${base}/api/catalog`, { method: 'POST', headers: { Host: 'untrusted.example', 'Content-Type': 'application/json', 'X-Hub-Token': token } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end('{}');
  });
  assert.equal(badHostStatus, 403);
  assert.equal((await fetch(`${base}/src/catalog.mjs`)).status, 404);
  assert.equal((await post('catalog', null)).status, 400);
  const catalog = await (await post('catalog', {})).json();
  assert.equal(catalog.stats.duplicates, 1);
  const chosen = await (await post('preset', { id: 'pptx' })).json();
  const preview = await (await post('preview', { project: f.project, skills: chosen.ids, mode: 'focused' })).json();
  const applied = await (await post('apply', { project: f.project, skills: chosen.ids, mode: 'focused', revision: preview.revision })).json();
  assert.equal(applied.ok, true);
  assert.equal((await projectState(f.project)).manifest.skills.length, 2);

  // A Chinese path can arrive split between bytes of one UTF-8 character.
  const payload = Buffer.from(JSON.stringify({ project: f.project }));
  const split = payload.indexOf(Buffer.from('项目')) + 1;
  const splitResponse = await new Promise((resolve, reject) => {
    const req = http.request(`${base}/api/project`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Token': token } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('error', reject);
    req.write(payload.subarray(0, split));
    setTimeout(() => req.end(payload.subarray(split)), 5);
  });
  assert.equal(splitResponse.status, 200);
  assert.equal(splitResponse.body.project, f.project);
});
