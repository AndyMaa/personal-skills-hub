#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { scanCatalog, resolveNames, recommend } from './catalog.mjs';
import { applyProject, previewProject, projectState, undoProject, detachProject } from './project.mjs';
import { startServer } from './server.mjs';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    project: { type: 'string' }, skills: { type: 'string' }, preset: { type: 'string' },
    mode: { type: 'string', default: 'guided' }, port: { type: 'string', default: '47831' },
    open: { type: 'boolean', default: false }, json: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' }
  } });

  const command = positionals[0] || 'serve';
  if (values.help) {
    console.log(`Personal Skills Hub\n\nnode src/cli.mjs serve [--open] [--project "项目路径"]\nnode src/cli.mjs scan [--json]\nnode src/cli.mjs recommend "项目需求"\nnode src/cli.mjs preview --project "项目路径" --preset pptx\nnode src/cli.mjs apply --project "项目路径" --skills ppt-router,ppt-master\nnode src/cli.mjs status --project "项目路径"\nnode src/cli.mjs undo --project "项目路径"\nnode src/cli.mjs detach --project "项目路径"\n\n--mode guided（默认）：桌面版项目路由。focused：另生成聚焦 CLI 启动器。`);
  } else if (command === 'serve') {
    const result = await startServer({ port: Number(values.port), project: values.project || '', open: values.open });
    console.log(`Personal Skills Hub 已启动（仅本机）\n${result.url}\n已发现 ${result.catalog.stats.skills} 个技能，${result.catalog.stats.duplicates} 组重复安装。\n按 Ctrl+C 停止。`);
  } else if (command === 'undo' || command === 'detach' || command === 'status') {
    if (!values.project) throw new Error('请使用 --project 指定项目绝对路径。');
    const result = await ({ undo: undoProject, detach: detachProject, status: projectState })[command](values.project);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const catalog = await scanCatalog();
    if (command === 'scan') {
      console.log(values.json ? JSON.stringify(catalog, null, 2) : [`${catalog.stats.skills} 个技能 / ${catalog.stats.files} 份安装 / ${catalog.stats.duplicates} 组重复`, ...catalog.skills.map(s => `${s.key.padEnd(46)} ${s.summary}${s.duplicate ? ` [${s.copies.length} 份]` : ''}`)].join('\n'));
    } else if (command === 'recommend') {
      console.log(JSON.stringify(recommend(catalog, positionals.slice(1).join(' ')), null, 2));
    } else if (command === 'apply' || command === 'preview') {
      if (!values.project) throw new Error('请使用 --project 指定项目绝对路径。');
      const preset = values.preset && catalog.presets.find(p => p.id === values.preset);
      if (values.preset && !preset) throw new Error('未知技能包。');
      const names = preset?.names || values.skills?.split(',').map(s => s.trim()).filter(Boolean);
      if (!names?.length) throw new Error('请使用 --preset 或 --skills 指定技能。');
      const resolved = resolveNames(catalog, names);
      if (resolved.missing.length) throw new Error(`本地未安装：${resolved.missing.join(', ')}`);
      const result = command === 'apply' ? await applyProject(catalog, values.project, resolved.ids, values.mode) : await previewProject(catalog, values.project, resolved.ids, values.mode);
      if (command === 'preview') { delete result.before; delete result.after; }
      console.log(JSON.stringify(result, null, 2));
    } else throw new Error(`未知命令：${command}。使用 --help 查看。`);
  }
} catch (e) {
  console.error(`Hub: ${e.message}`);
  process.exitCode = 1;
}
