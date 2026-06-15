# CLAUDE.md — 项目上下文

## 协作工作流（默认行为）
- **改完即自动提交并推送**：完成一组改动后，自动 `git commit` 并 `git push` 到工作分支 `claude/dev`，无需每次征求确认，方便用户远程审查。
- **分支策略**：日常改动一律在 `claude/dev` 上进行并推送；**不直接推 main**。需要正式发布时，由用户确认后再将 `claude/dev` 合入 `main`。
- **提交署名**：`JJ-JUNELI <ljj9259225@gmail.com>`（已全局配置）。
- 例外：destructive 操作（reset --hard、force push、删分支等）仍需用户明确授权。

## 项目概述
Floway Tools：浏览器端视频效果生成工具集，纯前端无框架依赖，Canvas 2D + WebGL 渲染，支持 MP4/WebM/PNG 序列 + 透明视频(MOV) 导出（透明视频详见下方专章）。

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
- **透明背景 = 真透明**：选「🏁 透明」时，预览与**保 alpha 的导出**（PNG 序列 + 透明视频 MOV）保持真透明，露出整页网格底纹。`canvas` / `#mainSvg` 的 CSS 底色为 `transparent`（与图表 `webgl-canvas` 一致）。
- **填黑判断统一走 `recorder.keepsAlpha`**：`drawBg()`、`background.js draw()`、以及各 WebGL 合成效果内联的填黑，**只在录制不保 alpha 的格式（mp4/webm）时**填实底；预览 / PNG 序列 / 透明视频都不填。详见透明视频专章的「⚠️ keepsAlpha」——这是单一事实源，曾因各效果漏排除 prores 导致透明视频黑底。
- **录制实底固定黑色**：mp4/webm 不支持透明，透明背景录制时一律填 `#000000`（不随主题，亮色也是黑底），与 SVG 导出路径 `background.js drawToCanvas` 一致。
- 非透明模式（纯色/纸张/网格/自定义）由效果或背景铺满像素，CSS 底色不可见。

## 透明视频导出（MOV / PNG-in-MOV）
PNG 序列之外的「单文件透明视频」。导出格式下拉的 `🎬 透明视频 (MOV)`（内部 format 值仍叫 `prores`，历史遗留，实际编码早已换）。逻辑在 `shared/recorder.js` 的 `prores` 分支。

### 编码：PNG-in-MOV（QuickTime PNG 视频轨）
- **抓帧** = `canvas.toBlob('image/png')`（与 PNG 序列同路径，直通 alpha 正确）。**不要** drawImage→getImageData，那套预乘/直通来回会把柔光放大成白光晕（尤其 WebGL 画布）。
- **封装** = 纯 JS 自封装（`shared/mov-muxer.js` 的 `PngMovMuxer`，无 ffmpeg）：把抓到的 PNG 帧**原样**封进 QuickTime 'png ' 视频轨，不解码不缩放不重编码、近乎瞬时。
- 无损、带真 alpha、QuickTime/Apple 原生。**比 QTRLE 小约 6×**（辉光 1080p 实测 QTRLE 39MB vs PNG-in-MOV 6MB——QTRLE 逐行 RLE 压不动渐变，PNG 的 DEFLATE 正擅长）。
- **编码弯路（勿重走）**：曾先后用 ProRes 4444、QTRLE，都遇「剪映黑底」——后查实是**前端填黑 bug**（见 keepsAlpha），非编码/剪映问题；修掉后比体积才定下 PNG-in-MOV。教训：先排除自己的前端 bug，再怀疑编解码器。

### 平台兼容（实测）
| 目标 | PNG-in-MOV |
|---|---|
| 剪映/CapCut 桌面（Mac+Win） | ✓ |
| 安卓剪映 | ✓ |
| Premiere / AE / Resolve | ✓ |
| **苹果手机剪映** | ✗ → 走**绿幕 + 色度键**（MP4+绿幕背景） |

苹果手机剪映只认**带 alpha 的 HEVC**，那是 macOS VideoToolbox 的专有能力：**浏览器/WebCodecs 都产不出**（WebCodecs 对 HEVC 无 alpha；`hevc_videotoolbox` 是 macOS 系统编码器，浏览器里没有；x265 产的是不透明 HEVC）。要 HEVC-alpha 只能上 **macOS 后端**转，故手机端维持绿幕，别再研究浏览器产 HEVC-alpha。

### 引擎：纯 JS 自封装（`shared/mov-muxer.js` 的 `PngMovMuxer`，无 ffmpeg）
- **不依赖 ffmpeg / 任何 wasm**。封 MOV 只是「PNG 字节装箱 + 写采样表（atom）」——PNG 编码浏览器 `toBlob` 已免费做完，MOV 只是个"信封+目录"，纯 JS 几 KB 即可。（曾用 ffmpeg.wasm `-c:v copy`，是 31MB 杀鸡用牛刀 + 一堆 wasm 内存问题，已整体移除。）
- `PngMovMuxer`：`await addFrameBlob(pngBlob)` 逐帧持有 **PNG Blob**（首帧异步读 IHDR 自动得宽高），`finalize()` 返回 `Blob(video/quicktime)`。结构 = `ftyp + wide + mdat(帧字节) + moov`（`stsd 'png ' depth24 / 变长 stsz / edts·elst / minf hdlr`），对齐 ffmpeg 的 PNG-in-MOV 输出，已在剪映/AE 实测通过、逐像素无损（PSNR=inf）。
- **内存友好**：帧以 **PNG Blob** 持有（不是 Uint8Array）→ 大 Blob 浏览器(Chromium)自动落盘、常驻内存大降；`finalize` 用 `new Blob([头, ...帧Blob, moov])` 按引用分段拼装（不分配巨型连续缓冲）。`mdat` >4GB 时自动切 **64 位 largesize**（stco 单 chunk 偏移很小、仍 32 位安全）→ 文件结构不卡 4GB。**没有"wasm 内存只增不减 / 导出后整页卡 / 要 terminate 重载"那套问题**——那是 ffmpeg.wasm 时代的，已随移除一并消失。

### 抓帧 / 内存 / 时长上限
- 抓帧 = `canvas.toBlob('image/png')`，逐帧 `await PngMovMuxer.addFrameBlob(blob)`，帧以 **Blob** 持有（大 Blob 浏览器可落盘，常驻内存远低于"所有帧之和"）。
- 预算 `_proresByteBudget = 12e9`（~12GB）：累计 PNG 字节超了就**自动停录 + 封装已抓帧 + 弹窗**告知时长。Blob 落盘后内存不再是主瓶颈，上限主要受 Blob 存储/磁盘/下载约束（Chromium 利好最大；Firefox/Safari 大 Blob 更可能留内存）。mp4/webm 流式编码无限制；PNG 序列(JSZip)仍全在内存、极长可能 OOM。

### 档位（导出面板，选透明视频时显示）
- **帧率**：30 / 60 fps（`#ProResFps`）。
- **分辨率**：高清 2x（2880×2160，原样封装）/ 标准 1x（1440×1080，`#ProResRes`）。标准档缩放在**抓帧时用浏览器 `drawImage` 缩到一半再 `toBlob`** 完成，两档封装都是纯 JS 字节拼装（无重编码、瞬时）。好处：① 速度一致；② PNG 仅 1/4 大 → 时长上限再×4；③ 2x 渲染缩到 1x = SSAA 超采样、边缘比原生 1x 更锐。
- **缩放为何不发黑**（实测）：Chromium `drawImage` 降采样走预乘合成，透明软边不被拖暗——"不透明白↔全透明"边界缩后是 `(255,255,255,128)` 而非直通缩放的 `(127,127,127,128)`；2D 源与 `premultipliedAlpha:false` 的 WebGL 源都正确。
- 注：分辨率档**只对透明视频**生效（mp4/webm/png 仍 2880×2160）。未做"全局 render scale 切换"——各效果把 `scale=2` 写死在文件里、要动 5 个 WebGL 合成效果的 glCanvas/offscreen 尺寸，风险大；抓帧时缩用一处拿到同样的快+小+省内存且画质更好。

### ⚠️ keepsAlpha：保 alpha 格式的填黑判断（单一事实源）
mp4/webm 不支持透明，透明背景录制时各效果会把背景填黑（固定 `#000000`）。**该判断必须排除所有保 alpha 的格式**，单一事实源是 `recorder.keepsAlpha`（getter，= `png_seq || prores`）。曾经各效果**内联**写死 `recorder.format !== 'png_seq'`，新增透明视频(prores)时只改了 controls.js、漏了 6 个效果（xiaolin-card/card-3d/bar-chart/chart-fx/pie-chart/logo-matrix）和 background.js → 导出透明视频被填黑底；**卡片/图表类（WebGL 合成）最严重**，因为黑底 bgCanvas 喂进 `webgl-composite` 背景 Pass1 铺满全屏 → 整片黑。PNG 序列因被排除而一直正常，曾误判成编码/剪映/wasm 问题。**以后再加保 alpha 的导出格式，只改 `recorder.keepsAlpha` 一处，所有效果与 background.js 都走它。**

### 历史：从 ffmpeg.wasm 到纯 JS 自封装（已落地）
透明视频最初用 ffmpeg.wasm（先试 ProRes 4444 / QTRLE 编码，后改 PNG-in-MOV `-c:v copy` 仅封装）。但 `copy` 本质只是装箱，31MB 的 ffmpeg 纯属多余，还带来 wasm 内存只增不减、导出后整页卡、要 terminate 重载等问题。故改为 `mov-muxer.js` 纯 JS 自封装（见上「引擎」），**已移除 `shared/vendor/ffmpeg/` 的 31MB 及 recorder 里所有 ffmpeg 代码路径**（连带删了 `demo/prores-test.html`、`demo/mov-test.html` 两个 spike）。回溯需要 ffmpeg 时可从 git 历史取回。

## 图表预设对称约束（definePresetPair）
chart-fx / bar-chart 的 `MODE_PRESETS = definePresetPair(纸张, 赛博)`（`shared/utils.js`）。两套预设**必须键集完全相同**——`switchMode` 用 `Object.assign` 应用预设，键不对称会在切回时残留对方的值（曾出现 `barStrokeColor` 残留赛博青、`barGradientEnd` 不随风格）。`definePresetPair` 开发期 `console.error` 报不对称（冒烟测试可捕获）。pie-chart 无纸张/赛博预设，不涉及。

## 玻璃设计系统（液态玻璃）

统一的玻璃质感。首页（index.html 内联 `<style>`）与效果页（`shared/base.css`）**各用各的令牌词表**，并非两套同名副本：首页用 `--glass-fill/-border/-blur` 完整令牌化；效果页侧栏用 `--sidebar-bg/--glass-blur/--glass-shadow`，control-group 直接写字面 `rgba()`。**唯一共名令牌是 `--glass-highlight`**（暗色两边相同；亮色已统一为首页的 `0.5/0.3`）——改它请两处同步（两边定义旁均有 ⚠️ 注释）。下面是首页的令牌：
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
- [x] ~~**预览橱窗 stack-scan 仍可能有滚动条**~~ **已核实不存在**（2026-06-15 playwright 多尺寸实测无溢出）：SVG 实为 `preserveAspectRatio="xMidYMid meet"`（非旧记的 `slice`），叠加三重 `overflow:hidden`（根 .preview-mode + 内联脚本 body + .preview-area）+ iframe `scrolling="no"`，不会冒滚动条。
- [ ] **（休眠）预览模式交叉轴塌成 0 → featured 预览空白**：`.preview-mode` 强制 `align-items:center`，使 preview-area 在交叉轴收缩到内容尺寸；canvas/SVG 又靠 `height/width:100%` 反向依赖父尺寸，一起塌成 0（横向视口塌高、竖向塌宽，所有效果通病，非 stack-scan 特有）。当前 featured 精选区已注释，无用户可见影响；若重新启用 iframe 预览需先修（给 preview-area 确定的交叉轴尺寸/改 stretch）。

### 小问题
- [x] ~~**精选区和全部工具区重复展示**~~ **已解决**：首页精选推荐区(`featured-section`)已注释隐藏，只剩「探索」全部工具网格。
- [x] ~~**README 效果列表过时**~~ **已是最新**：README 已列全 9 个效果、端口 8000。

### 无所谓
- [ ] `drawMediaContain` 函数名叫反了（实际是 cover 行为），目前只内部使用
- [ ] `drawTextWrapped` 按字符拆分，英文会断词，但项目定位中文场景

## 面板结构问题

### 参数组织（高优先）
- [x] ~~**参数组太多且不可折叠**~~ **已修**：`initCollapsibleGroups()` 让每个 `.control-group` 点击标题即可折叠，并按 localStorage 记忆每组状态。**初始不默认折叠任何组**（用户明确要求全部展开）；`data-default-collapsed` 标记不生效。
- [~] **大量重复面板未抽共享**：入场动画(`buildEntryAnimationPanel`)、标题(`buildChartTitlePanel`)已抽到 controls.js 的 `SHARED_PANELS`。剩 chart-fx/bar-chart/pie-chart 的 config 默认 + `MODE_PRESETS` + 数据表仍是复制粘贴 → 见路线图 Phase C「ChartCore」。

### ID 命名与标题规范（中优先）
- [x] **ID 命名规则不统一**：~~slider 有的用 `XxxInput` 后缀（SizeInput、SpeedInput），有的不加（TitleSize、AnimDuration）。建议统一为 `Xxx` 做控件 ID、`XxxVal` 做显示值~~ **已完成**：8 个效果统一为 `Xxx`（控件）+ `XxxVal`（显示）。例外：`MainFontInput`/`BgFontInput` 是 `setupFontSelector` 的契约参数，保留。
- [ ] **分组标题中英混用**：有的纯中文（"粒子参数"），有的中英混合（"核心素材 (Logo)"）。建议统一用中文
- [ ] **分组顺序无统一逻辑**：建议统一为 模式/内容 → 样式 → 排版位置 → 动画 → 共享面板（背景+导出）

### 面板设计规范（中优先）
- [x] ~~**透明度值域不统一**~~ **已修**：所有透明度 slider 统一 `min=0 max=100` + `%` 显示。stack-scan/text-animator 用 bindUI `'%'` transform(内部仍 0-1，渲染零改动)，pie SliceOpacity 直接 0-100。
- [ ] **row/stack 布局混用**：同类控件在不同效果里方向不一致。建议 slider 统一 stack（标签上滑条下），select/color/checkbox 用 row（横排更紧凑）
- [~] **slider 数值单位**：字号类已加 `px`（透明度 `%`、角度 `°`、时长 `s` 本就有）。借 Phase B：单位只需在 `bindUI` 规则第 5 个参数加 suffix，`applyConfigToUI` 会连初始显示一起带上。其余非字号的 px 量（点大小、距离等）按需再补。
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
  controls.js       # initEffect() 入口 + 面板注入（含导出面板：格式/帧率/分辨率档）
  recorder.js       # 录制引擎：MP4(WebCodecs)/WebM(MediaRecorder)/PNG(JSZip)/透明视频(PNG-in-MOV 自封装)；recorder.keepsAlpha
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
  mov-muxer.js      # PngMovMuxer：透明视频导出引擎，纯 JS 把 PNG 帧自封装成 QuickTime png 轨 MOV（无 ffmpeg）
tests/smoke.spec.js # Playwright 冒烟测试（逐页无错 + 图表模式往返）
playwright.config.js / package.json / .github/workflows/smoke.yml  # 测试与 CI
GUIDE.md            # AI 开发规范（模板结构、API 说明）
STATUS.md           # 效果状态追踪
```
