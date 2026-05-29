// @ts-check
/**
 * 控件默认值快照测试。
 * 逐个加载效果页，dump 所有控件(input/select/textarea[id])的初始值/勾选态，
 * 与 tests/snapshots/<effect>.json 比对。任何「无声改默认值」(改 config / HTML value=
 * / syncFromConfig 行为)都会让对应快照飘红——补上了冒烟测试只测「不报错」的盲区。
 *
 * 有意修改默认值后，更新快照：
 *   UPDATE_SNAPSHOTS=1 npm test          (WSL/Linux/macOS)
 *   $env:UPDATE_SNAPSHOTS=1; npm test    (PowerShell)
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SNAP_DIR = path.join(__dirname, 'snapshots');
const effectPages = fs
  .readdirSync(path.join(__dirname, '..', 'effects'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => `/effects/${f}`)
  .sort();

for (const url of effectPages) {
  const name = url.split('/').pop().replace('.html', '');
  test(`控件默认值快照: ${name}`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const dump = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('input[id], select[id], textarea[id]').forEach((el) => {
        out[el.id] = el.type === 'checkbox' ? !!el.checked : el.value;
      });
      return out;
    });
    const actual = JSON.stringify(dump, null, 2);
    const snapFile = path.join(SNAP_DIR, name + '.json');

    if (process.env.UPDATE_SNAPSHOTS || !fs.existsSync(snapFile)) {
      fs.mkdirSync(SNAP_DIR, { recursive: true });
      fs.writeFileSync(snapFile, actual);
      console.log(`[snapshot] 写入 ${name}.json`);
      return;
    }
    // 归一化换行：git autocrlf 可能把快照文件检出成 CRLF，而 JSON.stringify 产出 LF，
    // 不归一化会在 Windows 全新检出时误报不符。
    const norm = (s) => s.replace(/\r\n/g, '\n');
    const expected = fs.readFileSync(snapFile, 'utf8');
    expect(
      norm(actual),
      `控件默认值与快照 ${name}.json 不符。若为有意修改，运行 UPDATE_SNAPSHOTS=1 npm test 更新。`
    ).toBe(norm(expected));
  });
}
