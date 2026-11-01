import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { scanCatalog, selection, resolveNames, recommend } from './catalog.mjs';
import { projectState, previewProject, applyProject, undoProject, detachProject } from './project.mjs';

const exec = promisify(execFile);
const publicDir = fileURLToPath(new URL('../web/', import.meta.url));
export function openBrowser(url) {
  if (process.platform === 'win32') {
    const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {}); child.unref();
  } else {
    const child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
    child.on('error', () => {}); child.unref();
  }
}

async function chooseFolder() {
  if (process.platform !== 'win32') throw new Error('请在项目路径栏粘贴文件夹绝对路径。');
  const script = `Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = '选择需要配置 Skills 的项目文件夹'; $picker.UseDescriptionForTitle = $true; if ($picker.ShowDialog() -eq 'OK') { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::Write($picker.SelectedPath) }`;
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 120000, maxBuffer: 16000 });
  return stdout.trim();
}

export async function startServer({ port = 47831, project = '', open = false, scanOptions } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('端口必须是 0 到 65535 之间的整数；0 表示自动分配。');
  let catalog = await scanCatalog(scanOptions);
  let folderPending = false;
  const token = crypto.randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const host = `127.0.0.1:${address.port}`;
    const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    try {
      if (req.headers.host !== host) return send(403, { error: '无效的本地主机。' });
      const url = new URL(req.url, `http://${host}`);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(403, { error: '不允许跨站请求。' });
      if (url.pathname.startsWith('/api/')) {
        if (req.headers['x-hub-token'] !== token) return send(403, { error: '会话已失效，请从启动地址重新打开 Hub。' });
        if (req.method !== 'POST') return send(405, { error: '仅支持 POST。' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: '需要 application/json。' });
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 100000) { send(413, { error: '请求过大。' }); return; }
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        const body = JSON.parse(raw || '{}');
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('请求内容必须是 JSON 对象。');
        switch (url.pathname) {
          case '/api/catalog': return send(200, { ...catalog, initialProject: project });
          case '/api/rescan': catalog = await scanCatalog(scanOptions); return send(200, catalog);
          case '/api/selection': return send(200, selection(catalog, body.skills));
          case '/api/preset': {
            const preset = catalog.presets.find(p => p.id === body.id);
            if (!preset) throw new Error('技能包不存在。');
            const resolved = resolveNames(catalog, preset.names);
            return send(200, { ...selection(catalog, resolved.ids), missing: resolved.missing });
          }
          case '/api/recommend': return send(200, recommend(catalog, body.brief));
          case '/api/project': return send(200, await projectState(body.project));
          case '/api/preview': {
            const preview = await previewProject(catalog, body.project, body.skills, body.mode);
            const { before, after, ...review } = preview;
            return send(200, review);
          }
          case '/api/apply': return send(200, await applyProject(catalog, body.project, body.skills, body.mode, body.revision));
          case '/api/undo': return send(200, await undoProject(body.project));
          case '/api/detach': return send(200, await detachProject(body.project));
          case '/api/folder': {
            if (folderPending) throw new Error('文件夹选择器已打开。');
            folderPending = true;
            try { return send(200, { project: await chooseFolder() }); } finally { folderPending = false; }
          }
          default: return send(404, { error: '接口不存在。' });
        }
      }
      if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: '不支持的请求。' });
      const routes = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
      const entry = routes[url.pathname];
      if (!entry) return send(404, { error: '页面不存在。' });
      res.writeHead(200, { 'Content-Type': entry[1] });
      res.end(req.method === 'HEAD' ? '' : await fs.readFile(path.join(publicDir, entry[0])));
    } catch (e) { if (!res.headersSent) send(400, { error: e.message }); else res.end(); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', error => reject(error.code === 'EADDRINUSE'
      ? new Error(`端口 ${port} 已被占用。可添加 --port 0 自动使用空闲端口。`)
      : error));
    server.listen(port, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/#${token}`;
  if (open) openBrowser(url);
  return { server, url, token, catalog };
}
