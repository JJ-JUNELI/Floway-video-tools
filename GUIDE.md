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
│   ├── background.js    ← 背景系统
│   ├── controls.js      ← 背景和导出面板（自动注入，不需要写 HTML）
│   ├── utils.js         ← 工具函数
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
            background: #000; width: 100%; max-width: 1600px; aspect-ratio: 4/3; display: block;
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
        <canvas id="mainCanvas"></canvas>
    </div>

    <script type="module">
        import { Recorder } from '../shared/recorder.js';
        import { Background } from '../shared/background.js';
        import { lerp, hexToRgba } from '../shared/utils.js';
        import { injectSharedControls } from '../shared/controls.js';

        // 注入共享面板（固定写法，不要改）
        injectSharedControls({ defaultBgMode: '#000000' });

        // ====== Canvas 初始化（固定写法）======
        const BASE_W = 1600;
        const BASE_H = 1200;
        const SCALE = 2;
        const canvas = document.getElementById('mainCanvas');
        canvas.width = BASE_W * SCALE;
        canvas.height = BASE_H * SCALE;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: false });
        ctx.scale(SCALE, SCALE);

        // ====== 参数默认值 ======
        const config = {
            // 在这里定义你的参数
        };

        // ====== 共享模块初始化（固定写法）======
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
            onFrame: (timeMs) => drawFrame(timeMs),
            fileName: 'EffectName',
            width: BASE_W * SCALE,
            height: BASE_H * SCALE,
        });

        // ====== 渲染函数（核心）======
        function drawFrame(timeMs) {
            // 清屏（固定写法）
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            // 背景（固定写法）
            if (recorder.format !== 'png_seq' && bg.mode === 'transparent') {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, BASE_W, BASE_H);
            }
            if (bg.mode !== 'transparent') {
                bg.draw(ctx, timeMs, recorder.isRecording, recorder.format);
            }

            // ★ 在这里写你的渲染逻辑 ★
            // 坐标空间是 BASE_W × BASE_H (1600 × 1200)
            // SCALE 已经通过 ctx.scale() 应用，不需要手动乘
            // timeMs 是毫秒
        }

        // ====== 预览循环（固定写法，不要改）======
        function previewLoop() {
            if (!recorder.isRecording) {
                drawFrame(performance.now() - animStartTime);
            }
            requestAnimationFrame(previewLoop);
        }
        requestAnimationFrame(previewLoop);

        // ====== UI 绑定 ======
        // 每个滑块/选择器需要绑定到 config
        // 示例：
        // document.getElementById('SpeedInput').addEventListener('input', e => {
        //     config.speed = parseFloat(e.target.value);
        //     document.getElementById('SpeedVal').innerText = e.target.value;
        // });
    </script>
</body>
</html>
```

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
| 2 | previewLoop 用 `if (!recorder.isRecording) { }` 包裹，**不要用 `return`** | `return` 会永久终止循环，录制结束后画面冻结 |
| 3 | clearRect 前必须 `ctx.save()` + `ctx.setTransform(1,0,0,1,0,0)`，之后 `ctx.restore()` | 不重置 transform 的话 clearRect 范围会受 scale 影响 |
| 4 | 绘制坐标用 `BASE_W` / `BASE_H` (1600/1200)，**不要用** `canvas.width` / `canvas.height` | canvas 实际尺寸是 3200×2400，用了会画到画布外 |
| 5 | `recorder.format` 在首次录制前是 `undefined`，不是字符串 | 检查 format 时要注意这一点 |
| 6 | 不要在函数声明前后插入 console.log 或其他语句 | ES module 中 function 声明不是 hoisted 到顶部的，会被语句打断 |
| 7 | **不要写背景面板和导出面板的 HTML**，用 `<div id="shared-controls-placeholder"></div>` 代替 | 面板由 `shared/controls.js` 自动注入，手动写会引入不一致 |

---

## 可用工具函数

```javascript
import { lerp, hexToRgba } from '../shared/utils.js';

lerp(0, 100, 0.5)        // → 50  线性插值
hexToRgba('#ff0000', 0.5) // → 'rgba(255, 0, 0, 0.5)'  颜色转带透明度
```

---

## Canvas 绘制要点

- 画布逻辑尺寸：**1600 × 1200**（4:3 比例）
- 实际像素：3200 × 2400（2x 超采样，导出更清晰）
- 预览显示大小由 CSS 控制，跟逻辑尺寸一致
- `ctx.scale(SCALE, SCALE)` 已设置，所有绘制用逻辑坐标
- 每帧必须先清屏再画，不要依赖上帧残留

---

## 导出格式

用户可以在 UI 上选择，AI 不需要处理：

| 格式 | 特点 |
|---|---|
| PNG 序列 | 透明背景，无损，ZIP 下载 |
| MP4 | H.264 Baseline 25Mbps，60fps，帧同步渲染 |
| WebM | VP9 25Mbps，实时流式录制 |
