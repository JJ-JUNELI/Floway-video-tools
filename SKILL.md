# Floway Tools — New Effect Development Skill

## Overview

Floway Tools is a video effect tool platform. Each effect is a single HTML file that imports shared modules for recording, background, and UI. You only need to write the effect-specific rendering logic and parameter panel.

## Project Structure

```
floway-tools-v2/
├── shared/
│   ├── base.css          ← UI framework (sidebar, buttons, sliders, mobile responsive)
│   ├── recorder.js       ← Recording engine (MP4/WebM/PNG sequence, 25Mbps, 60fps)
│   ├── background.js     ← Background system (Canvas + SVG output targets)
│   ├── svg-renderer.js   ← SVG→Canvas rasterization pipeline (for SVG effects)
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

            <!-- █ DO NOT write Background/Export panel HTML — auto-injected by initEffect() -->
            <div id="shared-controls-placeholder"></div>

        </div>
    </div>

    <div class="preview-area">
        <div id="RecIndicator"><div class="rec-dot"></div> RECORDING</div>
        <canvas id="mainCanvas" class="effect-canvas"></canvas>

    <script type="module">
        import { initEffect } from '../shared/controls.js';
        import { initEffect } from '../shared/controls.js';

        // ====== █ DO NOT modify: Init ======
        const { ctx, baseWidth, baseHeight, clearFrame, drawBg, startPreviewLoop, lerp, hexToRgba } = initEffect({
            canvasId: 'mainCanvas',
            fileName: 'YourEffect',
        });

        // ====== █ YOUR: Parameter defaults ======
        const config = {
            // Define your parameters here with defaults
        };

        // ====== █ YOUR: Rendering logic ======
        function drawFrame(timeMs) {
            clearFrame();
            drawBg(timeMs);
            // █ YOUR: Draw your effect here using ctx
            // All coordinates are in baseWidth × baseHeight space (1600 × 1200)
            // The SCALE transform is already applied, no need to multiply
        }

        // ====== Start preview ======
        startPreviewLoop(drawFrame);

        // ====== █ YOUR: UI bindings ======
        // Bind each slider/select to update config values
        // Example:
        // document.getElementById('ParamNameInput').addEventListener('input', e => {
        //     config.paramName = parseFloat(e.target.value);
        //     document.getElementById('ParamNameVal').innerText = e.target.value;
        // });
    </script>
```

### Step 3: Write your rendering logic

The `drawFrame(timeMs)` function is called for each frame.

- `timeMs` is in milliseconds
- All drawing coordinates are in `baseWidth × baseHeight` space (default 1600 × 1200). The 2x SCALE transform is already applied.
- **Never use `canvas.width` or `canvas.height` for drawing** — those are the physical pixel dimensions (3200 × 2400). Use `baseWidth` and `baseHeight` instead.
- `clearFrame()` and `drawBg(timeMs)` handle clearing and background automatically — no need to manually clearRect or save/restore.

### Step 4: Bind UI controls

For each slider/select, add an `addEventListener('input', ...)` that updates `config` and optionally the value display element.

### Step 5: Add to index.html

Add a card link in `index.html` inside the `.grid-container` div.

## initEffect() Return Value

```javascript
const { ctx, canvas, bg, recorder, baseWidth, baseHeight, scale,
        clearFrame, drawBg, startPreviewLoop, resetAnimStart } = initEffect({
    canvasId: 'mainCanvas',    // Canvas 元素 ID
    fileName: 'EffectName',    // 导出文件名
    // 可选：
    // baseWidth: 1600,  baseHeight: 1200,  scale: 2,
    // defaultBgMode: '#000000',  defaultPatternColor: '#333333',
    // useRealtimeWebm: false,  useRafForFrames: false,
    // useManualWebmFrames: false,  encodeQueueMax: 2,
});
```

| 返回值 | 说明 |
|---|---|
| `ctx` | 2D 渲染上下文（已应用 scale） |
| `canvas` | Canvas 元素 |
| `bg` | Background 实例（一般不需要直接用） |
| `recorder` | Recorder 实例（一般不需要直接用） |
| `baseWidth` | 逻辑宽度（默认 1600） |
| `baseHeight` | 逻辑高度（默认 1200） |
| `scale` | 超采样倍率（默认 2） |
| `clearFrame()` | 清屏（正确处理 scale 变换） |
| `drawBg(timeMs)` | 绘制背景（自动处理透明+非 PNG 的黑色填充） |
| `startPreviewLoop(drawFn)` | 启动预览循环，drawFn = (timeMs) => void |
| `resetAnimStart()` | 重置动画起始时间 |

### 可选录制参数

| 参数 | 默认值 | 适用场景 |
|---|---|---|
| `useRealtimeWebm` | `false` | Logo 矩阵（实时 RAF 驱动） |
| `useRafForFrames` | `false` | Logo 矩阵（配合 useRealtimeWebm） |
| `useManualWebmFrames` | `false` | 堆叠扫描（captureStream(0) + requestFrame） |
| `encodeQueueMax` | `2` | 帧编码队列上限 |

大多数新效果不需要传这些参数，默认值即可。

## SVG Effects (Advanced)

Most effects use Canvas rendering. Use SVG pipeline when you need SVG features (SVG filters, text styling).

Key differences from Canvas effects:
- No `initEffect()` — use `Background` + `SvgRenderer` + `Recorder` directly
- Preview: manipulate SVG DOM elements directly, browser renders automatically
- Export: `SvgRenderer` serializes SVG → Image → hidden Canvas → Recorder captures that canvas
- `onFrame` must be `async` because `svgRenderer.rasterize()` returns a Promise

```javascript
import { Recorder } from '../shared/recorder.js';
import { Background } from '../shared/background.js';
import { SvgRenderer } from '../shared/svg-renderer.js';
import { injectPanels } from '../shared/controls.js';

injectPanels({ defaultBgMode: 'transparent' });

const bg = new Background({
    modeSelectId: '#BgMode', uploadInputId: '#BgUpload',
    patternColorId: '#PatternColor', patternRowId: '#PatternColorRow',
    defaultMode: 'transparent', baseWidth: 1600, baseHeight: 1200, scaleFactor: 1,
    svgTargets: {
        bgRect: document.getElementById('svgBg'),
        patternEl: document.getElementById('bgPattern'),
    },
});

const svgRenderer = new SvgRenderer(svg, 1600, 1200);

const recorder = new Recorder({
    canvas: svgRenderer.exportCanvas,
    onFrame: async (timeMs) => {
        updateSVG(timeMs);
        svgRenderer.drawBackground(bg, recorder.format);
        await svgRenderer.rasterize();
    },
    fileName: 'SvgEffect', width: 1600, height: 1200,
});
```

SVG HTML structure must include: `<rect id="svgBg">` for background and `<pattern id="bgPattern">` for grid/dots textures. Background sync is handled automatically via `svgTargets`.

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

1. **Script tags order**: `jszip.min.js` 和 `mp4-muxer.js` MUST be `<script>` tags in `<head>`, NOT ES module imports. The module script (`<script type="module">`) must come AFTER the canvas element in `<body>`.

2. **Don't write panel HTML**: Background and export panels are auto-injected by `initEffect()`. Just put `<div id="shared-controls-placeholder"></div>` in your sidebar.

3. **Don't insert statements before function declarations**: In ES modules, `function` declarations are NOT hoisted to top. Inserting `console.log()` or other statements between them will break the code.

4. **Use `baseWidth` / `baseHeight`, not `canvas.width` / `canvas.height`**: The physical canvas is 3200×2400 (2x supersampled). All drawing coordinates should use the logical dimensions (1600×1200).
