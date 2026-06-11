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

// 在 (cx,cy) 为中心、约 s 大小的方框内画一枚线性图标：保存/复制/刷新
function drawChromeIcon(ctx, type, cx, cy, s, color, lw) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const h = s / 2;
    if (type === 'save') {
        // 下载/保存：竖线 + 向下箭头 + 底座
        ctx.beginPath();
        ctx.moveTo(cx, cy - h * 0.85); ctx.lineTo(cx, cy + h * 0.2);
        ctx.moveTo(cx - h * 0.42, cy - h * 0.18); ctx.lineTo(cx, cy + h * 0.28); ctx.lineTo(cx + h * 0.42, cy - h * 0.18);
        ctx.moveTo(cx - h * 0.7, cy + h * 0.7); ctx.lineTo(cx + h * 0.7, cy + h * 0.7);
        ctx.stroke();
    } else if (type === 'copy') {
        // 复制：两个叠放的圆角方块
        const a = s * 0.46;
        ctx.beginPath(); rrect(ctx, cx - a * 0.6, cy - a * 0.72, a, a, a * 0.2); ctx.stroke();
        ctx.beginPath(); rrect(ctx, cx - a * 0.1, cy - a * 0.22, a, a, a * 0.2); ctx.stroke();
    } else if (type === 'refresh') {
        // 刷新：开口圆弧 + 箭头
        const r = h * 0.72;
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.45, Math.PI * 1.95); ctx.stroke();
        const ax = cx + r * Math.cos(Math.PI * 0.45), ay = cy + r * Math.sin(Math.PI * 0.45);
        ctx.beginPath();
        ctx.moveTo(ax - h * 0.34, ay + h * 0.02);
        ctx.lineTo(ax + h * 0.02, ay + h * 0.06);
        ctx.lineTo(ax - h * 0.06, ay - h * 0.32);
        ctx.stroke();
    }
    ctx.restore();
}

export function drawBrowserChrome(ctx, card, cfg, drawContentFn) {
    const cr = cfg.cardRadius || cfg.chromeCornerRadius || 0;
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

    // 顶部 = 控制条(状态点+按钮) + 标题条；总高 tH 向上扩展，不占内容区
    const tBar = Math.round(card.w * 0.05);
    const tTitle = Math.round(card.w * 0.052);
    const tH = tBar + tTitle;
    const pad = Math.round(tBar * 0.5);

    // 整个浏览器窗口区域：card 内容区上方额外扩展 tH
    const winX = card.x, winY = card.y - tH, winW = card.w, winH = card.h + tH;
    const winR = cr;

    // 辉光
    if (gw > 0) {
        if (!_glowTmp) _glowTmp = document.createElement('canvas');
        const cw = ctx.canvas.width, ch_ = ctx.canvas.height;
        if (_glowTmp.width !== cw || _glowTmp.height !== ch_) {
            _glowTmp.width = cw; _glowTmp.height = ch_;
        }
        const tc = _glowTmp.getContext('2d');
        tc.globalCompositeOperation = 'source-over';
        tc.globalAlpha = 1;
        tc.shadowBlur = 0;
        tc.shadowColor = 'rgba(0,0,0,0)';
        tc.filter = 'none';
        tc.setTransform(1, 0, 0, 1, 0, 0);
        tc.clearRect(0, 0, cw, ch_);

        const t = ctx.getTransform();
        tc.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
        const rawP = gi * 6;
        const fullP = Math.floor(rawP);
        const fracP = rawP - fullP;
        tc.filter = `blur(${gw * t.a}px)`;
        tc.strokeStyle = hexToRGBA(gc, 0.7);
        tc.lineWidth = gw * t.a * 0.5;
        tc.lineJoin = 'round';
        tc.beginPath();
        rrect(tc, winX - bw, winY - bw, winW + bw * 2, winH + bw * 2, winR + bw);
        for (let p = 0; p < fullP; p++) tc.stroke();
        if (fracP > 0.01) { tc.globalAlpha = fracP; tc.stroke(); tc.globalAlpha = 1; }
        tc.filter = 'none';

        tc.setTransform(1, 0, 0, 1, 0, 0);
        tc.globalCompositeOperation = 'destination-out';
        tc.fillStyle = '#000000';
        const px = (winX - bw) * t.a + t.e;
        const py = (winY - bw) * t.d + t.f;
        const pw = (winW + bw * 2) * t.a;
        const ph = (winH + bw * 2) * t.d;
        const pr = (winR + bw) * t.a;
        tc.beginPath();
        rrect(tc, px, py, pw, ph, pr);
        tc.fill();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(_glowTmp, 0, 0);
        ctx.restore();
    }

    // 描边
    if (bw > 0) {
        ctx.strokeStyle = bc;
        ctx.lineWidth = bw * 2;
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        rrect(ctx, winX - bw, winY - bw, winW + bw * 2, winH + bw * 2, winR + bw);
        ctx.stroke();
    }

    // 裁剪到整个窗口
    ctx.save();
    ctx.beginPath(); rrect(ctx, winX, winY, winW, winH, winR); ctx.clip();

    // ── 玻璃双栏：控制条(深一点) + 标题条(浅一点)，barColor 作色调 ──
    const tint = barColor;
    const titleTopY = winY + tBar;

    // 控制条玻璃（近不透明，竖向渐变 + 顶部偏亮）——做成玻璃质感且不透背景
    const g1 = ctx.createLinearGradient(0, winY, 0, winY + tBar);
    g1.addColorStop(0, lightenHexRGBA(tint, 0.18, 0.96));
    g1.addColorStop(1, hexToRGBA(tint, 0.92));
    ctx.fillStyle = g1;
    ctx.fillRect(winX, winY, winW, tBar);

    // 标题条玻璃（向白混合的浅色，近不透明）
    const g2 = ctx.createLinearGradient(0, titleTopY, 0, titleTopY + tTitle);
    g2.addColorStop(0, lightenHexRGBA(tint, 0.80, 0.95));
    g2.addColorStop(1, lightenHexRGBA(tint, 0.70, 0.92));
    ctx.fillStyle = g2;
    ctx.fillRect(winX, titleTopY, winW, tTitle);

    // 顶部高光细线（玻璃感）
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(winX, winY, winW, Math.max(1, Math.round(tBar * 0.045)));

    // 控制条/标题条分隔线
    ctx.strokeStyle = hexToRGBA(tint, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(winX, titleTopY + 0.5); ctx.lineTo(winX + winW, titleTopY + 0.5); ctx.stroke();
    // 标题条/内容分隔线（可调透明）
    if (sepA > 0.01) {
        ctx.strokeStyle = `rgba(255,255,255,${sepA})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(winX, winY + tH); ctx.lineTo(winX + winW, winY + tH); ctx.stroke();
    }

    // ── 左上 绿色状态点（带柔光+高光） ──
    const dotR = Math.max(4, tBar * 0.16);
    const dcx = winX + pad + dotR, dcy = winY + tBar / 2;
    const dg = ctx.createRadialGradient(dcx, dcy, 0, dcx, dcy, dotR * 2.4);
    dg.addColorStop(0, 'rgba(54,217,122,0.55)');
    dg.addColorStop(1, 'rgba(54,217,122,0)');
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.arc(dcx, dcy, dotR * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#36d97a';
    ctx.beginPath(); ctx.arc(dcx, dcy, dotR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath(); ctx.arc(dcx - dotR * 0.3, dcy - dotR * 0.34, dotR * 0.32, 0, Math.PI * 2); ctx.fill();

    // ── 右上 3 个玻璃按钮：保存 / 复制 / 刷新 ──
    const types = ['save', 'copy', 'refresh'];
    const bSize = Math.round(tBar * 0.62);
    const bGap = Math.round(bSize * 0.34);
    const byy = winY + (tBar - bSize) / 2;
    const totalW = types.length * bSize + (types.length - 1) * bGap;
    const startX = winX + winW - pad - totalW;
    types.forEach((ic, i) => {
        const bxx = startX + i * (bSize + bGap);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); rrect(ctx, bxx, byy, bSize, bSize, bSize * 0.28); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = Math.max(0.6, bSize * 0.045);
        ctx.beginPath(); rrect(ctx, bxx, byy, bSize, bSize, bSize * 0.28); ctx.stroke();
        drawChromeIcon(ctx, ic, bxx + bSize / 2, byy + bSize / 2, bSize * 0.52, 'rgba(255,255,255,0.92)', Math.max(1, bSize * 0.07));
    });

    // ── 标题文字（标题条，左对齐，深色调可读） ──
    if (textA > 0.01 && urlText) {
        ctx.fillStyle = darkenHexRGBA(tint, 0.42, Math.min(1, textA + 0.55));
        const fontSize = Math.round(tTitle * 0.46);
        ctx.font = `700 ${fontSize}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(urlText, winX + pad, titleTopY + tTitle / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    // 内容区：背景 + 内容 + 内描边
    if (drawContentFn) {
        drawContentFn(ctx, card.x, card.y, card.w, card.h);
    }
    if (innerW > 0.5) {
        ctx.strokeStyle = innerC;
        ctx.lineWidth = innerW;
        ctx.beginPath();
        rrectBottom(ctx, card.x + innerW / 2, card.y + innerW / 2,
              card.w - innerW, card.h - innerW, Math.max(0, winR - innerW / 2));
        ctx.stroke();
    }

    ctx.restore();

    return bw + gw + tH;
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
