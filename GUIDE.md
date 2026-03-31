# Floway Tools — AI 效果生成指引

> **本文档是自包含的。** 把本文档和用户的自然语言需求一起发给 AI，AI 即可生成一个可直接运行的效果文件。

---

## AI 的工作流程

```
用户描述需求 → AI 读取本文档 → AI 输出一个 HTML 文件 → 用户保存到 effects/ 目录 → 完成
```

**你不需要：**
- 了解项目架构
- 修改 shared/ 下的任何文件
- 解释代码怎么对接
- 做任何额外配置

**你只需要：**
- 描述你要什么效果
- 把 AI 输出的 HTML 文件保存到 `effects/` 目录
- 在 `index.html` 的 `.grid-container` 里加一个卡片链接

---

## 项目结构

```
floway-tools-v2/
├── shared/              ← 共享模块，不需要修改
│   ├── base.css         ← UI 样式框架
│   ├── recorder.js      ← 录制引擎（MP4/WebM/PNG）
│   ├── background.js    ← 背景系统（支持 Canvas 和 SVG 两种输出目标）
│   ├── controls.js      ← 一行初始化：Canvas/Background/Recorder/面板/预览循环
│   ├── svg-renderer.js  ← SVG 渲染管线：SVG→Canvas 序列化（SVG 效果用）
│   ├── utils.js         ← 工具函数（lerp, hexToRgba 等）
│   └── mp4-muxer.js     ← MP4 编码库
├── effects/             ← 效果文件目录
│   ├── text-animator.html
│   ├── stack-scan.html
│   ├── logo-matrix.html
│   ├── particle-field.html   ← 参考实例
│   └── [新效果].html         ← AI 生成的文件放这里
└── index.html          ← 导航页（需要手动加卡片链接）
```

---

## 效果文件模板

每个效果是一个**完整的单文件 HTML**。背景面板和导出面板由 `shared/controls.js` 自动注入，**你不需要写也不应该修改它们**。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>效果名称</title>

    <!-- 固定加载顺序，不要改 -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="../shared/mp4-muxer.js"></script>
    <link rel="stylesheet" href="../shared/base.css">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap" rel="stylesheet">

    <style>
        canvas {
            box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #333;
            background: #000; width: 100%; max-width: 1440px; aspect-ratio: 4/3; display: block;
        }
    </style>
</head>
<body>

    <div class="sidebar">
        <div class="sidebar-header">
            <div class="app-title">效果名称 <span style="font-size:9px; color:#666">v1.0</span></div>
            <div class="version-badge">NEW</div>
        </div>

        <div class="controls-container">

            <!-- ★ 在这里写你的参数面板 ★ -->
            <div class="control-group">
                <div class="group-title">🔧 效果参数</div>
                <!-- 加滑块、颜色选择器、下拉菜单 -->
            </div>

            <!-- 背景和导出面板自动注入，不要写也不要改 -->
            <div id="shared-controls-placeholder"></div>

        </div>
    </div>

    <div class="preview-area">
        <div id="RecIndicator"><div class="rec-dot"></div> RECORDING</div>
        <canvas id="mainCanvas" class="effect-canvas"></canvas>
    </div>

    <script type="module">
        import { lerp, hexToRgba } from '../shared/utils.js';
        import { initEffect } from '../shared/controls.js';

        // ====== 初始化（固定写法，不要改）======
        const { ctx, baseWidth, baseHeight, clearFrame, drawBg, startPreviewLoop } = initEffect({
            canvasId: 'mainCanvas',
            fileName: 'EffectName',
        });

        // ====== 参数默认值 ======
        const config = {
            // 在这里定义你的参数
        };

        // ====== 渲染函数（核心）======
        function drawFrame(timeMs) {
            clearFrame();
            drawBg(timeMs);
            // ★ 在这里写你的渲染逻辑 ★
        }

        // ====== 启动预览 ======
        startPreviewLoop(drawFrame);

        // ====== UI 绑定 ======
        // 示例：
        // document.getElementById('SpeedInput').addEventListener('input', e => {
        //     config.speed = parseFloat(e.target.value);
        //     document.getElementById('SpeedVal').innerText = e.target.value;
        // });
    </script>

---

## 参数面板 UI 组件

所有样式由 `shared/base.css` 提供，直接用对应的 class：

### 滑块（带数值显示）
```html
<div class="row stack">
    <div class="label-line"><span>参数名</span><span id="ParamVal">50</span></div>
    <input type="range" id="ParamInput" min="0" max="100" step="1" value="50">
</div>
```

### 颜色选择器
```html
<div class="row">
    <span style="font-size:12px; color:#aaa;">颜色名</span>
    <input type="color" id="ColorInput" value="#00ffaa">
</div>
```

### 下拉选择
```html
<div class="row">
    <select id="StyleInput" style="flex:1">
        <option value="style1">样式一</option>
        <option value="style2">样式二</option>
    </select>
</div>
```

### 开关
```html
<div class="sub-title">
    <span>功能名</span>
    <input type="checkbox" id="ToggleInput" checked>
</div>
```

---

## 严格规则（违反会导致效果无法运行）

| # | 规则 | 原因 |
|---|---|---|
| 1 | `jszip.min.js` 和 `mp4-muxer.js` 用 `<script>` 标签加载，**不要用 ES module import** | mp4-muxer.js 不是 ESM 格式，import 会导致整个脚本崩溃 |
| 2 | **不要写背景面板和导出面板的 HTML**，用 `<div id="shared-controls-placeholder"></div>` 代替 | 面板由 `initEffect()` 自动注入，手动写会引入不一致 |
| 3 | 不要在函数声明前后插入 console.log 或其他语句 | ES module 中 function 声明不是 hoisted 到顶部的，会被语句打断 |
| 4 | 绘制坐标用 `baseWidth` / `baseHeight`（默认 1440/1080），**不要用** `canvas.width` / `canvas.height` | canvas 实际尺寸是 2880×2160，用了会画到画布外 |
---

## 可用工具函数

所有工具函数通过 `initEffect()` 返回，**无需单独 import**。在解构时按需取用：

```javascript
const { ctx, baseWidth, baseHeight, clearFrame, drawBg, startPreviewLoop,
        lerp, clamp, hexToRgba, getLightness,
        easeOutCubic, getEasing,
        loadFont, drawMediaContain,
        createLinearGradient, createRadialGradient,
        drawTextCentered, drawTextWrapped } = initEffect({
    canvasId: 'mainCanvas',
    fileName: 'EffectName',
});
```

### 数学

| 函数 | 说明 | 示例 |
|---|---|---|
| `lerp(s, e, t)` | 线性插值 | `lerp(0, 100, 0.5)` → `50` |
| `clamp(v, min, max)` | 值域限制 | `clamp(150, 0, 100)` → `100` |

### 颜色

| 函数 | 说明 | 示例 |
|---|---|---|
| `hexToRgba(hex, alpha)` | HEX 转 rgba 字符串 | `hexToRgba('#ff0000', 0.5)` → `'rgba(255, 0, 0, 0.5)'` |
| `hexToRgbaStr(hex, alpha)` | 同上（别名） | 同 `hexToRgba` |
| `getLightness(hex)` | 获取颜色明度 0~1 | `getLightness('#ffffff')` → `1` |

### 渐变

| 函数 | 说明 |
|---|---|
| `createLinearGradient(ctx, x0, y0, x1, y1, stops)` | 创建线性渐变，stops = `[{pos: 0, color: '#000'}, {pos: 1, color: '#fff'}]` |
| `createRadialGradient(ctx, x, y, r0, r1, stops)` | 创建径向渐变，stops 同上 |

```javascript
// 用法示例：渐变背景
const grad = createLinearGradient(ctx, 0, 0, baseWidth, baseHeight, [
    { pos: 0, color: '#1a1a2e' },
    { pos: 1, color: '#16213e' },
]);
ctx.fillStyle = grad;
ctx.fillRect(0, 0, baseWidth, baseHeight);
```

### 缓动函数

| 函数 | 说明 |
|---|---|
| `easeLinear(t)` | 匀速 |
| `easeInCubic(t)` | 缓入（慢→快） |
| `easeOutCubic(t)` | 缓出（快→慢） |
| `easeInOutCubic(t)` | 缓入缓出 |
| `easeOutQuart(t)` | 强缓出 |
| `easeOutExpo(t)` | 指数缓出 |
| `easeInOutCubicSmooth(t)` | 平滑缓入缓出（同 easeInOutCubic） |
| `getEasing(name)` | 按名称查找，`name` = `'linear'` / `'easeIn'` / `'easeOut'` / `'easeInOut'` / `'easeOutQuart'` / `'easeOutExpo'` / `'smooth'` |

```javascript
// 用法示例 1：直接使用
const progress = easeOutCubic(t);

// 用法示例 2：配合下拉菜单动态选择
const easing = getEasing(config.easingType);
const progress = easing(normalizedTime);
```

### 字体

| 函数 | 说明 |
|---|---|
| `loadFont(file, familyName?)` | 加载字体文件 (.ttf/.otf/.woff/.woff2)，返回 CSS font-family 字符串 |

```javascript
// 用法示例：配合文件上传
document.getElementById('FontUpload').addEventListener('change', async e => {
    const fontStr = await loadFont(e.target.files[0], 'MyFont');
    config.fontFamily = fontStr; // '"MyFont", sans-serif'
});
```

### Canvas 辅助

| 函数 | 说明 |
|---|---|
| `drawMediaContain(ctx, media, w, h, scaleFactor?)` | 图片/视频 contain 模式铺满画布（保持比例，居中裁切） |

```javascript
// 用法示例：绘制背景视频
drawMediaContain(ctx, videoElement, baseWidth, baseHeight, scale);
```

### 文字排版

| 函数 | 说明 |
|---|---|
| `drawTextCentered(ctx, text, x, y, font?, color?, align?, maxWidth?)` | 居中绘制文字，超宽自动截断加省略号 |
| `drawTextWrapped(ctx, text, x, y, maxWidth, lineHeight?)` | 自动换行绘制文字，返回总行高 |

```javascript
// 用法示例：标题居中
drawTextCentered(ctx, 'Hello World', baseWidth / 2, 100,
    '700 48px "Noto Sans SC", sans-serif', '#ffffff');

// 用法示例：多行文字自动换行
const totalHeight = drawTextWrapped(ctx, longText, 100, 200,
    baseWidth - 200, 1.5);
```

---

## Canvas 绘制要点

- 画布逻辑尺寸：**1440 × 1080**（4:3 比例）
- 实际像素：2880 × 2160（2x 超采样，导出更清晰）
- 预览显示大小由 CSS 控制，跟逻辑尺寸一致
- `ctx.scale(SCALE, SCALE)` 已设置，所有绘制用逻辑坐标
- 每帧必须先清屏再画，不要依赖上帧残留

---

---

## SVG 效果（高级）

大多数效果用 Canvas 渲染即可。如果你的效果需要 SVG 特性（如 SVG 滤镜描边、SVG 文字渲染），使用以下模式：

**关键区别：** SVG 效果在预览时直接操作 SVG DOM 元素，导出时通过 `SvgRenderer` 将 SVG 序列化为 Image 再绘制到隐藏 Canvas。

```html
<!-- SVG 根元素，包含 SVG 背景和内容 -->
<svg id="mainSvg" width="1440" height="1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <pattern id="bgPattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse"></pattern>
    </defs>
    <rect id="svgBg" width="100%" height="100%" fill="transparent"/>
    <g id="contentGroup">
        <!-- ★ 在这里画你的 SVG 内容 ★ -->
    </g>
</svg>
```

```javascript
import { Recorder } from '../shared/recorder.js';
import { Background } from '../shared/background.js';
import { SvgRenderer } from '../shared/svg-renderer.js';
import { injectPanels } from '../shared/controls.js';

injectPanels({ defaultBgMode: 'transparent' });

const svg = document.getElementById('mainSvg');

const bg = new Background({
    modeSelectId: '#BgMode',
    uploadInputId: '#BgUpload',
    patternColorId: '#PatternColor',
    patternRowId: '#PatternColorRow',
    defaultMode: 'transparent',
    baseWidth: 1440, baseHeight: 1080, scaleFactor: 2,
    svgTargets: {
        bgRect: document.getElementById('svgBg'),
        patternEl: document.getElementById('bgPattern'),
    },
});

const svgRenderer = new SvgRenderer(svg, 1440, 1080);

const recorder = new Recorder({
    canvas: svgRenderer.exportCanvas,
    onFrame: async (timeMs) => {
        updateSVG(timeMs);                             // 你的 SVG 更新逻辑
        svgRenderer.drawBackground(bg, recorder.format); // 背景画到底层
        await svgRenderer.rasterize();                  // SVG→Canvas 序列化
    },
    fileName: 'SvgEffect', width: 1440, height: 1080,
});

function updateSVG(timeOverride = null) {
    // ★ 在这里操作 SVG DOM 元素 ★
}
```

**注意事项：**
- SVG 效果的 `onFrame` 必须是 `async`，因为 `svgRenderer.rasterize()` 返回 Promise
- 背景由 `svgTargets` 自动同步到 SVG 元素，**不需要手动操作** `svgBg` 或 `bgPattern`
- 导出 Canvas 由 `SvgRenderer` 管理，**不需要手动创建** `<canvas id="exportCanvas">`

## 导出格式

用户可以在 UI 上选择，AI 不需要处理：

| 格式 | 特点 |
|---|---|
| PNG 序列 | 透明背景，无损，ZIP 下载 |
| MP4 | H.264 Baseline 25Mbps，60fps，帧同步渲染 |
| WebM | VP9 25Mbps，实时流式录制 |
