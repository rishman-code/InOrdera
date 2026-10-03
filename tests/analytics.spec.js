const { test, expect } = require('@playwright/test');
const { openHome } = require('./helpers');

const events = page => page.evaluate(() => window.dataLayer.map(e => e.event));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.dataLayer = []; });
});

test('opening Calendly or the form does not count as a booking', async ({ page }) => {
  await openHome(page);
  await page.waitForFunction(() => !!window.Calendly);
  await page.locator('[onclick*="openCalendly"]:visible').first().click();
  await page.evaluate(() => openModal('pricing'));

  const fired = await events(page);
  expect(fired).toContain('live_demo_click');
  expect(fired).toContain('lead_form_opened');
  expect(fired).not.toContain('demo_booked');
});

test('demo_booked fires when Calendly reports a scheduled event', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {
    origin: 'https://calendly.com', data: { event: 'calendly.event_scheduled' },
  })));
  expect(await events(page)).toContain('demo_booked');
});

test('ignores booking messages from other origins', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {
    origin: 'https://evil.example', data: { event: 'calendly.event_scheduled' },
  })));
  expect(await events(page)).not.toContain('demo_booked');
});
