// @ts-check
/**
 * 冒烟测试：逐页加载首页与所有效果页，断言无 JS 错误；图表额外做模式往返切换。
 * 目的：自动拦截「加载报错 / 预设键不对称(definePresetPair) / 切换残留 / div 配平失误」等回归，
 * 为 B/C 阶段重构提供兜底。
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 枚举 effects/*.html + 首页
const effectsDir = path.join(__dirname, '..', 'effects');
const effectPages = fs
  .readdirSync(effectsDir)
  .filter((f) => f.endsWith('.html'))
  .map((f) => `/effects/${f}`)
  .sort();
const allPages = ['/index.html', ...effectPages];

// 过滤网络类噪声（CDN 字体/jszip 偶发失败、favicon 404），只保留真正的 JS 错误与断言
function isRealError(text) {
  return !/Failed to load resource|net::|favicon|ERR_|status of (4|5)\d\d|preload/i.test(text);
}

function attachErrorCollectors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && isRealError(msg.text())) {
      errors.push(`[console] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  return errors;
}

for (const url of allPages) {
  test(`加载无错误: ${url}`, async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await page.goto(url, { waitUntil: 'load' });
    // 给异步初始化（模块脚本、字体、WebGL、面板注入）留时间
    await page.waitForTimeout(1500);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// 图表：纸张↔赛博↔纸张 往返切换不报错（覆盖 definePresetPair + 预设残留）
const chartPages = effectPages.filter((u) => /chart-fx|bar-chart/.test(u));
for (const url of chartPages) {
  test(`模式往返切换无报错: ${url}`, async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    async function setMode(mode) {
      await page.evaluate((m) => {
        const s = document.getElementById('EffectMode');
        if (!s) throw new Error('找不到 #EffectMode 下拉');
        s.value = m;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      }, mode);
      await page.waitForTimeout(400);
    }

    await setMode('cyber');
    await setMode('paper');
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
