/**
 * Floway Tools — 效果初始化
 * 一行代码完成：Canvas 初始化、Background、Recorder、面板注入、预览循环
 */

import { Recorder } from './recorder.js';
import { Background } from './background.js';
import { lerp, hexToRgba, getLightness, clamp, easeLinear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, getEasing, loadFont, setupFontSelector, initFontSelector, FONT_LIST, fontSelectHTML, drawMediaContain, createLinearGradient, createRadialGradient, drawTextCentered, drawTextWrapped, bindUI, applyVignetteMask, calcGradCoords } from './utils.js';
import { getTheme } from './themes.js';
import { enhanceAllSelects, enhanceSelect } from './custom-select.js';

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
    chartTitle: buildChartTitlePanel,
};

function buildEntryAnimationPanel(cfg = {}) {
    const collapsible = cfg.collapsible !== false;
    const defaultCollapsed = cfg.defaultCollapsed !== false;
    const [xMin, xMax] = cfg.xyRange || [-1000, 1000];
    const [sMin, sMax] = cfg.scaleRange || [0, 200];
    const startY = cfg.startY != null ? cfg.startY : 300;
    const headerBtn = cfg.headerButton
        ? `<button class="btn-play" id="${cfg.headerButton.id}">${cfg.headerButton.label}</button>`
        : '';
    const extras = (cfg.extras || []).map(name => EXTRA_BLOCKS[name] || '').join('');

    const classes = ['control-group'];
    if (collapsible) classes.push('collapsible');
    const attrs = defaultCollapsed && collapsible ? ' data-default-collapsed' : '';

    return `
        <div class="${classes.join(' ')}"${attrs}>
            <div class="group-title"><span>入场动画</span>${headerBtn}</div>
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
 * 共享「标题」面板：主标题 + 副标题（字体/字号/字重/颜色/位置/括号/发光）。
 * chart-fx / bar-chart / pie-chart 三个图表通用，控件 ID 与各自的 bindUI/渲染契约一致。
 * cfg:
 *   groupTitle  分组标题文案（默认 '标题'）
 *   mainTitle   主标题默认文字
 *   subTitle    副标题默认文字
 */
function buildChartTitlePanel(cfg = {}) {
    const groupTitle = cfg.groupTitle || '标题';
    const mainTitle = cfg.mainTitle != null ? cfg.mainTitle : '主标题';
    const subTitle = cfg.subTitle != null ? cfg.subTitle : '副标题';

    return `
        <div class="control-group">
            <div class="group-title"><span>${groupTitle}</span></div>
            <div class="row stack"><div class="label-line"><span>标题字体</span></div>
                <div id="TitleFontMount" style="width:100%"></div></div>
            <div class="sub-section ss-blue">
                <div class="sub-section-label">主标题</div>
                <div class="sub-title"><span>启用主标题</span><input type="checkbox" id="ShowMainTitle" checked></div>
                <div id="MainTitleOpts">
                    <div class="row stack">
                        <div class="label-line"><span>文字</span></div>
                        <input type="text" id="MainTitle" value="${mainTitle}">
                    </div>
                    <div class="advanced-params">
                        <div class="stack"><div class="label-line"><span>字号</span><span id="TitleSizeVal">26</span></div>
                            <input type="range" id="TitleSize" min="12" max="72" step="2" value="26"></div>
                        <div class="stack"><div class="label-line"><span>字重</span><span id="MainTitleWeightVal">700</span></div>
                            <input type="range" id="MainTitleWeight" min="100" max="900" step="100" value="700"></div>
                        <div class="row stack"><div class="label-line"><span>颜色</span></div>
                            <input type="color" id="TitleColor" value="#333333"></div>
                        <div class="row">
                            <div class="stack" style="flex:1"><div class="label-line"><span>X</span><span id="MainTitleXVal">0</span></div>
                                <input type="range" id="MainTitleX" min="-720" max="720" step="1" value="0"></div>
                            <div class="stack" style="flex:1"><div class="label-line"><span>Y</span><span id="MainTitleYVal">-490</span></div>
                                <input type="range" id="MainTitleY" min="-540" max="540" step="1" value="-490"></div>
                        </div>
                        <div class="sub-title"><span>显示括号</span><input type="checkbox" id="ShowBrackets" checked></div>
                    </div>
                </div>
            </div>
            <div class="sub-section ss-purple">
                <div class="sub-section-label">副标题</div>
                <div class="sub-title"><span>启用副标题</span><input type="checkbox" id="ShowSubTitle" checked></div>
                <div id="SubTitleOpts">
                    <div class="row stack">
                        <div class="label-line"><span>文字</span></div>
                        <input type="text" id="SubTitle" value="${subTitle}">
                    </div>
                    <div class="advanced-params">
                        <div class="stack"><div class="label-line"><span>字号</span><span id="SubTitleSizeVal">36</span></div>
                            <input type="range" id="SubTitleSize" min="16" max="100" step="2" value="36"></div>
                        <div class="stack"><div class="label-line"><span>字重</span><span id="SubTitleWeightVal">400</span></div>
                            <input type="range" id="SubTitleWeight" min="100" max="900" step="100" value="400"></div>
                        <div class="row stack"><div class="label-line"><span>颜色</span></div>
                            <input type="color" id="SubTitleColor" value="#999999"></div>
                        <div class="row">
                            <div class="stack" style="flex:1"><div class="label-line"><span>X</span><span id="SubTitleXVal">630</span></div>
                                <input type="range" id="SubTitleX" min="-720" max="720" step="1" value="630"></div>
                            <div class="stack" style="flex:1"><div class="label-line"><span>Y</span><span id="SubTitleYVal">0</span></div>
                                <input type="range" id="SubTitleY" min="-540" max="540" step="1" value="0"></div>
                        </div>
                        <div class="sub-title"><span>副标题发光</span><input type="checkbox" id="SubTitleGlow"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

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

    const bgCellHTML = skipBg ? '' : `
        <div class="sf-cell">
            <span class="sf-label">背景</span>
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
        </div>`;

    const bgExtrasHTML = skipBg ? '' : `
        <input type="file" id="BgUpload" accept="image/*,video/*" style="display:none">
        <div class="row" id="PatternColorRow" style="display:none; justify-content:space-between; align-items:center;">
            <div style="font-size:11px; color:var(--text-sub, #888);">纹理颜色</div>
            <input type="color" id="PatternColor" value="${defaultPatternColor}">
        </div>
        <div class="row stack" id="PaperParamsRow" style="display:none;">
            <div class="label-line"><span>暖色调 (Warmth)</span><span id="PaperWarmthVal">40</span></div>
            <input type="range" id="PaperWarmth" min="0" max="100" step="1" value="40">
        </div>`;

    placeholder.innerHTML = '';
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    let footer = sidebar.querySelector('.sidebar-footer');
    if (footer) footer.remove();
    footer = document.createElement('div');
    footer.className = 'sidebar-footer';
    footer.innerHTML = `
        <div class="sf-row">
            ${bgCellHTML}
            <div class="sf-cell">
                <span class="sf-label">格式</span>
                <select id="ExportFormat">
                    <option value="png_seq">📸 PNG 序列</option>
                    <option value="mp4">🎥 MP4</option>
                    <option value="webm">🌐 WebM</option>
                    <option value="prores">🎬 透明视频 (MOV)</option>
                </select>
            </div>
        </div>
        <div class="sf-row" id="ProResOpts" style="display:none">
            <div class="sf-cell">
                <span class="sf-label">帧率</span>
                <select id="ProResFps">
                    <option value="30" selected>30 fps</option>
                    <option value="60">60 fps</option>
                </select>
            </div>
        </div>
        ${bgExtrasHTML}
        <div class="sf-actions">
            <button id="FooterBtnPlay" class="btn btn-play" style="display:none">▶ 播放</button>
            <button id="BtnRecord" class="btn btn-record" disabled>⌛ 连接...</button>
        </div>
    `;
    sidebar.appendChild(footer);

    // 统一 footer 下拉为自定义样式（enhanceSelect 幂等，已增强会自动跳过）
    footer.querySelectorAll('select').forEach(el => enhanceSelect(el));

    // ProRes 专属选项（帧率/质量）仅在选中 ProRes 时显示
    const fmtSel = footer.querySelector('#ExportFormat');
    const proresOpts = footer.querySelector('#ProResOpts');
    if (fmtSel && proresOpts) {
        const toggleProres = () => { proresOpts.style.display = fmtSel.value === 'prores' ? '' : 'none'; };
        fmtSel.addEventListener('change', toggleProres);
        toggleProres();
    }
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
 * @param {boolean} [opts.skipMainCanvas=false] - 跳过 getElementById(canvasId) 与尺寸设置（用于 WebGL/SVG 效果）
 * @param {boolean} [opts.skipDrawContext=false] - 跳过 2D context 创建（与 skipMainCanvas 配合）
 * @param {HTMLCanvasElement|string|Function} [opts.recorderCanvas] - Recorder 实际抓帧的 canvas；可传 DOM 元素、id、或 lazy getter
 * @param {{bgRect, patternEl}} [opts.svgTargets] - 透传给 Background（仅 SVG 效果使用）
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
    if (!isPreview) initAdvancedSections();

    // 1.10 顶部播放按钮（若效果有 #BtnPlay）
    if (!isPreview) initHeaderPlayButton();

    // 1.11 颜色选择器旁注入 hex 输入框
    if (!isPreview) initColorInputs();

    // 1.12 参数分类标签（文字/数据 · 样式 · 动画）
    if (!isPreview) initCategoryTabs();

    // 2. Canvas 初始化（预览模式降低分辨率；可跳过供 WebGL/SVG 效果使用）
    const baseWidth = opts.baseWidth || 1440;
    const baseHeight = opts.baseHeight || 1080;
    const scale = isPreview ? 1 : (opts.scale || 2);
    let canvas = null, ctx = null;
    if (!opts.skipMainCanvas) {
        canvas = document.getElementById(opts.canvasId || 'mainCanvas');
        canvas.width = baseWidth * scale;
        canvas.height = baseHeight * scale;
        if (!opts.skipDrawContext) {
            ctx = canvas.getContext('2d', { alpha: true, desynchronized: false });
            ctx.scale(scale, scale);
        }
    }

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
        svgTargets: opts.svgTargets,
    });

    // 4. Recorder（预览模式用空桩）
    function resolveRecorderCanvas() {
        const rc = opts.recorderCanvas;
        if (!rc) return canvas;
        if (typeof rc === 'string') return document.getElementById(rc);
        if (typeof rc === 'function') return rc();
        return rc;
    }
    const recorder = isPreview
        ? { isRecording: false, format: 'png_seq' }
        : new Recorder({
            canvas: resolveRecorderCanvas(),
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

    // 6. 画布工具函数（skipDrawContext 模式下为 no-op）
    function clearFrame() {
        if (!ctx) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    function drawBg(timeMs) {
        if (!ctx) return;
        if (bg.mode === 'transparent') {
            // 录制 mp4/webm 时视频不支持透明 → 一律填黑底（不随主题）；
            // 预览 & PNG 序列 & ProRes(带 alpha) 保持真透明（画布已 clearFrame），露出整页网格底纹
            const keepsAlpha = recorder.format === 'png_seq' || recorder.format === 'prores';
            if (recorder.isRecording && !keepsAlpha) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, baseWidth, baseHeight);
            }
            return;
        }
        bg.draw(ctx, timeMs, recorder.isRecording, recorder.format);
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

    // 启动期遮罩解除：setup 完成 + 首帧后移除 editor-booting，让侧栏/画布淡入
    if (!isPreview) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            document.documentElement.classList.remove('editor-booting');
        }));
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
 *  - 初始全部展开；仅恢复用户此前手动折叠过的分组
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

        // 不默认折叠：初始全部展开，仅恢复用户此前手动折叠过的分组（data-default-collapsed 不生效）
        const persisted = state[key];
        if (persisted === true) {
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

// ========== 参数分类标签（文字/数据 · 样式 · 动画）==========

/**
 * 在 sidebar-header 与滚动参数区之间插入标签栏，把参数分组按类别过滤：
 *  - data  内容（数据表、标题、文字内容、上传素材）
 *  - style 样式（图表/文字本体外观、颜色、坐标、标签、模式…默认归类）
 *  - card  卡片（卡片外观/边框、透视旋转、旋转光效、卡片漂浮等三维相关）
 *  - anim  动画（画线/入场/扫描序列/动态等时间线动效）
 * 归类规则：分组若带 data-cat 属性优先用之；否则按标题关键词匹配（data→card→anim→默认 style）。
 * 仅显示该效果实际存在的类别，且 ≥2 类才显示标签栏；快速预设面板常驻、不参与过滤。
 * 切换状态按页面路径持久化到 localStorage。
 */
const CATEGORY_DEFS = [
    { id: 'data',  label: '内容', icon: '<path d="M5 6h14M5 12h14M5 18h9"/>' },
    { id: 'style', label: '样式', icon: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>' },
    { id: 'card',  label: '卡片', icon: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/>' },
    { id: 'anim',  label: '动画', icon: '<path d="M8 5l11 7-11 7z"/>' },
];

// 归类关键词：按 内容 → 卡片 → 动画 顺序命中，否则默认样式。
// 卡片：卡片外观/样式/边框、透视旋转(静态3D倾角)、旋转光效、卡片漂浮/漂浮动画 等三维相关。
const CATEGORY_KEYWORDS = {
    data: ['数据管理', '标题', '核心内容', '内容编辑', '内容', '核心素材', '素材管理', '素材', '文字', '文本'],
    card: ['卡片', '透视旋转', '旋转', '漂浮', '边框'],
    anim: ['入场动画', '动画', '动态'],
};

function categorizeByTitle(title) {
    for (const kw of CATEGORY_KEYWORDS.data) if (title.includes(kw)) return 'data';
    for (const kw of CATEGORY_KEYWORDS.card) if (title.includes(kw)) return 'card';
    for (const kw of CATEGORY_KEYWORDS.anim) if (title.includes(kw)) return 'anim';
    return 'style';
}

// 读取分组标题文本：优先取非折叠箭头的 label span；标题为直接文本时，
// 排除 initCollapsibleGroups 追加的 ▼ 箭头与按钮后再取文本（否则会误读成 "▼"）。
function readGroupTitle(group) {
    const titleEl = group.querySelector(':scope > .group-title');
    if (!titleEl) return '';
    const labelSpan = titleEl.querySelector('span:not(.collapse-arrow)');
    if (labelSpan) return labelSpan.textContent.trim();
    const clone = titleEl.cloneNode(true);
    clone.querySelectorAll('.collapse-arrow, button, input, select').forEach(n => n.remove());
    return clone.textContent.trim();
}

const CAT_TAB_KEY = 'floway-cat-tab';

export function initCategoryTabs(root = document) {
    const sidebar = root.querySelector('.sidebar');
    const container = root.querySelector('.controls-container');
    if (!sidebar || !container) return;
    if (sidebar.querySelector('.cat-tabs')) return; // 幂等

    // 顶层分组（预设面板常驻，不参与分类过滤）
    const groups = Array.from(container.querySelectorAll(':scope > .control-group'))
        .filter(g => !g.classList.contains('preset-panel'));
    if (!groups.length) return;

    const present = new Set();
    groups.forEach(g => {
        let cat = g.dataset.cat;
        if (!cat) {
            cat = categorizeByTitle(readGroupTitle(g));
            g.dataset.cat = cat;
        }
        present.add(cat);
    });

    const cats = CATEGORY_DEFS.filter(c => present.has(c.id));
    if (cats.length < 2) return; // 只有一类时无需标签

    const bar = document.createElement('div');
    bar.className = 'cat-tabs';

    // 滑块（当前项的浮起玻璃），置于按钮之下，由 JS 设宽度+位移
    const thumb = document.createElement('div');
    thumb.className = 'cat-thumb';
    bar.appendChild(thumb);

    cats.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'cat-tab';
        btn.dataset.cat = c.id;
        btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${c.icon || ''}</svg><span>${c.label}</span>`;
        bar.appendChild(btn);
    });
    sidebar.insertBefore(bar, container);

    const key = CAT_TAB_KEY + ':' + (location.pathname.split('/').pop() || 'effect');
    let active = localStorage.getItem(key);
    if (!active || !present.has(active)) active = cats[0].id;

    // 把滑块对齐到指定标签：仅设宽度 + 横移（垂直由 CSS top/bottom:4px 居中）
    function moveThumb(tab) {
        if (!tab || !tab.offsetWidth) return;
        thumb.style.width = tab.offsetWidth + 'px';
        thumb.style.transform = `translateX(${tab.offsetLeft - bar.clientLeft}px)`;
    }

    function setActive(cat) {
        active = cat;
        let activeTab = null;
        bar.querySelectorAll('.cat-tab').forEach(b => {
            const on = b.dataset.cat === cat;
            b.classList.toggle('active', on);
            if (on) activeTab = b;
        });
        groups.forEach(g => { g.style.display = (g.dataset.cat === cat) ? '' : 'none'; });
        moveThumb(activeTab);
        try { localStorage.setItem(key, cat); } catch {}
    }

    bar.querySelectorAll('.cat-tab').forEach(b => b.addEventListener('click', () => setActive(b.dataset.cat)));
    setActive(active);
    // 首帧定位完成后再开启过渡，避免初次从原点滑入；并兜底重定位
    requestAnimationFrame(() => {
        moveThumb(bar.querySelector('.cat-tab.active'));
        bar.classList.add('cat-ready');
    });
    // 侧栏可拖拽改宽 → 分段宽度变化，即时（无过渡）跟随，避免滑块拖拽时滞后
    if (window.ResizeObserver) {
        let first = true;
        new ResizeObserver(() => {
            if (first) { first = false; return; }
            bar.classList.remove('cat-ready');
            moveThumb(bar.querySelector('.cat-tab.active'));
            requestAnimationFrame(() => bar.classList.add('cat-ready'));
        }).observe(bar);
    }
}

// ========== 侧边栏可拖拽调节宽度 ==========

const SIDEBAR_WIDTH_KEY = 'floway-sidebar-width';
const SIDEBAR_DEFAULT = 360;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 900;

export function initSidebarResize() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const portraitQuery = window.matchMedia('(max-width: 1100px) and (orientation: portrait)');

    // 始终将偏好值写入 CSS 变量；CSS clamp() 负责响应式边界裁决
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const initialW = saved ? parseInt(saved, 10) : SIDEBAR_DEFAULT;
    sidebar.style.setProperty('--sidebar-w', initialW + 'px');

    // 创建拖拽手柄
    let handle = sidebar.querySelector('.sidebar-resize-handle');
    if (!handle) {
        handle = document.createElement('div');
        handle.className = 'sidebar-resize-handle';
        sidebar.appendChild(handle);
    }

    let startX = 0, startWidth = 0, lastW = initialW;

    handle.addEventListener('mousedown', (e) => {
        if (portraitQuery.matches) return;
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        // 从实际显示宽度出发，避免和 clamp 上限打架
        startWidth = sidebar.getBoundingClientRect().width;
        document.body.classList.add('resizing');

        const onMove = (ev) => {
            ev.preventDefault();
            const delta = ev.clientX - startX;
            lastW = Math.max(SIDEBAR_MIN, Math.round(startWidth + delta));
            // 只写变量，CSS clamp 决定最终展示宽度
            sidebar.style.setProperty('--sidebar-w', lastW + 'px');
        };

        const onUp = () => {
            document.body.classList.remove('resizing');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            // 存原始拖拽意图，而非被 clamp 截断后的显示值
            localStorage.setItem(SIDEBAR_WIDTH_KEY, String(lastW));
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ========== 简洁 / 完整模式切换 ==========

export function initAdvancedSections() {
    document.querySelectorAll('.advanced-params').forEach(section => {
        const btn = document.createElement('button');
        btn.className = 'btn-advanced-toggle';
        btn.innerHTML = '<span class="adv-arrow">▶</span> 高级参数';
        btn.addEventListener('click', () => {
            const open = section.classList.toggle('open');
            btn.classList.toggle('open', open);
        });
        section.before(btn);
    });
}

// ========== 颜色选择器 + hex 可编辑输入框 ==========

export function initColorInputs() {
    document.querySelectorAll('input[type="color"]').forEach(colorInput => {
        if (colorInput.parentElement?.classList.contains('color-input-group')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'color-input-group';

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'hex-input';
        hexInput.name = (colorInput.id || 'color') + 'Hex';
        hexInput.value = colorInput.value.toUpperCase();
        hexInput.maxLength = 7;
        hexInput.spellcheck = false;

        colorInput.parentNode.insertBefore(wrapper, colorInput);
        wrapper.appendChild(colorInput);
        wrapper.appendChild(hexInput);

        // 色块 → 输入框
        colorInput.addEventListener('input', () => {
            hexInput.value = colorInput.value.toUpperCase();
        });

        // 输入框 → 色块
        hexInput.addEventListener('input', () => {
            let v = hexInput.value.trim();
            if (v && !v.startsWith('#')) v = '#' + v;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                colorInput.value = v;
                colorInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // 失焦时规范化
        hexInput.addEventListener('blur', () => {
            let v = hexInput.value.trim();
            if (v && !v.startsWith('#')) v = '#' + v;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                hexInput.value = v.toUpperCase();
            } else {
                hexInput.value = colorInput.value.toUpperCase();
            }
        });
    });
}

// ========== 顶部播放按钮（替换 sidebar-header 中的徽章） ==========

export function initHeaderPlayButton() {
    const realBtn = document.getElementById('BtnPlay');
    if (!realBtn) return;
    const footerBtn = document.getElementById('FooterBtnPlay');
    if (footerBtn) {
        footerBtn.style.display = '';
        footerBtn.addEventListener('click', () => realBtn.click());
    }
    realBtn.style.display = 'none';
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
            <div class="group-title"><span>快速预设</span></div>
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
