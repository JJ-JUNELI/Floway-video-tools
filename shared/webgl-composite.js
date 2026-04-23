/**
 * Floway Tools — WebGL 3D 合成模块
 * 将 Canvas 2D 内容通过 WebGL 进行透视变换合成
 * 解决 canvas.captureStream() 无法捕获 CSS 3D 变换的问题
 *
 * 使用方式：
 *   import { WebGLComposite } from './webgl-composite.js';
 *   const gl = new WebGLComposite(glCanvas, 1440, 1080);
 *   gl.render({
 *       bgCanvas,      // 背景 canvas（固定不动）
 *       cardCanvas,     // 卡片内容 canvas（离屏 2D）
 *       rx: 0.02,       // X轴旋转（弧度）
 *       ry: -0.01,      // Y轴旋转（弧度）
 *       perspective: 900,
 *       elevation: 0.5, // 0-1 影响阴影
 *       cardScale: 0.8, // 卡片占画布比例
 *       cardRadius: 16,
 *   });
 */

export class WebGLComposite {
    constructor(canvas, baseWidth, baseHeight) {
        this.canvas = canvas;
        this.baseWidth = baseWidth;
        this.baseHeight = baseHeight;
        this.gl = canvas.getContext('webgl', {
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
            antialias: true,
        });

        if (!this.gl) throw new Error('WebGL not available');

        // SDF 抗锯齿需要 derivatives 扩展
        this.gl.getExtension('OES_standard_derivatives');

        // 翻转纹理 Y 轴（Canvas 2D 坐标原点在左上，WebGL 在左下）
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

        this._initShaders();
        this._initBuffers();
        this._initTextures();

        // 预分配可复用的矩阵数组（避免每帧 new Float32Array）
        this._m0 = new Float32Array(16);
        this._m1 = new Float32Array(16);
        this._m2 = new Float32Array(16);
        this._m3 = new Float32Array(16);
        this._m4 = new Float32Array(16);
        this._m5 = new Float32Array(16);
        // 阴影缓存：参数未变时跳过重绘
        this._shadowCache = { rx: null, ry: null, perspective: null, cardScale: null, elevation: null, cardRadius: null };
    }

    // ========== 着色器 ==========

    _initShaders() {
        const gl = this.gl;

        // 顶点着色器：4×4 透视矩阵变换
        const vsSource = `
            attribute vec2 aPosition;
            attribute vec2 aTexCoord;

            uniform mat4 uMVP;

            varying vec2 vTexCoord;

            void main() {
                vTexCoord = aTexCoord;
                gl_Position = uMVP * vec4(aPosition, 0.0, 1.0);
            }
        `;

        // 片段着色器：纹理采样 + SDF 圆角裁剪
        const fsSource = `
            #extension GL_OES_standard_derivatives : enable
            precision mediump float;

            varying vec2 vTexCoord;

            uniform sampler2D uTexture;
            uniform vec4 uBounds;   // x, y, w, h（卡片在画布中的归一化位置）
            uniform float uRadius;  // 圆角半径（归一化）
            uniform float uIsCard;  // 1.0 = 卡片（需圆角裁剪），0.0 = 背景/阴影
            uniform float uAlpha;   // 全局透明度

            float sdfRoundBox(vec2 p, vec2 b, float r) {
                vec2 d = abs(p) - b + r;
                return length(max(d, 0.0)) - r;
            }

            void main() {
                vec4 texColor = texture2D(uTexture, vTexCoord);

                if (uIsCard > 0.5) {
                    // 将 texCoord 转换到卡片局部坐标
                    vec2 localPos = (vTexCoord - uBounds.xy) / uBounds.zw;
                    vec2 centerPos = localPos - 0.5;
                    vec2 halfSize = vec2(0.5);
                    float d = sdfRoundBox(centerPos, halfSize, uRadius);

                    // 抗锯齿 SDF 边缘
                    float aa = fwidth(d) * 1.5;
                    float alpha = 1.0 - smoothstep(-aa, aa, d);
                    texColor.a *= alpha * uAlpha;
                } else {
                    texColor.a *= uAlpha;
                }

                gl_FragColor = texColor;
            }
        `;

        this._program = this._createProgram(vsSource, fsSource);

        // Attribute / Uniform 位置
        this._aPosition = gl.getAttribLocation(this._program, 'aPosition');
        this._aTexCoord = gl.getAttribLocation(this._program, 'aTexCoord');
        this._uMVP = gl.getUniformLocation(this._program, 'uMVP');
        this._uTexture = gl.getUniformLocation(this._program, 'uTexture');
        this._uBounds = gl.getUniformLocation(this._program, 'uBounds');
        this._uRadius = gl.getUniformLocation(this._program, 'uRadius');
        this._uIsCard = gl.getUniformLocation(this._program, 'uIsCard');
        this._uAlpha = gl.getUniformLocation(this._program, 'uAlpha');
    }

    _createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this._compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSource);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error('WebGL program link failed: ' + gl.getProgramInfoLog(prog));
        }
        return prog;
    }

    _compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Shader compile failed: ' + info);
        }
        return shader;
    }

    // ========== 缓冲区 ==========

    _initBuffers() {
        const gl = this.gl;

        // 单位 quad：position (x,y) + texCoord (u,v)
        // NDC 坐标，render() 中通过 MVP 矩阵变换
        const quadData = new Float32Array([
            // x,    y,    u,   v
            -1.0, -1.0,  0.0, 0.0,
             1.0, -1.0,  1.0, 0.0,
            -1.0,  1.0,  0.0, 1.0,
             1.0,  1.0,  1.0, 1.0,
        ]);

        this._quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

        this._indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 1, 3]), gl.STATIC_DRAW);
    }

    // ========== 纹理 ==========

    _initTextures() {
        const gl = this.gl;
        this._texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    _uploadTexture(sourceCanvas) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    }

    // ========== 矩阵工具（零分配）==========
    _mat4Perspective(out, d) {
        out[0]=1;out[1]=0;out[2]=0;out[3]=0;
        out[4]=0;out[5]=1;out[6]=0;out[7]=0;
        out[8]=0;out[9]=0;out[10]=1;out[11]=-1/d;
        out[12]=0;out[13]=0;out[14]=0;out[15]=1;
        return out;
    }
    _mat4Mul(out, a, b) {
        for (let i = 0; i < 4; i++) {
            out[i]   =a[i]*b[0] +a[i+4]*b[1] +a[i+8]*b[2]  +a[i+12]*b[3];
            out[i+4] =a[i]*b[4] +a[i+4]*b[5] +a[i+8]*b[6]  +a[i+12]*b[7];
            out[i+8] =a[i]*b[8] +a[i+4]*b[9] +a[i+8]*b[10] +a[i+12]*b[11];
            out[i+12]=a[i]*b[12]+a[i+4]*b[13]+a[i+8]*b[14]+a[i+12]*b[15];
        }
        return out;
    }
    _mat4Identity(out) {
        out[0]=1;out[1]=0;out[2]=0;out[3]=0;
        out[4]=0;out[5]=1;out[6]=0;out[7]=0;
        out[8]=0;out[9]=0;out[10]=1;out[11]=0;
        out[12]=0;out[13]=0;out[14]=0;out[15]=1;
        return out;
    }
    _mat4Translate(out, tx, ty, tz) {
        out[0]=1;out[1]=0;out[2]=0;out[3]=0;
        out[4]=0;out[5]=1;out[6]=0;out[7]=0;
        out[8]=0;out[9]=0;out[10]=1;out[11]=0;
        out[12]=tx;out[13]=ty;out[14]=tz;out[15]=1;
        return out;
    }
    _mat4RotateX(out, rad) {
        const c = Math.cos(rad), s = Math.sin(rad);
        out[0]=1;out[1]=0;out[2]=0;out[3]=0;
        out[4]=0;out[5]=c;out[6]=s;out[7]=0;
        out[8]=0;out[9]=-s;out[10]=c;out[11]=0;
        out[12]=0;out[13]=0;out[14]=0;out[15]=1;
        return out;
    }
    _mat4RotateY(out, rad) {
        const c = Math.cos(rad), s = Math.sin(rad);
        out[0]=c;out[1]=0;out[2]=-s;out[3]=0;
        out[4]=0;out[5]=1;out[6]=0;out[7]=0;
        out[8]=s;out[9]=0;out[10]=c;out[11]=0;
        out[12]=0;out[13]=0;out[14]=0;out[15]=1;
        return out;
    }

    /**
     * 构建卡片 quad 的 MVP 矩阵
     */
    _buildCardMVP(rx, ry, perspective, cardScale, offsetX = 0, offsetY = 0) {
        const bw = this.baseWidth;
        const bh = this.baseHeight;
        const d = perspective / (bh / 2);
        const m = this._m0; m[0]=cardScale;m[5]=cardScale;m[10]=1;m[15]=1; m[1]=m[2]=m[3]=m[4]=m[6]=m[7]=m[8]=m[9]=m[11]=m[12]=m[13]=m[14]=0;
        const rxOut = this._m1; this._mat4RotateX(rxOut, rx);
        const ryOut = this._m2; this._mat4RotateY(ryOut, ry);
        const V = this._m3; this._mat4Mul(V, rxOut, ryOut);
        const P = this._m4; this._mat4Perspective(P, d);
        const VM = this._m5; this._mat4Mul(VM, V, m);
        let result = this._m0; this._mat4Mul(result, P, VM);
        if (offsetX !== 0 || offsetY !== 0) {
            const ndcOX = offsetX / (bw / 2);
            const ndcOY = -offsetY / (bh / 2);
            const T = this._m3; this._mat4Translate(T, ndcOX, ndcOY, 0);
            this._mat4Mul(this._m4, T, result);
            result = this._m4;
        }
        return result;
    }

    _buildFullscreenMVP() { return this._mat4Identity(this._m0); }

    // ========== 绘制 ==========

    _drawQuad(mvp, bounds, radius, isCard, alpha) {
        const gl = this.gl;
        gl.uniformMatrix4fv(this._uMVP, false, mvp);
        gl.uniform4f(this._uBounds, bounds.x, bounds.y, bounds.w, bounds.h);
        gl.uniform1f(this._uRadius, radius);
        gl.uniform1f(this._uIsCard, isCard);
        gl.uniform1f(this._uAlpha, alpha);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    // ========== 主渲染接口 ==========

    render(opts) {
        const gl = this.gl;
        const bw = this.baseWidth;
        const bh = this.baseHeight;
        const cardScale = opts.cardScale || 0.8;
        const perspective = opts.perspective || 900;
        const elevation = opts.elevation || 0.5;
        const cardRadius = opts.cardRadius || 16;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this._program);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);

        const stride = 4 * 4;
        gl.enableVertexAttribArray(this._aPosition);
        gl.vertexAttribPointer(this._aPosition, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this._aTexCoord);
        gl.vertexAttribPointer(this._aTexCoord, 2, gl.FLOAT, false, stride, 2 * 4);

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this._uTexture, 0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        const offsetX = opts.offsetX || 0;
        const offsetY = opts.offsetY || 0;
        const cardAlpha = opts.cardAlpha !== undefined ? opts.cardAlpha : 1.0;

        // === Pass 1: 背景 ===
        if (opts.bgCanvas) {
            this._uploadTexture(opts.bgCanvas);
            this._drawQuad(this._buildFullscreenMVP(), { x: 0, y: 0, w: 1, h: 1 }, 0, 0, 1.0);
        }

        // === Pass 2: 卡片阴影（带缓存）===
        {
            const sc = this._shadowCache;
            const paramsChanged = sc.rx !== opts.rx || sc.ry !== opts.ry ||
                sc.perspective !== perspective || sc.cardScale !== cardScale ||
                sc.elevation !== elevation || sc.cardRadius !== cardRadius;
            if (paramsChanged) {
                const shadowCanvas = this._getShadowCanvas();
                const sctx = shadowCanvas.getContext('2d');
                sctx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
                const sy = 4 + elevation * 36;
                const sb = 12 + elevation * 44;
                sctx.save();
                sctx.setTransform(1, 0, 0, 1, 0, 0);
                sctx.scale(shadowCanvas.width / bw, shadowCanvas.height / bh);
                sctx.shadowOffsetX = 0;
                sctx.shadowOffsetY = sy * 0.6;
                sctx.shadowBlur = sb * 0.5;
                sctx.shadowColor = 'rgba(0,0,0,' + (0.05 + elevation * 0.10) + ')';
                sctx.fillStyle = 'rgba(0,0,0,0.3)';
                sctx.beginPath();
                this._roundRect(sctx, 0, 0, bw, bh, cardRadius);
                sctx.fill();
                sctx.restore();
                sc.rx = opts.rx; sc.ry = opts.ry; sc.perspective = perspective;
                sc.cardScale = cardScale; sc.elevation = elevation; sc.cardRadius = cardRadius;
            }
            const shadowCanvas = this._getShadowCanvas();
            this._uploadTexture(shadowCanvas);
            this._drawQuad(this._buildCardMVP(opts.rx, opts.ry, perspective, cardScale, offsetX, offsetY),
                { x: 0, y: 0, w: 1, h: 1 }, 0, 0, 0.6 * cardAlpha);
        }

        // === Pass 3: 卡片内容 ===
        if (opts.cardCanvas) {
            this._uploadTexture(opts.cardCanvas);
            const rNorm = cardRadius / bw;
            this._drawQuad(this._buildCardMVP(opts.rx, opts.ry, perspective, cardScale, offsetX, offsetY),
                { x: 0, y: 0, w: 1, h: 1 }, rNorm, 1.0, cardAlpha);
        }
    }

    // ========== 工具 ==========

    _getShadowCanvas() {
        if (!this._shadowCanvas) {
            this._shadowCanvas = document.createElement('canvas');
            this._shadowCanvas.width = this.canvas.width;
            this._shadowCanvas.height = this.canvas.height;
        }
        return this._shadowCanvas;
    }

    _roundRect(c, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.arcTo(x + w, y, x + w, y + r, r);
        c.lineTo(x + w, y + h - r);
        c.arcTo(x + w, y + h, x + w - r, y + h, r);
        c.lineTo(x + r, y + h);
        c.arcTo(x, y + h, x, y + h - r, r);
        c.lineTo(x, y + r);
        c.arcTo(x, y, x + r, y, r);
    }

    destroy() {
        const gl = this.gl;
        gl.deleteProgram(this._program);
        gl.deleteBuffer(this._quadBuffer);
        gl.deleteBuffer(this._indexBuffer);
        gl.deleteTexture(this._texture);
    }
}
