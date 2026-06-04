/**
 * Floway Tools — PNG-in-MOV 自封装器（纯 JS，无 ffmpeg）
 *
 * 把一串 PNG 帧（`canvas.toBlob('image/png')` 的字节）封进单个 QuickTime .mov，
 * 视频轨编码为 QuickTime 'png '（每帧一个 PNG 采样）。无损、带真 alpha、
 * QuickTime/Apple 原生：桌面剪映(Mac+Win) + 安卓剪映 + Premiere/AE/Resolve 都读。
 *
 * 为什么不用 ffmpeg：PNG 编码浏览器 toBlob 已免费做完，封 MOV 只是「字节装箱 + 写采样表」，
 * 用 31MB 的 ffmpeg.wasm 是杀鸡用牛刀（还有 wasm 内存只增不减、要重载、导出后卡的问题）。
 * 纯 JS 几 KB 即可，内存是可 GC 的普通 JS，下载完就释放。
 * 结构对齐 ffmpeg 的 PNG-in-MOV 输出（ftyp/wide/edts·elst/minf hdlr/变长 stsz），已在剪映/AE 验证。
 *
 * 用法:
 *   const mux = new PngMovMuxer({ fps: 30 });   // 宽高自动从首帧 PNG 的 IHDR 读取
 *   await mux.addFrameBlob(pngBlob);            // 逐帧加入 PNG Blob（不拷贝、不转码，仅持有引用）
 *   const blob = mux.finalize();                // 返回 Blob(video/quicktime)，可直接下载
 *
 * 内存：帧以 PNG **Blob** 持有（不是 Uint8Array）。大 Blob 浏览器(Chromium)会自动分页落盘，
 *       常驻内存远低于"所有 PNG 字节之和"，上限从 JS 堆 ~2.5GB 抬到 Blob 存储/磁盘级（几十 GB）。
 *       finalize 用 `new Blob([头, ...帧Blob, moov])` 按引用拼装，不分配巨型连续缓冲。
 *       (Firefox/Safari 对大 Blob 更可能留内存，落盘红利打折。)
 */

// ---- 字节小工具 ----
function u16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function u32(n) { return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]; }
// 64 位大端（用于 >4GB 的 mdat largesize；n ≤ 2^53 由 JS Number 安全表示）
function u64(n) { return [...u32(Math.floor(n / 0x100000000)), ...u32(n >>> 0)]; }
function fourcc(s) { return [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)]; }

/** atom: 4字节长度 + 4字节类型 + 负载 */
function box(type, ...parts) {
    const payload = [].concat(...parts);
    return [...u32(8 + payload.length), ...fourcc(type), ...payload];
}

// 3x3 定点单位矩阵（QuickTime matrix）
const IDENTITY_MATRIX = [
    ...u32(0x00010000), ...u32(0), ...u32(0),
    ...u32(0), ...u32(0x00010000), ...u32(0),
    ...u32(0), ...u32(0), ...u32(0x40000000),
];

export class PngMovMuxer {
    constructor({ fps = 30 } = {}) {
        this.fps = fps;
        this.width = 0;
        this.height = 0;
        this.frames = [];   // Blob[]（PNG 帧，原样持有；大 Blob 浏览器可落盘）
    }

    /** 加入一帧 PNG（Blob）。首帧异步读 IHDR 前 24 字节得到宽高。 */
    async addFrameBlob(blob) {
        if (this.frames.length === 0) {
            // PNG: 8字节签名 + IHDR(长度4+'IHDR'4+宽4+高4...) → 宽在偏移16、高在偏移20（大端）
            const head = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
            this.width = (head[16] << 24 | head[17] << 16 | head[18] << 8 | head[19]) >>> 0;
            this.height = (head[20] << 24 | head[21] << 16 | head[22] << 8 | head[23]) >>> 0;
        }
        this.frames.push(blob);
    }

    get frameCount() { return this.frames.length; }

    _stsd() {
        const compressorName = new Array(32).fill(0);
        const desc = box('png ',
            ...u16(0), ...u16(0), ...u16(0),    // reserved(6)
            ...u16(1),                           // data_reference_index
            ...u16(0), ...u16(0),                // version, revision
            ...fourcc('FLOW'),                   // vendor
            ...u32(512),                         // temporal quality
            ...u32(2),                           // spatial quality
            ...u16(this.width), ...u16(this.height),
            ...u32(0x00480000), ...u32(0x00480000), // 72dpi h/v
            ...u32(0),                           // data size
            ...u16(1),                           // frame count per sample
            ...compressorName,
            ...u16(24),                          // depth=24（alpha 在 PNG 内，与 ffmpeg 一致）
            ...u16(0xffff),                      // color table id = -1
        );
        return box('stsd', ...u32(0), ...u32(1), ...desc);
    }

    _stbl(mdatDataOffset) {
        const N = this.frames.length;
        const stts = box('stts', ...u32(0), ...u32(1), ...u32(N), ...u32(1)); // 每帧 delta=1（时基=fps）
        const stsc = box('stsc', ...u32(0), ...u32(1), ...u32(1), ...u32(N), ...u32(1)); // 全部 N 帧在 1 个 chunk
        const sizes = [];
        for (const f of this.frames) sizes.push(...u32(f.size));
        const stsz = box('stsz', ...u32(0), ...u32(0), ...u32(N), ...sizes); // sample_size=0 → 变长表
        const stco = box('stco', ...u32(0), ...u32(1), ...u32(mdatDataOffset));
        return box('stbl', this._stsd(), stts, stsc, stsz, stco);
    }

    _minf(o) {
        const vmhd = box('vmhd', 0, 0, 0, 1, ...u16(0), ...u16(0), ...u16(0), ...u16(0));
        // 数据处理器引用（规范要求；ffmpeg 也有）：componentType 'dhlr' / subtype 'url '
        const dn = [..."DataHandler"].map(c => c.charCodeAt(0));
        const dataHdlr = box('hdlr', ...u32(0), ...fourcc('dhlr'), ...fourcc('url '),
            ...u32(0), ...u32(0), ...u32(0), dn.length, ...dn);
        const dref = box('dref', ...u32(0), ...u32(1), box('url ', 0, 0, 0, 1));
        return box('minf', vmhd, dataHdlr, box('dinf', dref), this._stbl(o));
    }

    _mdia(o) {
        const N = this.frames.length;
        const mdhd = box('mdhd', ...u32(0), ...u32(0), ...u32(0), ...u32(this.fps), ...u32(N), ...u16(0x55c4), ...u16(0));
        const vn = [..."VideoHandler"].map(c => c.charCodeAt(0));
        const hdlr = box('hdlr', ...u32(0), ...fourcc('mhlr'), ...fourcc('vide'),
            ...u32(0), ...u32(0), ...u32(0), vn.length, ...vn);
        return box('mdia', mdhd, hdlr, this._minf(o));
    }

    _trak(o) {
        const N = this.frames.length;
        const tkhd = box('tkhd', 0, 0, 0, 0x07, ...u32(0), ...u32(0), ...u32(1), ...u32(0), ...u32(N),
            ...u32(0), ...u32(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...IDENTITY_MATRIX,
            ...u32(this.width << 16), ...u32(this.height << 16));
        // 恒等编辑列表：segment_duration 用本文件 mvhd 时基(=fps) → = N（不能照搬 ffmpeg 的 1000）
        const elst = box('elst', ...u32(0), ...u32(1), ...u32(N), ...u32(0), ...u32(0x00010000));
        return box('trak', tkhd, box('edts', elst), this._mdia(o));
    }

    _moov(o) {
        const N = this.frames.length;
        const mvhd = box('mvhd', ...u32(0), ...u32(0), ...u32(0), ...u32(this.fps), ...u32(N),
            ...u32(0x00010000), ...u16(0x0100), ...new Array(10).fill(0), ...IDENTITY_MATRIX,
            ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(2));
        const sw = [..."Floway"].map(c => c.charCodeAt(0));
        const udta = box('udta', box('©swr', ...u16(sw.length), ...u16(0x55c4), ...sw));
        return box('moov', mvhd, this._trak(o), udta);
    }

    /** 输出 .mov 为 Blob（布局：ftyp + wide + mdat + moov）。分段拼装，不分配巨型连续缓冲。 */
    finalize() {
        const ftyp = box('ftyp', ...fourcc('qt  '), ...u32(0x00000200), ...fourcc('qt  '));
        const wide = [...u32(8), ...fourcc('wide')];        // mdat 前占位（QuickTime 传统）
        const dataLen = this.frames.reduce((s, f) => s + f.size, 0);
        // mdat 长度：≤4GB 用 32 位标准头(8B)；>4GB 用 64 位 largesize(size=1 + 8字节实际长度，16B 头)。
        // 单 chunk，stco 偏移=mdat 数据起点(很小)始终 32 位安全；仅 mdat 盒长度需 64 位。
        let mdatHeader, mdatDataOffset;
        if (8 + dataLen <= 0xFFFFFFFF) {
            mdatHeader = [...u32(8 + dataLen), ...fourcc('mdat')];
            mdatDataOffset = ftyp.length + wide.length + 8;
        } else {
            mdatHeader = [...u32(1), ...fourcc('mdat'), ...u64(16 + dataLen)];
            mdatDataOffset = ftyp.length + wide.length + 16;
        }
        const moov = this._moov(mdatDataOffset);
        // Blob 分段：小头部转 Uint8Array，帧 Blob 原样塞入；浏览器负责拼装（可落盘，省内存）
        const parts = [new Uint8Array(ftyp), new Uint8Array(wide), new Uint8Array(mdatHeader),
            ...this.frames, new Uint8Array(moov)];
        return new Blob(parts, { type: 'video/quicktime' });
    }
}
