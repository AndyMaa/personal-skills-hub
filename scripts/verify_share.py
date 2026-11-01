"""Check the sharing ZIP after extracting it into a fresh directory."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--skip-codex', action='store_true', help='Skip the installed-Codex preflight, for CI runners.')
options = parser.parse_args()

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / "package.json").read_text("utf-8"))["version"]
archive_path = ROOT / "dist" / f"personal-skills-hub-{version}.zip"
node = shutil.which("node")
if not node:
    raise RuntimeError("Node.js is required for verification")


def run(args, cwd, **kwargs):
    result = subprocess.run(args, cwd=cwd, text=True, encoding="utf-8",
                            capture_output=True, timeout=60, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout


with tempfile.TemporaryDirectory(prefix="personal-skills-hub-share-") as temporary:
    extraction = Path(temporary)
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        for member in archive.namelist():
            resolved = (extraction / member).resolve()
            assert resolved.is_relative_to(extraction.resolve())
            assert not any(part in {".hub", "node_modules", ".git"}
                           for part in Path(member).parts)
        archive.extractall(extraction)
    package = extraction / "Personal Skills Hub"
    assert (package / ".codex-plugin/plugin.json").is_file()
    assert (package / "SHARING.md").is_file()
    assert (package / "skills/personal-skills-hub/scripts/hub.mjs").is_file()

    if not options.skip_codex:
        print(run([node, "src/install.mjs", "--check"], package).strip())
        marketplace_probe = r'''
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root = process.argv[2];
await fs.mkdir(process.argv[3], {recursive:true});
const {resolveCodexCommand} = await import(pathToFileURL(path.join(root, 'src/codex-command.mjs')));
const executable = await resolveCodexCommand();
const call = async args => {
  const result = await promisify(execFile)(executable.command, [...executable.args, ...args], {
    env: {...process.env, CODEX_HOME: process.argv[3]}, windowsHide:true, timeout:60000,
  });
  return JSON.parse(result.stdout);
};
await call(['plugin','marketplace','add',root,'--json']);
const installed = await call(['plugin','add','personal-skills-hub@personal-skills-hub','--json']);
const listing = await call(['plugin','list','--marketplace','personal-skills-hub','--json']);
assert.ok(listing.installed.some(p => p.name === 'personal-skills-hub' && p.enabled));
const manifest = JSON.parse(await fs.readFile(path.join(installed.installedPath,'.codex-plugin/plugin.json'),'utf8'));
const pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
assert.equal(manifest.version, pkg.version);
console.log('Repository marketplace installation passed in an isolated CODEX_HOME.');
'''
        print(run([node, '--input-type=module', '-', str(package),
                   str(extraction / 'isolated-codex-home')], package,
                  input=marketplace_probe).strip())
    print(run([node, "scripts/check.mjs"], package).strip())
    print(run([node, "--test"], package).strip())

    probe = r'''
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {scanCatalog} = await import(pathToFileURL(path.join(process.argv[2], 'src/catalog.mjs')));
const home = process.argv[3];
const options = {home, codexHome: path.join(home, '.codex')};
const empty = await scanCatalog(options);
assert.equal(empty.stats.skills, 0);
for (const root of ['.agents', '.codex']) {
  const dir = path.join(home, root, 'skills', 'recipient-demo');
  await fs.mkdir(dir, {recursive:true});
  await fs.writeFile(path.join(dir, 'SKILL.md'), '---\nname: recipient-demo\ndescription: A recipient-owned example skill.\n---\n'.replaceAll('\\n','\n'));
}
const catalog = await scanCatalog(options);
assert.equal(catalog.stats.skills, 1);
assert.equal(catalog.stats.duplicates, 1);
assert.ok(catalog.skills[0].path.startsWith(path.join(home, '.agents')));
console.log('Recipient-home check passed: empty library and recipient-owned duplicates.');
'''
    print(run([node, "--input-type=module", "-", str(package),
               str(extraction / "recipient-home")], package, input=probe).strip())

    empty_path = extraction / "empty-path"
    empty_path.mkdir()
    environment = dict(os.environ)
    environment["PATH"] = str(empty_path)
    environment["CODEX_HOME"] = str(extraction / "missing-cli-home")
    result = subprocess.run([node, "src/install.mjs", "--check"], cwd=package,
                            env=environment, text=True, encoding="utf-8",
                            capture_output=True, timeout=30)
    assert result.returncode == 1, result.stdout + result.stderr
    assert not (extraction / "missing-cli-home").exists()
    print("Missing-CLI check passed: no installation files were written.")

print("Sharing ZIP verification passed.")
