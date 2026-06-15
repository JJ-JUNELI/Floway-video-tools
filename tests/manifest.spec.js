// @ts-check
/**
 * 清单漂移测试：守住 effects/manifest.js ↔ effects/*.html ↔ 首页渲染 三者一致。
 * 防止「新增效果忘了登记 manifest」或「manifest 指向不存在的文件」这类无声漂移。
 *
 * 注：manifest.js 是 ESM，而 playwright 测试运行器按 CJS 转译项目 .js（package.json 无 type:module），
 * 故不在 node 侧 import，而是在浏览器里 import（真 ESM、由 dev server 提供）再回传比对。
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const effectsDir = path.join(__dirname, '..', 'effects');

// 磁盘上的效果文件（排除 manifest.js 等非效果文件）
const diskFiles = fs
  .readdirSync(effectsDir)
  .filter((f) => f.endsWith('.html'))
  .map((f) => `effects/${f}`)
  .sort();

async function loadEffects(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const m = await import('/effects/manifest.js');
    return m.EFFECTS;
  });
}

test('manifest 与 effects/*.html 双向一致', async ({ page }) => {
  const effects = await loadEffects(page);
  const manifestFiles = effects.map((e) => e.file).sort();

  // 每个磁盘效果文件都在 manifest 里（漏登记 → 失败）；每个 manifest 条目都指向真实文件（写错路径/删了文件 → 失败）
  expect(manifestFiles, '清单与磁盘 effects/*.html 不一致').toEqual(diskFiles);

  // id 唯一、字段完整、分类合法
  const ids = new Set();
  for (const e of effects) {
    expect(e.id, `条目缺 id: ${JSON.stringify(e)}`).toBeTruthy();
    expect(ids.has(e.id), `id 重复: ${e.id}`).toBe(false);
    ids.add(e.id);
    for (const k of ['title', 'desc', 'category', 'version', 'keywords', 'icon']) {
      expect(e[k], `${e.id} 缺字段 ${k}`).toBeTruthy();
    }
    expect(['text', 'visual', 'chart', 'particle'], `${e.id} 分类非法: ${e.category}`).toContain(e.category);
  }
});

test('首页渲染卡片数量/顺序与 manifest 一致', async ({ page }) => {
  const effects = await loadEffects(page);

  const cards = await page.$$eval('#ToolGrid .ext-card', (els) =>
    els.map((e) => ({ href: e.getAttribute('href'), cat: e.getAttribute('data-category') }))
  );

  expect(cards.length, '渲染卡片数与 manifest 不符（渲染失败或数据不符）').toBe(effects.length);
  expect(cards.map((c) => c.href)).toEqual(effects.map((e) => e.file));
  expect(cards.map((c) => c.cat)).toEqual(effects.map((e) => e.category));
});
