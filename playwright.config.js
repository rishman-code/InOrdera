// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8123;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // PHP's built-in server runs send-demo-request.php for real. mail() is
  // redirected to a file so tests can read the email instead of sending it.
  webServer: {
    command: `mkdir -p test-results && php -d sendmail_path="cat >> test-results/outbox.log" -S 127.0.0.1:${PORT}`,
    url: `http://127.0.0.1:${PORT}/InOrdera.html`,
    reuseExistingServer: !process.env.CI,
  },
});
