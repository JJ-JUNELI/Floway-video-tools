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

        this._libsLoaded = false;
        this._loadLibs();
        this._bindButton();
    }

    _loadLibs() {
        setTimeout(() => {
            if (window.Mp4Muxer && window.Mp4Muxer.Muxer) {
                window.Mp4MuxerLib = { Muxer: window.Mp4Muxer.Muxer, ArrayBufferTarget: window.Mp4Muxer.ArrayBufferTarget };
                this._libsLoaded = true;
                this.status.innerHTML = "<span class='status-dot status-ready'></span>组件就绪";
                this.btn.disabled = false;
                this.btn.innerHTML = "🔴 开始录制";
            } else {
                console.warn('mp4-muxer.js not loaded');
                this._libsLoaded = false;
                this.status.innerHTML = "<span class='status-dot status-offline'></span>离线模式 (仅WebM/PNG)";
                const mp4Opt = this.exportSelect.querySelector('option[value="mp4"]');
                if (mp4Opt) {
                    mp4Opt.disabled = true;
                    mp4Opt.text += ' [加载失败]';
                }
                this.btn.disabled = false;
                this.btn.innerHTML = "🔴 开始录制";
            }
        }, 300);
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
        document.body.classList.add('is-recording');
        this.ind.style.display = 'flex';

        if (this.onStateChange) this.onStateChange(true);

        const w = this.width;
        const h = this.height;

        try {
            if (this.format === 'png_seq') {
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

        const time = this.frameCount * (1000 / 60);

        // 调用效果的渲染函数 (可能是 async，比如 SVG rasterize)
        await this.onFrame(time);

        if (this.format === 'png_seq') {
            await new Promise(r => {
                this.canvas.toBlob(b => {
                    this.zip.file(`frame_${String(this.frameCount).padStart(5, '0')}.png`, b);
                    r();
                }, 'image/png');
            });
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
        this.btn.innerHTML = "🔴 开始录制";
        this.btn.disabled = false;
        if (this.onStateChange) this.onStateChange(false);
    }
}
