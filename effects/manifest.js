/**
 * 效果清单（单一事实源）——首页 index.html 的工具卡片由此渲染。
 *
 * 新增效果只需在 EFFECTS 数组里加一项（保持期望的展示顺序），index.html 自动出卡片，
 * 无需再手改首页 HTML。冒烟测试 tests/manifest.spec.js 守住「清单 ↔ effects/*.html」双向一致。
 *
 * 字段：
 *   id        唯一标识（= 文件名去扩展名）
 *   file      相对站点根的路径，如 'effects/stack-scan.html'
 *   title     卡片标题
 *   desc      卡片描述（一句话）
 *   category  分类：text | visual | chart | particle（决定筛选 tab 与分类标签）
 *   version   版本号文本，如 'v19.4'
 *   hot       是否标「热门」高亮（version-tag hot）
 *   keywords  搜索关键词（空格分隔，喂给搜索框 data-name）
 *   icon      24×24 内联 SVG 字符串（卡片左侧图标）
 *   featured  可选：曾在「精选」橱窗展示（当前精选区已注释，保留供将来启用）
 */

export const CAT_LABELS = {
    text: '文字类',
    visual: '视觉类',
    chart: '图表类',
    particle: '粒子类',
};

export const EFFECTS = [
    {
        id: 'stack-scan',
        file: 'effects/stack-scan.html',
        title: '文字突出扫描',
        desc: '赛博朋克扫描文字效果。多字体斜体、透明度延迟、防掉帧渲染。',
        category: 'text',
        version: 'v19.4',
        hot: true,
        featured: true,
        keywords: '文字突出扫描 堆叠扫描 赛博朋克 文字 扫描 MP4 PNG',
        icon: '<svg viewBox="0 0 24 24"><rect class="g-dot" x="4" y="5" width="13" height="3" rx="0.6" stroke="none" opacity="0.28"/><rect class="g-dot" x="5" y="10" width="13" height="3" rx="0.6" stroke="none" opacity="0.58"/><rect class="g-main" x="6" y="15" width="13" height="3" rx="0.6" stroke-width="1.6"/><line class="g-main" x1="3.5" y1="12" x2="20.5" y2="12" stroke-width="1.4" stroke-dasharray="1.6 1.8" opacity="0.85"/></svg>',
    },
    {
        id: 'text-animator',
        file: 'effects/text-animator.html',
        title: '文字动效',
        desc: '科技感标题动画引擎。VP9 录制、超采样、阴影渐变效果。',
        category: 'text',
        version: 'v60.6',
        hot: true,
        featured: true,
        keywords: '文字动效 文字 标题 动画 VP9 录制 超采样 阴影 渐变 PNG MP4',
        icon: '<svg viewBox="0 0 24 24"><line class="g-main" x1="3.5" y1="9" x2="6.5" y2="9" stroke-width="1.4" opacity="0.32"/><line class="g-main" x1="3.5" y1="13" x2="7.5" y2="13" stroke-width="1.4" opacity="0.55"/><line class="g-main" x1="3.5" y1="17" x2="8.5" y2="17" stroke-width="1.4" opacity="0.78"/><path class="g-main" stroke-width="1.7" d="M11 19 L15 5 L19 19"/><line class="g-main" stroke-width="1.6" x1="12.4" y1="14.5" x2="17.6" y2="14.5"/></svg>',
    },
    {
        id: 'logo-matrix',
        file: 'effects/logo-matrix.html',
        title: 'Logo 矩阵',
        desc: '循环 Logo 阵列背景。帧同步录制、羽化遮罩、多种科技纹理。',
        category: 'visual',
        version: 'v25.0',
        hot: false,
        keywords: 'Logo 矩阵 循环 背景 阵列 羽化 纹理 H.264',
        icon: '<svg viewBox="0 0 24 24"><circle class="g-main" cx="5"  cy="5"  r="1.4" stroke-width="1.4" opacity="0.7"/><circle class="g-main" cx="12" cy="5"  r="1.4" stroke-width="1.4" opacity="0.7"/><circle class="g-main" cx="19" cy="5"  r="1.4" stroke-width="1.4" opacity="0.7"/><circle class="g-main" cx="5"  cy="12" r="1.4" stroke-width="1.4" opacity="0.7"/><circle class="g-dot" cx="12" cy="12" r="2.4" stroke="none"/><circle class="g-main" cx="19" cy="12" r="1.4" stroke-width="1.4" opacity="0.7"/><circle class="g-main" cx="5"  cy="19" r="1.4" stroke-width="1.4" opacity="0.7"/><circle class="g-main" cx="12" cy="19" r="1.4" stroke-width="1.4" opacity="0.7"/><circle class="g-main" cx="19" cy="19" r="1.4" stroke-width="1.4" opacity="0.7"/></svg>',
    },
    {
        id: 'particle-field',
        file: 'effects/particle-field.html',
        title: '粒子场',
        desc: '动态粒子连线场效果。可调节数量、大小、速度及连线距离。',
        category: 'particle',
        version: 'v1.0',
        hot: true,
        keywords: '粒子场 动态 粒子 连线 效果',
        icon: '<svg viewBox="0 0 24 24"><line class="g-main" stroke-width="1.4" x1="6"  y1="6"  x2="12" y2="12" opacity="0.55"/><line class="g-main" stroke-width="1.4" x1="12" y1="12" x2="19" y2="7"  opacity="0.55"/><line class="g-main" stroke-width="1.4" x1="12" y1="12" x2="8"  y2="19" opacity="0.55"/><line class="g-main" stroke-width="1.4" x1="12" y1="12" x2="18" y2="18" opacity="0.55"/><circle class="g-dot" cx="12" cy="12" r="2.4" stroke="none"/><circle class="g-main" cx="6"  cy="6"  r="1.4" stroke-width="1.4"/><circle class="g-main" cx="19" cy="7"  r="1.4" stroke-width="1.4"/><circle class="g-main" cx="8"  cy="19" r="1.4" stroke-width="1.4" opacity="0.7"/><circle class="g-main" cx="18" cy="18" r="1.4" stroke-width="1.4" opacity="0.7"/></svg>',
    },
    {
        id: 'chart-fx',
        file: 'effects/chart-fx.html',
        title: '折线图',
        desc: '双风格动态折线图。纸张模式 + 赛博模式，WebGL 3D 漂浮卡片合成。',
        category: 'chart',
        version: 'v3.0',
        hot: true,
        featured: true,
        keywords: '图表 折线图 纸张 赛博 WebGL 3D 漂浮 数据可视化',
        icon: '<svg viewBox="0 0 24 24"><path class="g-dot" d="M4 16 C 7.5 13, 9 14, 12 11.5 S 16.5 6.5, 20 7 L20 18 L4 18 Z" opacity="0.16" stroke="none"/><path class="g-main" stroke-width="1.6" d="M4 16 C 7.5 13, 9 14, 12 11.5 S 16.5 6.5, 20 7"/><circle class="g-dot" cx="20" cy="7" r="1.5"/><line class="g-main" x1="4" y1="18.5" x2="20" y2="18.5" stroke-width="1.2" opacity="0.35"/></svg>',
    },
    {
        id: 'multi-line',
        file: 'effects/multi-line.html',
        title: '多折线图',
        desc: '任意条折线对比。每条独立配色与命名、自动图例；纸张 + 赛博双风格，WebGL 3D 漂浮。',
        category: 'chart',
        version: 'v1.0',
        hot: true,
        keywords: '多折线图 折线 多条 系列 对比 图表 数据可视化 纸张 赛博 WebGL',
        icon: '<svg viewBox="0 0 24 24"><path class="g-main" stroke-width="1.6" d="M4 15 C 8 12, 10 13, 13 10 S 17 6, 20 6.5"/><path class="g-dot" stroke-width="1.6" d="M4 18.5 C 8 17, 10 17.5, 13 15.5 S 17 12.5, 20 13" opacity="0.5" stroke-dasharray="0"/><line class="g-main" x1="4" y1="20.5" x2="20" y2="20.5" stroke-width="1.2" opacity="0.3"/></svg>',
    },
    {
        id: 'card-3d',
        file: 'effects/card-3d.html',
        title: '3D 卡片',
        desc: '3D 悬浮展示卡片。支持图片/视频素材导入，自定义圆角、透视角度和漂浮动画。',
        category: 'visual',
        version: 'v1.0',
        hot: true,
        keywords: '3D 卡片 悬浮 展示 图片 视频 WebGL 透视',
        icon: '<svg viewBox="0 0 24 24"><rect class="g-dot" x="7.5" y="4.5" width="11" height="14" rx="1.8" stroke="none" opacity="0.28" transform="rotate(-8 13 11.5)"/><rect class="g-main" x="5.5" y="6.5" width="11" height="14" rx="1.8" stroke-width="1.6" transform="rotate(-8 11 13.5)"/><line class="g-main" x1="7.2" y1="11.6" x2="13.4" y2="10.7" stroke-width="1.4" opacity="0.55"/><line class="g-main" x1="7.5" y1="14.5" x2="11.8" y2="13.9" stroke-width="1.4" opacity="0.35"/></svg>',
    },
    {
        id: 'bar-chart',
        file: 'effects/bar-chart.html',
        title: '柱状图效果',
        desc: '动态柱状图。纸张模式 + 赛博模式，WebGL 3D 漂浮卡片合成。',
        category: 'chart',
        version: 'v1.0',
        hot: true,
        keywords: '柱状图 柱状图 纸张 赛博 WebGL 3D 漂浮 数据可视化',
        icon: '<svg viewBox="0 0 24 24"><rect class="g-dot" x="4" y="13" width="4" height="6" rx="1" stroke="none" opacity="0.35"/><rect class="g-dot" x="10" y="9" width="4" height="10" rx="1" stroke="none" opacity="0.6"/><rect class="g-main" x="16" y="5" width="4" height="14" rx="1" stroke-width="1.6"/><line class="g-main" x1="3.5" y1="19.5" x2="20.5" y2="19.5" stroke-width="1.2" opacity="0.35"/></svg>',
    },
    {
        id: 'pie-chart',
        file: 'effects/pie-chart.html',
        title: '饼图效果',
        desc: '实心饼图与环形图，标签引导线、百分比显示，纸张/赛博双主题，WebGL 3D 漂浮。',
        category: 'chart',
        version: 'v1.0',
        hot: true,
        keywords: '饼图 饼状图 环形图 赛博 纸张 数据可视化',
        icon: '<svg viewBox="0 0 24 24"><circle class="g-main" cx="12" cy="12" r="7.5" stroke-width="1.6" opacity="0.45"/><path class="g-dot" d="M12 4.5 A7.5 7.5 0 0 1 18.5 16 L12 12 Z" stroke="none"/><path class="g-main" d="M12 4.5 A7.5 7.5 0 0 1 18.5 16" stroke-width="1.6"/></svg>',
    },
    {
        id: 'xiaolin-card',
        file: 'effects/xiaolin-card.html',
        title: '小lin说卡片',
        desc: '旋转光边框展示卡片。彩色光流在边框上循环流动，搭配动态光斑背景，WebGL 3D 漂浮合成。',
        category: 'visual',
        version: 'v1.0',
        hot: true,
        keywords: '小lin说卡片 旋转光 边框 发光 卡片 3D WebGL',
        icon: '<svg viewBox="0 0 24 24"><rect class="g-main" x="5" y="6" width="14" height="13" rx="2" stroke-width="1.6"/><path class="g-dot" d="M9 6 L17 6 A2 2 0 0 1 19 8 L19 12" stroke="currentColor" stroke-width="2.2" opacity="0.8" stroke-linecap="round" fill="none"/><circle class="g-dot" cx="19" cy="12" r="1.7" stroke="none"/></svg>',
    },
];

/** 把站点根相对路径转成「从首页 index.html 出发」的相对 href（两者同处根目录，原样即可）。 */
function hrefFromFile(file) {
    return file;
}

/** 渲染一张工具卡片的 HTML 字符串（结构与原静态卡片一致）。 */
export function cardHTML(eff) {
    const catLabel = CAT_LABELS[eff.category] || eff.category;
    const verCls = eff.hot ? 'version-tag hot' : 'version-tag';
    const devCls = eff.dev ? ' dev' : '';
    return `
                <a href="${hrefFromFile(eff.file)}" class="ext-card${devCls}" data-category="${eff.category}" data-name="${eff.keywords}">
                    <div class="ext-icon">${eff.icon}</div>
                    <div class="ext-info">
                        <div class="ext-title-row"><span class="ext-title">${eff.title}</span><span class="${verCls}">${eff.version}</span></div>
                        <p class="ext-desc">${eff.desc}</p>
                        <div class="ext-meta">
                            <span class="ext-meta-item"><span class="ext-author-avatar">F</span>Floway Team</span>
                            <span class="ext-meta-item">·</span>
                            <span class="ext-meta-item">${catLabel}</span>
                        </div>
                    </div>
                    <div class="ext-action"><button class="btn-install">打开</button></div>
                </a>`;
}

/** 渲染整个工具网格到指定容器。 */
export function renderToolGrid(container, effects = EFFECTS) {
    container.innerHTML = effects.map(cardHTML).join('\n');
}
