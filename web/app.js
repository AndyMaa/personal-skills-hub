const $ = id => document.getElementById(id);
const fragment = location.hash.slice(1);
if (fragment) { sessionStorage.setItem('psh-token', fragment); history.replaceState(null, '', location.pathname + location.search); }
// A restarted server can open a new token on the same tab without a full navigation.
window.addEventListener('hashchange', () => {
  if (/^#[a-f0-9]{64}$/.test(location.hash)) location.reload();
});
const token = sessionStorage.getItem('psh-token') || '';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const storage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let catalog, selected = new Set(), category = 'all', source = 'all', busy = false, selectionResult, currentPreview, projectRevision;
const favorites = new Set(storage('psh-favorites', []));
let profiles = storage('psh-profiles', []);
let toastTimeout, pathTimeout;
async function api(endpoint, data = {}) {
  const response = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Token': token }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '请求失败。');
  return result;
}
function toast(message, error = false) {
  clearTimeout(toastTimeout); $('toast').textContent = message; $('toast').className = error ? 'error' : ''; $('toast').hidden = false;
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, error ? 9000 : 6500);
}
async function action(fn) { try { return await fn(); } catch (e) { toast(e.message, true); } }
const project = () => $('project-path').value.trim().replace(/^"|"$/g, '');
function payload() { return { project: project(), skills: [...selected], mode: $('mode').value }; }
function updateActions() {
  const invalid = busy || !selected.size || !project() || !projectRevision || !!selectionResult?.conflicts.length;
  $('apply').disabled = invalid; $('preview').disabled = invalid;
  $('preview-apply').disabled = invalid;
  $('apply').textContent = busy ? '正在写入…' : '＋ 一键添加到项目';
}
function renderNavigation() {
  const buttons = [{ id: 'all', label: '全部技能', icon: '⊞' }, ...catalog.categories, { id: 'favorites', label: '我的收藏', icon: '☆' }];
  $('navigation').innerHTML = buttons.map(c => `${c.id === 'favorites' ? '<div class="nav-divider"></div>' : ''}<button data-category="${c.id}" class="${category === c.id ? 'active' : ''}"><span class="nav-icon">${c.icon}</span><span>${c.label}</span><span class="nav-count">${c.id === 'all' ? catalog.skills.length : c.id === 'favorites' ? catalog.skills.filter(s => favorites.has(s.key)).length : catalog.skills.filter(s => s.category === c.id).length}</span></button>`).join('');
}
function renderCatalog() {
  const query = $('search').value.toLowerCase().trim();
  const list = catalog.skills.filter(s => (category === 'all' || category === 'favorites' && favorites.has(s.key) || s.category === category) && (source === 'all' || s.kind === source) && (!$('duplicates-only').checked || s.duplicate) && (!query || `${s.name} ${s.description} ${s.summary} ${s.sourceLabel} ${s.use} ${s.avoid}`.toLowerCase().includes(query)));
  $('catalog-title').textContent = category === 'all' ? '全部技能' : category === 'favorites' ? '我的收藏' : catalog.categories.find(c => c.id === category)?.label;
  $('results-count').textContent = `${list.length} 个`;
  $('empty').hidden = list.length > 0;
  $('skill-grid').innerHTML = list.map(s => {
    const c = catalog.categories.find(c => c.id === s.category);
    return `<article class="skill-card ${selected.has(s.id) ? 'selected' : ''}"><div class="card-top"><div class="skill-icon ${s.category}">${c?.icon || '⊞'}</div><div><h3 class="card-name">${escape(s.name)}</h3><div class="card-source">${escape(s.sourceLabel)}</div></div><button class="favorite ${favorites.has(s.key) ? 'active' : ''}" data-favorite="${s.id}" title="收藏技能" aria-label="${favorites.has(s.key) ? '取消收藏' : '收藏'} ${escape(s.name)}" aria-pressed="${favorites.has(s.key)}">${favorites.has(s.key) ? '★' : '☆'}</button></div><p class="card-summary">${escape(s.summary)}</p><div class="card-badges"><span class="badge">${escape(c?.label)}</span>${s.duplicate ? `<span class="badge warning">${s.copies.length} 份安装 · 已去重</span>` : ''}${s.protected ? '<span class="badge system">基础技能保留</span>' : ''}${s.kind === 'plugin' ? '<span class="badge system">需原插件</span>' : ''}</div><div class="card-bottom"><button class="text-button" data-detail="${s.id}">适用边界 ↗</button><button class="add-button" data-toggle="${s.id}" aria-label="${selected.has(s.id) ? '移除' : '添加'} ${escape(s.name)}">${selected.has(s.id) ? '✓ 已选择' : '＋ 添加'}</button></div></article>`;
  }).join('');
}
function renderSelection() {
  const skills = [...selected].map(id => catalog.skills.find(s => s.id === id)).filter(Boolean);
  $('selected-count').textContent = skills.length;
  $('selection-empty').hidden = skills.length > 0;
  $('selected-list').innerHTML = skills.map(s => `<div class="selected-item"><span class="check">✓</span><span class="name">${escape(s.name)}<small>${escape(s.sourceLabel)}${(s.companions || []).length ? ' · 已补齐辅助技能' : ''}</small></span><button data-remove="${s.id}" aria-label="移除 ${escape(s.name)}">×</button></div>`).join('');
  $('conflicts').hidden = !selectionResult?.conflicts.length;
  $('conflicts').textContent = selectionResult?.conflicts.map(c => c.message).join('\n') || '';
  $('warnings').hidden = !selectionResult?.warnings.length;
  $('warnings').textContent = selectionResult?.warnings.join('\n') || '';
  updateActions();
}
let selectionSequence = 0;
async function setSelection(ids) {
  const sequence = ++selectionSequence;
  const result = await api('selection', { skills: [...ids] });
  if (sequence !== selectionSequence) return;
  selected = new Set(result.ids); selectionResult = result;
  currentPreview = null;
  renderSelection(); renderCatalog();
}
function renderProfiles() {
  $('saved-profiles').innerHTML = profiles.length ? `<div class="saved-label">我的组合</div>${profiles.map((p, i) => `<div class="saved-profile"><button class="subtle" data-profile="${i}">${escape(p.name)} <span class="muted">${p.keys.length}</span></button><button class="text-button" data-delete-profile="${i}" aria-label="删除组合 ${escape(p.name)}">×</button></div>`).join('')}` : '';
}
function renderHeader() {
  $('total-badge').textContent = `${catalog.stats.skills} SKILLS`;
  $('stats').innerHTML = `<div class="stat"><div class="stat-number">${catalog.stats.skills}<span>个</span></div><div class="stat-label">可用技能种类</div></div><div class="stat"><div class="stat-number">${catalog.categories.filter(c => catalog.skills.some(s => s.category === c.id)).length}<span>类</span></div><div class="stat-label">按工作类型整理</div></div><div class="stat"><div class="stat-number">${catalog.stats.duplicates}<span>组</span></div><div class="stat-label">重复安装已合并展示</div></div>`;
  $('scan-time').textContent = `最近扫描 ${new Date(catalog.scannedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  $('presets').innerHTML = catalog.presets.map(p => `<button class="preset" data-preset="${p.id}"><span class="preset-icon">${p.icon}</span><span class="preset-name">${escape(p.title)}</span><small>${escape(p.subtitle)}</small></button>`).join('');
  renderNavigation(); renderCatalog(); renderProfiles();
}
let projectSequence = 0;
async function loadProject(restore = true) {
  const input = project(), sequence = ++projectSequence;
  projectRevision = null; currentPreview = null; updateActions();
  if (!input) { $('project-status').textContent = '先选择项目文件夹'; return; }
  try {
    const result = await api('project', { project: input });
    if (sequence !== projectSequence || input !== project()) return;
    projectRevision = result.revision;
    $('project-status').textContent = result.manifest ? `已配置 · ${result.manifest.skills.length} 个技能 · ${result.manifest.mode === 'focused' ? '聚焦 CLI' : '桌面路由'}` : '项目已就绪 · 还未添加技能组合';
    if (restore && result.manifest) {
      const ids = result.manifest.skills.map(saved => catalog.skills.find(s => s.key === saved.key)?.id).filter(Boolean);
      if (ids.length !== result.manifest.skills.length) toast('部分已配置技能已不在扫描目录中，请检查项目清单。', true);
      $('mode').value = result.manifest.mode;
      await setSelection(ids);
    }
  } catch (e) { if (sequence === projectSequence) $('project-status').textContent = e.message; }
  updateActions();
}
function detail(id) {
  const s = catalog.skills.find(s => s.id === id);
  $('detail-title').textContent = s.name;
  $('detail-content').innerHTML = `<p class="detail-description">${escape(s.description)}</p><section class="detail-section"><h3>什么时候用</h3><p>${escape(s.use)}</p></section><section class="detail-section"><h3>与相似技能的边界</h3><p>${escape(s.avoid)}</p></section>${s.companions?.length ? `<section class="detail-section"><h3>自动补齐的辅助技能</h3><p>${escape(s.companions.join(' · '))}</p></section>` : ''}<section class="detail-section"><h3>${s.duplicate ? `发现 ${s.copies.length} 份安装` : '指令文件'}${s.duplicate ? ` · ${s.identical ? '入口内容一致' : '入口内容存在差异'}` : ''}</h3><p>${s.duplicate ? '本地来源优先使用 .agents/skills 中的版本；项目聚焦时限制其他副本。' : '保留原路径与资源引用。'}${s.kind === 'plugin' ? ' 需原插件和连接器保持可用。' : ''}</p><pre>${s.copies.map((c, i) => `${i === 0 ? '使用 → ' : '副本   '}${escape(c.path)}`).join('\n')}</pre></section>`;
  $('details-dialog').showModal();
}
async function makePreview() {
  const result = await api('preview', payload());
  currentPreview = result;
  $('preview-summary').textContent = `${result.skills.length} 个已选技能 · ${result.mode === 'focused' ? `专用 CLI 启动器限制 ${result.disabled} 份未选或重复安装` : '桌面版按项目清单路由，其他技能仍可见'} · 仅写入所选项目。`;
  $('preview-tabs').innerHTML = result.files.map((f, i) => `<button data-file="${i}" class="${i === 0 ? 'active' : ''}">${escape(f.path)}</button>`).join('');
  $('preview-content').textContent = result.files[0].after || '(此文件将移除)';
  $('preview-dialog').showModal();
}
async function apply() {
  if (busy) return;
  busy = true; updateActions();
  try {
    const result = await api('apply', { ...payload(), revision: currentPreview?.revision || projectRevision });
    $('preview-dialog').close(); currentPreview = null;
    toast(result.message);
    await loadProject(false);
  } finally { busy = false; updateActions(); }
}

$('navigation').addEventListener('click', e => { const button = e.target.closest('[data-category]'); if (!button) return; category = button.dataset.category; renderNavigation(); renderCatalog(); });
$('source-filters').addEventListener('click', e => { const button = e.target.closest('[data-source]'); if (!button) return; source = button.dataset.source; [...$('source-filters').children].forEach(b => b.classList.toggle('active', b === button)); renderCatalog(); });
$('search').addEventListener('input', () => catalog && renderCatalog());
$('duplicates-only').addEventListener('change', renderCatalog);
$('reset-filter').onclick = () => { category = 'all'; source = 'all'; $('search').value = ''; $('duplicates-only').checked = false; [...$('source-filters').children].forEach(b => b.classList.toggle('active', b.dataset.source === 'all')); renderNavigation(); renderCatalog(); };
$('skill-grid').addEventListener('click', e => action(async () => {
  const toggle = e.target.closest('[data-toggle]'), favorite = e.target.closest('[data-favorite]'), info = e.target.closest('[data-detail]');
  if (toggle) { const next = new Set(selected); next.has(toggle.dataset.toggle) ? next.delete(toggle.dataset.toggle) : next.add(toggle.dataset.toggle); await setSelection(next); }
  if (favorite) { const s = catalog.skills.find(s => s.id === favorite.dataset.favorite); favorites.has(s.key) ? favorites.delete(s.key) : favorites.add(s.key); localStorage.setItem('psh-favorites', JSON.stringify([...favorites])); renderNavigation(); renderCatalog(); }
  if (info) detail(info.dataset.detail);
}));
$('selected-list').addEventListener('click', e => action(async () => { const button = e.target.closest('[data-remove]'); if (!button) return; const next = new Set(selected); next.delete(button.dataset.remove); await setSelection(next); }));
$('clear-selection').onclick = () => action(() => setSelection([]));
$('presets').addEventListener('click', e => action(async () => { const button = e.target.closest('[data-preset]'); if (!button) return; const result = await api('preset', { id: button.dataset.preset }); await setSelection(result.ids); [...$('presets').children].forEach(b => b.classList.toggle('active', b === button)); if (result.missing?.length) toast(`当前未安装：${result.missing.join('、')}`, true); }));
$('recommend').onclick = () => action(async () => { if (!$('brief').value.trim()) return toast('先用一句话描述项目需要交付什么。'); const result = await api('recommend', { brief: $('brief').value }); $('recommendation').textContent = result.message; $('recommendation').hidden = false; if (result.ids.length) await setSelection(result.ids); });
$('brief').addEventListener('keydown', e => { if (e.key === 'Enter') $('recommend').click(); });
$('project-path').addEventListener('input', () => { ++projectSequence; projectRevision = null; currentPreview = null; updateActions(); clearTimeout(pathTimeout); pathTimeout = setTimeout(() => loadProject(), 450); });
$('browse').onclick = () => action(async () => { $('browse').disabled = true; try { const result = await api('folder'); if (result.project) { $('project-path').value = result.project; await loadProject(); } } finally { $('browse').disabled = false; } });
$('mode').onchange = () => { currentPreview = null; $('mode-note').textContent = $('mode').value === 'focused' ? '添加后运行项目内 .personal-skills-hub / Start Focused Codex.cmd，限制只在该 CLI 会话生效。桌面版仍按清单路由。' : '为新项目聊天指定技能及适用边界；其他技能仍可见。添加后请开启新聊天。'; };
$('preview').onclick = () => action(makePreview);
$('apply').onclick = () => action(apply);
$('preview-apply').onclick = () => action(apply);
$('preview-tabs').onclick = e => { const button = e.target.closest('[data-file]'); if (!button || !currentPreview) return; [...$('preview-tabs').children].forEach(b => b.classList.toggle('active', b === button)); $('preview-content').textContent = currentPreview.files[Number(button.dataset.file)].after || '(此文件将移除)'; };
$('undo').onclick = () => action(async () => { const result = await api('undo', { project: project() }); toast(result.message); await setSelection([]); await loadProject(); });
$('detach').onclick = () => { if (!project()) return toast('先选择项目。', true); $('detach-dialog').showModal(); };
$('confirm-detach').onclick = () => action(async () => { const result = await api('detach', { project: project() }); $('detach-dialog').close(); toast('已移除 Hub 项目配置；原技能与其他项目内容已保留。'); await loadProject(); });
$('save-profile').onclick = () => { if (!selected.size) return toast('先选择要保存的技能。'); $('profile-dialog').showModal(); $('profile-name').focus(); };
$('confirm-profile').onclick = () => { const name = $('profile-name').value.trim(); if (!name) return toast('给这个组合取个名字。'); profiles = profiles.filter(p => p.name !== name); profiles.push({ name, keys: [...selected].map(id => catalog.skills.find(s => s.id === id).key) }); localStorage.setItem('psh-profiles', JSON.stringify(profiles)); renderProfiles(); $('profile-dialog').close(); $('profile-name').value = ''; toast('已保存组合。'); };
$('saved-profiles').onclick = e => action(async () => { const load = e.target.closest('[data-profile]'), remove = e.target.closest('[data-delete-profile]'); if (load) { const profile = profiles[Number(load.dataset.profile)]; const ids = profile.keys.map(key => catalog.skills.find(s => s.key === key)?.id).filter(Boolean); await setSelection(ids); if (ids.length !== profile.keys.length) toast('部分技能已不在技能库中，请检查组合。', true); } if (remove) { profiles.splice(Number(remove.dataset.deleteProfile), 1); localStorage.setItem('psh-profiles', JSON.stringify(profiles)); renderProfiles(); } });
$('rescan').onclick = () => action(async () => { $('rescan').disabled = true; try { catalog = await api('rescan'); selected = new Set([...selected].filter(id => catalog.skills.some(s => s.id === id))); renderHeader(); await setSelection(selected); await loadProject(false); toast(`已扫描 ${catalog.stats.skills} 个技能。`); } finally { $('rescan').disabled = false; } });
document.querySelectorAll('.close-dialog').forEach(button => { button.onclick = () => button.closest('dialog').close(); });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => { if (e.target === dialog) { const rect = dialog.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close(); } }));
document.addEventListener('keydown', e => { if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); $('search').focus(); } });

await action(async () => { catalog = await api('catalog'); renderHeader(); await setSelection([]); if (catalog.initialProject) { $('project-path').value = catalog.initialProject; await loadProject(); } if (catalog.warnings.length) toast(`有 ${catalog.warnings.length} 份技能文件无法读取或缺少必要元数据，已跳过。`, true); });
