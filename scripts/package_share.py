"""Build a self-contained friend-sharing ZIP from an explicit source allowlist."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    "src", "web", "skills", "assets", ".codex-plugin", "test", "scripts",
    "plugin.json", "package.json", "README.md", "README.en.md", "SHARING.md", "VALIDATION.md",
    "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", ".agents", ".github",
    ".editorconfig", ".gitattributes", "docs/publishing.md", "docs/hub-preview.jpg",
    "Install Codex Plugin.cmd", "Open Personal Skills Hub.cmd",
    "Open Personal Skills Hub.vbs", ".gitignore",
)
BLOCKED = {".hub", ".git", "node_modules", "__pycache__", "dist"}


def build():
    version = json.loads((ROOT / "package.json").read_text("utf-8"))["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?", version):
        raise ValueError("Invalid package version")
    output = ROOT / "dist"
    output.mkdir(exist_ok=True)
    name = f"personal-skills-hub-{version}.zip"
    target = output / name
    temporary = output / f"{name}.tmp"
    members = {}
    home_paths = {str(Path.home()).encode(), Path.home().as_posix().encode()}
    for source in SOURCES:
        entry = ROOT / source
        if not entry.exists():
            raise FileNotFoundError(source)
        candidates = sorted(entry.rglob("*")) if entry.is_dir() else [entry]
        for file in candidates:
            if any(part in BLOCKED for part in file.relative_to(ROOT).parts):
                continue
            if file.is_symlink():
                raise ValueError(f"Do not package symlinks: {file.name}")
            if not file.is_file():
                continue
            data = file.read_bytes()
            if any(home_path.lower() in data.lower() for home_path in home_paths):
                raise ValueError(f"Personal home path found in {file.relative_to(ROOT)}")
            if re.search(rb"/#[0-9a-f]{64}", data):
                raise ValueError(f"Session URL found in {file.relative_to(ROOT)}")
            member = "Personal Skills Hub/" + file.relative_to(ROOT).as_posix()
            members[member] = data
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for member, data in sorted(members.items()):
            archive.writestr(member, data)
    with zipfile.ZipFile(temporary) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP integrity check failed")
    temporary.replace(target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    (output / f"{name}.sha256").write_text(f"{digest}  {name}\n", "utf-8")
    report = {"file": name, "version": version, "bytes": target.stat().st_size,
              "sha256": digest, "files": len(members),
              "containsOnlyAllowlistedSources": True,
              "members": sorted(members)}
    (output / "share-package-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "members"}, ensure_ascii=False))


if __name__ == "__main__":
    build()
