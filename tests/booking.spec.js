const { test, expect } = require('@playwright/test');
const { openHome } = require('./helpers');

const CALENDLY_URL = 'https://calendly.com/inordera-sales';

test('every visible booking CTA opens the Calendly popup', async ({ page }) => {
  const errors = await openHome(page);
  await page.waitForFunction(() => !!window.Calendly);

  const ctas = page.locator('[onclick*="openCalendly"]:visible');
  const count = await ctas.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    await ctas.nth(i).click();
  }
  const calls = await page.evaluate(() => window.__calendlyCalls || []);
  expect(calls).toEqual(Array(count).fill(CALENDLY_URL));
  expect(errors).toEqual([]);
});

test('mobile menu "Try It" closes the menu and opens Calendly', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'burger menu only shows on small screens');
  await openHome(page);
  await page.waitForFunction(() => !!window.Calendly);

  await page.locator('#burger-btn').click();
  await expect(page.locator('#mobile-panel')).toHaveClass(/open/);
  await page.locator('#mobile-panel button').click();
  await expect(page.locator('#mobile-panel')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => window.__calendlyCalls)).toEqual([CALENDLY_URL]);
});

test('falls back to opening Calendly in a new tab if the widget fails to load', async ({ page }) => {
  await page.addInitScript(() => {
    window.open = (url, target) => { window.__opened = { url, target }; return null; };
  });
  await openHome(page, { calendly: false });

  await page.locator('[onclick*="openCalendly"]:visible').first().click();
  expect(await page.evaluate(() => window.__opened)).toEqual({ url: CALENDLY_URL, target: '_blank' });
});
