/**
 * Floway Tools — 共享录制引擎
 * 从 tool-text-v4 / tool-stack-scan / tool-logo-v4 提取
 * 
 * 支持四种导出格式: PNG序列(ZIP) / MP4(H.264 Baseline 25Mbps) / WebM(VP9 25Mbps) / 透明视频(PNG-in-MOV 自封装)
 * 
 * 使用方式:
 *   const recorder = new Recorder({
 *       canvas:       HTMLCanvasElement,
 *       onFrame:      (timeMs) => void|Promise,
 *       btnSelector:  '#BtnRecord',
 *       indSelector: '#RecIndicator',
 *       exportSelector: '#ExportFormat',
 *       statusSelector: '#LibStatus',
 *       fileName:     'TextAnim',
 *       width:        2880,
 *       height:       2160,
 *       // 可选配置:
 *       useRealtimeWebm: false,  // WebM 是否用独立实时循环 (默认 false = 帧同步)
 *       useRafForFrames: false,     // MP4/PNG 是否用 rAF 驱动 (默认 false = setTimeout)
 *       encodeQueueMax: 2,        // MP4 编码队列上限 (logo 原始用 5)
 *       useManualWebmFrames: false, // WebM 是否用手动帧请求 captureStream(0)+requestFrame (stack-scan 原始行为)
 *   });
 */

import { saveFile } from './utils.js';
import { PngMovMuxer } from './mov-muxer.js?v=blob-frames';
export class Recorder {
    constructor(opts) {
        this.canvas = opts.canvas;
        this.onFrame = opts.onFrame;
        this.btnSelector = opts.btnSelector || '#BtnRecord';
        this.indSelector = opts.indSelector || '#RecIndicator';
        this.exportSelector = opts.exportSelector || '#ExportFormat';
        this.statusSelector = opts.statusSelector || '#LibStatus';
        this.fileName = opts.fileName || 'FlowayExport';
        this.width = opts.width || this.canvas.width;
        this.height = opts.height || this.canvas.height;

        // 可选裁切：物理像素 {x,y,w,h}。由效果在录制时设置（如「导出完整卡片」贴合裁切）。
        // 仅作用于保 alpha 抓帧路径(png_seq/prores)与 mp4；webm(live stream)不裁。null=不裁，导出整画布。
        this.cropRect = null;

        // 录制目标时长（秒）。>0 时达到 maxDurationSec×实际帧率 帧数自动收尾。
        // 由效果设置（如"导出时长=视频长度"）。0=不限，手动停。
        this.maxDurationSec = 0;

        // 可选配置
        this.useRealtimeWebm = opts.useRealtimeWebm || false;
        this.useRafForFrames = opts.useRafForFrames || false;
        this.encodeQueueMax = opts.encodeQueueMax || 2;
        this.useManualWebmFrames = opts.useManualWebmFrames || false;

        this.btn = document.querySelector(this.btnSelector);
        this.ind = document.querySelector(this.indSelector);
        this.exportSelect = document.querySelector(this.exportSelector);
        this.status = document.querySelector(this.statusSelector);

        this.isRecording = false;
        this.frameCount = 0;
        this.mp4Muxer = null;
        this.videoEncoder = null;
        this.recorder = null;
        this.chunks = [];
        this.zip = null;
        this._webmLoopRunning = false;
        this._movMux = null;          // 透明视频: PNG-in-MOV 自封装器(纯 JS, 无 ffmpeg)
        this._proresN = 0;            // 透明视频: 已加入封装器的帧数

        this._libsLoaded = false;

        // 浏览器是否 Chromium 系：决定透明视频内存上限（Chromium 大 Blob 可落盘 → 上限高；
        // Firefox/Safari 大 Blob 更可能常驻内存 → 上限调低，并在选透明视频时提示）。
        this._isChromium = (() => {
            try {
                const uad = navigator.userAgentData;
                if (uad && Array.isArray(uad.brands)) {
                    return uad.brands.some(b => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
                }
            } catch (e) { /* ignore */ }
            const ua = navigator.userAgent || '';
            return /Chrome|Chromium|Edg\//.test(ua) && !/Firefox/.test(ua);
        })();

        this._loadLibs();
        this._bindButton();
        this._initProresHint();
    }

    /** 非 Chromium 浏览器：在透明视频档位行内提示时长上限较低（选透明视频时该行才显示，即「选格式时提示」）。 */
    _initProresHint() {
        if (this._isChromium) return;
        const opts = document.getElementById('ProResOpts');
        if (!opts || opts.querySelector('.prores-hint')) return;
        const hint = document.createElement('div');
        hint.className = 'prores-hint';
        hint.textContent = '⚠️ 当前浏览器对大文件支持有限，透明视频时长上限较低；长视频建议用 Chrome/Edge。';
        hint.style.cssText = 'flex-basis:100%;font-size:11px;line-height:1.45;opacity:.72;margin-top:2px;';
        opts.appendChild(hint);
    }

    _loadLibs() {
        if (typeof VideoEncoder === 'undefined') {
            const mp4Opt = this.exportSelect.querySelector('option[value="mp4"]');
            if (mp4Opt) { mp4Opt.disabled = true; mp4Opt.text += ' (需要 Chrome/Edge)'; }
            if (this.exportSelect.value === 'mp4') this.exportSelect.value = 'webm';
        }

        // 轮询等待 mp4-muxer CDN 脚本就绪：弱网下不再因固定延时过早误判离线
        const POLL_INTERVAL = 150, MAX_WAIT = 5000;
        let waited = 0;
        const markReady = () => {
            window.Mp4MuxerLib = { Muxer: window.Mp4Muxer.Muxer, ArrayBufferTarget: window.Mp4Muxer.ArrayBufferTarget };
            this._libsLoaded = true;
            if (this.status) this.status.innerHTML = "<span class='status-dot status-ready'></span>组件就绪";
            this.btn.disabled = false;
            this.btn.innerHTML = "⬤ 录制";
        };
        const markOffline = () => {
            console.warn('mp4-muxer.js not loaded');
            this._libsLoaded = false;
            if (this.status) this.status.innerHTML = "<span class='status-dot status-offline'></span>离线模式 (仅WebM/PNG)";
            const mp4Opt = this.exportSelect.querySelector('option[value="mp4"]');
            if (mp4Opt) {
                mp4Opt.disabled = true;
                mp4Opt.text += ' [加载失败]';
            }
            this.btn.disabled = false;
            this.btn.innerHTML = "⬤ 录制";
        };
        const poll = () => {
            if (window.Mp4Muxer && window.Mp4Muxer.Muxer) { markReady(); return; }
            waited += POLL_INTERVAL;
            if (waited >= MAX_WAIT) { markOffline(); return; }
            setTimeout(poll, POLL_INTERVAL);
        };
        poll();
    }

    // ====== 透明视频 (PNG-in-MOV 自封装，纯 JS，无 ffmpeg) ======

    /** 透明视频初始化：抓帧走 PNG（与 PNG 序列同路径，直通 alpha 正确，无 drawImage 预乘来回） */
    _initProres() {
        this._movMux = new PngMovMuxer({ fps: this._proresFps || 30 });
        this._proresN = 0;
        this._proresBytes = 0;
        // PNG 帧以 Blob 持有 → 内存不再是主瓶颈。预算按浏览器分档：
        // Chromium 大 Blob 自动落盘 → ~12GB；Firefox/Safari 大 Blob 更可能常驻内存 → 调低到 ~2.5GB，
        // 防止长序列吃满内存崩页。到顶自动收尾+提示而非崩页。
        // 注：mov-muxer 在 >4GB 时已切 64 位 mdat，文件结构本身不再卡 4GB。
        this._proresByteBudget = this._isChromium ? 12e9 : 2.5e9;
        this._proresHitCap = false;
    }

    /** 透明视频收尾：把已加入的 PNG 帧自封装成 QuickTime MOV（纯字节拼装）→ 下载 */
    _finishProres() {
        const mux = this._movMux;
        this._movMux = null;
        const N = this._proresN || 0;
        if (!mux || N === 0) { this._resetBtn(); return; }
        try {
            this.btn.innerHTML = "⏳ 封装透明视频…";
            // PNG-in-MOV：把抓到的 PNG 帧原样封进 QuickTime MOV（mov-muxer.js，纯 JS）。
            // 无损、带 alpha、QuickTime/Apple 原生：AE/Pr/Resolve + 安卓剪映 + 苹果桌面剪映都认
            // （苹果手机剪映只认 HEVC-alpha、浏览器产不出 → 手机走绿幕）。不加载 ffmpeg、无 wasm 内存残留。
            const blob = mux.finalize();
            saveFile(blob, `${this.fileName}_${Date.now()}.mov`);
            if (this._proresHitCap) {
                this._proresHitCap = false;
                alert(`已达内存上限，导出了前 ${N} 帧（约 ${(N / (this._proresFps || 60)).toFixed(1)}s）。如需更长，请缩短时长。`);
            }
        } catch (err) {
            alert("透明视频封装失败: " + (err && err.message ? err.message : err));
            console.error(err);
        }
        this._resetBtn();
    }

    _bindButton() {
        this.btn.addEventListener('click', () => {
            if (this.btn.disabled) return;
            if (this.isRecording) this.stop();
            else this.start();
        });
    }

    get format() {
        return this.exportSelect.value;
    }

    // 透明可保留的导出格式：PNG 序列 + 透明视频(QTRLE/MOV)。
    // mp4/webm 不支持 alpha，录制时需填实底。各效果的"透明模式填黑"判断统一走这里，
    // 避免每个效果各写 `format !== 'png_seq'`（漏掉 prores 会导致透明视频变黑底）。
    get keepsAlpha() {
        return this.format === 'png_seq' || this.format === 'prores' || this.format === 'png_single';
    }

    async start() {
        this.isRecording = true;
        this.frameCount = 0;
        this.cropRect = null;    // 每次录制重新决定（效果可在首帧 onFrame 内设置）
        this._captureFps = 60;   // 默认 60；ProRes 可改 30（见下）
        document.body.classList.add('is-recording');
        this.ind.style.display = 'flex';
        this._clearProgress();

        if (this.onStateChange) this.onStateChange(true);

        const w = this.width;
        const h = this.height;

        try {
            if (this.format === 'png_seq') {
                if (typeof JSZip === 'undefined') {
                    alert("PNG 序列打包组件 (JSZip) 未加载，请检查网络或刷新");
                    this.isRecording = false;
                    document.body.classList.remove('is-recording');
                    this.ind.style.display = 'none';
                    return;
                }
                this.zip = new JSZip();
                this.btn.innerHTML = "⏹ 停止录制 (PNG序列)";
                this.btn.classList.add('recording');
                this._processFrameLoop();
            } else if (this.format === 'mp4') {
                if (!window.Mp4MuxerLib) {
                    alert("MP4组件未加载，请检查网络或刷新");
                    this.isRecording = false;
                    document.body.classList.remove('is-recording');
                    this.ind.style.display = 'none';
                    return;
                }

                this.mp4Muxer = new window.Mp4MuxerLib.Muxer({
                    target: new window.Mp4MuxerLib.ArrayBufferTarget(),
                    video: { codec: 'avc', width: w, height: h },
                    fastStart: 'in-memory'
                });

                this.videoEncoder = new VideoEncoder({
                    output: (chunk, meta) => this.mp4Muxer.addVideoChunk(chunk, meta),
                    error: e => console.error(e)
                });

                this.videoEncoder.configure({
                    codec: 'avc1.420034',
                    width: w, height: h,
                    bitrate: 25_000_000,
                    framerate: 60,
                    latencyMode: 'quality'
                });

                this.btn.innerHTML = "⏹ 停止录制 (MP4)";
                this.btn.classList.add('recording');
                this._processFrameLoop();
            } else if (this.format === 'prores') {
                // 透明视频(PNG-in-MOV 自封装)：无需加载任何编码器，直接开录
                const fpsEl = document.getElementById('ProResFps');
                this._proresFps = fpsEl ? (parseInt(fpsEl.value, 10) || 30) : 30;
                this._captureFps = this._proresFps;
                const resEl = document.getElementById('ProResRes');
                this._proresHalf = resEl ? (resEl.value === 'half') : false;  // 标准 1x = 缩到一半
                this._initProres();
                this.btn.innerHTML = "⏹ 停止录制 (透明MOV)";
                this.btn.classList.add('recording');
                this._processFrameLoop();
            } else if (this.format === 'png_single') {
                // 单张图片：抓首帧即存即停（含 cropRect 贴合裁切）。无需编码器。
                this.btn.innerHTML = "⏳ 导出图片…";
                this.btn.classList.add('recording');
                this._processFrameLoop();
            } else {
                // WebM
                const streamFPS = this.useManualWebmFrames ? 0 : 60;
                const stream = this.canvas.captureStream(streamFPS);
                this.recorder = new MediaRecorder(stream, {
                    mimeType: 'video/webm; codecs=vp9',
                    videoBitsPerSecond: 25000000
                });
                this.chunks = [];
                this.recorder.ondataavailable = e => this.chunks.push(e.data);
                this.recorder.onstop = () => this._saveVideoWebM();
                this.recorder.start();

                this.btn.innerHTML = "⏹ 停止录制 (WebM)";
                this.btn.classList.add('recording');

                if (this.useRealtimeWebm) {
                    // logo 模式: 独立实时循环 (performance.now + rAF)
                    this._webmLoopRunning = true;
                    this._animStartTime = performance.now();
                    requestAnimationFrame(() => this._webmLoop());
                } else if (this.useManualWebmFrames) {
                    // stack-scan 模式: 帧同步 + requestFrame (captureStream(0))
                    const track = stream.getVideoTracks()[0];
                    if (!track.requestFrame) {
                        console.warn('Browser does not support track.requestFrame, WebM may drop frames');
                    }
                    this._webmTrack = track;
                    this._processFrameLoop();
                } else {
                    // 默认 (text-animator): 帧同步循环，captureStream(60) 自动抓帧
                    this._processFrameLoop();
                }
            }
        } catch (e) {
            alert("启动失败: " + e.message);
            console.error(e);
            this.isRecording = false;
            document.body.classList.remove('is-recording');
            this.ind.style.display = 'none';
        }
    }

    stop() {
        this.isRecording = false;
        document.body.classList.remove('is-recording');
        this.ind.style.display = 'none';
        this.btn.classList.remove('recording');
        this.btn.disabled = true;   // 收尾(打包/封装/编码)期间禁用，防止重复触发；各 finalize 完成调 _resetBtn() 恢复
        this._webmLoopRunning = false;

        if (this.onStateChange) this.onStateChange(false);

        if (this.format === 'png_seq') {
            this.btn.innerHTML = "⏳ 打包 ZIP 0%";
            this.zip.generateAsync({ type: "blob" }, (meta) => {
                this.btn.innerHTML = `⏳ 打包 ZIP ${Math.floor(meta.percent)}%`;
            }).then(content => {
                saveFile(content, `${this.fileName}_Seq_${Date.now()}.zip`);
                this._resetBtn();
            });
        } else if (this.format === 'mp4') {
            this.btn.innerHTML = "⏳ 封装 MP4 中...";
            if (this.videoEncoder && this.videoEncoder.state !== "closed") {
                this.videoEncoder.flush().then(() => {
                    this.mp4Muxer.finalize();
                    saveFile(
                        new Blob([this.mp4Muxer.target.buffer], { type: 'video/mp4' }),
                        `${this.fileName}_${Date.now()}.mp4`
                    );
                    this.videoEncoder.close();
                    this._resetBtn();
                });
            } else {
                this._resetBtn();
            }
        } else if (this.format === 'prores') {
            this._finishProres();
        } else if (this.format === 'png_single') {
            // 图片已在抓帧时保存，这里只复位按钮
            this._resetBtn();
        } else {
            if (this.recorder) this.recorder.stop();
            else this._resetBtn();
        }
    }

    /**
     * WebM 独立实时渲染循环 (用于循环动画效果)
     * 用 performance.now() 计算时间，用 rAF 驱动
     */
    _webmLoop() {
        if (!this._webmLoopRunning) return;
        const elapsed = performance.now() - this._animStartTime;
        this.onFrame(elapsed);
        this.frameCount++;
        this._updateProgress(elapsed);
        requestAnimationFrame(() => this._webmLoop());
    }

    /**
     * 帧同步渲染循环 (用于 MP4/PNG，以及非循环动画的 WebM)
     * 每帧时间 = frameCount * (1000/60)，确保输出帧均匀
     */
    /**
     * 返回送编码的源画布：按 cropRect 裁切（物理像素）+ 可选 1x 降采样。
     * 无裁切且不降采样时直接返回主画布（零拷贝）。裁切/降采样走 2D 暂存（drawImage 预乘合成，透明软边不发黑）。
     */
    _encodeSource(half) {
        const cr = this.cropRect;
        if (!cr && !half) return this.canvas;
        const cw = this.canvas.width, ch = this.canvas.height;
        let sx0 = 0, sy0 = 0, sw = cw, sh = ch;
        if (cr) {
            sx0 = Math.max(0, Math.round(cr.x)); sy0 = Math.max(0, Math.round(cr.y));
            sw = Math.min(cw - sx0, Math.round(cr.w)); sh = Math.min(ch - sy0, Math.round(cr.h));
            if (sw <= 0 || sh <= 0) return this.canvas; // 裁切无效 → 退回整画布
        }
        let dw = sw, dh = sh;
        if (half) { dw = Math.max(2, Math.round(sw / 2)); dh = Math.max(2, Math.round(sh / 2)); }
        if (!this._encScratch) this._encScratch = document.createElement('canvas');
        const sc = this._encScratch;
        if (sc.width !== dw || sc.height !== dh) { sc.width = dw; sc.height = dh; }
        const g = sc.getContext('2d');
        g.clearRect(0, 0, dw, dh);
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(this.canvas, sx0, sy0, sw, sh, 0, 0, dw, dh);
        return sc;
    }

    async _processFrameLoop() {
        if (!this.isRecording) return;

        // MP4: 如果编码队列满了，等一下再提交
        if (this.format === 'mp4' && this.videoEncoder.encodeQueueSize > this.encodeQueueMax) {
            const waitTime = this.encodeQueueMax > 2 ? 10 : 5;
            setTimeout(() => this._processFrameLoop(), waitTime);
            return;
        }

        const time = this.frameCount * (1000 / this._captureFps);

        // 调用效果的渲染函数 (可能是 async，比如 SVG rasterize)
        await this.onFrame(time);

        if (this.format === 'png_single') {
            // 单张图片：抓首帧（含 cropRect 裁切）即存即停
            const src = this._encodeSource(false);
            const blob = await new Promise(r => src.toBlob(r, 'image/png'));
            saveFile(blob, `${this.fileName}_${Date.now()}.png`);
            this.frameCount++;
            this.stop();
            return;
        } else if (this.format === 'png_seq') {
            const src = this._encodeSource(false);  // 含 cropRect 裁切
            await new Promise(r => {
                src.toBlob(b => {
                    this.zip.file(`frame_${String(this.frameCount).padStart(5, '0')}.png`, b);
                    r();
                }, 'image/png');
            });
        } else if (this.format === 'prores') {
            // 抓帧 → toBlob PNG → 加入自封装器（mov-muxer.js）。帧持有在 JS 堆，下载完即 GC 回收。
            // _proresHalf 标准 1x：drawImage 缩到一半（2x 渲染→1x 输出 = SSAA 超采样，边缘更锐）；
            // cropRect（导出完整卡片）裁切也在此处统一完成（_encodeSource 内 drawImage 预乘合成，透明软边不发黑）。
            const src = this._encodeSource(this._proresHalf);
            const png = await new Promise(r => src.toBlob(r, 'image/png'));
            // 以 Blob 持有（不 arrayBuffer 进 JS 堆）：大 Blob 浏览器自动落盘，内存占用大降。
            await this._movMux.addFrameBlob(png);
            this._proresN++;
            this._proresBytes += png.size;
            if (this._proresBytes >= this._proresByteBudget) {
                this._proresHitCap = true;
                this.stop();   // 达内存上限 → 收尾封装
                return;
            }
        } else if (this.format === 'mp4') {
            // mp4 编码尺寸在 start 时固定、且不支持 alpha → 不应用 cropRect（导出完整卡片请用 PNG 序列/透明视频）
            const frame = new VideoFrame(this.canvas, { timestamp: time * 1000 });
            if (this.videoEncoder.encodeQueueSize > this.encodeQueueMax + 3) {
                frame.close();
                await new Promise(r => setTimeout(r, 10));
            } else {
                this.videoEncoder.encode(frame, { keyFrame: (this.frameCount % 60 === 0) });
                frame.close();
            }
        } else {
            // WebM
            if (this.useManualWebmFrames && this._webmTrack) {
                // stack-scan 模式: 手动请求帧捕获
                if (this._webmTrack.requestFrame) await this._webmTrack.requestFrame();
                else await new Promise(r => setTimeout(r, 16));
            } else {
                // 默认: 等一帧时间让 captureStream 抓到
                await new Promise(r => setTimeout(r, 1000 / 60));
            }
        }

        this.frameCount++;
        this._updateProgress();

        // 时长跟随（如"导出时长=视频长度"）：达到目标帧数自动收尾。用实际 captureFps 换算。
        if (this.maxDurationSec > 0 && this._captureFps > 0 &&
            this.frameCount >= Math.round(this.maxDurationSec * this._captureFps)) {
            this.stop();
            return;
        }

        // 驱动方式取决于配置
        if (this.useRafForFrames || (this.useManualWebmFrames && this.format === 'webm')) {
            // stack-scan WebM 用 rAF, logo 全格式用 rAF
            requestAnimationFrame(() => this._processFrameLoop());
        } else {
            // setTimeout(0) 解耦屏幕刷新率，防止 PNG 压缩时序抖动
            setTimeout(() => this._processFrameLoop(), 0);
        }
    }

    // ====== 录制进度反馈（RecIndicator 内追加 .rec-progress，不动各效果原标签） ======

    _ensureProgressEl() {
        if (this._progEl && this._progEl.isConnected) return this._progEl;
        if (!this.ind) return null;
        let el = this.ind.querySelector('.rec-progress');
        if (!el) {
            el = document.createElement('span');
            el.className = 'rec-progress';
            el.style.cssText = 'margin-left:6px;opacity:.85;font-variant-numeric:tabular-nums;';
            this.ind.appendChild(el);
        }
        this._progEl = el;
        return el;
    }

    /** 每帧更新进度：定长录制显示「已录/总 帧 百分比」，手动停显示「帧数 · 秒」；透明视频附累计 MB。 */
    _updateProgress(elapsedMsOverride) {
        const el = this._ensureProgressEl();
        if (!el) return;
        const fps = this._captureFps || 60;
        const n = this.frameCount;
        let txt;
        if (this.maxDurationSec > 0 && fps > 0) {
            const total = Math.max(1, Math.round(this.maxDurationSec * fps));
            const pct = Math.min(100, Math.floor((n / total) * 100));
            txt = `· ${n}/${total} 帧 ${pct}%`;
        } else {
            const elapsed = elapsedMsOverride != null ? elapsedMsOverride / 1000 : n / fps;
            txt = `· ${n} 帧 ${elapsed.toFixed(1)}s`;
        }
        if (this.format === 'prores' && this._proresBytes) {
            txt += ` · ${(this._proresBytes / 1e6).toFixed(0)}MB`;
        }
        el.textContent = ' ' + txt;
    }

    _clearProgress() {
        if (this._progEl) this._progEl.textContent = '';
    }

    _saveVideoWebM() {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        saveFile(blob, `${this.fileName}_${Date.now()}.webm`);
        this.chunks = [];
        this._resetBtn();
    }

    _resetBtn() {
        this._freeBuffers();
        this._clearProgress();
        this.btn.innerHTML = "⬤ 录制";
        this.btn.disabled = false;
        if (this.onStateChange) this.onStateChange(false);
    }

    /**
     * 导出收尾后主动释放大块缓冲，避免常驻内存：
     * - this.zip：JSZip 攒着 PNG 序列所有帧，导出后若不置空会一直赖到下次录制（长序列=几个 GB）。
     * - this._movMux：透明视频封装器（含帧 Blob 引用）。最终 MOV Blob 已独立，置空让帧 Blob 随下载完成+GC 回收。
     * - this._encScratch：抓帧暂存画布（2x 下 ~24MB 像素缓冲），width/height=0 释放底层缓冲。
     * 注：下载中的 Blob 由浏览器自身持有直到写盘完成，JS 这边丢引用即可，不会中断下载。
     */
    _freeBuffers() {
        this.zip = null;
        this._movMux = null;
        this.chunks = [];
        if (this._encScratch) { this._encScratch.width = 0; this._encScratch.height = 0; this._encScratch = null; }
    }
}
