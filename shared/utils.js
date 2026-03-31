/**
 * Floway Tools — 共享工具函数
 * 从 tool-text-v4 / tool-stack-scan / tool-logo-v4 提取
 * 
 * 所有函数都通过 initEffect() 返回，新效果只需一行 import:
 *   import { initEffect } from '../shared/controls.js';
 *   const { ctx, ..., easeOut, loadFont, ... } = initEffect({...});
 */

// ========== 1. 数学工具 ==========

export function lerp(s, e, t) {
    return s * (1 - t) + e * t;
}

export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// ========== 2. 颜色工具 ==========

export function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hexToRgbaStr(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getLightness(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

/**
 * 创建线性渐变
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0 起点 x
 * @param {number} y0 起点 y
 * @param {number} x1 终点 x
 * @param {number} y1 终点 y
 * @param {Array<{pos: number, color: string}>} stops 颜色停靠点, pos 0~1, color 为 CSS 颜色字符串
 * @returns {CanvasGradient}
 */
export function createLinearGradient(ctx, x0, y0, x1, y1, stops) {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const s of stops) {
        grad.addColorStop(s.pos, s.color);
    }
    return grad;
}

/**
 * 创建径向渐变
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x 圆心 x
 * @param {number} y 圆心 y
 * @param {number} r0 内半径
 * @param {number} r1 外半径
 * @param {Array<{pos: number, color: string}>} stops
 * @returns {CanvasGradient}
 */
export function createRadialGradient(ctx, x, y, r0, r1, stops) {
    const grad = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const s of stops) {
        grad.addColorStop(s.pos, s.color);
    }
    return grad;
}

// ========== 3. 缓动函数 ==========

/** @param {number} t 0~1 */
export const easeLinear = t => t;
/** @param {number} t 0~1 */
export const easeInCubic = t => t * t * t;
/** @param {number} t 0~1 */
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
/** @param {number} t 0~1 */
export const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** @param {number} t 0~1 */
export const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
/** @param {number} t 0~1 */
export const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
/** @param {number} t 0~1 */
export const easeInOutCubicSmooth = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * 按名称查找缓动函数，用于动态配置 (如 select 下拉选择)
 * @param {string} name - 'linear' | 'easeInCubic' | 'easeOutCubic' | ...
 * @returns {Function}
 */
export function getEasing(name) {
    const map = {
        linear: easeLinear,
        easeIn: easeInCubic,
        easeOut: easeOutCubic,
        easeInOut: easeInOutCubic,
        easeOutQuart,
        easeOutExpo,
        smooth: easeInOutCubicSmooth,
    };
    return map[name] || easeOutCubic;
}

// ========== 4. 字体上传 ==========

/**
 * 加载字体文件并注册到 document.fonts
 * @param {File} file - 字体文件 (.ttf, .otf, .woff, .woff2)
 * @param {string} [familyName] - 自定义字体族名, 默认自动生成
 * @returns {Promise<string>} 可用于 CSS font-family 的字体名, 如 '"CustomFont_1", sans-serif'
 */
export async function loadFont(file, familyName) {
    if (!familyName) {
        familyName = `CustomFont_${Date.now().toString(36)}`;
    }
    const buffer = await file.arrayBuffer();
    const font = new FontFace(familyName, buffer);
    await font.load();
    document.fonts.add(font);
    return `"${familyName}", sans-serif`;
}

// ========== 5. Canvas 绘图辅助 ==========

/**
 * 图片/视频铺满画布 (contain 模式, 保持比例)
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement|HTMLVideoElement} media
 * @param {number} w 画布逻辑宽度 (baseWidth)
 * @param {number} h 画布逻辑高度 (baseHeight)
 * @param {number} [scaleFactor=1] 超采样倍率
 */
export function drawMediaContain(ctx, media, w, h, scaleFactor = 1) {
    const mw = media.videoWidth || media.width;
    const mh = media.videoHeight || media.height;
    if (!mw || !mh) return;

    const s = Math.max(w / mw, h / mh);
    const dw = mw * s;
    const dh = mh * s;
    const sx = scaleFactor;

    ctx.drawImage(
        media,
        (w - dw) / 2 * sx,
        (h - dh) / 2 * sx,
        dw * sx,
        dh * sx
    );
}

// ========== 6. 文字排版 ==========

/**
 * 在指定位置绘制居中文字
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x 中心 x
 * @param {number} y 中心 y
 * @param {string} [font] CSS font 字符串, 如 '700 24px "Noto Sans SC"'
 * @param {string} [color='#ffffff']
 * @param {string} [align='center'] - 'left' | 'center' | 'right'
 * @param {number} [maxWidth] - 可选, 超过宽度自动截断加省略号
 */
export function drawTextCentered(ctx, text, x, y, font, color = '#ffffff', align = 'center', maxWidth) {
    ctx.save();
    ctx.font = font || '700 24px "Noto Sans SC", sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;

    if (maxWidth) {
        let displayText = text;
        if (ctx.measureText(text).width > maxWidth) {
            while (ctx.measureText(displayText + '...').width > maxWidth && displayText.length > 0) {
                displayText = displayText.slice(0, -1);
            }
            displayText += '...';
        }
        ctx.fillText(displayText, x, y);
    } else {
        ctx.fillText(text, x, y);
    }
    ctx.restore();
}

/**
 * 自动换行绘制文字, 返回总行高
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x 起始 x
 * @param {number} y 起始 y
 * @param {number} maxWidth 行宽
 * @param {number} [lineHeight=1.2] 行高倍率
 * @returns {number} 总绘制高度
 */
export function drawTextWrapped(ctx, text, x, y, maxWidth, lineHeight = 1.2) {
    ctx.save();
    const lh = parseFloat(ctx.font) * lineHeight;
    const words = text.split('');
    let line = '';
    let curY = y;

    for (let i = 0; i < words.length; i++) {
        const test = line + words[i];
        if (ctx.measureText(test).width > maxWidth && line.length > 0) {
            ctx.fillText(line, x, curY);
            curY += lh;
            line = words[i];
        } else {
            line = test;
        }
    }
    if (line) {
        ctx.fillText(line, x, curY);
        curY += lh;
    }

    ctx.restore();
    return curY - y;
}

// ========== 7. 文件保存 ==========

export function saveFile(blob, name) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(u);
    }, 100);
}

// ========== 8. UI 绑定 ==========

/**
 * 批量绑定UI控件到config对象，自动监听变化
 *
 * @param {Object} config - 配置对象
 * @param {Array<Array>} rules - 绑定规则数组
 *   每条规则: [elemId, configKey, transform?, displayId?, suffix?]
 *   transform:
 *     'int'     → parseInt(v)
 *     'float'   → parseFloat(v)
 *     '%'       → parseInt(v) / 100
 *     'checked' → 用 el.checked 代替 el.value
 *     Function  → 自定义转换函数
 *     undefined → 原样字符串
 *   displayId: 变化时同步更新显示值的元素ID
 *   suffix: 显示值后缀（如 '%'、's'、'°'）
 *
 * @param {Object} opts
 *   opts.onChange(rawVal, configKey, elemId) - 每次值变化后调用
 *
 * @returns {{ readAll: Function }}
 *   readAll() 一次性从DOM读取所有值到config，然后调用onChange
 *
 * @example
 *   const { readAll } = bindUI(config, [
 *       ['SizeInput', 'fontSize', 'int', 'SizeVal'],
 *       ['GlowToggle', 'glowEnabled', 'checked'],
 *       ['FillSelect', 'fillMode'],
 *       ['GradOp1', 'gradOp1', '%', 'GradOp1Val', '%'],
 *       ['AnimDuration', 'duration', 'float', 'DurVal', 's'],
 *   ], { onChange: () => { recalculate(); } });
 */
export function bindUI(config, rules, opts = {}) {
    const onChange = opts.onChange || (() => {});

    function transformValue(raw, transform) {
        if (typeof transform === 'function') return transform(raw);
        if (transform === 'int') return parseInt(raw);
        if (transform === 'float') return parseFloat(raw);
        if (transform === '%') return parseInt(raw) / 100;
        return raw;
    }

    function readOne(rule) {
        const [elemId, configKey, transform] = rule;
        const el = document.getElementById(elemId);
        if (!el) return;
        const raw = transform === 'checked' ? el.checked : el.value;
        if (configKey) config[configKey] = transformValue(raw, transform);
    }

    function readAll() {
        for (const rule of rules) readOne(rule);
        onChange();
    }

    for (const rule of rules) {
        const [elemId, configKey, transform, displayId, suffix] = rule;
        const el = document.getElementById(elemId);
        if (!el) continue;

        const isSelect = el.tagName === 'SELECT';
        const isCheckbox = el.type === 'checkbox' || transform === 'checked';
        const eventType = (isSelect || isCheckbox) ? 'change' : 'input';

        el.addEventListener(eventType, () => {
            readOne(rule);
            if (displayId) {
                const display = document.getElementById(displayId);
                if (display) display.innerText = el.value + (suffix || '');
            }
            onChange(el.value, configKey, elemId);
        });
    }

    return { readAll };
}
