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
  // Starts a fake SMTP server that writes emails to test-results/smtp-outbox.log.
  globalSetup: require.resolve('./tests/fixtures/global-setup'),
  // PHP's built-in server runs send-demo-request.php for real, configured to
  // send through the fake SMTP server and save leads to test-results/leads.csv.
  webServer: {
    command: `php -S 127.0.0.1:${PORT}`,
    env: { INORDERA_CONFIG: 'tests/fixtures/inordera-config.php' },
    url: `http://127.0.0.1:${PORT}/InOrdera.html`,
    reuseExistingServer: !process.env.CI,
  },
});
