# Contributing

Thanks for helping improve Personal Skills Hub. Please keep changes focused on a concrete user need, and describe how you verified the result.

## Local development

Node.js 22+ is required. Runtime and tests use Node's standard library; no npm dependency installation is needed.

```sh
npm run check
npm test
node src/cli.mjs serve --port 0
```

The last command prints a localhost URL containing a temporary session token. Keep that token out of issues, screenshots and commits. Use temporary project folders when testing apply, undo or detach.

## Skill rules

Curated descriptions, conflict groups and helper dependencies live in `src/rules.mjs`. Add a boundary that distinguishes the skill from similar workflows. Do not add every skill to a conflict group just because their descriptions share a keyword. New rules should work when some recommended skills are absent.

## Project writes

Keep changes inside the selected project and preserve content outside Hub-managed blocks. Any change to project write behavior should include a regression test for user-edited files and rollback where relevant. Do not edit the user's downloaded skills or global configuration to simplify a project workflow.

The generated CLI launcher embeds `resolveCodexCommand` so it can run independently of this checkout. Keep that resolver self-contained and test argument handling without a shell.

## Sharing package

Python 3.10+ is needed for packaging:

```sh
npm run package:share
npm run verify:share
```

The package uses an explicit allowlist. Add required public resources there, and keep runtime state, local project manifests and credentials excluded. `verify:share` works without an installed Codex CLI; run `python -X utf8 scripts/verify_share.py` to also check a real local Codex installation.

## Pull requests

Describe the problem, the resulting behavior and validation. UI changes should include a screenshot without private paths or session tokens. New dependencies need a concrete reason; preserve the zero-dependency runtime when possible.

Contributions are distributed under the repository's [MIT license](LICENSE).
