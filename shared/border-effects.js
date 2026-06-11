/**
 * border-effects.js
 * 4 种 Canvas 2D 卡片边框效果，从 test-border.html 搬运并参数化。
 *
 * 所有函数接收 card = {x, y, w, h} 逻辑像素坐标，
 * 返回效果超出卡片边界的像素数（用于 WebGL padding）。
 */

// ── 工具函数 ──

export function hexToRGBA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}

export function prand(i) {
    return ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
}

export function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function rrectBottom(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.closePath();
}

function buildSegGradient(ctx, angle, cx, cy, lightC, dimC, segCount) {
    const bright = hexToRGBA(lightC, 1);
    const dim = dimC;
    const n = Math.max(1, segCount);
    const segArc = 1 / n;
    // 每段中亮部过渡区占 40%（两侧各 20%），中间 20% 保持 dim
    const bw = segArc * 0.2;

    const grad = ctx.createConicGradient(angle, cx, cy);

    for (let i = 0; i < n; i++) {
        const s = i * segArc;
        const mid = s + segArc / 2;

        grad.addColorStop(s, dim);
        grad.addColorStop(mid - bw, dim);
        grad.addColorStop(mid, bright);
        grad.addColorStop(mid + bw, dim);
    }
    grad.addColorStop(1, dim);

    return grad;
}

function drawImgCover(ctx, img, x, y, w, h) {
    if (!img) return;
    const ir = (img.videoWidth || img.naturalWidth || img.width) / (img.videoHeight || img.naturalHeight || img.height);
    const rr = w / h;
    let sx, sy, sw, sh;
    if (ir > rr) {
        sh = img.videoHeight || img.naturalHeight || img.height;
        sw = sh * rr;
        sx = ((img.videoWidth || img.naturalWidth || img.width) - sw) / 2; sy = 0;
    } else {
        sw = img.videoWidth || img.naturalWidth || img.width;
        sh = sw / rr;
        sx = 0; sy = ((img.videoHeight || img.naturalHeight || img.height) - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ── ① 实线描边 + 辉光 ──

let _glowTmp = null;

export function drawSolidGlow(ctx, card, cfg) {
    const bw = cfg.borderWidth || 0;
    const bc = cfg.borderColor || '#ffffff';
    const cr = cfg.cornerRadius || 0;
    const gw = cfg.glowWidth || 0;
    const gc = cfg.glowColor || '#3b82f6';
    const gi = cfg.glowIntensity || 0;
    const dir = cfg.glowDir || 'outer';

    if (gw > 0) {
        // passes 控制 brightness，固定 stroke alpha 保证低值也可见
        const rawPasses = gi * 6;
        const fullPasses = Math.floor(rawPasses);
        const fracPass = rawPasses - fullPasses;
        const glowA = 0.7;
        const cardPath = (c) => {
            c.beginPath();
            rrect(c, card.x - bw, card.y - bw, card.w + bw * 2, card.h + bw * 2, cr + bw);
        };

        const s = ctx.getTransform().a;

        // 内辉光
        if (dir === 'inner' || dir === 'both') {
            ctx.save();
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowBlur = gw * s;
            ctx.shadowColor = hexToRGBA(gc, glowA);
            ctx.strokeStyle = gc;
            ctx.lineWidth = Math.max(bw * 2, 2);
            ctx.lineJoin = 'round';
            cardPath(ctx);
            for (let p = 0; p < fullPasses; p++) ctx.stroke();
            if (fracPass > 0.01) { ctx.globalAlpha = fracPass; ctx.stroke(); ctx.globalAlpha = 1; }
            ctx.restore();
        }

        // 外辉光
        if (dir === 'outer' || dir === 'both') {
            if (!_glowTmp) _glowTmp = document.createElement('canvas');
            const cw = ctx.canvas.width, ch = ctx.canvas.height;
            if (_glowTmp.width !== cw || _glowTmp.height !== ch) {
                _glowTmp.width = cw; _glowTmp.height = ch;
            }
            const tc = _glowTmp.getContext('2d');

            // 完全重置临时 canvas 状态
            tc.globalCompositeOperation = 'source-over';
            tc.globalAlpha = 1;
            tc.shadowBlur = 0;
            tc.shadowColor = 'rgba(0,0,0,0)';
            tc.filter = 'none';
            tc.setTransform(1, 0, 0, 1, 0, 0);
            tc.clearRect(0, 0, cw, ch);

            // 复制主 canvas 的坐标变换
            const t = ctx.getTransform();
            tc.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

            // 用 filter blur 画模糊描边（描边沿卡片边缘走，圆角精确跟随）
            tc.filter = `blur(${gw * t.a}px)`;
            tc.strokeStyle = hexToRGBA(gc, glowA);
            tc.lineWidth = gw * t.a * 0.5;
            tc.lineJoin = 'round';
            tc.beginPath();
            rrect(tc, card.x, card.y, card.w, card.h, cr);
            for (let p = 0; p < fullPasses; p++) tc.stroke();
            if (fracPass > 0.01) { tc.globalAlpha = fracPass; tc.stroke(); tc.globalAlpha = 1; }
            tc.filter = 'none';

            // destination-out 挖掉卡片矩形内部
            tc.setTransform(1, 0, 0, 1, 0, 0);
            tc.globalCompositeOperation = 'destination-out';
            tc.fillStyle = '#000000';
            const px = card.x * t.a + t.e;
            const py = card.y * t.d + t.f;
            const pw = card.w * t.a;
            const ph = card.h * t.d;
            const pr = cr * t.a;
            tc.beginPath();
            rrect(tc, px, py, pw, ph, pr);
            tc.fill();

            // 合成到主画布（像素对齐）
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(_glowTmp, 0, 0);
            ctx.restore();
        }
    }
    if (bw > 0) {
        ctx.strokeStyle = bc;
        ctx.lineWidth = bw * 2;
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        rrect(ctx, card.x - bw, card.y - bw, card.w + bw * 2, card.h + bw * 2, cr + bw);
        ctx.stroke();
    }

    return bw + gw;
}

// ── ② 边缘羽化 ──

export function drawEdgeFeather(ctx, card, cfg, sourceCanvas) {
    const blurW = cfg.featherBlur || 0;
    const gi = cfg.featherIntensity || 0;
    const cr = cfg.featherCornerRadius || 0;
    const feather = blurW * gi;

    if (feather < 0.5) {
        // 模糊为零时仍保留圆角裁剪
        if (cr > 0.5) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.fillStyle = '#fff';
            const sx2 = sourceCanvas.width / (card.w + card.x * 2 || 1);
            ctx.beginPath();
            rrect(ctx, card.x * sx2, card.y * sx2, card.w * sx2, card.h * sx2, cr * sx2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
        }
        return 0;
    }

    // 临时画布用原始像素尺寸（绕过 scale 变换）
    const pw = sourceCanvas.width;
    const ph = sourceCanvas.height;
    const sx = sourceCanvas.width / (card.w + card.x * 2 || 1); // scale factor

    // 1. 截取卡片区域内容
    const cardPx = {
        x: card.x * sx,
        y: card.y * sx,
        w: card.w * sx,
        h: card.h * sx,
    };

    const content = document.createElement('canvas');
    content.width = pw; content.height = ph;
    const cc = content.getContext('2d');
    cc.drawImage(sourceCanvas, 0, 0);

    // 2. 对内容做高斯模糊
    const blurLayer = document.createElement('canvas');
    blurLayer.width = pw; blurLayer.height = ph;
    const bc = blurLayer.getContext('2d');
    bc.filter = `blur(${feather * sx}px)`;
    bc.drawImage(content, 0, 0);
    bc.filter = 'none';

    // 3. 羽化遮罩
    const mask = document.createElement('canvas');
    mask.width = pw; mask.height = ph;
    const mc = mask.getContext('2d');
    mc.filter = `blur(${feather * sx}px)`;
    mc.fillStyle = '#fff';
    mc.beginPath();
    rrect(mc, cardPx.x, cardPx.y, cardPx.w, cardPx.h, cr * sx);
    mc.fill();
    mc.filter = 'none';

    // 4. 模糊层 × 遮罩
    bc.globalCompositeOperation = 'destination-in';
    bc.drawImage(mask, 0, 0);
    bc.globalCompositeOperation = 'source-over';

    // 5. 锐利中心层
    const sharpLayer = document.createElement('canvas');
    sharpLayer.width = pw; sharpLayer.height = ph;
    const sc = sharpLayer.getContext('2d');
    sc.drawImage(content, 0, 0);
    const inset = feather * 0.6 * sx;
    const sharpMask = document.createElement('canvas');
    sharpMask.width = pw; sharpMask.height = ph;
    const smc = sharpMask.getContext('2d');
    smc.filter = `blur(${feather * 0.4 * sx}px)`;
    smc.fillStyle = '#fff';
    smc.beginPath();
    rrect(smc, cardPx.x + inset, cardPx.y + inset, cardPx.w - inset * 2, cardPx.h - inset * 2, Math.max(0, cr * sx - inset));
    smc.fill();
    smc.filter = 'none';
    sc.globalCompositeOperation = 'destination-in';
    sc.drawImage(sharpMask, 0, 0);
    sc.globalCompositeOperation = 'source-over';

    // 6. 合成：清除原区域，画模糊边缘 + 锐利中心
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.drawImage(blurLayer, 0, 0);
    ctx.drawImage(sharpLayer, 0, 0);
    ctx.restore();

    return feather;
}

// ── ③ 浏览器窗口 ──

function _hexRGB(hex) {
    let h = (hex || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// 压暗（f<1）返回 rgba —— 用于标题文字等需要可读深色处
function darkenHexRGBA(hex, f, a) {
    const [r, g, b] = _hexRGB(hex);
    return `rgba(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)},${a})`;
}
// 向白混合 f（0=原色,1=白）返回 rgba —— 用于浅色玻璃栏
function lightenHexRGBA(hex, f, a) {
    const [r, g, b] = _hexRGB(hex);
    const mix = c => Math.round(c + (255 - c) * f);
    return `rgba(${mix(r)},${mix(g)},${mix(b)},${a})`;
}

// 在 (cx,cy) 为中心、约 s 大小内画白色图标（深色圆按钮上）：保存/复制/刷新
// darkColor 用于在白色块上挖暗色细节（软盘滑盖/标签、复制前后块的分隔）
function drawChromeIcon(ctx, type, cx, cy, s, color, lw, darkColor) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (type === 'save') {
        // 软盘：白色主体(右上折角) + 暗色顶部滑盖 + 暗色底部标签
        const a = s * 0.82, x0 = cx - a / 2, y0 = cy - a / 2, fold = a * 0.26, rr = a * 0.1;
        ctx.beginPath();
        ctx.moveTo(x0 + rr, y0);
        ctx.lineTo(x0 + a - fold, y0);
        ctx.lineTo(x0 + a, y0 + fold);
        ctx.lineTo(x0 + a, y0 + a - rr);
        ctx.arcTo(x0 + a, y0 + a, x0 + a - rr, y0 + a, rr);
        ctx.lineTo(x0 + rr, y0 + a);
        ctx.arcTo(x0, y0 + a, x0, y0 + a - rr, rr);
        ctx.lineTo(x0, y0 + rr);
        ctx.arcTo(x0, y0, x0 + rr, y0, rr);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = darkColor || '#1c1c1f';
        ctx.fillRect(x0 + a * 0.5, y0 + a * 0.1, a * 0.18, a * 0.24);          // 顶部滑盖
        ctx.fillRect(x0 + a * 0.22, y0 + a * 0.5, a * 0.56, a * 0.32);          // 底部标签
    } else if (type === 'copy') {
        // 复制：后方块(白描边) + 前方块(白填充，暗色描边分隔)
        const a = s * 0.52, off = a * 0.26, rr = a * 0.18;
        ctx.lineWidth = lw;
        ctx.beginPath(); rrect(ctx, cx - a / 2 + off, cy - a / 2 - off, a, a, rr); ctx.stroke();   // 后块
        ctx.fillStyle = color;
        ctx.beginPath(); rrect(ctx, cx - a / 2 - off, cy - a / 2 + off, a, a, rr); ctx.fill();      // 前块(填充)
        ctx.strokeStyle = darkColor || '#1c1c1f'; ctx.lineWidth = lw * 1.6;
        ctx.beginPath(); rrect(ctx, cx - a / 2 - off, cy - a / 2 + off, a, a, rr); ctx.stroke();    // 前块暗描边(与后块分隔)
    } else if (type === 'refresh') {
        // 刷新：上下两段弧 + 末端切向箭头（经典 ⟳ 双箭头）
        const r = s * 0.32;
        ctx.lineWidth = lw;
        const ah = lw * 2.2;
        // 末端 θ 处沿切线(增角方向)画箭头
        const arrow = (θ) => {
            const px = cx + r * Math.cos(θ), py = cy + r * Math.sin(θ);
            const tx = -Math.sin(θ), ty = Math.cos(θ);   // 切向(增角)
            const nx = Math.cos(θ), ny = Math.sin(θ);    // 径向(向外)
            const tipx = px + tx * ah * 0.5, tipy = py + ty * ah * 0.5;
            ctx.beginPath();
            ctx.moveTo(tipx - tx * ah + nx * ah * 0.75, tipy - ty * ah + ny * ah * 0.75);
            ctx.lineTo(tipx, tipy);
            ctx.lineTo(tipx - tx * ah - nx * ah * 0.75, tipy - ty * ah - ny * ah * 0.75);
            ctx.stroke();
        };
        // 上弧（左→右上），末端在右上
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
        arrow(Math.PI * 1.85);
        // 下弧（右→左下），末端在左下
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.05, Math.PI * 0.85); ctx.stroke();
        arrow(Math.PI * 0.85);
    }
    ctx.restore();
}

export function drawBrowserChrome(ctx, card, cfg, drawContentFn) {
    const cr = cfg.cardRadius || cfg.chromeCornerRadius || 0;
    const fw = cfg.chromeBorderWidth != null ? cfg.chromeBorderWidth : 12;   // 外框(贝塞)宽度
    const frameColor = cfg.chromeBorderColor || '#cfcfcf';                    // 外框灰
    const gw = cfg.chromeGlowWidth || 0;
    const gc = cfg.chromeGlowColor || '#3b82f6';
    const gi = cfg.chromeGlowIntensity || 0;
    const barColor = cfg.chromeBarColor || '#8c8c8e';                         // 标题栏灰

    // 单条标题栏；总高 tH 向上扩展，不占内容区
    const tH = Math.round(card.w * 0.078);
    const winX = card.x, winY = card.y - tH, winW = card.w, winH = card.h + tH;
    const winR = cr;

    // 辉光（可选，默认 0）
    if (gw > 0) {
        if (!_glowTmp) _glowTmp = document.createElement('canvas');
        const cw = ctx.canvas.width, ch_ = ctx.canvas.height;
        if (_glowTmp.width !== cw || _glowTmp.height !== ch_) { _glowTmp.width = cw; _glowTmp.height = ch_; }
        const tc = _glowTmp.getContext('2d');
        tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1; tc.filter = 'none';
        tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, cw, ch_);
        const t = ctx.getTransform();
        tc.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
        const rawP = gi * 6, fullP = Math.floor(rawP), fracP = rawP - fullP;
        tc.filter = `blur(${gw * t.a}px)`;
        tc.strokeStyle = hexToRGBA(gc, 0.7);
        tc.lineWidth = gw * t.a * 0.5; tc.lineJoin = 'round';
        tc.beginPath(); rrect(tc, winX - fw, winY - fw, winW + fw * 2, winH + fw * 2, winR + fw);
        for (let p = 0; p < fullP; p++) tc.stroke();
        if (fracP > 0.01) { tc.globalAlpha = fracP; tc.stroke(); tc.globalAlpha = 1; }
        tc.filter = 'none';
        tc.setTransform(1, 0, 0, 1, 0, 0);
        tc.globalCompositeOperation = 'destination-out'; tc.fillStyle = '#000';
        tc.beginPath(); rrect(tc, (winX - fw) * t.a + t.e, (winY - fw) * t.d + t.f, (winW + fw * 2) * t.a, (winH + fw * 2) * t.d, (winR + fw) * t.a); tc.fill();
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(_glowTmp, 0, 0); ctx.restore();
    }

    // ── 外框：灰色光泽贝塞（填充圆角矩形 + 立体高光/暗边）──
    if (fw > 0) {
        const fg = ctx.createLinearGradient(0, winY - fw, 0, winY + winH + fw);
        fg.addColorStop(0, lightenHexRGBA(frameColor, 0.5, 1));
        fg.addColorStop(0.5, hexToRGBA(frameColor, 1));
        fg.addColorStop(1, darkenHexRGBA(frameColor, 0.72, 1));
        ctx.fillStyle = fg;
        ctx.beginPath(); rrect(ctx, winX - fw, winY - fw, winW + fw * 2, winH + fw * 2, winR + fw); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
        ctx.beginPath(); rrect(ctx, winX - fw + 0.5, winY - fw + 0.5, winW + fw * 2 - 1, winH + fw * 2 - 1, winR + fw); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); rrect(ctx, winX - fw + 2, winY - fw + 2, winW + fw * 2 - 4, winH + fw * 2 - 4, winR + fw - 2); ctx.stroke();
    }

    // 裁剪到窗口
    ctx.save();
    ctx.beginPath(); rrect(ctx, winX, winY, winW, winH, winR); ctx.clip();

    // 标题栏（灰，竖向渐变）
    const bg = ctx.createLinearGradient(0, winY, 0, winY + tH);
    bg.addColorStop(0, lightenHexRGBA(barColor, 0.16, 1));
    bg.addColorStop(1, darkenHexRGBA(barColor, 0.9, 1));
    ctx.fillStyle = bg;
    ctx.fillRect(winX, winY, winW, tH);
    // 标题栏底分隔（暗线）
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(winX, winY + tH - 1.5, winW, 1.5);

    // 内容区（白底由 card 背景/上传素材提供）
    if (drawContentFn) drawContentFn(ctx, card.x, card.y, card.w, card.h);

    const padX = Math.round(tH * 0.4);

    // ── 左上 绿色状态点 ──
    const dotR = tH * 0.23;
    const dcx = winX + padX + dotR, dcy = winY + tH / 2;
    ctx.fillStyle = '#21cf67';
    ctx.beginPath(); ctx.arc(dcx, dcy, dotR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(dcx - dotR * 0.3, dcy - dotR * 0.32, dotR * 0.3, 0, Math.PI * 2); ctx.fill();

    // ── 右上 3 个深色圆按钮：保存 / 复制 / 刷新 ──
    const types = ['save', 'copy', 'refresh'];
    const rB = tH * 0.3;
    const gap = rB * 0.45;
    const n = types.length;
    const firstCx = winX + winW - padX - (n * 2 * rB + (n - 1) * gap) + rB;
    const cyB = winY + tH / 2;
    types.forEach((ic, i) => {
        const cxB = firstCx + i * (rB * 2 + gap);
        ctx.fillStyle = '#1c1c1f';
        ctx.beginPath(); ctx.arc(cxB, cyB, rB, 0, Math.PI * 2); ctx.fill();
        drawChromeIcon(ctx, ic, cxB, cyB, rB * 1.2, '#ffffff', Math.max(1.6, rB * 0.13), '#1c1c1f');
    });

    ctx.restore();
    return fw + gw + tH;
}

// ── ④ 旋转光边 ──

// 画旋转光边背景（在卡片底色之上、内容之前调用）
export function drawRotatingBlobs(ctx, card, cfg, time) {
    const colors = [
        cfg.rotatingBlob1 || '#3b82f6',
        cfg.rotatingBlob2 || '#8b5cf6',
        cfg.rotatingBlob3 || '#ec4899',
    ];
    const bSize = cfg.rotatingBlobSize || 150;
    const bSpeed = (cfg.rotatingBlobSpeed || 30) / 100;
    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;

    const blobSeeds = [
        { px: 0, py: 1.5, sm: 1 },
        { px: 2.5, py: 0.8, sm: 0.6 },
        { px: 4.2, py: 3.1, sm: 0.8 },
        { px: 1.1, py: 5.3, sm: 0.5 },
    ];
    for (let bi = 0; bi < blobSeeds.length; bi++) {
        const blob = blobSeeds[bi];
        const color = colors[bi % colors.length];
        const bx = cx + Math.sin(time * bSpeed * blob.sm + blob.px) * card.w * 0.3;
        const by = cy + Math.cos(time * bSpeed * blob.sm * 0.7 + blob.py) * card.h * 0.3;

        const N = 12;
        const step = Math.PI * 2 / N;
        const pts = [];
        for (let i = 0; i < N; i++) {
            const a = i * step;
            const r = bSize * (
                0.85
                + 0.1 * Math.sin(time * bSpeed * (0.35 + i * 0.19) + i * 2.39 + blob.px)
                + 0.05 * Math.cos(time * bSpeed * (0.55 + i * 0.15) + i * 1.73 + blob.py)
            );
            pts.push({ x: bx + Math.cos(a) * r, y: by + Math.sin(a) * r });
        }

        ctx.save();
        ctx.filter = `blur(${bSize * 0.22}px)`;
        ctx.beginPath();
        ctx.moveTo((pts[N - 1].x + pts[0].x) / 2, (pts[N - 1].y + pts[0].y) / 2);
        for (let i = 0; i < N; i++) {
            const c = pts[i], n = pts[(i + 1) % N];
            ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, bSize * 0.85);
        g.addColorStop(0, hexToRGBA(color, 0.55));
        g.addColorStop(0.4, hexToRGBA(color, 0.3));
        g.addColorStop(0.75, hexToRGBA(color, 0.1));
        g.addColorStop(1, hexToRGBA(color, 0));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
    }
}

// 画旋转描边（内容之后调用）
export function drawRotatingStroke(ctx, card, cfg, time) {
    const speed = cfg.rotatingSpeed || 0;
    const lightC = cfg.rotatingLightColor || '#60a5fa';
    const dimC = cfg.rotatingDimColor || '#1e1e3a';
    const bw = cfg.rotatingBorderWidth || 0;
    const segCount = cfg.rotatingSegments || 1;
    const cr = cfg.cardRadius || cfg.rotatingCornerRadius || 0;

    if (bw < 0.5) return 0;

    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;
    const angle = time * speed / 100 * 2;
    const grad = buildSegGradient(ctx, angle, cx, cy, lightC, dimC, segCount);
    ctx.strokeStyle = grad;
    ctx.lineWidth = bw * 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    rrect(ctx, card.x - bw, card.y - bw, card.w + bw * 2, card.h + bw * 2, cr + bw);
    ctx.stroke();

    return bw;
}
