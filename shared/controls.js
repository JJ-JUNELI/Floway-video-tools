/**
 * Floway Tools — 效果初始化
 * 一行代码完成：Canvas 初始化、Background、Recorder、面板注入、预览循环
 */

import { Recorder } from './recorder.js';
import { Background } from './background.js';
import { lerp, hexToRgba, getLightness, clamp, easeLinear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, getEasing, loadFont, setupFontSelector, FONT_LIST, fontSelectHTML, drawMediaContain, createLinearGradient, createRadialGradient, drawTextCentered, drawTextWrapped, bindUI } from './utils.js';

// ========== 面板 HTML 注入 ==========

export function injectPanels(opts = {}) {
    const placeholder = document.querySelector('#shared-controls-placeholder');
    if (!placeholder) return;

    const defaultBgMode = opts.defaultBgMode || '#000000';
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
                    <option value="custom">📂 上传背景...</option>
                </select>
            </div>
            <input type="file" id="BgUpload" accept="image/*,video/*" style="display:none">
            <div class="row" id="PatternColorRow" style="display:none; justify-content:space-between; align-items:center;">
                <div style="font-size:11px; color:#aaa;">纹理颜色</div>
                <input type="color" id="PatternColor" value="${defaultPatternColor}">
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
    // 1. 注入面板 HTML
    injectPanels(opts);

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
        defaultMode: opts.defaultBgMode || '#000000',
        defaultPatternColor: opts.defaultPatternColor || '#333333',
        baseWidth,
        baseHeight,
        scaleFactor: scale,
    });

    // 4. Recorder
    const recorder = new Recorder({
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
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, baseWidth, baseHeight);
        }
        if (bg.mode !== 'transparent') {
            bg.draw(ctx, timeMs, recorder.isRecording, recorder.format);
        }
    }

    // 7. 预览循环
    let _previewLoopRunning = false;

    function startPreviewLoop(drawFn) {
        if (_previewLoopRunning) return;
        _previewLoopRunning = true;
        function loop() {
            if (!recorder.isRecording) {
                drawFn(performance.now() - animStartTime);
            }
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    }

    return {
        ctx, canvas, bg, recorder,
        baseWidth, baseHeight, scale,
        clearFrame, drawBg,
        startPreviewLoop, resetAnimStart,
        lerp, hexToRgba, getLightness, clamp,
        easeLinear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, getEasing,
        loadFont,
        setupFontSelector,
        FONT_LIST, fontSelectHTML,
        drawMediaContain,
        createLinearGradient, createRadialGradient,
        drawTextCentered, drawTextWrapped,
        bindUI,
    };
}
