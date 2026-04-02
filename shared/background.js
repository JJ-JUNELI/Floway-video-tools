/**
 * Floway Tools — 共享背景系统
 * 从 tool-text-v4 / tool-stack-scan / tool-logo-v4 提取
 * 
 * 支持: 纯色 / 绿幕 / 蓝幕 / 网格 / 点阵 / 透明 / 自定义图片或视频
 * 可选 SVG 模式: 自动同步背景到 SVG 元素（用于 SVG 渲染管线的效果）
 * 
 * 使用方式 (Canvas 效果):
 *   const bg = new Background({
 *       modeSelectId:   '#BgMode',
 *       uploadInputId:  '#BgUpload',
 *       patternColorId: '#PatternColor',
 *       patternRowId:   '#PatternColorRow',
 *       defaultMode:    '#000000',
 *       defaultPatternColor: '#333333',
 *       baseWidth:      1440,
 *       baseHeight:     1080,
 *       scaleFactor:    1,
 *   });
 *   bg.draw(ctx, timestamp, isRecording, exportFormat);
 *
 * 使用方式 (SVG 效果):
 *   const bg = new Background({
 *       ...其他选项,
 *       svgTargets: {
 *           bgRect:    document.getElementById('svgBg'),    // SVG <rect> 背景
 *           patternEl: document.getElementById('bgPattern'), // SVG <pattern> 纹理
 *       },
 *   });
 *   bg.drawToCanvas(ctx, width, height, exportFormat); // 导出时画到 Canvas
 */

export class Background {
    constructor(opts) {
        this.modeSelectId = opts.modeSelectId !== undefined ? opts.modeSelectId : '#BgMode';
        this.uploadInputId = opts.uploadInputId !== undefined ? opts.uploadInputId : '#BgUpload';
        this.patternColorId = opts.patternColorId !== undefined ? opts.patternColorId : '#PatternColor';
        this.patternRowId = opts.patternRowId !== undefined ? opts.patternRowId : '#PatternColorRow';
        this.defaultMode = opts.defaultMode || '#000000';
        this.defaultPatternColor = opts.defaultPatternColor || '#333333';
        this.baseWidth = opts.baseWidth || 1440;
        this.baseHeight = opts.baseHeight || 1080;
        this.scaleFactor = opts.scaleFactor || 1;

        this.mode = this.defaultMode;
        this.patternColor = this.defaultPatternColor;
        this.bgMedia = null;
        this.bgMediaType = null;
        this.patternCanvas = null;

        // SVG 目标元素（可选，SVG 效果用）
        this.svgBgRect = (opts.svgTargets && opts.svgTargets.bgRect) || null;
        this.svgPatternEl = (opts.svgTargets && opts.svgTargets.patternEl) || null;

        if (this.modeSelectId) {
            this._bindUI();
        }

        this._updatePatternCache();
        if (this.svgBgRect) this._syncSvg();
    }

    _bindUI() {
        const modeSelect = document.querySelector(this.modeSelectId);
        const uploadInput = document.querySelector(this.uploadInputId);
        const patternColor = document.querySelector(this.patternColorId);
        const patternRow = document.querySelector(this.patternRowId);

        if (modeSelect) {
            modeSelect.value = this.defaultMode;
            modeSelect.addEventListener('change', (e) => {
                const v = e.target.value;
                this.mode = v;

                if (v === 'grid' || v === 'dots') {
                    if (patternRow) patternRow.style.display = 'flex';
                } else {
                    if (patternRow) patternRow.style.display = 'none';
                }

                if (v === 'custom' && uploadInput) {
                    uploadInput.click();
                } else {
                    this._updatePatternCache();
                }

                this._syncSvg();
            });
        }

        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                const f = e.target.files[0];
                if (!f) return;
                const url = URL.createObjectURL(f);
                if (f.type.startsWith('image/')) {
                    this.bgMediaType = 'image';
                    this.bgMedia = new Image();
                    this.bgMedia.src = url;
                } else {
                    this.bgMediaType = 'video';
                    this.bgMedia = document.createElement('video');
                    this.bgMedia.src = url;
                    this.bgMedia.loop = true;
                    this.bgMedia.muted = true;
                    this.bgMedia.play();
                }
                this.mode = 'custom';
                if (modeSelect) modeSelect.value = 'custom';
            });
        }

        if (patternColor) {
            patternColor.value = this.defaultPatternColor;
            patternColor.addEventListener('input', (e) => {
                this.patternColor = e.target.value;
                this._updatePatternCache();
                this._syncSvg();
            });
        }
    }

    _updatePatternCache() {
        if (this.mode !== 'grid' && this.mode !== 'dots') {
            this.patternCanvas = null;
            this._updateSvgPattern();
            return;
        }

        this.patternCanvas = document.createElement('canvas');
        const s = 60;
        this.patternCanvas.width = s;
        this.patternCanvas.height = s;
        const pc = this.patternCanvas.getContext('2d');
        pc.strokeStyle = this.patternColor;
        pc.fillStyle = this.patternColor;
        pc.lineWidth = 2;

        if (this.mode === 'grid') {
            pc.beginPath();
            pc.moveTo(0, s);
            pc.lineTo(0, 0);
            pc.lineTo(s, 0);
            pc.stroke();
        } else {
            pc.beginPath();
            pc.arc(s / 2, s / 2, 3, 0, Math.PI * 2);
            pc.fill();
        }

        this._updateSvgPattern();
    }

    setMode(mode) {
        this.mode = mode;
        this._updatePatternCache();
        this._syncSvg();
    }

    // ========== SVG 同步（SVG 效果用） ==========

    /**
     * 同步当前背景模式到 SVG 元素
     */
    _syncSvg() {
        if (!this.svgBgRect) return;

        const mode = this.mode;
        if (mode === 'transparent') {
            this.svgBgRect.setAttribute('fill', 'transparent');
        } else if (mode === '#000000' || mode === '#0000ff' || mode === '#00ff00') {
            this.svgBgRect.setAttribute('fill', mode);
        } else if (mode === 'grid' || mode === 'dots') {
            this._updateSvgPattern();
        }
    }

    /**
     * 更新 SVG <pattern> 元素（网格/点阵）
     */
    _updateSvgPattern() {
        if (!this.svgPatternEl || !this.svgBgRect) return;
        const mode = this.mode;

        // 清空旧 pattern 子元素
        while (this.svgPatternEl.firstChild) {
            this.svgPatternEl.removeChild(this.svgPatternEl.firstChild);
        }

        if (mode === 'grid' || mode === 'dots') {
            const ns = 'http://www.w3.org/2000/svg';
            if (mode === 'grid') {
                const path = document.createElementNS(ns, 'path');
                path.setAttribute('d', 'M0 60 L0 0 L60 0');
                path.setAttribute('stroke', this.patternColor);
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                this.svgPatternEl.appendChild(path);
            } else {
                const circle = document.createElementNS(ns, 'circle');
                circle.setAttribute('cx', '30');
                circle.setAttribute('cy', '30');
                circle.setAttribute('r', '3');
                circle.setAttribute('fill', this.patternColor);
                this.svgPatternEl.appendChild(circle);
            }
            this.svgBgRect.setAttribute('fill', 'url(#bgPattern)');
        }
    }

    // ========== Canvas 绘制（Canvas 效果每帧调用） ==========

    /**
     * 在 Canvas 上绘制背景
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} timestamp - 毫秒时间戳 (用于视频背景同步)
     * @param {boolean} isRecording - 是否正在录制 (影响透明背景处理)
     * @param {string} exportFormat - 当前导出格式 ('png_seq' | 'mp4' | 'webm')
     */
    draw(ctx, timestamp = 0, isRecording = false, exportFormat = '') {
        if (this.mode === 'transparent') {
            // MP4/WebM + 透明 → 强制黑底; PNG + 透明 → 真透明
            if (isRecording && exportFormat !== 'png_seq') {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.restore();
            }
            return;
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (this.mode === 'grid' || this.mode === 'dots') {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if (this.patternCanvas) {
                const pat = ctx.createPattern(this.patternCanvas, 'repeat');
                ctx.fillStyle = pat;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        } else if (this.mode === 'custom' && this.bgMedia) {
            if (this.bgMediaType === 'video' && this.bgMedia.readyState >= 2) {
                if (isRecording) {
                    this.bgMedia.currentTime = (timestamp / 1000) % this.bgMedia.duration;
                }
                this._drawMediaContain(ctx, this.bgMedia);
            } else if (this.bgMediaType === 'image' && this.bgMedia.complete) {
                this._drawMediaContain(ctx, this.bgMedia);
            }
        } else {
            // 纯色 (#000000, #00ff00, #0000ff 等)
            ctx.fillStyle = this.mode;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        ctx.restore();
    }

    // ========== 导出用 Canvas 背景绘制（SVG 效果导出时用） ==========

    /**
     * 在指定 Canvas 上绘制背景（用于 SVG 效果的导出 canvas）
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} width
     * @param {number} height
     * @param {string} exportFormat - 'png_seq' | 'mp4' | 'webm'
     */
    drawToCanvas(ctx, width, height, exportFormat = '') {
        const mode = this.mode;
        ctx.save();

        // 透明 + 非PNG → 黑底
        if ((exportFormat === 'mp4' || exportFormat === 'webm') && mode === 'transparent') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
        } else if (exportFormat === 'png_seq' && mode === 'transparent') {
            ctx.clearRect(0, 0, width, height);
        } else if (mode === 'custom' && this.bgMedia) {
            const mw = this.bgMedia.videoWidth || this.bgMedia.width;
            const mh = this.bgMedia.videoHeight || this.bgMedia.height;
            if (mw && mh) {
                const s = Math.max(width / mw, height / mh);
                const w = mw * s, h = mh * s;
                ctx.drawImage(this.bgMedia, (width - w) / 2, (height - h) / 2, w, h);
            }
        } else if ((mode === 'grid' || mode === 'dots') && this.patternCanvas) {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = ctx.createPattern(this.patternCanvas, 'repeat');
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = mode;
            ctx.fillRect(0, 0, width, height);
        }

        ctx.restore();
    }

    // ========== 内部工具 ==========

    /**
     * Draw cover — 图片/视频铺满画布 (contain模式)
     */
    _drawMediaContain(ctx, media) {
        const mw = media.videoWidth || media.width;
        const mh = media.videoHeight || media.height;
        if (!mw || !mh) return;

        const scale = Math.max(this.baseWidth / mw, this.baseHeight / mh);
        const w = mw * scale;
        const h = mh * scale;

        // 应用超采样缩放
        const sx = this.scaleFactor;
        ctx.drawImage(
            media,
            (this.baseWidth - w) / 2 * sx,
            (this.baseHeight - h) / 2 * sx,
            w * sx,
            h * sx
        );
    }
}
