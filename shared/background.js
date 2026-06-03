/**
 * Floway Tools — 共享背景系统
 * 从 tool-text-v4 / tool-stack-scan / tool-logo-v4 提取
 * 
 * 支持: 纯色 / 绿幕 / 蓝幕 / 网格 / 点阵 / 透明 / 纸张 / 玻璃卡片 / 自定义图片或视频
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

import { drawMediaContain } from './utils.js';
import { getTheme } from './themes.js';
import { PaperTexture } from './paper-texture.js';

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
        this.paperTexture = new PaperTexture();

        // 玻璃卡片预设参数（与 #Glass* 控件绑定；单位见下）
        this.glass = {
            color: 'light',   // 'light'=白雾(提亮) / 'dark'=烟熏(压暗)
            veil: 0.12,       // 半透膜不透明度 0~0.4（通透感主旋钮）
            border: 0.5,      // 描边亮度 0~1
            highlight: 0.45,  // 左上柔光强度 0~1
            radius: 48,       // 圆角（1440 基准 px，内部按画布宽缩放）
            shadow: 26,       // 投影（1440 基准 px）
            sheen: 0.45,      // 扫光程度 0~1（0=关）
            grain: true,      // 磨砂噪点
        };
        this._glassGrainTile = null;

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

                // 纸张纹理参数行
                const paperRow = document.querySelector('#PaperParamsRow');
                if (paperRow) {
                    paperRow.style.display = (v === 'paper') ? 'flex' : 'none';
                }

                // 玻璃卡片参数行
                const glassRow = document.querySelector('#GlassParamsRow');
                if (glassRow) {
                    glassRow.style.display = (v === 'glass-card') ? 'block' : 'none';
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

        // 玻璃卡片参数绑定（滑块带数值显示；任何改动清缓存键）
        const bindGlass = (id, key, scale, fmt) => {
            const el = document.querySelector('#' + id);
            const val = document.querySelector('#' + id + 'Val');
            if (!el) return;
            const upd = () => {
                this.glass[key] = parseFloat(el.value) * scale;
                if (val) val.textContent = fmt(parseFloat(el.value));
                this._glassCacheKey = null;
            };
            el.addEventListener('input', upd);
            upd();
        };
        bindGlass('GlassVeil', 'veil', 0.01, x => x + '%');
        bindGlass('GlassBorder', 'border', 0.01, x => x + '%');
        bindGlass('GlassHighlight', 'highlight', 0.01, x => x + '%');
        bindGlass('GlassRadius', 'radius', 1, x => String(x));
        bindGlass('GlassShadow', 'shadow', 1, x => String(x));
        bindGlass('GlassSheen', 'sheen', 0.01, x => x + '%');
        const glassColorEl = document.querySelector('#GlassColor');
        if (glassColorEl) {
            glassColorEl.value = this.glass.color;
            glassColorEl.addEventListener('change', (e) => { this.glass.color = e.target.value; this._glassCacheKey = null; });
        }
        const glassGrainEl = document.querySelector('#GlassGrain');
        if (glassGrainEl) {
            glassGrainEl.checked = this.glass.grain;
            glassGrainEl.addEventListener('change', (e) => { this.glass.grain = e.target.checked; this._glassCacheKey = null; });
        }

        // 纸张纹理暖色调滑块
        const paperWarmthEl = document.querySelector('#PaperWarmth');
        const paperWarmthVal = document.querySelector('#PaperWarmthVal');
        if (paperWarmthEl) {
            paperWarmthEl.value = this.paperTexture.warmth;
            if (paperWarmthVal) paperWarmthVal.textContent = this.paperTexture.warmth;
            paperWarmthEl.addEventListener('input', (e) => {
                const v = parseInt(e.target.value, 10);
                this.paperTexture.setWarmth(v);
                if (paperWarmthVal) paperWarmthVal.textContent = v;
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
        } else if (mode === 'paper') {
            // SVG 无法渲染程序化纹理，回退到主题色
            this.svgBgRect.setAttribute('fill', getTheme().canvasBg);
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
     * @param {string} exportFormat - 当前导出格式 ('png_seq' | 'mp4' | 'webm' | 'prores')
     */
    draw(ctx, timestamp = 0, isRecording = false, exportFormat = '') {
        if (this.mode === 'transparent') {
            // MP4/WebM + 透明 → 强制黑底; PNG 序列 / 透明视频(prores/QTRLE) + 透明 → 真透明
            // 须与 recorder.keepsAlpha 保持一致(png_seq + prores)
            if (isRecording && exportFormat !== 'png_seq' && exportFormat !== 'prores') {
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
            ctx.fillStyle = getTheme().canvasBg;
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
        } else if (this.mode === 'paper') {
            const texCanvas = this.paperTexture.getCanvas(ctx.canvas.width, ctx.canvas.height);
            if (texCanvas) {
                ctx.drawImage(texCanvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
            } else {
                ctx.fillStyle = getTheme().canvasBg;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        } else if (this.mode === 'glass-card') {
            // 卡外透明（供叠加），mp4/webm 不支持 alpha → 卡外填黑（与 keepsAlpha 一致）
            const W = ctx.canvas.width, H = ctx.canvas.height;
            ctx.clearRect(0, 0, W, H);
            if (isRecording && exportFormat !== 'png_seq' && exportFormat !== 'prores') {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, W, H);
            }
            const tms = isRecording ? timestamp : performance.now();
            this._paintGlassCard(ctx, W, H, tms);
        } else {
            // 纯色 (#000000, #00ff00, #0000ff 等)
            ctx.fillStyle = this.mode;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        ctx.restore();
    }

    // ========== 玻璃卡片绘制 ==========

    /** 圆角矩形路径（带 fallback） */
    _roundRectPath(c, x, y, w, h, r) {
        c.beginPath();
        if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    /** 磨砂噪点贴片（128px，生成一次缓存） */
    _glassGrain() {
        if (this._glassGrainTile) return this._glassGrainTile;
        const s = 128;
        const t = document.createElement('canvas');
        t.width = t.height = s;
        const tc = t.getContext('2d');
        const img = tc.createImageData(s, s);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = 200 + Math.floor(Math.random() * 55);
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = Math.floor(Math.random() * 22);
        }
        tc.putImageData(img, 0, 0);
        this._glassGrainTile = t;
        return t;
    }

    /**
     * 在 ctx 上画一张居中玻璃卡（透明背景之上）。tms=毫秒，用于扫光相位。
     * 同款配方移植自 demo/glass-card-test.html：半透膜+左上柔光+磨砂+扫光+渐变描边+投影。
     */
    _paintGlassCard(ctx, W, H, tms = 0) {
        const g = this.glass;
        const k = W / 1440; // 按画布宽缩放（兼容 2x/标准档）
        const cw = Math.round(W * 0.66), ch = Math.round(H * 0.62);
        const x = Math.round((W - cw) / 2), y = Math.round((H - ch) / 2);
        const r = g.radius * k;
        // 玻璃色：亮=白雾(提亮)，暗=烟熏(压暗)；描边/高光始终走亮边（玻璃缘反光）
        const veilRGB = g.color === 'dark' ? '18,22,30' : '255,255,255';

        // 1) 投影 + 半透膜
        ctx.save();
        if (g.shadow > 0) {
            ctx.shadowColor = g.color === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.28)';
            ctx.shadowBlur = g.shadow * k;
            ctx.shadowOffsetY = Math.round(g.shadow * 0.4 * k);
        }
        this._roundRectPath(ctx, x, y, cw, ch, r);
        ctx.fillStyle = `rgba(${veilRGB}, ${g.veil})`;
        ctx.fill();
        ctx.restore();

        // 卡内裁剪
        ctx.save();
        this._roundRectPath(ctx, x, y, cw, ch, r);
        ctx.clip();

        // 2) 左上柔光
        if (g.highlight > 0) {
            const lg = ctx.createLinearGradient(x, y, x + cw * 0.7, y + ch * 0.7);
            lg.addColorStop(0, `rgba(255,255,255, ${0.18 * (g.highlight / 0.45)})`);
            lg.addColorStop(0.5, 'rgba(255,255,255,0)');
            ctx.fillStyle = lg;
            ctx.fillRect(x, y, cw, ch);
        }

        // 3) 磨砂噪点
        if (g.grain) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = ctx.createPattern(this._glassGrain(), 'repeat');
            ctx.fillRect(x, y, cw, ch);
            ctx.globalAlpha = 1;
        }

        // 4) 扫光（斜向亮带横扫，4 秒循环）
        if (g.sheen > 0) {
            const period = 4000;
            const p = (tms % period) / period;
            const bandW = cw * 0.22;
            const sx = x - bandW + p * (cw + bandW * 2);
            ctx.save();
            ctx.translate(sx, y + ch / 2);
            ctx.rotate(-0.32);
            const sg = ctx.createLinearGradient(-bandW, 0, bandW, 0);
            sg.addColorStop(0, 'rgba(255,255,255,0)');
            sg.addColorStop(0.5, `rgba(255,255,255, ${0.16 * g.sheen})`);
            sg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = sg;
            ctx.fillRect(-bandW, -ch, bandW * 2, ch * 2);
            ctx.restore();
        }

        ctx.restore(); // 解除裁剪

        // 5) 渐变描边（顶部更亮，骑在边缘）
        if (g.border > 0) {
            const bg = ctx.createLinearGradient(x, y, x, y + ch);
            const bb = g.border / 0.5;
            bg.addColorStop(0, `rgba(255,255,255, ${0.55 * bb})`);
            bg.addColorStop(0.5, `rgba(255,255,255, ${0.18 * bb})`);
            bg.addColorStop(1, `rgba(255,255,255, ${0.30 * bb})`);
            ctx.strokeStyle = bg;
            ctx.lineWidth = 1.5 * k;
            this._roundRectPath(ctx, x + 0.75 * k, y + 0.75 * k, cw - 1.5 * k, ch - 1.5 * k, r);
            ctx.stroke();
        }
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
            ctx.fillStyle = getTheme().canvasBg;
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = ctx.createPattern(this.patternCanvas, 'repeat');
            ctx.fillRect(0, 0, width, height);
        } else if (mode === 'paper') {
            const texCanvas = this.paperTexture.getCanvas(width, height);
            if (texCanvas) {
                ctx.drawImage(texCanvas, 0, 0, width, height);
            } else {
                ctx.fillStyle = getTheme().canvasBg;
                ctx.fillRect(0, 0, width, height);
            }
        } else if (mode === 'glass-card') {
            ctx.clearRect(0, 0, width, height);
            if (exportFormat === 'mp4' || exportFormat === 'webm') {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
            }
            this._paintGlassCard(ctx, width, height, 0); // SVG 导出无时间轴 → 扫光取相位 0
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
        drawMediaContain(ctx, media, this.baseWidth, this.baseHeight, this.scaleFactor);
    }
}
