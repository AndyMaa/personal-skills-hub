import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolveCodexCommand } from '../src/codex-command.mjs';
import { startServer } from '../src/server.mjs';

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'personal-skills-hub-runtime-'));
  t.after(() => {
    assert.ok(directory.startsWith(path.join(os.tmpdir(), 'personal-skills-hub-runtime-')));
    return fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('Windows Codex lookup supports npm shims and preserves arguments without a shell', async t => {
  const directory = await temporary(t);
  const prefix = path.join(directory, 'npm with spaces');
  const entry = path.join(prefix, 'node_modules/@openai/codex/bin/codex.js');
  await fs.mkdir(path.dirname(entry), { recursive: true });
  await fs.writeFile(path.join(prefix, 'codex.cmd'), '@echo off');
  await fs.writeFile(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))');
  const executable = await resolveCodexCommand({ platform: 'win32', env: { PATH: `"${prefix}"` } });
  const args = ['plugin', 'a path with spaces', 'literal&value', '中文项目'];
  const result = await promisify(execFile)(executable.command, [...executable.args, ...args]);
  assert.deepEqual(JSON.parse(result.stdout), args);
  await fs.writeFile(path.join(prefix, 'codex.exe'), 'native executable placeholder');
  assert.deepEqual(await resolveCodexCommand({ platform: 'win32', env: { PATH: prefix } }), { command: path.join(prefix, 'codex.exe'), args: [] });
});

test('unrecognized Windows shims give an actionable installation error', async t => {
  const directory = await temporary(t);
  await fs.writeFile(path.join(directory, 'codex.cmd'), '@echo off');
  await assert.rejects(resolveCodexCommand({ platform: 'win32', env: { PATH: directory } }), /Codex CLI/);
});

test('server reports invalid ports and an occupied port clearly', async t => {
  const home = await temporary(t);
  const scanOptions = { home, codexHome: path.join(home, '.codex') };
  await assert.rejects(startServer({ port: Number.NaN, scanOptions }), /端口/);
  await assert.rejects(startServer({ port: 65536, scanOptions }), /端口/);
  const { server } = await startServer({ port: 0, scanOptions });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(startServer({ port: server.address().port, scanOptions }), /--port 0/);
});

test('CLI usage errors show a short message instead of a stack trace', async () => {
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  await assert.rejects(promisify(execFile)(process.execPath, [cli, '--invalid-hub-option']), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /^Hub: /);
    assert.doesNotMatch(error.stderr, /\n\s+at /);
    return true;
  });
});
