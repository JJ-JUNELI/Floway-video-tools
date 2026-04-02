# Floway Video Tools v2 — 项目状态

> 最后更新：2026-04-02

---

## 一、项目目标

### 最终形态

做一个**模板库应用**，用户跟 AI 聊天描述效果，AI 生成完整的效果模板文件，模板自动加入库，可以浏览、预览、调参数、导出（MP4/WebM/PNG）。

### 核心原则

- **零门槛生成**：AI 只需要读 GUIDE.md，就能输出一个可直接运行的单文件 HTML
- **共享基础设施**：Canvas 初始化、背景系统、录制引擎、UI 面板、字体选择器全部抽象为共享模块，新效果不需要重复造轮子
- **效果不打折扣**：迁移到共享模块后的效果必须跟原始项目完全一致
- **新增效果零成本**：任何人说"我要什么效果"就能得到一个可用的效果文件

### 技术规格

- 预览分辨率：1440 × 1080
- 导出分辨率：2880 × 2160（2x 超采样）
- 画布比例：4:3
- 导出格式：PNG 序列（透明）/ MP4（H.264）/ WebM（VP9）

---

## 二、项目结构

```
floway-tools-v2/
├── shared/                 ← 共享模块（稳定，不需要改）
│   ├── base.css            ← UI 样式框架
│   ├── controls.js         ← initEffect() 一行初始化 + injectPanels 面板注入
│   ├── background.js       ← 背景系统（Canvas + SVG 双模式，支持 headless）
│   ├── recorder.js         ← 录制引擎（MP4/WebM/PNG）
│   ├── svg-renderer.js     ← SVG→Canvas 序列化（SVG 效果用）
│   ├── utils.js            ← 工具函数（lerp, bindUI, 字体选择器等）
│   └── mp4-muxer.js        ← MP4 编码库
├── effects/                ← 效果文件
│   ├── text-animator.html  ← ✅ 科技文字动画（Canvas）
│   ├── stack-scan.html     ← ✅ 堆叠扫光（SVG 渲染管线）
│   ├── logo-matrix.html    ← ✅ Logo 矩阵（Canvas + 遮罩）
│   ├── line-chart.html     ← 未维护
│   └── particle-field.html ← 未维护
├── GUIDE.md                ← 给 AI 看的效果生成指引
├── index.html              ← 导航页
└── STATUS.md               ← 本文件
```

---

## 三、共享模块 API 速查

### initEffect() — Canvas 效果一行初始化

```javascript
import { initEffect } from '../shared/controls.js';

const { ctx, canvas, bg, recorder, baseWidth, baseHeight, scale,
        clearFrame, drawBg, startPreviewLoop, resetAnimStart,
        lerp, clamp, hexToRgba, getLightness,
        easeLinear, easeInCubic, easeOutCubic, easeInOutCubic,
        easeOutQuart, easeOutExpo, getEasing,
        loadFont, setupFontSelector, FONT_LIST, fontSelectHTML,
        drawMediaContain, bindUI,
        createLinearGradient, createRadialGradient,
        drawTextCentered, drawTextWrapped } = initEffect({
    canvasId: 'mainCanvas',
    fileName: 'EffectName',
    defaultBgMode: '#000000',       // 背景默认模式
    defaultPatternColor: '#333333', // 纹理默认颜色
    onFrame: drawFrame,             // 录制时的帧回调
});
```

做了什么：Canvas 初始化（含 2x scale）+ Background 创建 + Recorder 创建 + 面板 HTML 注入。

### bindUI() — 批量 UI 绑定

```javascript
bindUI(config, [
    ['ElemId', 'configKey', 'transform?', 'displayId?', 'suffix?'],
    ['SizeInput', 'fontSize', 'int', 'SizeVal'],
    ['ToggleInput', 'enabled', 'checked'],
    ['SelectInput', 'mode'],
    ['OpacityInput', 'opacity', '%', 'OpacityVal', '%'],
    ['DurationInput', 'duration', 'float', 'DurVal', 's'],
], {
    onChange: (val, key) => { /* 联动逻辑 */ }
});
```

transform 支持：`'int'` / `'float'` / `'%'` / `'checked'` / 自定义函数 / 省略（原样字符串）。

### 字体选择器

```javascript
// 1. 在 HTML 中放一个容器
// <div id="FontMount" style="width:100%"></div>

// 2. 注入 HTML
document.getElementById('FontMount').innerHTML = fontSelectHTML('FontSelect', config.fontFamily);

// 3. 初始化交互
setupFontSelector({
    selectId: 'FontSelect',
    configKey: 'fontFamily',
    fileInputId: 'FontSelectUpload',
    weightInputId: 'WeightInput',  // 可选，自定义字体时自动禁用
    config,
});
```

### Background — 背景系统

**有 DOM 绑定（主背景）：**
```javascript
// initEffect() 内部自动创建，通过 bg 使用
bg.mode    // 当前模式
bg.draw(ctx, timestamp, isRecording, exportFormat)  // 画到 Canvas
```

**无 DOM 绑定（headless，用于内部图案）：**
```javascript
import { Background } from '../shared/background.js';
const maskBg = new Background({
    modeSelectId: null,    // 关键：null 表示不绑定 DOM
    defaultMode: 'grid',
    defaultPatternColor: '#333333',
});
maskBg.setMode('dots');           // 动态切换模式
maskBg.patternCanvas              // 获取图案 Canvas
```

---

## 四、三个效果的实现特点

### text-animator（科技文字动画）

- **渲染**：Canvas，逐字符绘制，支持渐变填充 + 纹理叠加 + 辉光 + 投影
- **初始化**：用 `initEffect()`
- **预览循环**：自写 `previewLoop()`（需要区分"播放中"和"静止终态"两种状态）
- **UI 绑定**：`bindUI()` 35 条规则 + `onChange` 处理渐变面板显隐/布局重算/纹理更新
- **特殊**：`calcGradCoords()` 计算渐变坐标、`calculateLayout()` 缓存字符宽度

### stack-scan（堆叠扫光）

- **渲染**：SVG 渲染管线（预览直接操作 SVG DOM，导出时 SVG→Canvas 序列化）
- **初始化**：**不用 `initEffect()`**，手动拼装 Recorder + Background + injectPanels + SvgRenderer
- **预览循环**：自写 `previewLoop()`
- **UI 绑定**：`bindUI()` 29 条规则
- **特殊**：SVG 滤镜描边（feMorphology dilate/erode）、扫光算法、水印背景

### logo-matrix（Logo 矩阵）

- **渲染**：Canvas，双画布合成（底层遮罩底图 + 上层主画面+Logo，遮罩擦除后合成）
- **初始化**：用 `initEffect()` + 额外 `import Background` 创建 headless 实例
- **预览循环**：用共享的 `startPreviewLoop(drawFrame)`
- **UI 绑定**：`bindUI()` 13 条规则 + `onChange` 处理遮罩面板显隐/底图模式切换
- **特殊**：vignette 遮罩（`destination-in` 合成模式）、`maskBg` headless 实例

---

## 五、已完成的迁移工作

| 改动 | 涉及文件 |
|---|---|
| config/state 分离 | text-animator |
| 共享字体选择器（3个效果统一） | 全部 |
| `bindUI` 替代手写 addEventListener | 全部 |
| `clearFrame` 替代手写 clearRect | 全部 |
| `drawMediaContain` 替代手写 contain 绘制 | logo-matrix |
| `startPreviewLoop` 替代手写预览循环 | logo-matrix |
| 共享背景面板（injectPanels 自动注入） | 全部 |
| Background headless 模式 | background.js |
| Background.setMode() | background.js |
| injectPanels 透明选项 selected 修复 | controls.js |
| Background 构造函数默认值修复（null 正确传递） | background.js |
| maskBg 下拉框覆盖主背景下拉框的 bug | logo-matrix |

---

## 六、已知问题与待办

### 已完成 (2026-04-02)

1. ~~**更新 GUIDE.md**~~ — 已补齐 `bindUI()`、字体选择器、Background headless、`resetAnimStart()` 文档；重写 Canvas/SVG 双模板；修正规则 #3
2. ~~**修正 GUIDE.md 错误规则**~~ — 规则 #3 已修正为准确的描述
3. ~~**GUIDE.md 模板与实际效果统一**~~ — 以 logo-matrix 为蓝本重写模板，可直接运行
4. ~~**`hexToRgba` 和 `hexToRgbaStr` 合并**~~ — 删除 hexToRgbaStr，全局替换为 hexToRgba
5. ~~**删除 `initEffect` 中空实现的 autoPreview 分支**~~ — controls.js 死代码已清理；同时清理了 easeInOutCubicSmooth 别名
6. ~~**logo-matrix 录制时 `bg.draw` 的 isRecording 参数**~~ — 已修复为 `recorder.isRecording`

### 未来规划

7. **模板库应用** — index.html 改造为模板浏览/选择界面，支持 AI 聊天生成新效果并自动加入库

---

## 七、Git 提交历史

```
70f587f cleanup: remove duplicate startPreviewLoop call and unused frameCount in logo-matrix
23f8f57 refactor: logo-matrix shared module migration + fix bg dropdown empty bug
8487a29 fix: stack-scan shared file input, font quotes, hardcoded coords, fontSelectHTML injection
b6fcbb0 refactor: text-animator config/state separation + shared font selector, stack-scan bindUI cleanup, fontSelectHTML width fix
```

---

## 八、约束（用户明确要求）

- "不要改项目文件" — 原始项目在 `D:\Floway_video_Tools`，不动
- "不要调用 gemini 的模型"
- "效果跟原始项目效果一样的，不要打折扣"
- "新增效果的快速、0 成本适配也是非常重要的"
- "需要让能用共享模块的地方就用共享模块"
- line-chart 和 particle-field 不需要维护
