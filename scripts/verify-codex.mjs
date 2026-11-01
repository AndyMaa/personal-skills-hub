// Integration probe for the installed Codex client. No model turn is run.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const project = path.join(root, '.hub/native-project');
const trustKey = `projects.${JSON.stringify(project)}.trust_level="trusted"`;
const session = JSON.parse(await fs.readFile(path.join(project, '.personal-skills-hub/session.json'), 'utf8'));
const override = 'skills.config=[' + session.overrides.map(s => `{path=${JSON.stringify(s.path)},enabled=${s.enabled}}`).join(',') + ']';
const overrides = process.argv.includes('--project-only') ? [] : ['-c', override];
const child = spawn('codex', ['-c', trustKey, ...overrides, 'app-server', '--stdio'], { cwd: project, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
const requests = new Map();
let buffer = '', stderr = '', counter = 0;
child.stderr.on('data', chunk => { stderr += chunk; });
child.stdout.on('data', chunk => {
  buffer += chunk;
  let boundary;
  while ((boundary = buffer.indexOf('\n')) >= 0) {
    const raw = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
    try { const data = JSON.parse(raw); const pending = requests.get(data.id); if (pending) { requests.delete(data.id); data.error ? pending.reject(new Error(JSON.stringify(data.error))) : pending.resolve(data.result); } } catch {}
  }
});
function request(method, params) {
  return new Promise((resolve, reject) => { const id = ++counter; requests.set(id, { resolve, reject }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
}
const timeout = setTimeout(() => { console.error('Codex verification timed out.'); child.kill(); process.exitCode = 1; }, 45000);
child.on('error', e => { console.error(e.message); clearTimeout(timeout); process.exitCode = 1; });
try {
  const initialized = await request('initialize', { clientInfo: { name: 'personal-skills-hub-validation', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');
  const config = await request('config/read', { includeLayers: true, cwd: project });
  console.log(JSON.stringify({ configuredOverrides: config.config?.skills?.config?.length, projectConfigRead: config.layers?.some(l => l.name?.type === 'project') }));
  const result = await request('skills/list', { cwds: [project], forceReload: true });
  await fs.writeFile(path.join(root, '.hub/codex-skills-verification.json'), JSON.stringify(result, null, 2));
  const skills = result.data?.flatMap(d => d.skills || []) || [];
  const local = skills.filter(s => /\\\.agents\\skills\\|\\\.codex\\skills\\/.test(s.path) && !s.path.includes('\\.system\\'));
  const chosen = new Set(session.overrides.filter(s => s.enabled).map(s => path.normalize(s.path)));
  const activeLocal = local.filter(s => s.enabled);
  console.log(JSON.stringify({ client: initialized.userAgent, mode: overrides.length ? 'session-flags' : 'project-file-only', skills: skills.length, hubPluginLoaded: skills.some(s => s.name.split(':').at(-1) === 'personal-skills-hub' && s.enabled), activeLocal: activeLocal.map(({name,path}) => ({name,path})), disabledLocal: local.filter(s => !s.enabled).length, errors: result.data?.flatMap(d => d.errors || []) }, null, 2));
  if (overrides.length && (activeLocal.some(s => !chosen.has(path.normalize(s.path))) || activeLocal.length !== chosen.size)) throw new Error('实际技能启用状态与项目清单不符。');
} catch (e) { console.error(e.message); if (stderr) console.error(stderr.slice(-1200)); process.exitCode = 1; }
finally { clearTimeout(timeout); child.kill(); }
