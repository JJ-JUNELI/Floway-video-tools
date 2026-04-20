/**
 * Floway Tools — 主题系统
 * 支持 dark / light / glass 三套主题，通过 data-theme 属性 + JS 对象双重驱动
 *
 * 使用方式：
 *   import { getTheme, setTheme, themes } from '../shared/themes.js';
 *   const t = getTheme();
 *   ctx.fillStyle = t.canvasText;
 *   setTheme('light');  // 切换并自动重绘
 */

// ============================================================
//  主题定义
// ============================================================
export const themes = {
  dark: {
    id: 'dark',
    name: '暗色',

    // ---- CSS 变量映射（供参考，实际由 base.css 控制）----
    bg: '#0e1117',
    panelBg: '#161b22',
    cardBg: '#1c2333',
    textMain: '#e5e7eb',
    textSub: '#6b7280',
    border: 'rgba(255,255,255,0.06)',
    accent: '#818cf8',
    danger: '#f87171',

    // ---- Canvas 渲染颜色 ----
    canvasBg: '#000000',           // 画布背景
    canvasCardFill: '#000000',     // 卡片投影填充
    canvasShadow: 'rgba(0,0,0,0.35)',       // 卡片阴影
    canvasText: 'rgba(255,255,255,0.3)',    // 坐标轴标签
    canvasGrid: 'rgba(255,255,255,0.08)',   // 网格线
    canvasAxisLine: 'rgba(255,255,255,0.08)', // 坐标轴线
    canvasLineHighlight: 'rgba(255,255,255,0.8)', // 线条高光层
    canvasPointWhite: '#ffffff',     // 数据点白心
    canvasValueBg: 'rgba(255,255,255,0.08)', // 数值标签背景

    // ---- 卡片 3D 光照（暗色底）----
    cardBaseColor: '#1a1a2e',        // 卡片底色（用于光照计算）
    cardBorderColor: '#333355',      // 卡片边框

    // ---- 辉光/发光 ----
    glowColor: '#818cf8',            // 辉光色（= accent）

    // ---- 文字阴影 ----
    textShadowColor: '#000000',

    // ---- 录制指示器 ----
    recIndicatorBg: 'rgba(0,0,0,0.8)',
  },

  light: {
    id: 'light',
    name: '亮色',

    // ---- CSS 变量映射 ----
    bg: '#f8fafc',
    panelBg: '#ffffff',
    cardBg: '#f1f5f9',
    textMain: '#1e293b',
    textSub: '#94a3b8',
    border: 'rgba(0,0,0,0.06)',
    accent: '#6366f1',
    danger: '#ef4444',

    // ---- Canvas 渲染颜色 ----
    canvasBg: '#fafaf7',             // 暖白纸张底
    canvasCardFill: '#ffffff',       // 卡片投影填充（白色）
    canvasShadow: 'rgba(0,0,0,0.06)',        // 轻微阴影
    canvasText: 'rgba(60,60,60,0.4)',         // 深灰坐标轴标签
    canvasGrid: 'rgba(180,170,155,0.25)',     // 暖棕网格线
    canvasAxisLine: 'rgba(180,170,155,0.15)', // 淡坐标轴线
    canvasLineHighlight: 'rgba(80,80,80,0.5)', // 深灰线条高光（不用白色）
    canvasPointWhite: '#ffffff',      // 数据点白心（保持）
    canvasValueBg: 'rgba(80,80,80,0.08)',    // 灰色数值标签背景

    // ---- 卡片 3D 光照（亮色底）----
    cardBaseColor: '#ffffff',         // 白色卡片
    cardBorderColor: '#ddddee',       // 淡边框

    // ---- 辉光/发光（亮色下降低强度）----
    glowColor: '#6366f1',             // 靛蓝辉光

    // ---- 文字阴影 ----
    textShadowColor: 'rgba(255,255,255,0.8)',

    // ---- 录制指示器 ----
    recIndicatorBg: 'rgba(255,255,255,0.9)',
  },

  glass: {
    id: 'glass',
    name: '毛玻璃',

    // ---- CSS 变量映射 ----
    bg: '#08080e',
    panelBg: 'rgba(14, 14, 22, 0.75)',
    cardBg: 'rgba(255,255,255,0.04)',
    textMain: '#e0e0ec',
    textSub: '#8888a0',
    border: 'rgba(255,255,255,0.06)',
    accent: '#818cf8',
    danger: '#f87171',

    // ---- Canvas 渲染颜色（复用 dark）----
    canvasBg: '#000000',
    canvasCardFill: '#000000',
    canvasShadow: 'rgba(0,0,0,0.35)',
    canvasText: 'rgba(255,255,255,0.3)',
    canvasGrid: 'rgba(255,255,255,0.08)',
    canvasAxisLine: 'rgba(255,255,255,0.08)',
    canvasLineHighlight: 'rgba(255,255,255,0.8)',
    canvasPointWhite: '#ffffff',
    canvasValueBg: 'rgba(255,255,255,0.08)',

    // ---- 卡片 3D 光照 ----
    cardBaseColor: '#1a1a2e',
    cardBorderColor: 'rgba(255,255,255,0.08)',

    // ---- 辉光/发光 ----
    glowColor: '#818cf8',

    // ---- 文字阴影 ----
    textShadowColor: '#000000',

    // ---- 录制指示器 ----
    recIndicatorBg: 'rgba(0,0,0,0.7)',
  }
};

// ============================================================
//  当前主题状态
// ============================================================
let currentTheme = themes.dark;

// ============================================================
//  公开 API
// ============================================================

/** 获取当前主题对象 */
export function getTheme() {
  return currentTheme;
}

/**
 * 切换主题
 * @param {'dark'|'light'|'glass'} name - 主题名称
 * @returns 切换后的主题对象
 */
export function setTheme(name) {
  currentTheme = themes[name] || themes.dark;

  // 设置 DOM 属性（触发 CSS 变量切换）
  document.body.setAttribute('data-theme', currentTheme.id);

  // 全局引用（供非模块化代码读取）
  window.__flowayTheme = currentTheme;

  // 持久化
  try {
    localStorage.setItem('floway-theme', currentTheme.id);
  } catch (e) { /* localStorage 不可用时静默 */ }

  return currentTheme;
}

/** 切换到另一个主题（dark ↔ light 双态） */
export function toggleTheme() {
  return setTheme(currentTheme.id === 'dark' ? 'light' : 'dark');
}

/** 获取当前是否为亮色 */
export function isLightTheme() {
  return currentTheme.id === 'light';
}

// ============================================================
//  自动初始化：读取存储的主题偏好
// ============================================================
(function initTheme() {
  try {
    const saved = localStorage.getItem('floway-theme');
    if (saved && themes[saved]) {
      setTheme(saved);
    } else {
      window.__flowayTheme = currentTheme;
    }
  } catch (e) {
    window.__flowayTheme = currentTheme;
  }
})();
