# Floway Tools — New Effect Development Skill

## Overview

Floway Tools is a video effect tool platform. Each effect is a single HTML file that imports shared modules for recording, background, and UI. You only need to write the effect-specific rendering logic and parameter panel.

## Project Structure

```
floway-tools-v2/
├── shared/
│   ├── base.css          ← UI framework (sidebar, buttons, sliders, mobile responsive)
│   ├── recorder.js       ← Recording engine (MP4/WebM/PNG sequence, 25Mbps, 60fps)
│   ├── background.js     ← Background system (solid/grid/dots/transparent/media upload)
│   ├── utils.js          ← Utility functions (saveFile, lerp, hexToRgba, getLightness)
│   └── mp4-muxer.js      ← MP4 encoding library (local file, loaded via <script> tag)
├── effects/
│   ├── text-animator.html    ← Example: Canvas 2D text rendering with 2x supersampling
│   ├── stack-scan.html       ← Example: SVG rendering with rasterize-to-canvas export
│   ├── logo-matrix.html      ← Example: Canvas 2D with offscreen compositing for vignette mask
│   └── YOUR_EFFECT.html      ← Create this
└── index.html
```

## How to Create a New Effect

### Step 1: Create the HTML file

Create a new file at `effects/your-effect-name.html`.

### Step 2: Use this template

Copy this template as-is. The sections marked with `█ YOUR` are where you write your code. Everything else is fixed infrastructure — do NOT modify it.

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>YOUR EFFECT NAME</title>

    <!-- █ DO NOT change the order or content of these two script tags -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="../shared/mp4-muxer.js"></script>

    <!-- Shared UI CSS -->
    <link rel="stylesheet" href="../shared/base.css">

    <!-- Google Fonts — add fonts your effect needs -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=Orbitron:wght@900&display=swap" rel="stylesheet">

    <style>
        canvas {
            box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #333;
            background: #000; width: 100%; max-width: 1600px; aspect-ratio: 4/3; display: block;
        }
    </style>
</head>
<body>

    <div class="sidebar">
        <div class="sidebar-header">
            <div class="app-title">YOUR EFFECT NAME <span style="font-size:9px; color:#666">v1.0</span></div>
            <div class="version-badge">NEW</div>
        </div>

        <div class="controls-container">

            <!-- █ YOUR: Parameter panel — add sliders/selects/color pickers here -->
            <div class="control-group">
                <div class="group-title">🔧 效果参数</div>
                <!-- Example slider:
                <div class="row stack">
                    <div class="label-line"><span>参数名</span><span id="ParamNameVal">50</span></div>
                    <input type="range" id="ParamNameInput" min="0" max="100" step="1" value="50">
                </div>
                -->
                <!-- Example color picker:
                <div class="row">
                    <span style="font-size:12px; color:#aaa;">颜色名</span>
                    <input type="color" id="ColorInput" value="#00ffaa">
                </div>
                -->
            </div>

            <!-- █ DO NOT modify — Background controls -->
            <div class="control-group">
                <div class="group-title"><span>▩ 场景背景 (Background)</span></div>
                <div class="row">
                    <select id="BgMode">
                        <option value="transparent">🏁 透明 (Alpha)</option>
                        <option value="#000000">⬛ 纯黑 (Black)</option>
                        <option value="#00ff00">🟩 绿幕 (Green)</option>
                        <option value="#0000ff">🟦 蓝幕 (Blue)</option>
                        <option value="grid">▦ 科技网格 (Grid)</option>
                        <option value="dots">::: 矩阵点阵 (Dots)</option>
                        <option value="custom">📂 上传背景...</option>
                    </select>
                </div>
                <input type="file" id="BgUpload" accept="image/*,video/*" style="display:none">
                <div class="row" id="PatternColorRow" style="display:none; justify-content:space-between; align-items:center;">
                    <div style="font-size:11px; color:#aaa;">纹理颜色</div>
                    <input type="color" id="PatternColor" value="#333333">
                </div>
            </div>

            <!-- █ DO NOT modify — Export controls -->
            <div class="control-group" style="border-color:var(--danger)">
                <div class="group-title">🎥 导出格式 (Export)</div>
                <div class="row">
                    <select id="ExportFormat">
                        <option value="png_seq">📸 PNG 序列 (透明无损)</option>
                        <option value="mp4">🎥 MP4 (Baseline 25Mbps)</option>
                        <option value="webm">🌐 WebM (VP9 25Mbps)</option>
                    </select>
                </div>
                <div class="row" style="margin-top:10px;">
                    <button id="BtnRecord" class="btn btn-record" disabled>⌛ 连接组件...</button>
                </div>
                <div id="LibStatus" style="font-size:10px; color:#666; margin-top:5px; text-align:center;">
                    <span class='status-dot status-loading'></span>初始化...
                </div>
            </div>

        </div>
    </div>

    <div class="preview-area">
        <div id="RecIndicator"><div class="rec-dot"></div> RECORDING</div>
        <canvas id="mainCanvas"></canvas>
    </div>

    <script type="module">
        import { Recorder } from '../shared/recorder.js';
        import { Background } from '../shared/background.js';
        import { lerp, hexToRgba } from '../shared/utils.js';

        // ====== █ DO NOT modify: Canvas setup ======
        const BASE_W = 1600;
        const BASE_H = 1200;
        const SCALE = 2;  // 2x supersampling — preview stays same size, export is sharper
        const canvas = document.getElementById('mainCanvas');
        canvas.width = BASE_W * SCALE;
        canvas.height = BASE_H * SCALE;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: false });
        ctx.scale(SCALE, SCALE);

        // ====== █ YOUR: Parameter defaults ======
        const config = {
            // Define your parameters here with defaults
        };

        // ====== █ DO NOT modify: Shared modules ======
        let animStartTime = performance.now();

        const bg = new Background({
            modeSelectId: '#BgMode',
            uploadInputId: '#BgUpload',
            patternColorId: '#PatternColor',
            patternRowId: '#PatternColorRow',
            defaultMode: '#000000',
            defaultPatternColor: '#333333',
            baseWidth: BASE_W,
            baseHeight: BASE_H,
            scaleFactor: SCALE,
        });

        const recorder = new Recorder({
            canvas: canvas,
            onFrame: (timeMs) => {
                drawFrame(timeMs);
            },
            fileName: 'YourEffect',
            width: BASE_W * SCALE,
            height: BASE_H * SCALE,
        });

        // ====== █ YOUR: Rendering logic ======
        function drawFrame(timeMs) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            // Background: transparent + MP4/WebM → force black; otherwise draw bg
            if (recorder.format !== 'png_seq' && bg.mode === 'transparent') {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, BASE_W, BASE_H);
            }
            if (bg.mode !== 'transparent') {
                bg.draw(ctx, timeMs, recorder.isRecording, recorder.format);
            }

            // █ YOUR: Draw your effect here using ctx
            // All coordinates are in BASE_W × BASE_H space (1600 × 1200)
            // The SCALE transform is already applied, no need to multiply
        }

        // ====== █ DO NOT modify: Preview loop ======
        function previewLoop() {
            if (!recorder.isRecording) {
                const elapsed = performance.now() - animStartTime;
                drawFrame(elapsed);
            }
            requestAnimationFrame(previewLoop);
        }
        requestAnimationFrame(previewLoop);

        // ====== █ YOUR: UI bindings ======
        // Bind each slider/select to update config values
        // Example:
        // document.getElementById('ParamNameInput').addEventListener('input', e => {
        //     config.paramName = parseFloat(e.target.value);
        //     document.getElementById('ParamNameVal').innerText = e.target.value;
        // });
    </script>
</body>
</html>
```

### Step 3: Write your rendering logic

The `drawFrame(timeMs)` function is called for each frame.

- `timeMs` is in milliseconds
- All drawing coordinates are in `BASE_W × BASE_H` space (1600 × 1200). The 2x SCALE transform is already applied.
- **Never use `canvas.width` or `canvas.height` for drawing** — those are the physical pixel dimensions (3200 × 2400). Use `BASE_W` and `BASE_H` instead.
- Always call `ctx.save()` / `ctx.setTransform(1,0,0,1,0,0)` before `clearRect`, then `ctx.restore()` — this works correctly with the scale transform.

### Step 4: Bind UI controls

For each slider/select, add an `addEventListener('input', ...)` that updates `config` and optionally the value display element.

### Step 5: Add to index.html

Add a card link in `index.html` inside the `.grid-container` div.

## Shared Module API Reference

### Recorder

```javascript
import { Recorder } from '../shared/recorder.js';

const recorder = new Recorder({
    canvas: HTMLCanvasElement,
    onFrame: (timeMs) => void|Promise,  // Use async if SVG rasterize needed
    fileName: string,
    width: number,   // Use BASE_W * SCALE
    height: number,  // Use BASE_H * SCALE
});

recorder.isRecording  // boolean
recorder.format       // 'png_seq' | 'mp4' | 'webm' | undefined (before recording)
```

### Background

```javascript
import { Background } from '../shared/background.js';

const bg = new Background({
    modeSelectId: '#BgMode',
    uploadInputId: '#BgUpload',
    patternColorId: '#PatternColor',
    patternRowId: '#PatternColorRow',
    defaultMode: '#000000',
    defaultPatternColor: '#333333',
    baseWidth: BASE_W,
    baseHeight: BASE_H,
    scaleFactor: SCALE,  // Must match canvas scale
});

bg.mode    // Current background mode string
bg.draw(ctx, timestamp, isRecording, exportFormat)  // Draw background to canvas
```

### Utils

```javascript
import { saveFile, lerp, hexToRgba } from '../shared/utils.js';

lerp(0, 100, 0.5)        // → 50
hexToRgba('#ff0000', 0.5) // → 'rgba(255, 0, 0, 0.5)'
```

## UI Component Classes

| Class | Purpose |
|---|---|
| `.sidebar` | Left panel container |
| `.sidebar-header` | Header with title and version badge |
| `.controls-container` | Scrollable controls area |
| `.control-group` | Rounded card for a group of controls |
| `.group-title` | Group label with bottom border |
| `.row` | Horizontal flex row |
| `.row.stack` | Vertical stack (for label + slider pairs) |
| `.label-line` | Flex row with label left, value right (accent color, monospace) |
| `.btn-record` | Red record button |

## Critical Rules

1. **Script tags order**: `jszip.min.js` and `mp4-muxer.js` MUST be `<script>` tags in `<head>`, NOT ES module imports. The module script (`<script type="module">`) must come AFTER the canvas element in `<body>`.

2. **Canvas setup pattern**: Set `canvas.width/height` to `BASE * SCALE`, then `ctx.scale(SCALE, SCALE)`. All drawing uses BASE coordinates. For `clearRect`, use `ctx.save() → ctx.setTransform(1,0,0,1,0,0) → clearRect(canvas.width, canvas.height) → ctx.restore()`.

3. **Preview loop**: MUST use `if (!recorder.isRecording) { ... } requestAnimationFrame(previewLoop)` pattern. NEVER use `if (recorder.isRecording) return` — that kills the loop permanently.

4. **Background handling**: Always check `bg.mode` in drawFrame. For transparent mode + MP4/WebM, force black background. Call `bg.draw()` for non-transparent modes.

5. **recorder.format**: Before first recording starts, `recorder.format` is `undefined`, not a string. The transparent+black check (`recorder.format !== 'png_seq'`) still works correctly because `undefined !== 'png_seq'` is true.
