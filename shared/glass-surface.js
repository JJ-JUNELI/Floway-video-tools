/**
 * Floway Tools — 玻璃卡面材质（可复用）
 *
 * 把「卡片本身的背景」画成液态玻璃质感：半透膜 + 左上柔光 + 磨砂噪点 + 斜向扫光 + 渐变描边。
 * 卡片/图表类效果的卡面材质选「玻璃」时调用（与「纸张」并列），不是 canvas 背景。
 *
 * 关键：半透（veil < 1）→ 卡片透出其后的 canvas 背景；canvas 透明时导出 MOV 即可叠到素材上。
 * 配方与 demo/glass-card-test.html 一致。
 *
 * 用法（在已按卡片圆角裁剪、或自行裁剪的 ctx 上，原点 0,0、尺寸 w×h）：
 *   drawGlassSurface(ctx, w, h, radius, { color:'light', veil:0.12, border:0.5,
 *                                         highlight:0.45, sheen:0.45, grain:true }, timeMs);
 */

let _grainTile = null;
function grainTile() {
    if (_grainTile) return _grainTile;
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
    _grainTile = t;
    return t;
}

function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

/**
 * 在 ctx 上、矩形 (0,0,w,h)、圆角 radius 处画玻璃卡面。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w 卡面宽（绘制坐标系，已含缩放）
 * @param {number} h 卡面高
 * @param {number} radius 圆角半径（与卡片一致）
 * @param {object} opts { color:'light'|'dark', veil 0~1, border 0~1, highlight 0~1, sheen 0~1, grain:bool }
 * @param {number} timeMs 扫光相位（毫秒）；不传则用 performance.now()
 */
export function drawGlassSurface(ctx, w, h, radius, opts = {}, timeMs) {
    const color = opts.color || 'light';
    const veil = opts.veil != null ? opts.veil : 0.12;
    const border = opts.border != null ? opts.border : 0.5;
    const highlight = opts.highlight != null ? opts.highlight : 0.45;
    const sheen = opts.sheen != null ? opts.sheen : 0.45;
    const grain = opts.grain !== false;
    const tms = timeMs != null ? timeMs : performance.now();
    // 描边/扫光线宽按卡面对角线缩放，分辨率无关
    const k = Math.hypot(w, h) / 1800;
    const veilRGB = color === 'dark' ? '18,22,30' : '255,255,255';

    ctx.save();
    roundRectPath(ctx, 0, 0, w, h, radius);
    ctx.clip();

    // 1) 半透膜
    ctx.fillStyle = `rgba(${veilRGB}, ${veil})`;
    ctx.fillRect(0, 0, w, h);

    // 2) 左上柔光
    if (highlight > 0) {
        const lg = ctx.createLinearGradient(0, 0, w * 0.7, h * 0.7);
        lg.addColorStop(0, `rgba(255,255,255, ${0.18 * (highlight / 0.45)})`);
        lg.addColorStop(0.5, 'rgba(255,255,255,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, w, h);
    }

    // 3) 磨砂噪点
    if (grain) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
    }

    // 4) 斜向扫光（4 秒循环）
    if (sheen > 0) {
        const period = 4000;
        const p = (tms % period) / period;
        const bandW = w * 0.22;
        const sx = -bandW + p * (w + bandW * 2);
        ctx.save();
        ctx.translate(sx, h / 2);
        ctx.rotate(-0.32);
        const sg = ctx.createLinearGradient(-bandW, 0, bandW, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, `rgba(255,255,255, ${0.16 * sheen})`);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(-bandW, -h, bandW * 2, h * 2);
        ctx.restore();
    }

    ctx.restore(); // 解除裁剪

    // 5) 渐变描边（顶部更亮，骑在边缘内侧）
    if (border > 0) {
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        const bb = border / 0.5;
        bg.addColorStop(0, `rgba(255,255,255, ${0.55 * bb})`);
        bg.addColorStop(0.5, `rgba(255,255,255, ${0.18 * bb})`);
        bg.addColorStop(1, `rgba(255,255,255, ${0.30 * bb})`);
        ctx.strokeStyle = bg;
        ctx.lineWidth = 1.5 * k;
        roundRectPath(ctx, 0.75 * k, 0.75 * k, w - 1.5 * k, h - 1.5 * k, radius);
        ctx.stroke();
    }
}
