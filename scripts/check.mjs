import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { frontmatter } from '../src/catalog.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const pkg = await readJson('package.json');
const portable = await readJson('plugin.json');
const codex = await readJson('.codex-plugin/plugin.json');
for (const manifest of [portable, codex]) {
  assert.equal(manifest.name, pkg.name, 'Plugin names must agree');
  assert.equal(manifest.version, pkg.version, 'Plugin versions must agree');
  assert.equal(manifest.license, pkg.license, 'Plugin licenses must agree');
}
assert.match(await fs.readFile(path.join(root, 'LICENSE'), 'utf8'), /MIT License/);
for (const reference of [codex.skills, codex.interface.logo, codex.interface.composerIcon]) {
  assert.ok(reference.startsWith('./') && !reference.split('/').includes('..'));
  await fs.access(path.join(root, reference));
}
const marketplace = await readJson('.agents/plugins/marketplace.json');
assert.equal(marketplace.plugins[0].name, pkg.name);
assert.equal(marketplace.plugins[0].source.path, './');
const skill = frontmatter(await fs.readFile(path.join(root, 'skills/personal-skills-hub/SKILL.md'), 'utf8'));
assert.equal(skill.name, pkg.name);
assert.ok(skill.description.length > 20);
assert.ok((await fs.readFile(path.join(root, 'web/index.html'), 'utf8')).includes(`v${pkg.version}`), 'The panel version must match the package');
for (const document of ['README.md', 'README.en.md', 'CONTRIBUTING.md', 'SHARING.md', 'VALIDATION.md', 'docs/publishing.md']) {
  const markdown = await fs.readFile(path.join(root, document), 'utf8');
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    if (!/^(?:https?:|#)/.test(match[1])) await fs.access(path.resolve(root, path.dirname(document), match[1].split('#')[0]));
  }
}

let checked = 0;
async function checkDirectory(relative) {
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) await checkDirectory(next);
    else if (/\.(?:mjs|js)$/.test(entry.name)) {
      execFileSync(process.execPath, ['--check', path.join(root, next)], { stdio: 'pipe' });
      checked++;
    }
  }
}
for (const directory of ['src', 'assets', 'scripts', 'skills', 'web', 'test']) await checkDirectory(directory);
console.log(`Checks passed: ${checked} JavaScript files; plugin, marketplace and skill metadata; version ${pkg.version}.`);
