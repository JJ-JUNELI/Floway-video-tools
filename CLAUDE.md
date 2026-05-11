# CLAUDE.md — 项目上下文

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
- [ ] **VideoEncoder 没有 feature detection**：Firefox 用户打开 MP4 选项会报错。加 `if (typeof VideoEncoder === 'undefined')` 检测
- [ ] **Recorder 库检测靠 setTimeout 300ms**：弱网下 jszip CDN 没到就误判失败。改为轮询或 script.onload
- [ ] **start.sh 不支持 macOS**：缺少 `open` 命令，只处理了 WSL 和 Linux
- [ ] **预览橱窗 stack-scan 仍可能有滚动条**：SVG preserveAspectRatio="slice" 溢出问题可能还未完全解决，需实际测试

### 小问题
- [ ] **精选区和全部工具区重复展示**：chart-fx、text-animator、stack-scan 同时出现在精选和全部工具区
- [ ] **README 效果列表过时**：列了 10 个效果（含"简洁折线图""纸张折线图"），实际已合并为 8 个

### 无所谓
- [ ] `drawMediaContain` 函数名叫反了（实际是 cover 行为），目前只内部使用
- [ ] `drawTextWrapped` 按字符拆分，英文会断词，但项目定位中文场景

## 本地开发
```bash
./start.sh          # 启动 HTTP 服务器（端口 8000）
# 或
python3 -m http.server 8000
```

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
  custom-select.js  # 自定义下拉框
  svg-renderer.js   # SVG → Canvas 渲染管线
  paper-texture.js  # 纸张纹理生成
GUIDE.md            # AI 开发规范（模板结构、API 说明）
STATUS.md           # 效果状态追踪
```
