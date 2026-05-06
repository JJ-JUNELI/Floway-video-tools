# Floway Video Tools v2 — 项目状态

> 最后更新：2026-05-06

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
├── effects/                     ← 正式效果文件（8 个）
│   ├── chart-fx.html            ← ✅ 万能图表（折线/柱状，纸张/赛博双模式，WebGL 3D）
│   ├── bar-chart.html           ← ✅ 柱状图（WebGL 3D 悬浮卡片）
│   ├── pie-chart.html           ← ✅ 饼图/环形图（WebGL 3D）
│   ├── card-3d.html             ← ✅ 3D 悬浮卡片（图片/视频展示）
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
| **C: Canvas + WebGL** | 3D 光照/卡片合成 | chart-fx, bar-chart, pie-chart, card-3d |

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

> 全部 8 个正式效果已通过 GUIDE.md 规范审计（2026-05-06）

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

## 五、未来规划

1. **主题切换自动化** — 将 themeToggle 按钮绑定收进 `initEffect()`，消除每个效果重复的 8 行样板代码
2. **数据表格通用化** — 提取图表效果的表格 CRUD 逻辑为 `shared/table-utils.js`
3. **Manifest 机制** — 效果数量增多后，用 `effects/manifest.json` 驱动 index.html 动态渲染卡片
4. **模板库应用** — index.html 改造为支持 AI 聊天生成新效果的完整应用

---

## 六、约束（用户明确要求）

- "不要改项目文件" — 原始项目在 `D:\Floway_video_Tools`，不动
- "效果跟原始项目效果一样的，不要打折扣"
- "新增效果的快速、0 成本适配也是非常重要的"
- "需要让能用共享模块的地方就用共享模块"
