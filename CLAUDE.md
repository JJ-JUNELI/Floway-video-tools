# CLAUDE.md — 项目上下文

## 协作工作流（默认行为）
- **改完即自动提交并推送**：完成一组改动后，自动 `git commit` 并 `git push` 到工作分支 `claude/dev`，无需每次征求确认，方便用户远程审查。
- **分支策略**：日常改动一律在 `claude/dev` 上进行并推送；**不直接推 main**。需要正式发布时，由用户确认后再将 `claude/dev` 合入 `main`。
- **提交署名**：`JJ-JUNELI <ljj9259225@gmail.com>`（已全局配置）。
- 例外：destructive 操作（reset --hard、force push、删分支等）仍需用户明确授权。

## 项目概述
Floway Tools：浏览器端视频效果生成工具集，纯前端无框架依赖，Canvas 2D + WebGL 渲染，支持 MP4/WebM/PNG 序列导出。

## 架构要点
- 每个效果是独立单文件 HTML，放在 `effects/` 目录
- `shared/` 下的模块提供基础能力：controls.js（面板注入+初始化）、recorder.js（录制引擎）、background.js（背景系统）、utils.js（工具函数）、themes.js（主题切换）
- `initEffect()` 是大多数效果的入口，一行完成 Canvas 初始化、Background、Recorder、面板注入
- **例外**：stack-scan.html 使用 SVG 渲染 + SvgRenderer，不走 initEffect，直接 import 各模块手动初始化
- 三种模板模式：A（Canvas）、B（SVG）、C（Canvas + WebGL 合成）
- 详细开发规范见 GUIDE.md

## 预览模式（?preview）
index.html 精选区使用 iframe 嵌入效果的实时动画预览。通过 URL 参数 `?preview` 触发：
- 每个效果页 `<head>` 有同步内联脚本，立即添加 `preview-mode` class 并注入关键 CSS
- controls.js 中 `initEffect()` 检测 preview 参数后：跳过面板注入、跳过 Recorder（用空桩）、Canvas scale 降为 1x
- base.css 底部有 `.preview-mode` 样式块：隐藏 sidebar、居中 Canvas/SVG、去边框阴影
- stack-scan 因为不走 initEffect，预览模式下仍会完整初始化（面板注入+Recorder），只是 sidebar 被 CSS 隐藏

## 背景与透明（统一约定）
- **透明背景 = 真透明**：选「🏁 透明」时，预览与 PNG 序列保持真透明，露出整页网格底纹。`canvas` / `#mainSvg` 的 CSS 底色为 `transparent`（与图表 `webgl-canvas` 一致）；`controls.js` 的 `drawBg()` 在透明模式下**只在录制 mp4/webm 时**填实底，预览/PNG 不填。
- **录制实底固定黑色**：mp4/webm 不支持透明，透明背景录制时一律填 `#000000`（不随主题，亮色也是黑底），与 SVG 导出路径 `background.js drawToCanvas` 一致。
- 非透明模式（纯色/纸张/网格/自定义）由效果或背景铺满像素，CSS 底色不可见。

## 图表预设对称约束（definePresetPair）
chart-fx / bar-chart 的 `MODE_PRESETS = definePresetPair(纸张, 赛博)`（`shared/utils.js`）。两套预设**必须键集完全相同**——`switchMode` 用 `Object.assign` 应用预设，键不对称会在切回时残留对方的值（曾出现 `barStrokeColor` 残留赛博青、`barGradientEnd` 不随风格）。`definePresetPair` 开发期 `console.error` 报不对称（冒烟测试可捕获）。pie-chart 无纸张/赛博预设，不涉及。

## 玻璃设计系统（液态玻璃）

统一的玻璃质感。首页（index.html 内联 `<style>`）与效果页（`shared/base.css`）各维护一套**同名令牌**：
- `--glass-fill` / `--glass-fill-strong`：半透膜（暗 `rgba(22,27,38,α)` 深染 / 亮 `rgba(255,255,255,α)`）
- `--glass-border`：**0.5px** 描边色（暗 `rgba(255,255,255,0.10)` / 亮 `rgba(15,23,42,0.10)`）
- `--glass-highlight`：顶部细高光 + **左上角柔光**（`inset` 组合，模拟左上光源）
- `--blur` / `--blur-strong`（首页）、`--glass-blur`（效果页侧栏）：**轻磨砂**（约 1px，几乎全透出背景）

**卡片材质** = 半透填充 + 0.5px 描边 + glass-highlight + 轻 blur + 投影 + 圆角（首页 18px）。统一用于：首页 卡片/按钮/搜索框/logo/主题开关；效果页 control-group/侧边栏/分类标签。调参时优先动「填充不透明度」和「blur」两个旋钮——在均匀深底上 blur 视觉影响很小，**填充才是控制通透感的主旋钮**。

**下拉框** `.fs-dropdown` 是**独立材质**（深染 0.18 + blur 5.5），用户明确要求不跟随上面的整体调整。

### ⚠️ 关键约束：backdrop-filter 嵌套失效 → 下拉框 portal 到 body
Chromium 下，带 `backdrop-filter` 的元素若**嵌套在另一个 backdrop-filter 祖先**（如侧边栏整体玻璃）内，它自己的 blur 是 **no-op**（膜照常渲染、但背景不模糊，文字依旧锐利）。改 CSS（去中间层滤镜、调 blur 值）都救不了。所以自定义下拉框（`shared/custom-select.js`）**打开时 portal 到 `<body>`**：`position:fixed` + `getBoundingClientRect` 贴住触发器、随 `scroll`(capture)/`resize` 跟随；脱离侧栏滤镜后 blur 才真正生效，顺带根治「被后一组盖住」的层叠问题。**给侧栏内任何玻璃元素调 blur 前先想这条。**

### 分类标签 cat-tabs
液态玻璃分段控件 + 滑动玻璃滑块（`.cat-thumb`）：效果页侧栏由 `controls.js` 的 `initCategoryTabs` 构建；首页筛选分类是 `index.html` 内联的同款（JS 内联 `moveThumb`：`width` + `translateX(tab.offsetLeft - bar.clientLeft)`，加 `ResizeObserver` 在字体加载/缩放后重对齐）。选中=主色字 `--text-main`/`--fg`、未选=次级字；移动端 `flex:1` 撑满等分。

### 两列参数布局
`.row`（横向 flex）内放两个 `.stack` 列即左右排布。`base.css` 有 `.row > .stack { margin-bottom:0 }` 保证两列对齐——否则首列（非 `:last-child`）残留 `margin-bottom:10px` 比末列高，`align-items:center` 会把两列内容上下错位 ~5px。

## 已完成的修复（最近一次 review）

### 前端修复
- [x] 删除 index.html 多余的 `<script src="shared/themes.js">` 非模块标签（消除控制台 SyntaxError）
- [x] 工具计数 7 → 8
- [x] 实现 ⌘K / Ctrl+K 搜索快捷键
- [x] 所有效果页 sidebar-header 添加 ← 返回首页按钮
- [x] README 端口号 3000 → 8000
- [x] 精选区从静态卡片改为 iframe 动态预览橱窗

### 预览模式调试
- [x] 同步内联脚本注入关键 CSS，消除 sidebar 闪现
- [x] 预览模式 Canvas scale 降为 1x 减少 GPU 负担
- [x] iframe 添加 scrolling="no" + overflow:hidden
- [x] 预览模式 Canvas/SVG 居中（justify-content + align-items center）
- [x] SVG（stack-scan）用 position:absolute+inset:0 约束，防止 preserveAspectRatio="slice" 溢出
- [x] 隐藏 RecIndicator 和 DebugLog

## 已知未修的问题

### 值得修（影响用户体验）
- [x] ~~**VideoEncoder 没有 feature detection**~~ **已修**：recorder.js `_loadLibs` 检测 `typeof VideoEncoder`，不支持(Firefox/Safari)时禁用 mp4 选项并改名「(需要 Chrome/Edge)」、自动切 webm。
- [x] ~~**Recorder 库检测靠 setTimeout 300ms**~~ **已修**：改为轮询(150ms/最多 5s)等 `window.Mp4Muxer`，弱网不再过早误判离线。
- [x] ~~**start.sh 不支持 macOS**~~ **已修**：WSL 后、xdg-open 前加了 `command -v open` 的 macOS 分支。
- [ ] **预览橱窗 stack-scan 仍可能有滚动条**：SVG preserveAspectRatio="slice" 溢出问题可能还未完全解决，需实际测试

### 小问题
- [ ] **精选区和全部工具区重复展示**：chart-fx、text-animator、stack-scan 同时出现在精选和全部工具区
- [ ] **README 效果列表过时**：实际工具 **9 个**（index.html 列 9 张卡），README 仍是旧列表，待同步

### 无所谓
- [ ] `drawMediaContain` 函数名叫反了（实际是 cover 行为），目前只内部使用
- [ ] `drawTextWrapped` 按字符拆分，英文会断词，但项目定位中文场景

## 面板结构问题

### 参数组织（高优先）
- [x] ~~**参数组太多且不可折叠**~~ **已修**：`initCollapsibleGroups()` 让每个 `.control-group` 点击标题即可折叠；带 `data-default-collapsed` 的「入场动画(共享面板)/卡片漂浮/坐标轴与网格」首次默认折叠，用户手动操作后以 localStorage 记录为准、覆盖默认。
- [~] **大量重复面板未抽共享**：入场动画(`buildEntryAnimationPanel`)、标题(`buildChartTitlePanel`)已抽到 controls.js 的 `SHARED_PANELS`。剩 chart-fx/bar-chart/pie-chart 的 config 默认 + `MODE_PRESETS` + 数据表仍是复制粘贴 → 见路线图 Phase C「ChartCore」。

### ID 命名与标题规范（中优先）
- [x] **ID 命名规则不统一**：~~slider 有的用 `XxxInput` 后缀（SizeInput、SpeedInput），有的不加（TitleSize、AnimDuration）。建议统一为 `Xxx` 做控件 ID、`XxxVal` 做显示值~~ **已完成**：8 个效果统一为 `Xxx`（控件）+ `XxxVal`（显示）。例外：`MainFontInput`/`BgFontInput` 是 `setupFontSelector` 的契约参数，保留。
- [ ] **分组标题中英混用**：有的纯中文（"粒子参数"），有的中英混合（"核心素材 (Logo)"）。建议统一用中文
- [ ] **分组顺序无统一逻辑**：建议统一为 模式/内容 → 样式 → 排版位置 → 动画 → 共享面板（背景+导出）

### 面板设计规范（中优先）
- [x] ~~**透明度值域不统一**~~ **已修**：所有透明度 slider 统一 `min=0 max=100` + `%` 显示。stack-scan/text-animator 用 bindUI `'%'` transform(内部仍 0-1，渲染零改动)，pie SliceOpacity 直接 0-100。
- [ ] **row/stack 布局混用**：同类控件在不同效果里方向不一致。建议 slider 统一 stack（标签上滑条下），select/color/checkbox 用 row（横排更紧凑）
- [ ] **slider 数值没有单位**：用户不知道数字代表 px、%、° 还是 s。建议字号加 px，角度加 °，透明度加 %，时长加 s
- [ ] **checkbox 无语义区分**：所有 checkbox 渲染为 toggle switch，chart-fx 有 14 个全长一样。建议功能开关用 toggle，模式选择改 select 或 segmented control

### 数据组件化（低优先）
- [ ] **数据表格结构不统一**：chart-fx、bar-chart、pie-chart 各自实现数据表格，交互方式不同。建议抽成共享组件

## 本地开发
```bash
./start.sh          # 启动 HTTP 服务器（端口 8000，支持 WSL/macOS/Linux 自动开浏览器）
# 或
python3 -m http.server 8000
```

## 冒烟测试（需 Node）
```bash
npm install            # 装 @playwright/test + http-server
npm run test:install   # 首次：下载 Chromium
npm test               # 逐页加载断言无 JS 错误 + 图表纸张↔赛博往返无残留
```
push/PR 自动触发 `.github/workflows/smoke.yml`。新增/改动效果页或重构 shared 后应保持 CI 绿。

## 文件结构速查
```
index.html          # 首页（精选预览 + 工具网格）
effects/*.html      # 各效果页（独立单文件）
shared/
  controls.js       # initEffect() 入口 + 面板注入
  recorder.js       # MP4/WebM/PNG 录制引擎
  background.js     # 背景系统（纯色/绿幕/网格/纸张/自定义）
  utils.js          # 工具函数（bindUI, drawText, easing 等）
  themes.js         # 暗色/亮色主题切换
  base.css          # 全局样式（含预览模式）
  custom-select.js  # 自定义下拉框（portal 到 body，暴露 _fsRefresh）
  svg-renderer.js   # SVG → Canvas 渲染管线
  paper-texture.js  # 纸张纹理生成
  webgl-composite.js# WebGL 合成（图表/卡片类 Template C）
  border-effects.js # 描边/发光等边框效果
  mp4-muxer.js      # 本地 MP4 封装库（含 fallback CDN 轮询）
  jszip.min.js      # 本地 JSZip（PNG 序列打包，原走 CDN，已本地化）
tests/smoke.spec.js # Playwright 冒烟测试（逐页无错 + 图表模式往返）
playwright.config.js / package.json / .github/workflows/smoke.yml  # 测试与 CI
GUIDE.md            # AI 开发规范（模板结构、API 说明）
STATUS.md           # 效果状态追踪
```
