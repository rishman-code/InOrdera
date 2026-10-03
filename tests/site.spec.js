const { test, expect } = require('@playwright/test');
const { openHome, stubExternal } = require('./helpers');

test('home page loads without JavaScript errors', async ({ page }) => {
  const errors = await openHome(page);
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('all in-page anchors point at sections that exist', async ({ page }) => {
  await openHome(page);
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')]
      .map(a => a.getAttribute('href'))
      .filter(h => h.length > 1 && !document.querySelector(h)));
  expect(missing).toEqual([]);
});

test('linked pages load', async ({ page, request }) => {
  await openHome(page);
  const hrefs = await page.evaluate(() => [...new Set(
    [...document.querySelectorAll('a[href$=".html"]')].map(a => a.getAttribute('href')))]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const res = await request.get('/' + href);
    expect(res.status(), href).toBe(200);
  }
});

for (const p of ['careers.html', 'privacy-policy.html', 'terms-of-service.html', 'cookie-policy.html', 'gdpr.html']) {
  test(`${p} renders without JavaScript errors`, async ({ page }) => {
    await stubExternal(page);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/' + p);
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
}

test('page does not scroll sideways', async ({ page }) => {
  await openHome(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('mobile burger menu opens and closes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'burger menu only shows on small screens');
  await openHome(page);
  const panel = page.locator('#mobile-panel');
  await page.locator('#burger-btn').click();
  await expect(panel).toHaveClass(/open/);
  await expect(page.locator('#burger-btn')).toHaveAttribute('aria-expanded', 'true');
  await panel.getByRole('link', { name: 'FAQ' }).click();
  await expect(panel).not.toHaveClass(/open/);
});
