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
    const mid = hexToRGBA(lightC, 0.4);
    const dim = dimC;

    const segs = [];
    let pos = 0;
    for (let i = 0; i < segCount; i++) {
        const w = 0.05 + prand(i) * 0.06;
        const gap = 0.06 + prand(i + 50) * 0.12;
        segs.push({ s: pos, e: pos + w });
        pos += w + gap;
    }
    const total = pos;
    for (const s of segs) { s.s /= total; s.e /= total; }

    const grad = ctx.createConicGradient(angle, cx, cy);
    let prev = 0;

    for (const seg of segs) {
        const tr = (seg.e - seg.s) * 0.3;
        if (seg.s > prev + 0.003) {
            grad.addColorStop(prev, dim);
            grad.addColorStop(seg.s, dim);
        }
        grad.addColorStop(seg.s, dim);
        grad.addColorStop(Math.min(seg.s + tr, seg.e), mid);
        grad.addColorStop((seg.s + seg.e) / 2, bright);
        grad.addColorStop(Math.max(seg.e - tr, seg.s), mid);
        grad.addColorStop(seg.e, dim);
        prev = seg.e;
    }
    grad.addColorStop(Math.min(prev, 0.999), dim);
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

export function drawSolidGlow(ctx, card, cfg) {
    const bw = cfg.borderWidth || 0;
    const bc = cfg.borderColor || '#ffffff';
    const cr = cfg.cornerRadius || 0;
    const gw = cfg.glowWidth || 0;
    const gc = cfg.glowColor || '#3b82f6';
    const gi = cfg.glowIntensity || 0;

    if (gw > 0) {
        const layers = 12;
        for (let i = layers; i >= 1; i--) {
            const t = i / layers;
            const halfLW = bw + gw * t;
            ctx.save();
            ctx.globalAlpha = gi * Math.pow(1 - t, 1.5);
            ctx.strokeStyle = gc;
            ctx.lineWidth = halfLW * 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            rrect(ctx, card.x - halfLW, card.y - halfLW, card.w + halfLW * 2, card.h + halfLW * 2, cr + halfLW);
            ctx.stroke();
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

    if (feather < 0.5) return 0;

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

export function drawBrowserChrome(ctx, card, cfg, drawContentFn) {
    const cr = cfg.chromeCornerRadius || 0;
    const bw = cfg.chromeBorderWidth || 0;
    const bc = cfg.chromeBorderColor || '#ffffff';
    const gw = cfg.chromeGlowWidth || 0;
    const gc = cfg.chromeGlowColor || '#3b82f6';
    const gi = cfg.chromeGlowIntensity || 0;
    const barColor = cfg.chromeBarColor || '#1e1e2e';
    const urlText = cfg.chromeUrlText || 'floway.tools';
    const sepA = cfg.chromeSepAlpha || 0;
    const urlA = cfg.chromeUrlAlpha || 0;
    const textA = cfg.chromeTextAlpha || 0;
    const innerW = cfg.chromeInnerWidth || 0;
    const innerC = cfg.chromeInnerColor || '#333344';

    const tH = Math.round(card.h * 0.076); // 标题栏高度按卡片比例缩放

    // 辉光
    if (gw > 0) {
        const layers = 12;
        for (let i = layers; i >= 1; i--) {
            const t = i / layers;
            const halfLW = bw + gw * t;
            ctx.save();
            ctx.globalAlpha = gi * Math.pow(1 - t, 1.5);
            ctx.strokeStyle = gc;
            ctx.lineWidth = halfLW * 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            rrect(ctx, card.x - halfLW, card.y - halfLW, card.w + halfLW * 2, card.h + halfLW * 2, cr + halfLW);
            ctx.stroke();
            ctx.restore();
        }
    }

    // 描边
    if (bw > 0) {
        ctx.strokeStyle = bc;
        ctx.lineWidth = bw * 2;
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        rrect(ctx, card.x - bw, card.y - bw, card.w + bw * 2, card.h + bw * 2, cr + bw);
        ctx.stroke();
    }

    ctx.save();
    ctx.beginPath(); rrect(ctx, card.x, card.y, card.w, card.h, cr); ctx.clip();

    // 标题栏
    ctx.fillStyle = barColor;
    ctx.fillRect(card.x, card.y, card.w, tH);

    // 分割线
    if (sepA > 0.01) {
        ctx.strokeStyle = `rgba(255,255,255,${sepA})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(card.x, card.y + tH);
        ctx.lineTo(card.x + card.w, card.y + tH);
        ctx.stroke();
    }

    // 红绿灯
    const dotR = Math.max(3, tH * 0.15);
    const dotGap = dotR * 3.6;
    const dy = card.y + tH / 2;
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(card.x + dotR * 2 + i * dotGap, dy, dotR, 0, Math.PI * 2);
        ctx.fill();
    });

    // URL 栏
    const ux = card.x + dotR * 2 + dotGap * 3 + 8;
    const uy = card.y + tH * 0.15;
    const uw = card.w - (ux - card.x) - 16;
    const uh = tH * 0.55;
    if (urlA > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${urlA})`;
        ctx.beginPath(); rrect(ctx, ux, uy, uw, uh, uh * 0.25); ctx.fill();
    }
    if (textA > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${textA})`;
        ctx.font = `${Math.round(uh * 0.65)}px system-ui`;
        ctx.fillText(urlText, ux + uh * 0.4, uy + uh * 0.78);
    }

    // 内容区
    const cy = card.y + tH, ch = card.h - tH;

    if (innerW > 0.5) {
        ctx.fillStyle = innerC;
        ctx.fillRect(card.x, cy, card.w, ch);

        ctx.save();
        ctx.beginPath();
        rrectBottom(ctx, card.x + innerW, cy + innerW, card.w - innerW * 2, ch - innerW * 2, Math.max(0, cr - innerW));
        ctx.clip();

        if (drawContentFn) {
            drawContentFn(ctx, card.x + innerW, cy + innerW, card.w - innerW * 2, ch - innerW * 2);
        }

        ctx.restore();
    } else {
        if (drawContentFn) {
            drawContentFn(ctx, card.x, cy, card.w, ch);
        }
    }

    ctx.restore();

    return bw + gw;
}

// ── ④ 旋转光边 ──

// 画旋转光边背景（内容之前调用）
export function drawRotatingBlobs(ctx, card, cfg, time) {
    const cr = cfg.rotatingCornerRadius || 0;
    const bgMode = cfg.rotatingBgMode || 'blobs';

    if (bgMode === 'none') return;

    ctx.save();
    ctx.beginPath();
    rrect(ctx, card.x, card.y, card.w, card.h, cr);
    ctx.clip();

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(card.x, card.y, card.w, card.h);

    if (bgMode === 'blobs') {
        const b1 = cfg.rotatingBlob1 || '#3b82f6';
        const b2 = cfg.rotatingBlob2 || '#8b5cf6';
        const b3 = cfg.rotatingBlob3 || '#ec4899';
        const bSize = cfg.rotatingBlobSize || 150;
        const bSpeed = (cfg.rotatingBlobSpeed || 30) / 100;

        const cx = card.x + card.w / 2;
        const cy = card.y + card.h / 2;

        const blobs = [
            { color: b1, phase: 0 },
            { color: b2, phase: 2.094 },
            { color: b3, phase: 4.189 },
        ];
        for (const blob of blobs) {
            const bx = cx + Math.sin(time * bSpeed + blob.phase) * card.w * 0.28;
            const by = cy + Math.cos(time * bSpeed * 0.7 + blob.phase * 1.3) * card.h * 0.28;
            const g = ctx.createRadialGradient(bx, by, 0, bx, by, bSize);
            g.addColorStop(0, hexToRGBA(blob.color, 0.55));
            g.addColorStop(0.4, hexToRGBA(blob.color, 0.2));
            g.addColorStop(1, hexToRGBA(blob.color, 0));
            ctx.fillStyle = g;
            ctx.fillRect(card.x, card.y, card.w, card.h);
        }
    }

    ctx.restore();
}

// 画旋转描边（内容之后调用）
export function drawRotatingStroke(ctx, card, cfg, time) {
    const speed = cfg.rotatingSpeed || 0;
    const lightC = cfg.rotatingLightColor || '#60a5fa';
    const dimC = cfg.rotatingDimColor || '#1e1e3a';
    const bw = cfg.rotatingBorderWidth || 0;
    const segCount = cfg.rotatingSegments || 4;
    const cr = cfg.rotatingCornerRadius || 0;

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
