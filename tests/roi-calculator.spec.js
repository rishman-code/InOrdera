const { test, expect } = require('@playwright/test');
const { openHome } = require('./helpers');

async function setSlider(page, id, value) {
  await page.locator(`#${id}`).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('shows the right totals for the default inputs', async ({ page }) => {
  await openHome(page);
  // 40 calls × 20% missed × £25 × 26 days = £5,200
  // 500 orders × £2 upsell = £1,000
  // 150 app orders × £25 × 25% = £937.50
  await expect(page.locator('#roi-part-missed')).toHaveText('£5,200');
  await expect(page.locator('#roi-part-upsell')).toHaveText('£1,000');
  await expect(page.locator('#roi-part-commission')).toHaveText('£938');
  await expect(page.locator('#roi-result-monthly')).toContainText('£7,138');
  await expect(page.locator('#roi-result-yearly')).toHaveText('£85,650/year');
  await expect(page.locator('#roi-missed-calls-desc')).toHaveText('8.0 missed calls/day');
});

test('recalculates when sliders move', async ({ page }) => {
  await openHome(page);
  await setSlider(page, 'roi-calls', 100);
  await setSlider(page, 'roi-missed', 10);
  await setSlider(page, 'roi-aov', 30);
  await setSlider(page, 'roi-days', 30);
  await setSlider(page, 'roi-orders', 1000);
  await setSlider(page, 'roi-upsell', 1.5);
  await setSlider(page, 'roi-platform-orders', 0);
  await setSlider(page, 'roi-commission', 30);

  await expect(page.locator('#roi-calls-val')).toHaveText('100');
  await expect(page.locator('#roi-upsell-val')).toHaveText('£1.50');
  await expect(page.locator('#roi-orders-val')).toHaveText('1,000');
  // 10/day × £30 × 30 = £9,000; 1000 × £1.50 = £1,500; 0 commission
  await expect(page.locator('#roi-part-missed')).toHaveText('£9,000');
  await expect(page.locator('#roi-part-upsell')).toHaveText('£1,500');
  await expect(page.locator('#roi-part-commission')).toHaveText('£0');
  await expect(page.locator('#roi-result-monthly')).toContainText('£10,500');
  await expect(page.locator('#roi-result-yearly')).toHaveText('£126,000/year');
});

test('"Calculate My Lost Revenue" scrolls to the calculator', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: 'Calculate My Lost Revenue →' }).first().click();
  await expect(page.locator('#roi-calculator')).toBeInViewport();
});

test('"See what InOrdera could recover" opens the lead form', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: 'See what InOrdera could recover' }).click();
  await expect(page.locator('#lead-modal')).toHaveClass(/open/);
  await expect(page.locator('#interest-field')).toHaveValue('roi_followup');
});

test('figures in the page source match the calculated defaults', async ({ page, request }) => {
  // Visitors without JavaScript, search engines and link previews see the
  // numbers written in the HTML, so they must agree with calcROI().
  const html = await (await request.get('/InOrdera.html')).text();
  await openHome(page);
  for (const id of ['roi-part-missed', 'roi-part-upsell', 'roi-part-commission', 'roi-result-yearly', 'roi-missed-calls-desc']) {
    const shown = await page.locator(`#${id}`).textContent();
    expect(html, id).toContain(`id="${id}"`);
    expect(html.split(`id="${id}"`)[1].split('<')[0], id).toContain(shown);
  }
  const monthly = (await page.locator('#roi-result-monthly').textContent()).replace('/month', '');
  expect(html.split('id="roi-result-monthly">')[1].split('<')[0]).toBe(monthly);
});
