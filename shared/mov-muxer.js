/**
 * Floway Tools — 最小 MOV 封装器(Phase 0:未压缩 RGBA / 'raw ' depth 32)
 *
 * 目的:在浏览器内把一串 Canvas 帧封成单个 QuickTime .mov,带真 alpha,
 *       无损、无第三方库、无 ffmpeg。用于验证三家编辑器(剪映/Premiere/Resolve)
 *       能否导入未压缩 32-bit MOV 的透明。
 *
 * 编码:QuickTime 'raw ' 未压缩,depth=32,像素 ARGB(每像素 4 字节 A,R,G,B,
 *       行自上而下)。对应 ffmpeg `-c:v rawvideo -pix_fmt argb`。
 *       直通 alpha(非预乘),与 Canvas getImageData 一致。
 *
 * 用法:
 *   const mux = new MovMuxer({ width, height, fps });
 *   mux.addFrameRGBA(uint8RGBA);   // 接受 Canvas getImageData 的 RGBA
 *   const bytes = mux.finalize();  // Uint8Array,即 .mov 文件
 *
 * 注意:Phase 0 把所有帧缓存在内存(样片只有几帧,够用)。未压缩体积极大,
 *       真正接入录制(Phase 1)时改为边抓边写 / Worker。
 */

// ---- 字节写入小工具 ----
function u16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function u32(n) { return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]; }
function fourcc(s) { return [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)]; }

/** 构建一个 atom:4字节长度 + 4字节类型 + 负载(可为字节数组或多段) */
function box(type, ...parts) {
    const payload = [].concat(...parts);
    const size = 8 + payload.length;
    return [...u32(size), ...fourcc(type), ...payload];
}

// 3x3 定点单位矩阵(QuickTime matrix:36 字节)
const IDENTITY_MATRIX = [
    ...u32(0x00010000), ...u32(0), ...u32(0),
    ...u32(0), ...u32(0x00010000), ...u32(0),
    ...u32(0), ...u32(0), ...u32(0x40000000),
];

export class MovMuxer {
    constructor({ width, height, fps = 60, pixelOrder = 'argb' }) {
        this.width = width;
        this.height = height;
        this.fps = fps;
        this.pixelOrder = pixelOrder;        // 'argb'(默认) | 'rgba' | 'bgra' — 验证用,可切字节序
        this.frameBytes = width * height * 4;
        this.frames = [];                    // Uint8Array[]
    }

    /** 接受 Canvas getImageData().data(RGBA),按 pixelOrder 转码后缓存一帧 */
    addFrameRGBA(rgba) {
        if (rgba.length !== this.frameBytes) {
            throw new Error(`帧字节数不符: 期望 ${this.frameBytes}, 实得 ${rgba.length}`);
        }
        const out = new Uint8Array(this.frameBytes);
        const n = this.width * this.height;
        const order = this.pixelOrder;
        for (let i = 0; i < n; i++) {
            const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3];
            const o = i * 4;
            if (order === 'argb')      { out[o] = a; out[o + 1] = r; out[o + 2] = g; out[o + 3] = b; }
            else if (order === 'rgba') { out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a; }
            else /* bgra */            { out[o] = b; out[o + 1] = g; out[o + 2] = r; out[o + 3] = a; }
        }
        this.frames.push(out);
    }

    /** 'raw ' 视频采样描述(ImageDescription),depth=32 表示带 alpha */
    _stsd() {
        const compressorName = new Array(32).fill(0); // 32字节 pascal,长度0
        const desc = box('raw ',
            ...u16(0), ...u16(0), ...u16(0),   // reserved(6)
            ...u16(1),                          // data_reference_index
            ...u16(0),                          // version
            ...u16(0),                          // revision level
            ...fourcc('FLOW'),                  // vendor
            ...u32(0),                          // temporal quality
            ...u32(512),                        // spatial quality
            ...u16(this.width),                 // width
            ...u16(this.height),                // height
            ...u32(0x00480000),                 // horiz resolution 72dpi
            ...u32(0x00480000),                 // vert resolution 72dpi
            ...u32(0),                          // data size (0)
            ...u16(1),                          // frame count per sample
            ...compressorName,                  // 32-byte compressor name
            ...u16(32),                         // depth = 32 (含 alpha)
            ...u16(0xffff),                     // color table id = -1
        );
        return box('stsd', ...u32(0), ...u32(1), ...desc);
    }

    _stbl(mdatDataOffset) {
        const N = this.frames.length;
        const stts = box('stts', ...u32(0), ...u32(1), ...u32(N), ...u32(1)); // delta=1(timescale=fps)
        const stsc = box('stsc', ...u32(0), ...u32(1), ...u32(1), ...u32(N), ...u32(1));
        const stsz = box('stsz', ...u32(0), ...u32(this.frameBytes), ...u32(N));
        const stco = box('stco', ...u32(0), ...u32(1), ...u32(mdatDataOffset));
        return box('stbl', this._stsd(), stts, stsc, stsz, stco);
    }

    _minf(mdatDataOffset) {
        // vmhd: version+flags=0x000001, graphics mode=0(copy), opcolor=0,0,0
        const vmhd = box('vmhd', 0, 0, 0, 1, ...u16(0), ...u16(0), ...u16(0), ...u16(0));
        const urlBox = box('url ', 0, 0, 0, 1);                 // flags=1 自包含
        const dref = box('dref', ...u32(0), ...u32(1), urlBox);
        const dinf = box('dinf', dref);
        return box('minf', vmhd, dinf, this._stbl(mdatDataOffset));
    }

    _mdia(mdatDataOffset) {
        const N = this.frames.length;
        const mdhd = box('mdhd', ...u32(0), ...u32(0), ...u32(0),
            ...u32(this.fps), ...u32(N), ...u16(0x55c4), ...u16(0));
        const hdlr = box('hdlr', ...u32(0),
            ...fourcc('mhlr'), ...fourcc('vide'),
            ...u32(0), ...u32(0), ...u32(0), 0); // 末尾 1 字节空 component name(pascal len 0)
        return box('mdia', mdhd, hdlr, this._minf(mdatDataOffset));
    }

    _trak(mdatDataOffset) {
        const N = this.frames.length;
        const tkhd = box('tkhd',
            0, 0, 0, 0x07,                      // version0 + flags(enabled|inMovie|inPreview)
            ...u32(0), ...u32(0),               // creation, modification
            ...u32(1),                          // track id
            ...u32(0),                          // reserved
            ...u32(N),                          // duration
            ...u32(0), ...u32(0),               // reserved
            ...u16(0),                          // layer
            ...u16(0),                          // alternate group
            ...u16(0),                          // volume (video=0)
            ...u16(0),                          // reserved
            ...IDENTITY_MATRIX,
            ...u32(this.width << 16),           // track width (fixed 16.16)
            ...u32(this.height << 16),          // track height
        );
        return box('trak', tkhd, this._mdia(mdatDataOffset));
    }

    _moov(mdatDataOffset) {
        const N = this.frames.length;
        const mvhd = box('mvhd',
            ...u32(0), ...u32(0), ...u32(0),    // version/flags, creation, modification
            ...u32(this.fps),                   // timescale
            ...u32(N),                          // duration
            ...u32(0x00010000),                 // preferred rate 1.0
            ...u16(0x0100),                     // preferred volume 1.0
            ...new Array(10).fill(0),           // reserved(10)
            ...IDENTITY_MATRIX,
            ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0), // preview/poster/selection/current
            ...u32(2),                          // next track id
        );
        return box('moov', mvhd, this._trak(mdatDataOffset));
    }

    /** 输出完整 .mov 字节(布局:ftyp + mdat + moov) */
    finalize() {
        const ftyp = box('ftyp',
            ...fourcc('qt  '), ...u32(0x00000200), ...fourcc('qt  '));

        // mdat:8 字节头 + 所有帧数据
        const mdatHeaderLen = 8;
        const mdatDataOffset = ftyp.length + mdatHeaderLen;
        const mdatSize = mdatHeaderLen + this.frames.length * this.frameBytes;

        const moov = this._moov(mdatDataOffset);

        const total = ftyp.length + mdatSize + moov.length;
        const out = new Uint8Array(total);
        let p = 0;
        out.set(ftyp, p); p += ftyp.length;
        // mdat 头
        out.set(u32(mdatSize), p); p += 4;
        out.set(fourcc('mdat'), p); p += 4;
        for (const f of this.frames) { out.set(f, p); p += f.length; }
        out.set(moov, p); p += moov.length;
        return out;
    }
}
