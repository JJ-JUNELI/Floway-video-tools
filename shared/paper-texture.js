/**
 * Floway Tools — 纸张纹理生成器
 * 从 paper-texture-demo.html 移植，4层程序化噪声
 *
 * 使用方式：
 *   import { PaperTexture } from './paper-texture.js';
 *   const pt = new PaperTexture({ warmth: 40 });
 *   const canvas = pt.getCanvas(1440, 1080); // 带缓存
 *   ctx.drawImage(canvas, 0, 0, fullWidth, fullHeight);
 */

// ========== 确定性噪声工具函数 ==========

/** 2D 整数哈希 — 返回 [0,1) */
function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    h = (h ^ (h >>> 16)) | 0;
    return ((h % 10000) + 10000) % 10000 / 10000;
}

/** 种子随机数生成器（状态数组） */
function texRnd(s) {
    s[0] = (s[0] + 1664525 + 1013904223) & 0xffffffff;
    let x = s[0];
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ========== PaperTexture 类 ==========

export class PaperTexture {
    constructor(opts = {}) {
        this.warmth   = opts.warmth   !== undefined ? opts.warmth   : 40;
        this.grain    = opts.grain    !== undefined ? opts.grain    : 35;
        this.fiber    = opts.fiber    !== undefined ? opts.fiber    : 20;
        this.vignette = opts.vignette !== undefined ? opts.vignette : 15;

        this._scale = opts.resolutionScale || 0.5; // 半分辨率优化
        this._cache = null;
        this._cacheW = 0;
        this._cacheH = 0;
        this._seed = [42]; // 固定种子保证确定性
    }

    /**
     * 获取（或从缓存返回）纹理 canvas
     * @param {number} fullWidth - 目标全分辨率宽度
     * @param {number} fullHeight - 目标全分辨率高度
     * @returns {HTMLCanvasElement}
     */
    getCanvas(fullWidth, fullHeight) {
        const w = Math.round(fullWidth * this._scale);
        const h = Math.round(fullHeight * this._scale);

        if (this._cache && this._cacheW === w && this._cacheH === h) {
            return this._cache;
        }

        this._cache = this._generate(w, h);
        this._cacheW = w;
        this._cacheH = h;
        return this._cache;
    }

    /** 清除缓存（参数变更后调用） */
    invalidate() {
        this._cache = null;
        this._cacheW = 0;
        this._cacheH = 0;
    }

    setWarmth(v)   { this.warmth = v;   this.invalidate(); }
    setGrain(v)    { this.grain = v;    this.invalidate(); }
    setFiber(v)    { this.fiber = v;    this.invalidate(); }
    setVignette(v) { this.vignette = v; this.invalidate(); }

    // ========== 核心：4层像素级生成 ==========

    _generate(w, h) {
        const tc = document.createElement('canvas');
        tc.width = w;
        tc.height = h;
        const tctx = tc.getContext('2d');
        const img = tctx.createImageData(w, h);
        const d = img.data;

        // 参数归一化
        const warmth = this.warmth / 100;
        const grain = this.grain / 100;
        const fiber = this.fiber / 100;
        const vig = this.vignette / 100;

        // 基础背景色（暖白）
        const bgR = clamp(Math.round(250 - warmth * 12), 0, 255);
        const bgG = clamp(Math.round(248 - warmth * 10), 0, 255);
        const bgB = clamp(Math.round(243 - warmth * 5), 0, 255);

        // 重置种子
        this._seed[0] = 42;

        // 纤维参数
        const fiberAngle = 12 * Math.PI / 180;
        const cosA = Math.cos(fiberAngle);
        const sinA = Math.sin(fiberAngle);

        // 暗角中心
        const cx = w / 2, cy = h / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                let r = bgR, g = bgG, b = bgB;

                // ---- Layer 1: 高频颗粒噪点 ----
                if (grain > 0) {
                    const n = (texRnd(this._seed) - 0.5) * grain * 22;
                    r += n; g += n * 0.97; b += n * 0.92;
                }

                // ---- Layer 2: 低频起伏（纸张不平整） ----
                if (grain > 0.05) {
                    const scale = 80 * this._scale;
                    const nx = x / scale, ny = y / scale;
                    const lx = Math.floor(nx), ly = Math.floor(ny);
                    const fx = nx - lx, fy = ny - ly;
                    const s1 = hash2(lx, ly), s2 = hash2(lx + 1, ly);
                    const s3 = hash2(lx, ly + 1), s4 = hash2(lx + 1, ly + 1);
                    const lowFreq = (s1 * (1 - fx) * (1 - fy) + s2 * fx * (1 - fy) +
                                        s3 * (1 - fx) * fy + s4 * fx * fy) - 0.5;
                    const bump = lowFreq * grain * 8;
                    r += bump; g += bump * 0.98; b += bump * 0.95;
                }

                // ---- Layer 3: 纤维纹理（斜向细微线条） ----
                if (fiber > 0) {
                    const proj = x * cosA + y * sinA;
                    const fiberNoise = Math.sin(
                        proj * 0.35 + hash2(Math.floor(x / 3), Math.floor(y / 3)) * 10
                    );
                    const fiberVal = fiberNoise * fiber * 3;
                    r -= fiberVal * 0.3;
                    g -= fiberVal * 0.28;
                    b -= fiberVal * 0.25;
                }

                // ---- Layer 4: 暗角效果 ----
                if (vig > 0) {
                    const dx = (x - cx) / maxDist;
                    const dy = (y - cy) / maxDist;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const vigFactor = Math.pow(dist, 2.2) * vig * 18;
                    r -= vigFactor;
                    g -= vigFactor;
                    b -= vigFactor;
                }

                d[idx]     = clamp(Math.round(r), 0, 255);
                d[idx + 1] = clamp(Math.round(g), 0, 255);
                d[idx + 2] = clamp(Math.round(b), 0, 255);
                d[idx + 3] = 255;
            }
        }

        tctx.putImageData(img, 0, 0);
        return tc;
    }
}
