#!/usr/bin/env node
// Keep this entry inside the skill, while sharing the plugin's runtime and web assets.
await import(new URL('../../../src/cli.mjs', import.meta.url));
