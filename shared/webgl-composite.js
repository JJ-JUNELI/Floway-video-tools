/**
 * Floway Tools — WebGL 3D 合成模块
 * 将 Canvas 2D 内容通过 WebGL 进行透视变换合成
 *
 * 使用方式：
 *   import { WebGLComposite } from './webgl-composite.js';
 *   const gl = new WebGLComposite(glCanvas, 1440, 1080);
 *   gl.render({
 *       bgCanvas, cardCanvas, rx, ry, perspective,
 *       elevation, cardScale, cardRadius,
 *       borderWidth, borderColor, glowWidth, glowColor, glowIntensity,
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

        this.gl.getExtension('OES_standard_derivatives');
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

        this._initShaders();
        this._initBuffers();
        this._initTextures();

        this._m0 = new Float32Array(16);
        this._m1 = new Float32Array(16);
        this._m2 = new Float32Array(16);
        this._m3 = new Float32Array(16);
        this._m4 = new Float32Array(16);
        this._m5 = new Float32Array(16);
        this._shadowCache = {};
    }

    // ========== 着色器 ==========

    _initShaders() {
        const gl = this.gl;

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

        // SDF 裁剪 + 外描边 + 边缘辉光，全部着色器内完成
        const fsSource = `
            #extension GL_OES_standard_derivatives : enable
            precision mediump float;

            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            uniform vec4 uBounds;
            uniform float uRadius;
            uniform vec2 uCardPixelSize;
            uniform float uIsCard;
            uniform float uAlpha;
            uniform float uBorderWidth;
            uniform vec3 uBorderColor;
            uniform float uGlowWidth;
            uniform vec3 uGlowColor;
            uniform float uGlowIntensity;

            float sdfRoundBox(vec2 p, vec2 b, float r) {
                vec2 d = abs(p) - b + r;
                return length(max(d, 0.0)) - r;
            }

            void main() {
                vec4 texColor = texture2D(uTexture, vTexCoord);

                if (uIsCard > 0.5) {
                    vec2 localPos = (vTexCoord - uBounds.xy) / uBounds.zw;
                    vec2 p = localPos - 0.5;
                    vec2 p_px = p * uCardPixelSize;
                    vec2 half_px = 0.5 * uCardPixelSize;
                    float d = sdfRoundBox(p_px, half_px, uRadius);
                    float aa = fwidth(d) * 1.5;

                    // 卡片内容：d < 0 可见
                    float clipMask = 1.0 - smoothstep(-aa, aa, d);

                    vec3 finalRGB = texColor.rgb;
                    float finalA = clipMask * texColor.a;

                    // 外描边：d ∈ [0, borderWidth]
                    if (uBorderWidth > 0.5) {
                        float inner = smoothstep(-aa, aa, d);
                        float outer = 1.0 - smoothstep(uBorderWidth - aa, uBorderWidth + aa, d);
                        float borderMask = inner * outer;
                        finalRGB = mix(finalRGB, uBorderColor, borderMask);
                        finalA = max(finalA, borderMask);
                    }

                    // 边缘辉光：指数衰减
                    if (uGlowWidth > 0.5) {
                        float glowAlpha = exp(-max(d, 0.0) / max(uGlowWidth, 0.1)) * uGlowIntensity;
                        float glowMask = glowAlpha * (1.0 - clipMask);
                        finalRGB = mix(finalRGB, uGlowColor, glowMask);
                        finalA = max(finalA, glowMask);
                    }

                    texColor = vec4(finalRGB, finalA * uAlpha);
                } else {
                    texColor.a *= uAlpha;
                }

                gl_FragColor = texColor;
            }
        `;

        this._program = this._createProgram(vsSource, fsSource);

        this._aPosition = gl.getAttribLocation(this._program, 'aPosition');
        this._aTexCoord = gl.getAttribLocation(this._program, 'aTexCoord');
        this._uMVP = gl.getUniformLocation(this._program, 'uMVP');
        this._uTexture = gl.getUniformLocation(this._program, 'uTexture');
        this._uBounds = gl.getUniformLocation(this._program, 'uBounds');
        this._uRadius = gl.getUniformLocation(this._program, 'uRadius');
        this._uCardPixelSize = gl.getUniformLocation(this._program, 'uCardPixelSize');
        this._uIsCard = gl.getUniformLocation(this._program, 'uIsCard');
        this._uAlpha = gl.getUniformLocation(this._program, 'uAlpha');
        this._uBorderWidth = gl.getUniformLocation(this._program, 'uBorderWidth');
        this._uBorderColor = gl.getUniformLocation(this._program, 'uBorderColor');
        this._uGlowWidth = gl.getUniformLocation(this._program, 'uGlowWidth');
        this._uGlowColor = gl.getUniformLocation(this._program, 'uGlowColor');
        this._uGlowIntensity = gl.getUniformLocation(this._program, 'uGlowIntensity');
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
        const quadData = new Float32Array([
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

    _buildCardMVP(rx, ry, perspective, cardScale, offsetX = 0, offsetY = 0, scaleX, scaleY) {
        const bw = this.baseWidth;
        const bh = this.baseHeight;
        const d = perspective / (bh / 2);
        const sx = (scaleX !== undefined) ? scaleX : cardScale;
        const sy = (scaleY !== undefined) ? scaleY : cardScale;
        const m = this._m0; m[0]=sx;m[5]=sy;m[10]=1;m[15]=1; m[1]=m[2]=m[3]=m[4]=m[6]=m[7]=m[8]=m[9]=m[11]=m[12]=m[13]=m[14]=0;
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

    _drawQuad(mvp, bounds, radius, isCard, alpha) {
        const gl = this.gl;
        gl.uniformMatrix4fv(this._uMVP, false, mvp);
        gl.uniform4f(this._uBounds, bounds.x, bounds.y, bounds.w, bounds.h);
        gl.uniform1f(this._uRadius, radius);
        gl.uniform1f(this._uIsCard, isCard);
        gl.uniform1f(this._uAlpha, alpha);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    _cacheChanged(cache, keys) {
        for (const k of keys) { if (cache[k[0]] !== k[1]) return true; }
        return false;
    }
    _cacheUpdate(cache, keys) {
        for (const k of keys) cache[k[0]] = k[1];
    }

    static hexToRGB(hex) {
        return [
            parseInt(hex.slice(1, 3), 16) / 255,
            parseInt(hex.slice(3, 5), 16) / 255,
            parseInt(hex.slice(5, 7), 16) / 255,
        ];
    }

    // ========== 主渲染接口 ==========

    render(opts) {
        const gl = this.gl;
        const bw = this.baseWidth;
        const bh = this.baseHeight;
        const cardScale = opts.cardScale || 0.8;
        const perspective = opts.perspective || 900;
        const elevation = opts.elevation || 0.5;
        const cardRadius = opts.cardRadius ?? 16;

        const cb = opts.cardBounds || { x: 0, y: 0, w: bw, h: bh };
        const normBounds = { x: cb.x / bw, y: cb.y / bh, w: cb.w / bw, h: cb.h / bh };

        const borderWidth = opts.borderWidth || 0;
        const glowWidth = opts.glowWidth || 0;
        const glowIntensity = opts.glowIntensity !== undefined ? opts.glowIntensity : 0.5;

        const offsetX = opts.offsetX || 0;
        const offsetY = opts.offsetY || 0;
        const cardAlpha = opts.cardAlpha !== undefined ? opts.cardAlpha : 1.0;

        // 计算效果所需的 padding（像素）
        const customPad = opts.effectPadding || 0;
        const effectPad = Math.ceil(Math.max(
            borderWidth > 0 ? borderWidth : 0,
            glowWidth > 0 ? glowWidth * 3 : 0,
            customPad
        )) + 2;

        // 给卡片内容加 padding：创建更大的画布，把原内容画在中心
        // 这样 quad 边缘和卡片内容边缘之间就有空间容纳描边/辉光
        let cardTexture = opts.cardCanvas;
        let cardNormBounds = normBounds;
        let effectiveScale = cardScale;
        let cardPixelW, cardPixelH;

        if (effectPad > 2 && opts.cardCanvas) {
            const srcW = opts.cardCanvas.width;
            const srcH = opts.cardCanvas.height;
            const sx = srcW / bw;
            const physPad = Math.ceil(effectPad * sx);

            const padW = srcW + physPad * 2;
            const padH = srcH + physPad * 2;

            const pc = this._getOffscreenCanvas('_paddedCanvas');
            if (pc.width !== padW || pc.height !== padH) {
                pc.width = padW;
                pc.height = padH;
            }
            const pctx = pc.getContext('2d');
            pctx.clearRect(0, 0, padW, padH);
            pctx.drawImage(opts.cardCanvas, physPad, physPad);

            cardTexture = pc;
            cardNormBounds = {
                x: (physPad + cb.x * sx) / padW,
                y: (physPad + cb.y * sx) / padH,
                w: cb.w * sx / padW,
                h: cb.h * sx / padH,
            };
            effectiveScale = cardScale * padW / srcW;
        }

        // SDF 像素尺寸 = 视觉卡片大小（不受 padding 影响）
        cardPixelW = cardScale * cb.w;
        cardPixelH = cardScale * cb.h;

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
        gl.uniform2f(this._uCardPixelSize, cardPixelW, cardPixelH);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // 描边/辉光 uniform
        gl.uniform1f(this._uBorderWidth, borderWidth);
        const bc = opts.borderColor ? WebGLComposite.hexToRGB(opts.borderColor) : [1, 1, 1];
        gl.uniform3f(this._uBorderColor, bc[0], bc[1], bc[2]);
        gl.uniform1f(this._uGlowWidth, glowWidth);
        const gc = opts.glowColor ? WebGLComposite.hexToRGB(opts.glowColor) : [0.23, 0.51, 0.96];
        gl.uniform3f(this._uGlowColor, gc[0], gc[1], gc[2]);
        gl.uniform1f(this._uGlowIntensity, glowIntensity);

        // === Pass 1: 背景 ===
        if (opts.bgCanvas) {
            this._uploadTexture(opts.bgCanvas);
            this._drawQuad(this._buildFullscreenMVP(), { x: 0, y: 0, w: 1, h: 1 }, 0, 0, 1.0);
        }

        // 背景 pass 用完 _m0，重建卡片 MVP
        const mvp = new Float32Array(this._buildCardMVP(
            opts.rx, opts.ry, perspective, effectiveScale, offsetX, offsetY, opts.scaleX, opts.scaleY
        ));

        // === Pass 2: 阴影（Canvas shadowBlur，用原始 normBounds 和原始 scale）===
        if (!opts.skipSDF) {
            const sc = this._shadowCache;
            const rCompensated = cardRadius / cardScale;
            const keys = [
                ['rx', opts.rx], ['ry', opts.ry], ['perspective', perspective],
                ['cardScale', cardScale], ['elevation', elevation], ['cardRadius', cardRadius],
                ['_cbx', cb.x], ['_cby', cb.y], ['_cbw', cb.w], ['_cbh', cb.h],
            ];
            if (this._cacheChanged(sc, keys)) {
                const c = this._getOffscreenCanvas('_shadowCanvas');
                const ctx = c.getContext('2d');
                ctx.clearRect(0, 0, c.width, c.height);
                const sy = 4 + elevation * 36;
                const sb = 12 + elevation * 44;
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(c.width / bw, c.height / bh);
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = sy * 0.6;
                ctx.shadowBlur = sb * 0.5;
                ctx.shadowColor = 'rgba(0,0,0,' + (0.05 + elevation * 0.10) + ')';
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                this._roundRect(ctx, cb.x, cb.y, cb.w, cb.h, rCompensated);
                ctx.fill();
                ctx.restore();
                this._cacheUpdate(sc, keys);
            }

            // 阴影用原始 MVP + 原始 normBounds（阴影 canvas 没有 padding）
            const shadowMVP = new Float32Array(this._buildCardMVP(
                opts.rx, opts.ry, perspective, cardScale, offsetX, offsetY, opts.scaleX, opts.scaleY
            ));
            this._uploadTexture(this._getOffscreenCanvas('_shadowCanvas'));
            this._drawQuad(shadowMVP, normBounds, 0, 0, 0.6 * cardAlpha);
        }

        // === Pass 3: 卡片内容（SDF 裁剪 + 描边 + 辉光）===
        if (cardTexture) {
            this._uploadTexture(cardTexture);
            this._drawQuad(mvp, cardNormBounds, cardRadius, opts.skipSDF ? 0 : 1.0, cardAlpha);
        }
    }

    _getOffscreenCanvas(key) {
        if (!this[key]) {
            this[key] = document.createElement('canvas');
            this[key].width = this.canvas.width;
            this[key].height = this.canvas.height;
        }
        return this[key];
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
