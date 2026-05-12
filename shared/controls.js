/**
 * Floway Tools — 效果初始化
 * 一行代码完成：Canvas 初始化、Background、Recorder、面板注入、预览循环
 */

import { Recorder } from './recorder.js';
import { Background } from './background.js';
import { lerp, hexToRgba, getLightness, clamp, easeLinear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, getEasing, loadFont, setupFontSelector, initFontSelector, FONT_LIST, fontSelectHTML, drawMediaContain, createLinearGradient, createRadialGradient, drawTextCentered, drawTextWrapped, bindUI, applyVignetteMask, calcGradCoords } from './utils.js';
import { getTheme } from './themes.js';
import { enhanceAllSelects } from './custom-select.js';

// ========== 共享面板构建器 ==========

/**
 * 共享面板注册表：name -> (cfg) => html
 * 每个 builder 接收单个效果的覆盖配置，返回完整 `<div class="control-group">...</div>` HTML。
 *
 * 用法（effect HTML）：
 *   <div data-shared-panel="entryAnimation"></div>
 *
 * 用法（initEffect opts）：
 *   sharedPanels: {
 *     entryAnimation: { xyRange: [-3000,3000], scaleRange: [0,500], headerButton: {id:'BtnPlay', label:'▶ 播放'}, extras: ['lineDelay'] }
 *   }
 */
const SHARED_PANELS = {
    entryAnimation: buildEntryAnimationPanel,
};

function buildEntryAnimationPanel(cfg = {}) {
    const collapsible = cfg.collapsible !== false;
    const defaultCollapsed = cfg.defaultCollapsed !== false;
    const [xMin, xMax] = cfg.xyRange || [-1000, 1000];
    const [sMin, sMax] = cfg.scaleRange || [0, 200];
    const startY = cfg.startY != null ? cfg.startY : 300;
    const headerBtn = cfg.headerButton
        ? `<button class="btn btn-primary" style="width:auto; padding:4px 10px;" id="${cfg.headerButton.id}">${cfg.headerButton.label}</button>`
        : '';
    const extras = (cfg.extras || []).map(name => EXTRA_BLOCKS[name] || '').join('');

    const classes = ['control-group'];
    if (collapsible) classes.push('collapsible');
    const attrs = defaultCollapsed && collapsible ? ' data-default-collapsed' : '';

    return `
        <div class="${classes.join(' ')}"${attrs}>
            <div class="group-title"><span>🎬 入场动画</span>${headerBtn}</div>
            <div class="sub-section ss-teal">
                <div class="sub-section-label">预设 & 曲线</div>
                <div class="sub-title"><span>启用入场动画</span><input type="checkbox" id="EntranceEnabled" checked></div>
                <div id="EntranceOpts">
                    <div class="row stack" style="margin-top:4px"><div class="label-line"><span>预设动画</span></div>
                        <select id="EntrancePreset">
                            <option value="none">无</option>
                            <option value="slideUp" selected>从下浮现</option>
                            <option value="fadeIn">纯淡入</option>
                            <option value="slideLeft">从右滑入</option>
                            <option value="slideRight">从左滑入</option>
                            <option value="zoomIn">缩放进入</option>
                        </select></div>
                    <div class="row" style="margin-top:6px">
                        <div style="flex:1" class="stack"><div class="label-line"><span>入场时长</span><span id="EntranceDurationVal">0.8s</span></div>
                            <input type="range" id="EntranceDuration" min="0.1" max="3" step="0.1" value="0.8"></div>
                        <div style="flex:1" class="stack"><div class="label-line"><span>入场曲线</span></div>
                            <select id="EntranceEasing">
                                <option value="linear">线性</option>
                                <option value="easeIn">先慢后快</option>
                                <option value="easeOut" selected>先快后慢</option>
                                <option value="easeInOut">丝滑缓动</option>
                            </select></div>
                    </div>
                </div>
            </div>
            <div id="EntranceDetailOpts">
                <div class="sub-section ss-blue">
                    <div class="sub-section-label">位置</div>
                    <div class="row">
                        <div style="flex:1" class="stack"><div class="label-line"><span>起始 X</span><span id="EntranceStartXVal">0</span></div>
                            <input type="range" id="EntranceStartX" min="${xMin}" max="${xMax}" step="10" value="0"></div>
                        <div style="flex:1" class="stack"><div class="label-line"><span>起始 Y</span><span id="EntranceStartYVal">${startY}</span></div>
                            <input type="range" id="EntranceStartY" min="${xMin}" max="${xMax}" step="10" value="${startY}"></div>
                    </div>
                    <div class="row">
                        <div style="flex:1" class="stack"><div class="label-line"><span>结束 X</span><span id="EntranceEndXVal">0</span></div>
                            <input type="range" id="EntranceEndX" min="${xMin}" max="${xMax}" step="10" value="0"></div>
                        <div style="flex:1" class="stack"><div class="label-line"><span>结束 Y</span><span id="EntranceEndYVal">0</span></div>
                            <input type="range" id="EntranceEndY" min="${xMin}" max="${xMax}" step="10" value="0"></div>
                    </div>
                </div>
                <div class="sub-section ss-green">
                    <div class="sub-section-label">透明度 & 缩放</div>
                    <div class="row">
                        <div style="flex:1" class="stack"><div class="label-line"><span>起始透明度</span><span id="EntranceStartOpacityVal">0%</span></div>
                            <input type="range" id="EntranceStartOpacity" min="0" max="100" step="5" value="0"></div>
                        <div style="flex:1" class="stack"><div class="label-line"><span>结束透明度</span><span id="EntranceEndOpacityVal">100%</span></div>
                            <input type="range" id="EntranceEndOpacity" min="0" max="100" step="5" value="100"></div>
                    </div>
                    <div class="row">
                        <div style="flex:1" class="stack"><div class="label-line"><span>起始缩放</span><span id="EntranceStartScaleVal">100%</span></div>
                            <input type="range" id="EntranceStartScale" min="${sMin}" max="${sMax}" step="5" value="100"></div>
                        <div style="flex:1" class="stack"><div class="label-line"><span>结束缩放</span><span id="EntranceEndScaleVal">100%</span></div>
                            <input type="range" id="EntranceEndScale" min="${sMin}" max="${sMax}" step="5" value="100"></div>
                    </div>
                </div>
                ${extras}
            </div>
        </div>
    `;
}

// 可选的附加子区块（按效果叠加，例如 chart-fx 的「画线延迟」）
const EXTRA_BLOCKS = {
    lineDelay: `
        <div class="sub-section ss-amber">
            <div class="sub-section-label">时间控制</div>
            <div class="row stack"><div class="label-line"><span>画线延迟</span><span id="LineDelayVal">0.3s</span></div>
                <input type="range" id="LineDelay" min="0" max="3" step="0.1" value="0.3"></div>
        </div>
    `,
};

/**
 * 扫描 `[data-shared-panel]` 占位符，按 opts.sharedPanels[name] 配置注入面板 HTML。
 * 同一面板在同一效果中只允许出现一次（重复 ID 会冲突）。
 */
export function injectSharedPanels(opts = {}) {
    const placeholders = document.querySelectorAll('[data-shared-panel]');
    const cfgMap = opts.sharedPanels || {};
    placeholders.forEach(ph => {
        const name = ph.getAttribute('data-shared-panel');
        const builder = SHARED_PANELS[name];
        if (!builder) {
            console.warn(`[Floway] 未知共享面板: ${name}`);
            return;
        }
        const html = builder(cfgMap[name] || {});
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        // 将 builder 返回的根节点替换占位符
        ph.replaceWith(...wrapper.childNodes);
    });
}

// ========== 面板 HTML 注入 ==========

export function injectPanels(opts = {}) {
    const placeholder = document.querySelector('#shared-controls-placeholder');
    if (!placeholder) return;

    const defaultBgMode = opts.defaultBgMode || getTheme().canvasBg;
    const defaultPatternColor = opts.defaultPatternColor || '#333333';
    const skipBg = opts.skipBgPanel === true;

    const bgPanelHTML = skipBg ? '' : `
        <div class="control-group">
            <div class="group-title"><span>▩ 场景背景</span></div>
            <div class="row">
                <select id="BgMode">
                    <option value="transparent" ${defaultBgMode === 'transparent' ? 'selected' : ''}>🏁 透明</option>
                    <option value="#000000" ${defaultBgMode === '#000000' ? 'selected' : ''}>⬛ 纯黑</option>
                    <option value="#00ff00">🟩 绿幕</option>
                    <option value="#0000ff">🟦 蓝幕</option>
                    <option value="grid">▦ 网格</option>
                    <option value="dots">::: 点阵</option>
                    <option value="paper">📄 纸张纹理</option>
                    <option value="custom">📂 上传背景...</option>
                </select>
            </div>
            <input type="file" id="BgUpload" accept="image/*,video/*" style="display:none">
            <div class="row" id="PatternColorRow" style="display:none; justify-content:space-between; align-items:center;">
                <div style="font-size:11px; color:var(--text-sub, #888);">纹理颜色</div>
                <input type="color" id="PatternColor" value="${defaultPatternColor}">
            </div>
            <div class="row stack" id="PaperParamsRow" style="display:none;">
                <div class="label-line"><span>暖色调 (Warmth)</span><span id="PaperWarmthVal">40</span></div>
                <input type="range" id="PaperWarmth" min="0" max="100" step="1" value="40">
            </div>
        </div>
    `;

    placeholder.innerHTML = `
        ${bgPanelHTML}

        <div class="control-group" style="border-color:var(--danger)">
            <div class="group-title">🎥 导出</div>
            <div class="row">
                <select id="ExportFormat">
                    <option value="png_seq">📸 PNG 序列</option>
                    <option value="mp4">🎥 MP4</option>
                    <option value="webm">🌐 WebM</option>
                </select>
            </div>
            <div class="row" style="margin-top:10px;">
                <button id="BtnRecord" class="btn btn-record" disabled>⌛ 连接组件...</button>
            </div>
            <div id="LibStatus" style="font-size:10px; color:#666; margin-top:5px; text-align:center;">
                <span class='status-dot status-loading'></span>初始化...
            </div>
        </div>
    `;
}

// ========== 主初始化函数 ==========

/**
 * @param {Object} opts
 * @param {string} [opts.canvasId='mainCanvas']
 * @param {string} opts.fileName          - 导出文件名
 * @param {number} [opts.baseWidth=1440]
 * @param {number} [opts.baseHeight=1080]
 * @param {number} [opts.scale=2]         - 超采样倍率
 * @param {string} [opts.defaultBgMode='#000000']
 * @param {string} [opts.defaultPatternColor='#333333']
 * @param {Function} opts.onFrame        - (timeMs) => void，录制时每帧调用
 * @param {boolean} [opts.useRealtimeWebm=false]
 * @param {boolean} [opts.useRafForFrames=false]
 * @param {boolean} [opts.useManualWebmFrames=false]
 * @param {number}  [opts.encodeQueueMax=2]
 * @returns {{ ctx, canvas, bg, recorder, baseWidth, baseHeight, scale, clearFrame, drawBg, startPreviewLoop, resetAnimStart }}
 */
export function initEffect(opts) {
    // 0. 预览模式检测
    const isPreview = new URLSearchParams(window.location.search).has('preview');
    if (isPreview) document.body.classList.add('preview-mode');

    // 1. 注入共享面板 + 背景/导出面板（预览模式跳过）
    if (!isPreview) {
        injectSharedPanels(opts);
        injectPanels(opts);
    }

    // 1.5 快速预设面板
    if (!isPreview && opts.presets) injectPresetPanel(opts.presets);

    // 1.6 自定义下拉框增强
    if (!isPreview) enhanceAllSelects();

    // 1.7 侧边栏拖拽调节
    if (!isPreview) initSidebarResize();

    // 1.8 可折叠分组
    if (!isPreview) initCollapsibleGroups();

    // 1.9 简洁/完整模式切换
    if (!isPreview) initSimpleMode();

    // 2. Canvas 初始化（预览模式降低分辨率）
    const baseWidth = opts.baseWidth || 1440;
    const baseHeight = opts.baseHeight || 1080;
    const scale = isPreview ? 1 : (opts.scale || 2);
    const canvas = document.getElementById(opts.canvasId || 'mainCanvas');
    canvas.width = baseWidth * scale;
    canvas.height = baseHeight * scale;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: false });
    ctx.scale(scale, scale);

    // 3. Background
    const bg = new Background({
        modeSelectId: '#BgMode',
        uploadInputId: '#BgUpload',
        patternColorId: '#PatternColor',
        patternRowId: '#PatternColorRow',
        defaultMode: opts.defaultBgMode || getTheme().canvasBg,
        defaultPatternColor: opts.defaultPatternColor || '#333333',
        baseWidth,
        baseHeight,
        scaleFactor: scale,
    });

    // 4. Recorder（预览模式用空桩）
    const recorder = isPreview
        ? { isRecording: false, format: 'png_seq' }
        : new Recorder({
            canvas,
            onFrame: opts.onFrame,
            fileName: opts.fileName || 'Effect',
            width: baseWidth * scale,
            height: baseHeight * scale,
            useRealtimeWebm: opts.useRealtimeWebm || false,
            useRafForFrames: opts.useRafForFrames || false,
            useManualWebmFrames: opts.useManualWebmFrames || false,
            encodeQueueMax: opts.encodeQueueMax || 2,
        });

    // 5. 动画时间
    let animStartTime = performance.now();
    function resetAnimStart() {
        animStartTime = performance.now();
    }

    // 6. 画布工具函数
    function clearFrame() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    function drawBg(timeMs) {
        if (recorder.format !== 'png_seq' && bg.mode === 'transparent') {
            ctx.fillStyle = getTheme().canvasBg;
            ctx.fillRect(0, 0, baseWidth, baseHeight);
        }
        if (bg.mode !== 'transparent') {
            bg.draw(ctx, timeMs, recorder.isRecording, recorder.format);
        }
    }

    // 7. 预览循环
    let _previewLoopRunning = false;

    function startPreviewLoop(drawFn, loopOptsOrGetter = {}) {
        if (_previewLoopRunning) return;
        _previewLoopRunning = true;

        function getOpts() {
            return typeof loopOptsOrGetter === 'function' ? loopOptsOrGetter() : loopOptsOrGetter;
        }

        function loop() {
            if (!recorder.isRecording) {
                let time = performance.now() - animStartTime;
                const opts = getOpts();
                const duration = (opts.duration || 0) * 1000;
                const hold = opts.hold === true;
                // hold 模式：超过时长后传入 Infinity 让效果画终态
                if (hold && duration > 0 && time > duration) {
                    time = Infinity;
                }
                drawFn(time);
            }
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    }

    // 8. onRender 自动模式（可选）
    // 如果提供 onRender 回调，自动完成 clearFrame → drawBg → 业务逻辑 → startPreviewLoop
    if (opts.onRender && typeof opts.onRender === 'function') {
        const userRender = opts.onRender;
        const loopOpts = opts.loopOpts || {};

        function _autoDrawFrame(timeMs) {
            clearFrame();
            drawBg(timeMs);
            userRender(timeMs);
        }

        startPreviewLoop(_autoDrawFrame, loopOpts);

        // 普通模式的返回值（onRender 模式追加 reRender）
        const result = {
            ctx, canvas, bg, recorder,
            baseWidth, baseHeight, scale,
            clearFrame, drawBg,
            startPreviewLoop, resetAnimStart,
            lerp, hexToRgba, getLightness, clamp,
            easeLinear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, getEasing,
            loadFont,
            setupFontSelector, initFontSelector,
            FONT_LIST, fontSelectHTML,
            drawMediaContain,
            createLinearGradient, createRadialGradient,
            drawTextCentered, drawTextWrapped,
            bindUI,
            applyVignetteMask, calcGradCoords,
        };
        result.reRender = resetAnimStart;  // 快捷重播（onRender 模式下的别名）
        return result;
    }

    return {
        ctx, canvas, bg, recorder,
        baseWidth, baseHeight, scale,
        clearFrame, drawBg,
        startPreviewLoop, resetAnimStart,
        lerp, hexToRgba, getLightness, clamp,
        easeLinear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, getEasing,
        loadFont,
        setupFontSelector, initFontSelector,
        FONT_LIST, fontSelectHTML,
        drawMediaContain,
        createLinearGradient, createRadialGradient,
        drawTextCentered, drawTextWrapped,
        bindUI,
        applyVignetteMask, calcGradCoords,
    };
}

// ========== 可折叠分组 ==========

/**
 * 扫描所有 `.control-group.collapsible`：
 *  - 把 `.group-title` 之后的兄弟节点包进 `.group-content`（若尚未包裹）
 *  - 给 `.group-title` 末尾追加 `<span class="collapse-arrow">▼</span>`（若没有）
 *  - `data-default-collapsed` 决定初始是否折叠
 *  - 点击标题切换 `.collapsed`
 *  - localStorage 持久化每个分组的折叠状态（按 title 文本作为 key）
 */
const COLLAPSE_STATE_KEY = 'floway-collapsed-groups';

function readCollapseState() {
    try { return JSON.parse(localStorage.getItem(COLLAPSE_STATE_KEY) || '{}'); }
    catch { return {}; }
}

function writeCollapseState(state) {
    try { localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(state)); } catch {}
}

export function initCollapsibleGroups(root = document) {
    const groups = root.querySelectorAll('.control-group');
    if (!groups.length) return;

    const state = readCollapseState();

    groups.forEach(group => {
        const title = group.querySelector(':scope > .group-title');
        if (!title) return;

        // 1) 把标题后的兄弟节点包进 .group-content
        let content = group.querySelector(':scope > .group-content');
        if (!content) {
            content = document.createElement('div');
            content.className = 'group-content';
            const after = [];
            let node = title.nextSibling;
            while (node) {
                after.push(node);
                node = node.nextSibling;
            }
            after.forEach(n => content.appendChild(n));
            group.appendChild(content);
        }

        // 2) 提取分组标识（用首个 span 文本，避免包含按钮/箭头）
        const labelSpan = title.querySelector('span');
        const key = (labelSpan ? labelSpan.textContent : title.textContent || '').trim();

        // 3) 追加折叠箭头
        if (!title.querySelector('.collapse-arrow')) {
            const arrow = document.createElement('span');
            arrow.className = 'collapse-arrow';
            arrow.textContent = '▼';
            title.appendChild(arrow);
        }

        const persisted = state[key];
        const defaultCollapsed = group.hasAttribute('data-default-collapsed');
        if (persisted === true || (persisted === undefined && defaultCollapsed)) {
            group.classList.add('collapsed');
        }

        // 5) 点击切换
        title.addEventListener('click', (e) => {
            // 避免点击标题内的按钮（如 ▶ 播放）触发折叠
            if (e.target.closest('button, input, select')) return;
            const collapsed = group.classList.toggle('collapsed');
            const s = readCollapseState();
            s[key] = collapsed;
            writeCollapseState(s);
        });
    });
}

// ========== 侧边栏可拖拽调节宽度 ==========

const SIDEBAR_WIDTH_KEY = 'floway-sidebar-width';
const SIDEBAR_DEFAULT = 360;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 900;

export function initSidebarResize() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const mobileQuery = window.matchMedia('(max-width: 1100px)');
    const portraitQuery = window.matchMedia('(max-width: 1100px) and (orientation: portrait)');

    function applySavedWidth() {
        if (mobileQuery.matches) {
            // 移动布局：清除 inline，让 CSS 媒体查询控制宽度
            sidebar.style.width = '';
        } else {
            const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
            const initialW = (saved) ? parseInt(saved, 10) : SIDEBAR_DEFAULT;
            if (initialW >= SIDEBAR_MIN && initialW <= SIDEBAR_MAX) {
                sidebar.style.width = initialW + 'px';
            } else {
                sidebar.style.width = '';
            }
        }
    }

    applySavedWidth();
    mobileQuery.addEventListener('change', applySavedWidth);

    // 创建拖拽手柄
    let handle = sidebar.querySelector('.sidebar-resize-handle');
    if (!handle) {
        handle = document.createElement('div');
        handle.className = 'sidebar-resize-handle';
        sidebar.appendChild(handle);
    }

    let startX = 0, startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        if (portraitQuery.matches) return;
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startWidth = sidebar.getBoundingClientRect().width;
        document.body.classList.add('resizing');

        const onMove = (ev) => {
            ev.preventDefault();
            const delta = ev.clientX - startX;
            let newW = Math.round(startWidth + delta);
            newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, newW));
            sidebar.style.width = newW + 'px';
        };

        const onUp = () => {
            document.body.classList.remove('resizing');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            // 持久化
            const finalW = Math.round(sidebar.getBoundingClientRect().width);
            localStorage.setItem(SIDEBAR_WIDTH_KEY, String(finalW));
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ========== 简洁 / 完整模式切换 ==========

const SIMPLE_MODE_KEY = 'floway-simple-mode';

export function initSimpleMode() {
    const container = document.querySelector('.controls-container');
    const headerRight = document.querySelector('.sidebar-header > div:last-child');
    if (!container || !headerRight) return;

    const isSimple = localStorage.getItem(SIMPLE_MODE_KEY) !== 'false';
    if (isSimple) container.classList.add('simple-mode');

    const btn = document.createElement('button');
    btn.className = 'btn-mode-toggle' + (isSimple ? ' is-simple' : '');
    btn.title = isSimple ? '切换到完整模式' : '切换到简洁模式';
    btn.textContent = isSimple ? '简洁' : '完整';

    btn.addEventListener('click', () => {
        const nowSimple = container.classList.toggle('simple-mode');
        btn.textContent = nowSimple ? '简洁' : '完整';
        btn.title = nowSimple ? '切换到完整模式' : '切换到简洁模式';
        btn.classList.toggle('is-simple', nowSimple);
        localStorage.setItem(SIMPLE_MODE_KEY, String(nowSimple));
    });

    headerRight.prepend(btn);
}

// ========== 快速预设面板 ==========

/**
 * 在 .controls-container 顶部注入预设按钮面板。
 * @param {Array<{label:string, id:string, apply:Function}>} presets
 */
export function injectPresetPanel(presets) {
    if (!presets || !presets.length) return;
    const container = document.querySelector('.controls-container');
    if (!container) return;

    const btns = presets.map(p =>
        `<button class="btn-preset" data-preset="${p.id}">${p.label}</button>`
    ).join('');

    const html = `
        <div class="control-group preset-panel" data-basic>
            <div class="group-title"><span>🎨 快速预设</span></div>
            <div class="group-content">
                <div class="preset-buttons">${btns}</div>
            </div>
        </div>`;

    container.insertAdjacentHTML('afterbegin', html);

    const panel = container.querySelector('.preset-panel');
    panel.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = presets.find(p => p.id === btn.dataset.preset);
            if (!preset) return;
            preset.apply();
            panel.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}
