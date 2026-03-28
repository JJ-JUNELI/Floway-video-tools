# Floway Tools v2 — 当前状态 & 待办清单

> 最后更新: 2026-03-28
> Git HEAD: 09943ce
> 服务器: python3 -m http.server 8000 (需手动启动)

---

## 项目结构

```
floway-tools-v2/
├── shared/
│   ├── controls.js      170行  initEffect() + injectPanels()
│   ├── recorder.js      307行  录制引擎 (MP4/WebM/PNG)
│   ├── background.js    317行  背景系统 (Canvas + SVG 双模式)
│   ├── svg-renderer.js   56行  SVG→Canvas 序列化管线
│   ├── base.css         402行  UI 框架
│   ├── utils.js          43行  lerp, hexToRgba, hexToRgbaStr, getLightness, saveFile
│   └── mp4-muxer.js   1845行  MP4 编码库 (本地化, <script> 标签加载)
├── effects/
│   ├── text-animator.html  687行  ⚡ 科技动效 (1440×1080, 自定义动画控制, initEffect)
│   ├── stack-scan.html     707行  📠 堆叠扫描 (SVG, injectPanels + SvgRenderer + 手动 Recorder)
│   ├── logo-matrix.html    425行  💠 Logo矩阵 (initEffect, scale:1, 离屏合成, 内联面板)
│   ├── particle-field.html 177行  ✨ 粒子场 (AI生成验证 #1, initEffect)
│   └── line-chart.html     550行  📈 折线图表 (AI生成验证 #2, initEffect)
├── GUIDE.md              ~270行  AI 自包含生成指引 (给 AI 读的)
├── SKILL.md              ~240行  开发者参考 (给人读的)
├── PROMPT_TEMPLATE.md     49行   已被 GUIDE.md 取代
└── index.html            155行  导航页
```

## 5 个效果的初始化方式

| 效果 | 方式 | 面板来源 | 录制策略 | canvas尺寸 | 特殊处理 |
|---|---|---|---|---|---|
| particle-field | initEffect() | 自动注入 placeholder | 默认 (setTimeout, captureStream(60)) | 1600×1200, scale:2 | 无 |
| line-chart | initEffect() | 自动注入 placeholder | 默认 | 1600×1200, scale:2 | 无 |
| text-animator | initEffect() | 自动注入 placeholder | 默认 | 1440×1080, scale:2 | 自定义 previewLoop (有 play/pause), 保留自定义动画触发 |
| logo-matrix | initEffect() | **内联** (有遮罩参数夹在中间, 不用 placeholder) | 内联 | 1600×1200, scale:1 | offscreen compositing, 遮罩, useRealtimeWebm+useRafForFrames |
| stack-scan | injectPanels() + 手动 | 自动注入 placeholder | useManualWebmFrames | 1600×1200 | SVG 渲染, async onFrame, SvgRenderer, Background svgTargets |

**关键区别**: logo-matrix 保留了内联 bg/export 面板 (被遮罩参数分隔), 所以 initEffect 的面板注入会被它覆盖。stack-scan 用 SVG 渲染, 预览直接操作 SVG DOM, 导出通过 SvgRenderer 序列化到隐藏 Canvas。

## 第一阶段完成状态

✅ 共享模块提取 (controls.js, recorder.js, background.js, svg-renderer.js, base.css, utils.js)
✅ initEffect() 一行初始化 (Canvas + Background + Recorder + 面板注入 + 预览循环)
✅ 5 个效果全部对接共享模块
✅ AI 生成效果验证 (particle-field + line-chart)
✅ GUIDE.md / SKILL.md 文档
✅ SVG 渲染管线 (SvgRenderer + Background svgTargets)
✅ utils 函数打包进 initEffect() 返回值 (AI 只需一行 import)
✅ Git 提交 (7 commits, 可回滚)

---

## 待办清单

### 🔴 Bug 修复

#### Bug 1: drawBg() 预览时也强制黑底
- **位置**: shared/controls.js 第 132-136 行
- **问题**: `if (recorder.format !== 'png_seq' && bg.mode === 'transparent')` 只检查了 format, 没检查 isRecording
- **现象**: 用户选了 MP4 格式 + 透明背景, 预览也是黑底, 但实际上只有导出时才需要强制黑底
- **修复**: 加上 `recorder.isRecording &&` 条件
- **代码**:
```javascript
// 现在的 (有 bug):
if (recorder.format !== 'png_seq' && bg.mode === 'transparent') {
// 应该改成:
if (recorder.isRecording && recorder.format !== 'png_seq' && bg.mode === 'transparent') {
```

#### Bug 2: createObjectURL 内存泄漏
- **位置**: shared/background.js 第 92 行
- **问题**: 上传背景图时 `URL.createObjectURL(f)` 从未调用 `URL.revokeObjectURL()`, 反复上传会累积内存
- **修复**: 在 modeSelect change 时, 如果之前有 custom media, revoke 旧的 URL

#### Bug 3: stack-scan 死代码
- **位置**: effects/stack-scan.html 第 360 行
- **问题**: `bgMode: document.getElementById('BgMode').value` 设置了 config 属性但从未被读取
- **修复**: 删除这行

### 🟡 文档补全

#### Doc 1: HTML head 模板
- **问题**: 每个效果的 `<head>` 必须有 jszip + mp4-muxer + base.css 3 行, AI 经常漏写导致崩溃
- **修复**: GUIDE.md 和 SKILL.md 的模板必须完整包含 head 部分, AI 只需改 title 和字体链接

#### Doc 2: body class 说明
- **问题**: base.css 有 3 套 UI 变体 (默认 / body.stack / body.logo), 但文档没提
- **影响**: AI 生成新效果不知道该用哪个 body class, 选错 UI 控件表现不一致
- **决策**: 需要确定新效果默认用哪个 class, 然后写进文档

#### Doc 3: initEffect 返回值文档需同步到 GUIDE.md
- **问题**: GUIDE.md 的模板里 initEffect 解构只列了部分返回值, 缺少 lerp/hexToRgba 等工具函数
- **修复**: 确保模板和 initEffect() 实际返回值一致

### 🟢 共享模块提取

#### Module 1: Easing 缓动函数
- **放哪里**: shared/utils.js
- **内容**: easeOutCubic, easeOutQuart, easeInCubic, easeInOutCubic, easeOutExpo 等
- **现有重复**: line-chart (easeOutCubic/Quart), text-animator (switch 内部), stack-scan (easings 对象)
- **理由**: 几乎所有动画效果都需要, AI 自己写容易参数不一致

#### Module 2: UI 绑定工具
- **放哪里**: shared/controls.js (跟 initEffect 放一起)
- **内容**: `bindUI(config, mappings)` 一行绑定 range/select/color/checkbox → config
- **现有重复**: 每个效果 20-50 行 addEventListener 样板代码
- **理由**: 效果文件最大的噪音来源, 减少 AI 生成样板代码的出错率
- **设计注意**: 不同效果绑定方式差异大 (后缀如 's', 'px', '固定小数位', 触发回调如 initParticles)
- **需要支持**: range → parseFloat, select → string, color → string, checkbox → boolean, 触发回调

#### Module 3: 字体上传
- **放哪里**: shared/utils.js 或新建 shared/font-loader.js
- **内容**: 文件选择 → FileReader/arrayBuffer → FontFace 注册 → select 下拉联动
- **现有重复**: text-animator (handleFontUpload ~8行), stack-scan (setupFontSelector + hiddenFontInput ~30行)
- **理由**: 所有文字类效果都需要, 代码复杂, AI 自己写容易出错

#### Module 4: Canvas 绘图辅助
- **放哪里**: shared/utils.js
- **内容**: drawMediaCover(ctx, media, w, h), drawPattern(ctx, type, color, w, h)
- **现有重复**: logo-matrix 有 drawMediaCover 和 drawPattern, background.js 有 _drawMediaContain 和 _updatePatternCache (内部方法)
- **理由**: 需要图片/视频/纹理作为背景或叠加层的效果都用得到

#### Module 5: 颜色/渐变工具
- **放哪里**: shared/utils.js
- **内容**: createLinearGradient(ctx, stops), createRadialGradient(ctx, stops), 传入坐标和颜色数组直接返回 gradient
- **现有使用**: line-chart 大量使用 hexToRgba + ctx.createLinearGradient + addColorStop
- **理由**: addColorStop 写起来啰嗦且容易格式写错

#### Module 6: 文字排版工具
- **放哪里**: shared/utils.js
- **内容**: measureTextCenter, wrapText (自动换行), 居中定位辅助
- **现有重复**: text-animator 有 calculateLayout, line-chart 有 measureText + textAlign/baseline 组合
- **理由**: measureText + textAlign + dominantBaseline 配合容易出错

#### Module 7: Canvas 尺寸自适应 class
- **放哪里**: shared/base.css
- **内容**: text-animator 有自定义 canvas CSS (max-width:1440px, aspect-ratio:4/3), 跟 base.css 的 canvas 样式冲突
- **修复**: 把 text-animator 的自定义 canvas CSS 移进 base.css 作为可选 class (如 .effect-canvas--custom)
- **理由**: AI 生成时不知道用哪个 canvas 样式

---

## import 错误的历史教训

这是我们最常犯的 bug 类型, 任何改动后必须验证:

1. **删除 import 时连带删了相邻的 import** — particle-field 和 text-animator 的 initEffect import 被误删
2. **initEffect() 忘记传 onFrame** — 4 个效果导出全部崩溃
3. **import 了不存在的函数名** — stack-scan 的 injectSharedControls 不存在
4. **改函数签名时漏更新调用处** — config.scale 重命名为 config.logoScale, bind 调用没同步
5. **批量删除时误删业务代码** — stack-scan 的 easings 常量被误删, updateSVG 引用 undefined 崩溃

**验证方法**: 
- grep 检查所有 effect 文件的 import 行
- grep 检查是否有引用不存在的函数/变量
- curl 检查 HTTP 200
- 浏览器测试 (用户来做, 我的环境没有浏览器)

---

## 核心需求 (来自用户)

1. **模块化项目架构** ✅
2. **新效果 0 成本适配** — 任何人只要描述效果, AI 就能生成完整可用的效果文件
3. **降低对机器的性能要求** — 未开始
4. **外观主题更加好看** — 未开始

## 关键约束

- "不要改项目文件, 而是创建新的项目文件夹和文件" (已遵守)
- "不要调用 gemini 的模型"
- "效果跟原始项目效果一样的, 不要打折扣"
- "我完全能接受有风险, 我需要的是最终结果的稳定可用"
- "新增效果的快速、0 成本适配也是非常重要的"

## 各效果需要的 Google Fonts

| 效果 | 字体 |
|---|---|
| particle-field | Noto Sans SC (400,700,900), Orbitron (900) |
| line-chart | Noto Sans SC (400,700,900), DM Sans (400,500,700) |
| text-animator | Noto Sans SC (100,300,400,500,700,900), Noto Serif SC (200,300,400,500,700,900), Orbitron (900) |
| stack-scan | Noto Sans SC (100,300,400,500,700,900), Noto Serif SC (900), Orbitron (900), Ma Shan Zheng, Exo 2, Playfair Display, Chakra Petch, Montserrat |
| logo-matrix | Noto Sans SC (400,700,900), Orbitron (900) |

→ 可以考虑把常用字体提取到一个共享的 Google Fonts 链接, 减少每个效果自己拼字体 URL
