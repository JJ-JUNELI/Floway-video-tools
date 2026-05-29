// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * 冒烟测试配置：起本地静态服务器，用 Chromium 逐页加载断言无错误。
 * 本地：`npm install` → `npm run test:install`（首次装浏览器）→ `npm test`。
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8000',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 图表用 WebGL；headless CI 无 GPU，允许软件渲染(swiftshader)避免取不到 context
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
