/**
 * Floway Tools — 共享录制引擎
 * 从 tool-text-v4 / tool-stack-scan / tool-logo-v4 提取
 * 
 * 支持三种导出格式: PNG序列(ZIP) / MP4(H.264 Baseline 25Mbps) / WebM(VP9 25Mbps)
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
        this._ffmpeg = null;          // ffmpeg.wasm 实例(懒加载,仅 ProRes 用)
        this._proresFrames = null;    // ProRes: 缓存的 PNG 帧(Uint8Array[])
        this._encoding = false;       // ProRes: 编码中(用于进度回调)

        this._libsLoaded = false;
        this._loadLibs();
        this._bindButton();
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

    // ====== ProRes (ffmpeg.wasm) ======

    /** 懒加载 ffmpeg.wasm（仅在首次导出 ProRes 时触发，本地同源 UMD） */
    async _loadFFmpeg() {
        if (this._ffmpeg) return this._ffmpeg;
        const vendor = new URL('vendor/ffmpeg/', import.meta.url).href;
        if (!window.FFmpegWASM) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = vendor + 'ffmpeg.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error('ffmpeg.js 加载失败（检查 shared/vendor/ffmpeg/）'));
                document.head.appendChild(s);
            });
        }
        const ff = new window.FFmpegWASM.FFmpeg();
        ff.on('progress', ({ progress }) => {
            if (this._encoding) this.btn.innerHTML = `⏳ 编码 ${Math.min(99, Math.max(0, Math.round((progress || 0) * 100)))}%`;
        });
        await ff.load({
            coreURL: vendor + 'ffmpeg-core.js',
            wasmURL: vendor + 'ffmpeg-core.wasm',
        });
        this._ffmpeg = ff;
        return ff;
    }

    /** ProRes 初始化：抓帧走 PNG（与 PNG 序列同路径，直通 alpha 正确，无 drawImage 预乘来回） */
    _initProres() {
        this._proresFrames = [];
        this._proresBytes = 0;
        this._proresByteBudget = 1.5e9; // ~1.5GB 压缩 PNG 预算（远比未压缩 raw 装更多帧）
        this._proresHitCap = false;
    }

    /** ProRes 收尾：PNG 帧写入 ffmpeg FS → 解 PNG 序列编 ProRes 4444 → 下载 */
    async _finishProres() {
        const ff = this._ffmpeg;
        const frames = this._proresFrames;
        this._proresFrames = null;
        const N = frames ? frames.length : 0;
        if (!ff || N === 0) { this._resetBtn(); return; }
        const names = [];
        try {
            for (let i = 0; i < N; i++) {
                const name = `f${String(i).padStart(5, '0')}.png`;
                await ff.writeFile(name, frames[i]);
                names.push(name);
                frames[i] = null; // 边写边释放 JS 引用
                if (i % 10 === 0) this.btn.innerHTML = `⏳ 写入帧 ${i + 1}/${N}`;
            }

            this._encoding = true;
            this.btn.innerHTML = "⏳ 编码 ProRes…";
            const fps = String(this._proresFps || 60);
            const qArgs = this._proresQscale ? ['-qscale:v', String(this._proresQscale)] : [];
            await ff.exec([
                '-framerate', fps, '-start_number', '0',
                '-i', 'f%05d.png',
                '-c:v', 'prores_ks', '-profile:v', '4444', ...qArgs, '-pix_fmt', 'yuva444p10le',
                '-y', 'out.mov',
            ]);
            this._encoding = false;

            const data = await ff.readFile('out.mov');
            saveFile(new Blob([data], { type: 'video/quicktime' }), `${this.fileName}_${Date.now()}.mov`);
            try {
                for (const n of names) await ff.deleteFile(n);
                await ff.deleteFile('out.mov');
            } catch (_) {}

            if (this._proresHitCap) {
                this._proresHitCap = false;
                alert(`已达 ProRes 内存上限，导出了前 ${N} 帧（约 ${(N / 60).toFixed(1)}s）。如需更长，请缩短时长。`);
            }
        } catch (err) {
            this._encoding = false;
            alert("ProRes 编码失败: " + (err && err.message ? err.message : err));
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

    async start() {
        this.isRecording = true;
        this.frameCount = 0;
        this._captureFps = 60;   // 默认 60；ProRes 可改 30（见下）
        document.body.classList.add('is-recording');
        this.ind.style.display = 'flex';

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
                // 读取 ProRes 专属选项（帧率 / 质量）
                const fpsEl = document.getElementById('ProResFps');
                const qualEl = document.getElementById('ProResQuality');
                this._proresFps = fpsEl ? (parseInt(fpsEl.value, 10) || 30) : 30;
                this._captureFps = this._proresFps;
                this._proresQscale = (qualEl && qualEl.value === 'small') ? 11 : null;
                this.btn.innerHTML = "⏳ 加载编码器…";
                this.btn.disabled = true;   // 加载期间禁用按钮，防止重复点击
                try {
                    await this._loadFFmpeg();
                } catch (err) {
                    alert("ProRes 编码器加载失败: " + (err && err.message ? err.message : err));
                    this.isRecording = false;
                    document.body.classList.remove('is-recording');
                    this.ind.style.display = 'none';
                    this._resetBtn();
                    return;
                }
                if (!this.isRecording) return; // 加载期间被取消
                this._initProres();
                this.btn.disabled = false;  // 录制中恢复，允许点击停止
                this.btn.innerHTML = "⏹ 停止录制 (ProRes)";
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
            this.btn.innerHTML = "⏳ 打包 ZIP 中...";
            this.zip.generateAsync({ type: "blob" }).then(content => {
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
        requestAnimationFrame(() => this._webmLoop());
    }

    /**
     * 帧同步渲染循环 (用于 MP4/PNG，以及非循环动画的 WebM)
     * 每帧时间 = frameCount * (1000/60)，确保输出帧均匀
     */
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

        if (this.format === 'png_seq') {
            await new Promise(r => {
                this.canvas.toBlob(b => {
                    this.zip.file(`frame_${String(this.frameCount).padStart(5, '0')}.png`, b);
                    r();
                }, 'image/png');
            });
        } else if (this.format === 'prores') {
            // 与 PNG 序列同款抓帧：直接对源画布 toBlob PNG（直通 alpha 正确，无 drawImage 预乘来回）
            const png = await new Promise(r => this.canvas.toBlob(r, 'image/png'));
            const bytes = new Uint8Array(await png.arrayBuffer());
            this._proresFrames.push(bytes);
            this._proresBytes += bytes.length;
            if (this._proresBytes >= this._proresByteBudget) {
                this._proresHitCap = true;
                this.stop();   // 达内存上限 → 收尾编码
                return;
            }
        } else if (this.format === 'mp4') {
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

        // 驱动方式取决于配置
        if (this.useRafForFrames || (this.useManualWebmFrames && this.format === 'webm')) {
            // stack-scan WebM 用 rAF, logo 全格式用 rAF
            requestAnimationFrame(() => this._processFrameLoop());
        } else {
            // setTimeout(0) 解耦屏幕刷新率，防止 PNG 压缩时序抖动
            setTimeout(() => this._processFrameLoop(), 0);
        }
    }

    _saveVideoWebM() {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        saveFile(blob, `${this.fileName}_${Date.now()}.webm`);
        this.chunks = [];
        this._resetBtn();
    }

    _resetBtn() {
        this.btn.innerHTML = "⬤ 录制";
        this.btn.disabled = false;
        if (this.onStateChange) this.onStateChange(false);
    }
}
