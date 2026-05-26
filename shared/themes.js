/**
 * Floway Tools — 主题系统
 * 支持 dark / light 两套主题，通过 data-theme 属性 + JS 对象双重驱动
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
 * @param {'dark'|'light'} name - 主题名称
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

/**
 * 强制重绘：移动端切换主题后，fixed 背景层（body::before 色晕）与
 * backdrop-filter 玻璃层常不自动重新采样（需滚动才刷新）。瞬时把 body
 * 透明度改成 0.9999（肉眼无感）逼整棵子树重新合成，下一帧还原。
 */
function forceMobileRepaint() {
  const b = document.body;
  if (!b) return;
  b.style.opacity = '0.9999';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { b.style.opacity = ''; });
  });
}

/** 切换到另一个主题（dark ↔ light 双态） */
export function toggleTheme() {
  const t = setTheme(currentTheme.id === 'dark' ? 'light' : 'dark');
  forceMobileRepaint();
  return t;
}

/** 获取当前是否为亮色 */
export function isLightTheme() {
  return currentTheme.id === 'light';
}

export const moonSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
export const sunSVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

/**
 * 初始化主题切换按钮（SVG 图标，与 index.html 一致）
 * @param {string} [btnId='themeToggle']
 */
export function initThemeToggle(btnId = 'themeToggle') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const update = () => { btn.innerHTML = currentTheme.id === 'dark' ? sunSVG : moonSVG; };
  btn.addEventListener('click', () => { toggleTheme(); update(); });
  update();
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
