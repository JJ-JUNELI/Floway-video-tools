# Floway Video Tools v2 — 项目状态

> 最后更新：2026-05-29

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
├── shared/                      ← 共享模块（稳定，不需要改）
│   ├── base.css                 ← UI 样式框架
│   ├── controls.js              ← initEffect() 一行初始化 + injectPanels 面板注入
│   ├── background.js            ← 背景系统（Canvas + SVG 双模式，支持 headless）
│   ├── recorder.js              ← 录制引擎（MP4/WebM/PNG）
│   ├── svg-renderer.js          ← SVG→Canvas 序列化（SVG 效果用）
│   ├── utils.js                 ← 工具函数（lerp, bindUI, 字体选择器等）
│   ├── themes.js                ← 暗色/亮色主题管理
│   ├── webgl-composite.js       ← WebGL 3D 合成引擎（3D 卡片效果用）
│   ├── border-effects.js        ← 边框特效（描边 + 辉光）
│   ├── paper-texture.js         ← 纸张纹理生成
│   ├── custom-select.js         ← 自定义下拉选择器
│   └── mp4-muxer.js             ← MP4 编码库
│
├── effects/                     ← 正式效果文件（10 个）
│   ├── chart-fx.html            ← ✅ 万能图表（折线/柱状，纸张/赛博双模式，WebGL 3D）
│   ├── multi-line.html          ← ✅ 多折线图（任意条折线对比，每条独立色/名+自动图例；由 chart-fx 派生、去柱状）
│   ├── bar-chart.html           ← ✅ 柱状图（WebGL 3D 悬浮卡片）
│   ├── pie-chart.html           ← ✅ 饼图/环形图（WebGL 3D）
│   ├── card-3d.html             ← ✅ 3D 悬浮卡片（图片/视频展示）
│   ├── xiaolin-card.html        ← ✅ 小lin说卡片（WebGL 3D 卡片）
│   ├── text-animator.html       ← ✅ 科技文字动画（Canvas，渐变/纹理/辉光）
│   ├── stack-scan.html          ← ✅ 堆叠扫光（SVG 渲染管线）
│   ├── logo-matrix.html         ← ✅ Logo 矩阵（Canvas + 遮罩底图）
│   └── particle-field.html      ← ✅ 粒子场（Canvas 粒子连线）
│
├── dev/                         ← 开发辅助/实验文件（.gitignore 忽略）
│   ├── test-border.html         ← 边框样式实验工具
│   ├── line-chart.html          ← 旧版折线图（已整合进 chart-fx）
│   ├── paper-chart.html         ← 旧版纸张图表（已整合进 chart-fx）
│   ├── demo.html                ← 导航页 UI 原型
│   ├── demo-crop.html           ← 图片裁切 demo
│   └── screenshot.js            ← Puppeteer 截图工具
│
├── index.html                   ← 导航页（Raycast Store 风格）
├── start.sh                     ← 本地开发服务器启动脚本
├── GUIDE.md                     ← AI 效果生成指引（模板 A/B/C + API 文档）
├── PROMPT_TEMPLATE.md           ← AI Prompt 模板
├── STATUS.md                    ← 本文件
└── README.md                    ← 项目简介
```

---

## 三、效果模板架构

### 三种模板模式

| 模板 | 适用场景 | 代表效果 |
|---|---|---|
| **A: Canvas** | 大多数 2D 效果 | text-animator, logo-matrix, particle-field |
| **B: SVG** | 需要 SVG 滤镜/文字渲染 | stack-scan |
| **C: Canvas + WebGL** | 3D 光照/卡片合成 | chart-fx, multi-line, bar-chart, pie-chart, card-3d, xiaolin-card |

### 共享模块依赖关系

```
效果文件
  └── initEffect() [controls.js]
        ├── Background [background.js]
        ├── Recorder [recorder.js]
        ├── bindUI / fontSelectHTML / setupFontSelector [utils.js]
        ├── injectPanels（自动注入背景 + 导出面板）
        └── enhanceAllSelects [custom-select.js]
```

WebGL 效果额外依赖：
```
  └── WebGLComposite [webgl-composite.js]
  └── drawSolidGlow [border-effects.js]  (chart-fx)
  └── PaperTexture [paper-texture.js]    (chart-fx)
```

---

## 四、规范合规状态

> 原 8 个正式效果已通过 GUIDE.md 规范审计（2026-05-06）；现共 9 个（新增 xiaolin-card）。
> 加载顺序中 jszip 已由 CDN 改为本地 `shared/jszip.min.js`（2026-05）。

| 检查项 | 状态 |
|---|---|
| `<head>` 加载顺序（jszip → mp4-muxer → base.css → Google Fonts）| ✅ 全部合规 |
| 侧边栏结构（.sidebar > .sidebar-header + .controls-container）| ✅ 全部合规 |
| `shared-controls-placeholder` 占位符 | ✅ 全部合规 |
| `initEffect()` 统一入口 | ✅ 全部合规 |
| `bindUI()` 批量 UI 绑定 | ✅ 全部合规 |
| 坐标系 1440 × 1080 | ✅ 全部合规 |
| 主题切换 themes.js | ✅ 全部合规 |

---

## 五、改进路线图（2026-06-15 制定）

> 按「风险 × 收益」排序：低风险高收益在前，高风险重构压轴。每阶段独立成 PR、单独 commit+push 到 `claude/dev`、`npm test` 保持绿、不推 main。
> **建议执行顺序：0 → 1 →（3、4 穿插）→ 2 → 5**。

### Phase 0 — 排查/修复 stack-scan 预览滚动条 ⚡
唯一挂着的功能 bug，最便宜先清。窄屏实测 SVG 是否溢出冒滚动条；若在，用 `position:absolute; inset:0` + 容器 `overflow:hidden` 收口。
> 注：实测发现 SVG 实为 `preserveAspectRatio="xMidYMid meet"`（非 CLAUDE.md 旧记的 `slice`），已有三重 `overflow:hidden` + iframe `scrolling="no"`，CLAUDE.md 该条记录疑似过时。

### Phase 1 — manifest 化首页 🎯（最高性价比）✅ 已完成（2026-06-15, commit 24f8b0d）
根治「首页卡片硬编码 + 效果文件漂移」，并为「AI 生成新效果自动入库」铺路。
- 新建 `effects/manifest.js`（用 **.js 不用 .json**：图标 SVG 用模板字符串更干净、免 fetch、能在 `file://` 跑）。每项 `{ id, file, title, desc, category, keywords, tags, icon(SVG字符串), featured }`。
- index.html 的 `#ToolGrid`（和精选区）改为从 manifest 渲染，删 ~10 段静态 `<a class="ext-card">`；筛选 tab / ⌘K 搜索 / cat-thumb 接到动态 DOM（注意 ResizeObserver 重对齐时机）。
- 加**双向漂移测试**进冒烟：manifest 每项 `file` 存在且无错加载；`effects/*.html` 每个都在 manifest 里。

### Phase 2 — UI 一致性收口 🎨（纯体感，工作量中）
先定规范再逐效果落地。
- **2a** 写规范进 GUIDE.md：slider=stack、select/color/checkbox=row；单位统一（透明度`%`/角度`°`/字号`px`/时长`s`）；分组标题统一中文；分组顺序统一为 **模式/内容 → 样式 → 排版位置 → 动画 → 共享(背景+导出)**。
- **2b** 逐效果改 HTML/顺序（10 文件，机械但量大，逐个改完跑冒烟+目测）。
- **2c** checkbox 语义区分：chart-fx 14 个一样的 toggle 里，模式选择类改 segmented/select、功能开关留 toggle（动逻辑，单独做）。
- **⚠️ 关键依赖**：改控件顺序会破 card-3d 快照测试（按 DOM 顺序 dump），每次调顺序须同步更新 `tests/snapshots/card-3d.json`。

### Phase 3 — 录制体验 📹（高频痛点）✅ 已完成（2026-06-15, commit df909bb）
改 `recorder.js` 一处，所有效果受益。
- 录制中显示进度：定长录制（`maxDurationSec`）显示 已录帧/总帧 + 百分比 + 估算剩余；PNG/MOV 封装阶段显示打包进度。
- 透明视频内存上限按浏览器区分：Chromium 维持 12GB（Blob 落盘）、非 Chromium 调低并在选格式时提示。

### Phase 4 — 主题切换样板收口 🧹（低风险低收益）
把 themeToggle 按钮注入 + `initThemeToggle()` 收进 `initEffect`/`injectPanels`，消除每效果 3 处样板。⚠️ stack-scan 不走 initEffect，需特判保留手动初始化。

### Phase 5 — ChartCore 重构 🏗️（高风险，压轴，单独 PR）
抽 chart-fx/bar-chart/pie-chart/multi-line 共享的 `config` 默认 + `MODE_PRESETS`（`definePresetPair`）+ 数据表格 CRUD → `shared/chart-core.js`，根除四文件副本漂移。**依赖 Phase 2 的 UI 规范先定好**，否则重构完返工。

### 远期
- **bindUI 以 config 为唯一真相**：初始化把 config 推回 UI，改默认值只需改一处（部分已在 Phase B 落地）。
- **模板库应用**：index.html 改造为支持 AI 聊天生成新效果的完整应用（Phase 1 manifest 是其前置）。

---

## 六、约束（用户明确要求）

- "不要改项目文件" — 原始项目在 `D:\Floway_video_Tools`，不动
- "效果跟原始项目效果一样的，不要打折扣"
- "新增效果的快速、0 成本适配也是非常重要的"
- "需要让能用共享模块的地方就用共享模块"
