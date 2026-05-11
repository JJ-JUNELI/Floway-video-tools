/**
 * Floway Tools — 效果初始化
 * 一行代码完成：Canvas 初始化、Background、Recorder、面板注入、预览循环
 */

import { Recorder } from './recorder.js';
import { Background } from './background.js';
import { lerp, hexToRgba, getLightness, clamp, easeLinear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, getEasing, loadFont, setupFontSelector, initFontSelector, FONT_LIST, fontSelectHTML, drawMediaContain, createLinearGradient, createRadialGradient, drawTextCentered, drawTextWrapped, bindUI, applyVignetteMask, calcGradCoords } from './utils.js';
import { getTheme } from './themes.js';
import { enhanceAllSelects } from './custom-select.js';

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

    // 1. 注入面板 HTML（预览模式跳过）
    if (!isPreview) injectPanels(opts);

    // 1.5 自定义下拉框增强
    if (!isPreview) enhanceAllSelects();

    // 1.6 侧边栏拖拽调节
    if (!isPreview) initSidebarResize();

    // 2. Canvas 初始化
    const baseWidth = opts.baseWidth || 1440;
    const baseHeight = opts.baseHeight || 1080;
    const scale = opts.scale || 2;
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

// ========== 侧边栏可拖拽调节宽度 ==========

const SIDEBAR_WIDTH_KEY = 'floway-sidebar-width';
const SIDEBAR_DEFAULT = 440;
const SIDEBAR_MIN = 280;
const SIDEBAR_MAX = 700;

export function initSidebarResize() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // 恢复上次宽度
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const initialW = (saved) ? parseInt(saved, 10) : SIDEBAR_DEFAULT;
    if (initialW >= SIDEBAR_MIN && initialW <= SIDEBAR_MAX) {
        sidebar.style.width = initialW + 'px';
    }

    // 创建拖拽手柄
    let handle = sidebar.querySelector('.sidebar-resize-handle');
    if (!handle) {
        handle = document.createElement('div');
        handle.className = 'sidebar-resize-handle';
        sidebar.appendChild(handle);
    }

    let startX = 0, startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
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
