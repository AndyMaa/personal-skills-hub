// Curated descriptions explain distinctions; unknown skills retain their own metadata.
export const categories = [
  ['slides', 'PPT 与演示', '▧'], ['video', '视频与动效', '▷'],
  ['image', '图像与设计', '◇'], ['documents', '文档与数据', '▤'],
  ['development', '开发与工具', '⌘'], ['other', '其他技能', '⊞']
].map(([id, label, icon]) => ({ id, label, icon }));

const rule = (category, summary, use, avoid, group = null, companions = []) =>
  ({ category, summary, use, avoid, group, companions, curated: true });
export const rules = {
  'ppt-router': rule('slides', '先判断交付格式，再选择演示制作路线', '项目开始时，先分清 HTML 演讲稿与可编辑 PPTX。', '它只做路线选择，不负责生成最终幻灯片。'),
  'ppt-master': rule('slides', '企业模板、品牌规范与原生可编辑 PPTX', '需要沿用企业模板、编辑现有 PPTX、复用品牌与版式。', '只要网页演讲稿时，优先选 HTML 路线。', 'slides-author'),
  'cyber-ppt': rule('slides', '研究报告、咨询汇报与高密度可编辑 PPTX', '从报告或数据提炼 SCR 论证，制作信息密度高的汇报材料。', '轻量演讲、发布会网页优先用 HTML 演示技能。', 'slides-author'),
  'frontend-slides': rule('slides', '通过视觉预览选风格，制作 HTML 演示', '还没确定视觉方向，想先看几种风格；也可把 PPTX 转网页。', '必须保留原生 PPTX 编辑能力时，选 ppt-master 或 cyber-ppt。', 'slides-author'),
  'guizang-ppt-skill': rule('slides', '杂志风 / 瑞士风的横向翻页网页演示', '发布会、分享会，需要演讲者模式和鲜明视觉风格。', '交付给客户编辑的 PPTX 不适合此路线。', 'slides-author'),
  'power-design': rule('slides', '提取品牌设计语言，制作 HTML 演示或网页', '品牌调性明确，需要延续已有品牌的字体、颜色和版式。', '不负责原生可编辑 PPTX。', 'slides-author'),
  'presentations': rule('slides', '通过官方演示工作流创建或修改幻灯片', '明确使用官方演示画布、既有演示稿或 Google Slides 等工作流。', '已有专用 PPT 生成路线时，避免并行采用两套制作系统。', 'slides-author'),
  'ffmpeg-skill': rule('video', '本地剪辑、转码、字幕、音量和平台导出', '已有视频或音频，需要剪切、合并、字幕、比例调整、响度处理。', '从零生成 AI 镜头，或写生成器提示词时，选生成类技能。', 'video-editor'),
  'video-use': rule('video', '按转录和画面理解素材，完成叙事剪辑', '访谈、口播、旅行等素材，需要理解内容再决定剪辑与包装。', '只做简单转码时 ffmpeg-skill 更直接。', 'video-editor'),
  'hyperframes': rule('video', '用 HTML 时间线创作并渲染视频', '动态图形、产品介绍、字幕动画、图表或程序化视频。', '普通素材裁切无需启动 HTML 视频制作流程。', 'motion-engine', ['hyperframes-cli', 'hyperframes-registry', 'media-use']),
  'hyperframes-cli': rule('video', 'HyperFrames 项目与渲染命令', '配合 hyperframes 建项目、检查、预览、渲染。', '它是辅助技能，不是另一套创作路线。'),
  'hyperframes-registry': rule('video', '查找可复用的 HyperFrames 动画组件', '配合 hyperframes 查找转场、标题、图表和效果。', '无需把整套组件目录作为项目指令加载。'),
  'media-use': rule('video', '为视频获取素材、音乐、配音并处理音频', '给 HyperFrames 视频获取或制作媒体资产。', '不作为独立的通用视频剪辑路线。'),
  'remotion-best-practices': rule('video', '用 React / Remotion 制作程序化视频', '明确使用 Remotion，需要 React 组件和帧驱动动画。', '已选 HyperFrames 时不同时加载两套渲染体系。', 'motion-engine'),
  'manim-video': rule('video', '数学、算法、几何与技术讲解动画', '公式推导、算法可视化、3Blue1Brown 风格的数学动画。', '广告口播或普通素材剪辑不适用。', 'motion-engine'),
  'kiro-motion-studio': rule('video', 'KIRO 风格片头、歌词 MV 与视觉包装', '个人展示、铬金属 Logo、卡点 MV、演出 VJ。', '通用视频交付不必套用这一视觉风格。', 'motion-engine'),
  'video': rule('video', 'AI 视频提示词、分镜与镜头连续性', '为 Seedance、Kling、Veo 等编写或改善生成提示词。', '已有素材的剪辑、调色、合成应选编辑类技能。'),
  'image': rule('image', '为图像模型编写提示词和构图方案', '需要图像提示词、模型参数建议、多画面和参考图分析。', '要直接产出图片时，还需可用的图像生成工具。'),
  'imagegen': rule('image', '直接生成或编辑位图图像', '插画、照片、透明抠图、图像修改等位图交付。', '现有 SVG、图标系统和 CSS 图形应直接编辑源码。'),
  'humanizer-zh': rule('documents', '润色已有中文，去空话和模板化表达', '保留事实与作者语气，改善已有文章、评论和文档。', '不用于从零写作或判断文本是否由 AI 生成。'),
  'documents': rule('documents', 'Word 文档制作、修订与版式检查', '需要生成 DOCX、批注、修订或正式排版。', '纯文本的简短改写通常无需加载。'),
  'pdf': rule('documents', '读取、生成和检查 PDF', 'PDF 提取、合并、生成、表单或需要检查页面视觉效果。', 'Word 编辑应走 documents。'),
  'spreadsheets': rule('documents', '表格文件、公式、图表与数据分析', '处理 XLSX、CSV、TSV 或 Google Sheets。', '操作正在打开的 Excel 会话应选 excel-live-control。'),
  'excel-live-control': rule('documents', '控制连接中的实时 Excel 工作簿', '用户明确指定 Microsoft Excel 应用或已连接的 Excel 会话。', '独立 XLSX 或 CSV 文件请用 spreadsheets。'),
  'reverse-engineer-anything': rule('development', '对已发布的软件、二进制与运行时做逆向分析', '分析安装包、原生程序、Electron 或浏览器运行行为。', '普通源码仓库的架构阅读不需要逆向工作流。'),
  'skill-creator': rule('development', '创建与维护 Codex skills', '编写新的 SKILL.md、收敛触发范围或增加支持脚本。', '已有技能的项目选择和管理交给本 Hub。'),
  'skill-installer': rule('development', '从来源仓库安装新的 skills', '技能库里还没有所需技能，需要下载安装。', '已安装技能的项目启用交给本 Hub。'),
  'find-skills': rule('development', '发现技能库之外可安装的新能力', '本地没有合适技能，想寻找可安装的新技能。', '选择现有技能时无需再次联网安装。'),
  'openai-docs': rule('development', '查证 Codex、OpenAI API 与产品文档', '开发 OpenAI 集成或查 Codex 设置、插件与技能机制。', '普通软件开发中仅提到 Codex 时不必触发。'),
  'sites': rule('development', '通过 Sites 创建与发布网站', '用户要创建、修改或发布由 Sites 托管的网站。', '本地插件和已有本地项目不应自动改用托管网站流程。'),
  'visualize': rule('documents', '在对话中创建交互图解与探索工具', '解释机制、比较方案、交互模拟或可视化探索。', '可导出的科学论文图应使用标准绘图工具。')
};

export const presets = [
  { id: 'pptx', title: '可编辑 PPT', subtitle: '企业汇报 · 模板与品牌', icon: '▧', names: ['ppt-router', 'ppt-master'], tags: ['ppt', 'pptx', '汇报', '企业', '模板', '幻灯片'] },
  { id: 'research', title: '研究 / 咨询汇报', subtitle: '报告转 PPT · 高密度论证', icon: '▤', names: ['ppt-router', 'cyber-ppt'], tags: ['研究', '咨询', '报告', '董事会', '行研'] },
  { id: 'html', title: '网页演示', subtitle: '分享 · 演讲 · 风格探索', icon: '▱', names: ['ppt-router', 'frontend-slides'], tags: ['html', '演讲', '分享', '网页演示', 'slides'] },
  { id: 'edit', title: '视频剪辑', subtitle: '现有素材 · 字幕与导出', icon: '✂', names: ['ffmpeg-skill'], tags: ['剪辑', '转码', '字幕', '音量', '裁切', '合并', 'mp4'] },
  { id: 'motion', title: '动效视频', subtitle: 'HTML 时间线 · 动态视觉', icon: '▷', names: ['hyperframes'], tags: ['动效', '动画', 'hyperframes', '时间线', '产品介绍'] },
  { id: 'ai-video', title: 'AI 视频分镜', subtitle: '镜头 · 提示词 · 连续性', icon: '◈', names: ['video'], tags: ['分镜', '提示词', 'kling', 'seedance', 'veo', 'ai视频'] },
  { id: 'data', title: '文档与数据', subtitle: 'Word · PDF · 电子表格', icon: '▦', names: ['documents', 'pdf', 'spreadsheets'], tags: ['文档', '数据', 'word', 'pdf', 'excel', 'xlsx', 'csv'] }
];

export function classify(name, description, provider = '') {
  if (rules[name]) return rules[name];
  const t = `${name} ${description}`.toLowerCase();
  if (provider === 'openai-templates') {
    const category = /create a presentation/i.test(description) ? 'slides' : 'documents';
    return { category, summary: `内置模板 · ${name.replace('artifact-template-', '').replaceAll('-', ' ')}`, use: description, avoid: '仅在明确使用这个模板时选择；不因输出格式相同而自动套用模板。', curated: true, companions: [], group: null };
  }
  if (name === 'plugin-management') return rule('development', '查找、连接与管理 Codex 插件', '需要查找外部服务插件、检查权限或管理已有插件。', '现有本地 skills 的按项目选择由本 Hub 管理。');
  if (name === 'template-creator') return rule('documents', '把参考文件制作成可复用的个人模板', '用户要创建长期复用的文档、表格或演示模板。', '基于模板的一次性产出不需要创建新模板。');
  if (['character-design', 'fal-regenerate-3d'].includes(name)) return rule('image', name === 'character-design' ? 'fal.ai · 一致角色设计与角色变体' : 'fal.ai · 3D 角色与展示场景', description, '需要 fal.ai 原插件及对应工具保持可用。');
  const category = /video|cinema|ugc|pgc|tvc|talking.head|storytelling/.test(t) ? 'video'
    : /image|character|gamedev|design|photo|3d/.test(t) ? 'image'
    : /slide|presentation|ppt/.test(t) ? 'slides'
    : /document|spreadsheet|pdf|template|data/.test(t) ? 'documents'
    : /skill|plugin|code|develop|browser|computer|web/.test(t) ? 'development' : 'other';
  const openart = provider.startsWith('app-6a42');
  if (['ugc', 'pgc', 'tvc', 'talking-head', 'performance-ads', 'product-listing-video'].includes(name)) {
    const label = openart ? 'OpenArt' : provider === 'fal' ? 'fal.ai' : provider;
    return rule('video', `${label} · ${name} 视频制作`, `通过 ${label} 连接器执行对应视频生成工作流。`, '必须有对应连接器；缓存中的 skill 不等于服务已连接。', name === 'ugc' ? 'ugc-provider' : null);
  }
  return { category, summary: description.slice(0, 100), use: description, avoid: '按 SKILL.md 的适用条件选择；此技能尚未补充人工分类说明。', curated: false, companions: [], group: null };
}
