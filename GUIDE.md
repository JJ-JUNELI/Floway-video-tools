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
│   ├── utils.js         ← 工具函数（lerp, hexToRgba, bindUI 等）
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

### 模板 A（推荐）：Canvas 最简模式 — onRender

**大多数新效果用这个写法**，只需关注业务逻辑，框架自动处理 clearFrame/drawBg/预览循环。

```html
<!-- HTML 部分与下方「完整模式」相同，这里只展示 JS 核心差异 -->
<script type="module">
    import { initEffect } from '../shared/controls.js';

    const { ctx, baseWidth, baseHeight, bindUI, initFontSelector,
            lerp, hexToRgba } = initEffect({
        canvasId: 'mainCanvas',
        fileName: 'MyEffect',
        defaultBgMode: '#000000',
        // ★ 核心：只写渲染逻辑，clearFrame + drawBg 自动处理 ★
        onRender(t) {
            const progress = Math.min(t / 2000, 1);   // 2 秒动画
            const alpha = lerp(0, 1, progress);
            ctx.fillStyle = hexToRgba('#00ffaa', alpha);
            ctx.beginPath();
            ctx.arc(baseWidth / 2, baseHeight / 2, 100, 0, Math.PI * 2);
            ctx.fill();
        },
    });

    const config = { size: 50, color: '#00ffaa' };

    // UI 绑定
    bindUI(config, [
        ['SizeInput', 'size', 'int', 'SizeVal'],
        ['ColorInput', 'color'],
    ], { onChange: () => { /* reRender() 由框架管理 */ } });

    // 字体选择器（一行搞定）
    initFontSelector({ mountId: 'FontMount', configKey: 'fontFamily', config });
</script>
```

**onRender 模式要点：**
- `onRender(t)` 只接收时间参数，`clearFrame()` 和 `drawBg(t)` 已自动调用
- `startPreviewLoop()` 自动启动，不需要手动调用
- 返回的 `reRender()` 等同于 `resetAnimStart()`，用于重播动画
- 如果需要 hold 终态（播完停在最后一帧），加 `loopOpts: { duration: 2, hold: true }`

---

### 模板 A（完整模式）：Canvas 效果 — 手动控制预览循环

如果效果需要更复杂的动画状态管理（如 text-animator 的播放/暂停），使用此模式。

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

                <!-- 示例：滑块 -->
                <div class="row stack">
                    <div class="label-line"><span>大小</span><span id="SizeVal">50</span></div>
                    <input type="range" id="SizeInput" min="0" max="100" step="1" value="50">
                </div>

                <!-- 示例：颜色 -->
                <div class="row">
                    <span style="font-size:12px; color:#aaa;">主颜色</span>
                    <input type="color" id="ColorInput" value="#00ffaa">
                </div>

                <!-- 示例：开关 -->
                <div class="sub-title">
                    <span>启用辉光</span>
                    <input type="checkbox" id="GlowToggle" checked>
                </div>

                <!-- 字体选择器（三步注入） -->
                <div class="row">
                    <span style="font-size:12px; color:#aaa;">字体</span>
                </div>
                <div id="FontMount" style="width:100%"></div>
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
        import { initEffect } from '../shared/controls.js';

        // ====== 初始化（固定写法）======
        const { ctx, canvas, bg, recorder, baseWidth, baseHeight, scale,
                clearFrame, drawBg, startPreviewLoop, resetAnimStart,
                lerp, clamp, hexToRgba, getLightness,
                easeOutCubic, getEasing,
                loadFont, setupFontSelector, FONT_LIST, fontSelectHTML,
                drawMediaContain, bindUI,
                createLinearGradient, createRadialGradient,
                drawTextCentered, drawTextWrapped } = initEffect({
            canvasId: 'mainCanvas',
            fileName: 'EffectName',
            defaultBgMode: '#000000',
            defaultPatternColor: '#333333',
            onFrame: drawFrame,  // 录制时的帧回调，必须指向你的渲染函数
        });

        // ====== 参数默认值 ======
        const config = {
            size: 50,
            color: '#00ffaa',
            glowEnabled: true,
            fontFamily: 'Orbitron',
        };

        // ====== 注入字体选择器 ======
        document.getElementById('FontMount').innerHTML = fontSelectHTML('FontSelect', config.fontFamily);
        setupFontSelector({
            selectId: 'FontSelect',
            configKey: 'fontFamily',
            fileInputId: 'FontSelectUpload',
            config,
        });

        // ====== UI 绑定（批量）======
        bindUI(config, [
            ['SizeInput',     'size',        'int',   'SizeVal'],
            ['ColorInput',    'color'],
            ['GlowToggle',    'glowEnabled',  'checked'],
        ], {
            onChange: () => {
                // 参数变化后需要重绘时调用 resetAnimStart()
                resetAnimStart();
            }
        });

        // ====== 渲染函数（核心）======
        function drawFrame(timeMs) {
            clearFrame();
            drawBg(timeMs);
            // ★ 在这里写你的渲染逻辑 ★
            // 所有坐标使用 baseWidth / baseHeight（1440 / 1080）
        }

        // ====== 启动预览 ======
        startPreviewLoop(drawFrame);
    </script>
```

### 模板 B：SVG 效果（需要 SVG 滤镜/特殊文字渲染时用）

大多数效果用 **模板 A（Canvas）** 即可。如果你的效果需要 SVG 特性（如 SVG 滤镜描边、SVG 文字渲染），使用以下模式：

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
import { injectPanels, bindUI } from '../shared/controls.js';
import { getEasing, setupFontSelector, fontSelectHTML } from '../shared/utils.js';

// 注入共享面板（背景 + 导出）
injectPanels({ defaultBgMode: 'transparent' });

const baseWidth = 1440, baseHeight = 1080, scale = 2;

// 创建背景系统（绑定到 SVG 元素）
const bg = new Background({
    modeSelectId: '#BgMode',
    uploadInputId: '#BgUpload',
    patternColorId: '#PatternColor',
    patternRowId: '#PatternColorRow',
    defaultMode: 'transparent',
    defaultPatternColor: '#222222',
    baseWidth, baseHeight, scaleFactor: scale,
    svgTargets: {
        bgRect: document.getElementById('svgBg'),
        patternEl: document.getElementById('bgPattern'),
    },
});

// 创建 SVG 渲染器
const svgRenderer = new SvgRenderer(document.getElementById('mainSvg'), baseWidth, baseHeight);

// 创建录制器
const recorder = new Recorder({
    canvas: svgRenderer.exportCanvas,
    onFrame: async (timeMs) => {
        updateSVG(timeMs);                             // 你的 SVG 更新逻辑
        svgRenderer.drawBackground(bg, recorder.format); // 背景画到底层
        await svgRenderer.rasterize();                  // SVG→Canvas 序列化
    },
    fileName: 'SvgEffect', width: baseWidth * scale, height: baseHeight * scale,
    useManualWebmFrames: true,
});

function updateSVG(timeOverride = null) {
    // ★ 在这里操作 SVG DOM 元素 ★
}
```

**SVG 效果注意事项：**
- `onFrame` 必须是 `async`，因为 `svgRenderer.rasterize()` 返回 Promise
- 背景由 `svgTargets` 自动同步到 SVG 元素，**不需要手动操作** `svgBg` 或 `bgPattern`
- 导出 Canvas 由 `SvgRenderer` 管理，**不需要手动创建** `<canvas id="exportCanvas">`
- UI 绑定同样使用 `bindUI()`，从 utils.js 单独导入

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

## `bindUI()` — 批量 UI 绑定

**不要手写 addEventListener！** 用 `bindUI()` 一行绑定所有控件。

### 函数签名

```javascript
const { readAll } = bindUI(config, rules, options);
```

### 参数说明

| 参数 | 类型 | 说明 |
|---|---|---|
| `config` | Object | 你的参数对象，bindUI 会自动读写其中的属性 |
| `rules` | Array | 绑定规则数组，每条规则格式见下表 |
| `options` | Object | 可选，`{ onChange: function }` 回调 |

### 规则格式

每条规则是一个数组：`[elemId, configKey, transform?, displayId?, suffix?]`

| 位置 | 名称 | 说明 | 示例 |
|---|---|---|---|
| 0 | `elemId` | 控件 DOM 元素 ID | `'SpeedInput'` |
| 1 | `configKey` | config 对应的属性名 | `'speed'` |
| 2 | `transform` | 值转换类型（可选） | 见下方列表 |
| 3 | `displayId` | 数值显示元素的 ID（可选） | `'SpeedVal'` |
| 4 | `suffix` | 显示值的后缀（可选） | `'s'`, `'%'` |

### transform 类型

| 值 | 作用 | 示例 |
|---|---|---|
| `'int'` | 转为整数 | `"3.7"` → `3` |
| `'float'` | 转为浮点数 | `"3.7"` → `3.7` |
| `'%'` | 转为 0~1 小数 | `"50"` → `0.5` |
| `'checked'` | 读取 checkbox 状态 | `true` / `false` |
| 函数 | 自定义转换 | `(v) => v.toUpperCase()` |
| 省略 | 保持原字符串 | `"hello"` → `"hello"` |

### 完整示例

```javascript
bindUI(config, [
    // 滑块 → int + 实时显示数值
    ['FontSizeInput', 'fontSize', 'int', 'FontSizeVal'],
    // 颜色选择器 → 直接存字符串
    ['GradColor1', 'gradColor1'],
    // 百分比滑块 → 转为小数 + 显示带 % 后缀
    ['OpacityInput', 'opacity', '%', 'OpacityVal', '%'],
    // 开关 → 读取 checked 状态
    ['GlowToggle', 'glowEnabled', 'checked'],
    // 浮点数 + 带 s 后缀显示
    ['DurationInput', 'duration', 'float', 'DurVal', 's'],
    // 下拉菜单 → 直接存字符串
    ['EasingSelect', 'easingType'],
], {
    onChange: (val, key, elemId) => {
        // 任一控件变化时触发
        // val: 当前值, key: config 属性名, elemId: 控件 ID
        resetAnimStart();  // 重置动画时间让预览即时更新
    }
});

// 手动读取所有控件值（用于初始化或强制刷新）
// readAll();
```

### 返回值

返回 `{ readAll }` — 调用 `readAll()` 可强制从所有 DOM 控件重新读取值到 config。

---

## 字体选择器

字体选择器分三步设置。它提供预设字体列表 + 上传自定义字体功能。

### 第一步：在 HTML 中放置容器

```html
<div class="row">
    <span style="font-size:12px; color:#aaa;">字体</span>
</div>
<div id="FontMount" style="width:100%"></div>
```

### 第二步：注入 HTML

```javascript
document.getElementById('FontMount').innerHTML = fontSelectHTML('FontSelect', config.fontFamily);
```

`fontSelectHTML(selectId, selectedValue)` 返回一个包含 `<select>` + 隐藏 `<input type="file">` 的 HTML 字符串。

### 第三步：初始化交互

```javascript
setupFontSelector({
    selectId: 'FontSelect',          // select 元素 ID
    configKey: 'fontFamily',         // config 中存储字体值的属性名
    fileInputId: 'FontSelectUpload', // 隐藏的 file input ID（自动生成）
    weightInputId: 'WeightInput',    // 可选：字重 input ID，上传自定义字体时自动禁用
    config,                          // 你的参数对象
});
```

用户操作流程：
1. 从下拉列表选预设字体 → 自动写入 `config.fontFamily`
2. 选"上传字体..." → 弹出文件选择器 → 加载 .ttf/.otf/.woff/.woff2 → 自动添加到下拉列表并选中

### FONT_LIST

预设字体列表（已内置在 `fontSelectHTML` 中），包含：
- Orbitron、Rajdhani、Chakra Petch、Exo 2 等科技风字体
- Noto Sans SC、ZCOOL QingKeHuangYou 等中文字体
- CustomFont 系列占位符

### 快捷方式：`initFontSelector()` 一行搞定

如果不需要自定义 select ID，可以用合并函数一步完成上述三步：

```javascript
initFontSelector({ mountId: 'FontMount', configKey: 'fontFamily', config });
```

内部自动生成 select ID、注入 HTML、绑定事件。返回 `{ selectId }` 如需额外操作可用。

---

## Background 系统

### 有 DOM 绑定（主背景，initEffect 自动创建）

`initEffect()` 内部自动创建 Background 实例，通过返回的 `bg` 使用：

```javascript
bg.mode    // 当前背景模式字符串
bg.draw(ctx, timestamp, isRecording, exportFormat)  // 绘制到 Canvas
```

在 `drawFrame` 中调用 `drawBg(timeMs)` 即可（内部封装了 `bg.draw()`）。

### 无 DOM 绑定（headless，用于内部图案/遮罩底图）

当你的效果需要一个独立的背景图案（不绑定到 UI 面板），使用 headless 模式：

```javascript
import { Background } from '../shared/background.js';

const maskBg = new Background({
    modeSelectId: null,              // 关键：null 表示不绑定任何 DOM
    defaultMode: 'grid',             // 默认图案类型
    defaultPatternColor: '#333333',  // 图案颜色
});

// 动态切换模式
maskBg.setMode('dots');              // 切换到点阵

// 获取图案 Canvas（可直接绘制或作为遮罩使用）
const patternCanvas = maskBg.patternCanvas;
```

**典型用途**：logo-matrix 中的遮罩底图——底层用 headless Background 绘制网格/点阵纹理，上层绘制主内容。

---

## `resetAnimStart()` — 重置动画时间

当用户修改参数后需要动画从头播放时调用：

```javascript
bindUI(config, [...], {
    onChange: () => {
        resetAnimStart();  // 下一帧从 timeMs=0 开始
    }
});
```

### `startPreviewLoop` hold 终态模式

默认情况下预览循环会持续播放（每帧传入递增的时间）。如果效果需要**播完后停在终态**（如文字动画、图表生长），使用 hold 模式：

```javascript
// 动画 2 秒，之后停在终态（time 传入 Infinity）
startPreviewLoop(drawFrame, { duration: 2, hold: true });

// drawFrame 中判断：
function drawFrame(t) {
    if (t === Infinity) {
        // 画终态（progress = 1）
    } else {
        // 正常动画（progress = t / 2000）
    }
}
```

配合 `onRender` 模式使用时，通过 `loopOpts` 传递：
```javascript
initEffect({
    ...
    onRender(t) { /* ... */ },
    loopOpts: { duration: 2, hold: true },
});
```

---

## 严格规则（违反会导致效果无法运行）

| # | 规则 | 原因 |
|---|---|---|
| 1 | `jszip.min.js` 和 `mp4-muxer.js` 用 `<script>` 标签加载，**不要用 ES module import** | mp4-muxer.js 不是 ESM 格式，import 会导致整个脚本崩溃 |
| 2 | **不要写背景面板和导出面板的 HTML**，用 `<div id="shared-controls-placeholder"></div>` 代替 | 面板由 `initEffect()` / `injectPanels()` 自动注入，手动写会引入不一致 |
| 3 | 将所有 `function` 声明放在模块顶层，不要夹杂在业务逻辑中间 | 虽然 ES module 中 function 会被 hoisted，但声明被其他语句包裹可能导致时序问题或可读性差。保持顶层声明是最佳实践 |
| 4 | 绘制坐标用 `baseWidth` / `baseHeight`（默认 1440/1080），**不要用** `canvas.width` / `canvas.height` | canvas 实际尺寸是 2880×2160（2x 超采样），用了会画到画布外 |

---

## 可用工具函数

所有工具函数通过 `initEffect()` 返回，**无需单独 import**。在解构时按需取用：

```javascript
const { ctx, baseWidth, baseHeight, clearFrame, drawBg, startPreviewLoop,
        lerp, clamp, hexToRgba, getLightness,
        easeOutCubic, getEasing,
        loadFont, initFontSelector, setupFontSelector, fontSelectHTML,
        drawMediaContain, bindUI,
        createLinearGradient, createRadialGradient,
        drawTextCentered, drawTextWrapped,
        applyVignetteMask, calcGradCoords } = initEffect({
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
| `getEasing(name)` | 按名称查找，`name` = `'linear'` / `'easeIn'` / `'easeOut'` / `'easeInOut'` / `'easeOutQuart'` / `'easeOutExpo'` |

```javascript
// 用法示例 1：直接使用
const progress = easeOutCubic(t);

// 用法示例 2：配合下拉菜单动态选择
const easing = getEasing(config.easingType);
const progress = easing(normalizedTime);
```

### 字体加载

| 函数 | 说明 |
|---|---|
| `loadFont(file, familyName?)` | 加载字体文件 (.ttf/.otf/.woff/.woff2)，返回 CSS font-family 字符串 |

> 注意：通常不需要直接调用 `loadFont()`，字体选择器（`setupFontSelector`）内部已经封装了字体上传和加载流程。

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

### 渲染辅助

| 函数 | 说明 |
|---|---|
| `applyVignetteMask(ctx, w, h, intensity?)` | 径向羽化遮罩（destination-in），边缘渐变透明。intensity 0~1，默认 0.85 |
| `calcGradCoords(w, h, angleDeg)` | 根据角度计算渐变起止坐标，用于文字/形状渐变填充 |

```javascript
// 羽化遮罩：让画布四角自然淡出
applyVignetteMask(ctx, baseWidth, baseHeight, 0.8);

// 渐变坐标：45 度角渐变
const { x1, y1, x2, y2 } = calcGradCoords(charWidth, fontSize, 45);
const grad = ctx.createLinearGradient(x1, y1, x2, y2);
```

---

## Canvas 绘制要点

- 画布逻辑尺寸：**1440 × 1080**（4:3 比例）
- 实际像素：2880 × 2160（2x 超采样，导出更清晰）
- 预览显示大小由 CSS 控制，跟逻辑尺寸一致
- `ctx.scale(SCALE, SCALE)` 已设置，所有绘制用逻辑坐标
- 每帧必须先清屏再画，不要依赖上帧残留
- 录制时 `recorder.isRecording` 为 `true`，可在渲染中据此跳过不必要的计算

---

## 导出格式

用户可以在 UI 上选择，AI 不需要处理：

| 格式 | 特点 |
|---|---|
| PNG 序列 | 透明背景，无损，ZIP 下载 |
| MP4 | H.264 Baseline 25Mbps，60fps，帧同步渲染 |
| WebM | VP9 25Mbps，实时流式录制 |
