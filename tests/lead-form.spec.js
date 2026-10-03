const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { openHome } = require('./helpers');

const OUTBOX = path.join(__dirname, '..', 'test-results', 'outbox.log');

// Each button that opens the shared lead form, and the enquiry type it should send.
const MODAL_CTAS = [
  { name: 'See what InOrdera could recover', interest: 'roi_followup', title: 'Talk to us about your restaurant' },
  { name: 'See Website Ordering →', interest: 'website_ordering', title: 'See Website Ordering' },
  { name: 'Join the Founding Restaurant Programme →', interest: 'founding_programme', title: 'Apply for the Founding Restaurant Programme' },
  { name: 'Apply for the Founding Restaurant Programme →', interest: 'founding_programme', title: 'Apply for the Founding Restaurant Programme' },
  { name: 'Talk to us about pricing →', interest: 'pricing', title: 'Talk to us about pricing' },
  { name: 'Start My Trial →', interest: 'trial', title: 'Start My Trial' },
  { link: 'Contact us', interest: 'integrations', title: 'Check POS compatibility' },
  { link: 'Contact', exact: true, interest: 'sales', title: 'Talk to Sales' },
];

async function fillForm(page, overrides = {}) {
  const v = { first: 'Test', last: 'Enquiry', email: 'test@example.com', restaurant: 'Playwright Bistro', phone: '7700 900000', locations: '2-5', ...overrides };
  await page.fill('#f-first', v.first);
  await page.fill('#f-last', v.last);
  await page.fill('#f-email', v.email);
  await page.fill('#f-restaurant', v.restaurant);
  await page.fill('#f-phone', v.phone);
  await page.selectOption('#f-locations', v.locations);
}

for (const cta of MODAL_CTAS) {
  test(`"${cta.name || cta.link}" opens the form as a ${cta.interest} enquiry`, async ({ page }) => {
    await openHome(page);
    const target = cta.name
      ? page.getByRole('button', { name: cta.name })
      : page.getByRole('link', { name: cta.link, exact: !!cta.exact });
    await target.first().click();
    await expect(page.locator('#lead-modal')).toHaveClass(/open/);
    await expect(page.locator('#modal-title')).toHaveText(cta.title);
    await expect(page.locator('#interest-field')).toHaveValue(cta.interest);
  });
}

test('modal closes via ✕, Escape and clicking the backdrop', async ({ page }) => {
  await openHome(page);
  const modal = page.locator('#lead-modal');
  const open = () => page.evaluate(() => openModal('demo'));

  await open();
  await page.locator('.modal-close').click();
  await expect(modal).not.toHaveClass(/open/);

  await open();
  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/open/);

  await open();
  await modal.click({ position: { x: 5, y: 5 } });
  await expect(modal).not.toHaveClass(/open/);
});

test('browser blocks submission when required fields are empty', async ({ page }) => {
  await openHome(page);
  let posted = false;
  page.on('request', r => { if (r.url().includes('send-demo-request.php')) posted = true; });
  await page.evaluate(() => openModal('demo'));
  await page.locator('#submit-btn').click();
  await expect(page.locator('#modal-success')).toBeHidden();
  expect(posted).toBe(false);
});

test('submits through the real PHP handler and emails the enquiry', async ({ page }, testInfo) => {
  await openHome(page);
  const restaurant = `Playwright Bistro ${testInfo.project.name} ${Date.now()}`;
  await page.getByRole('button', { name: 'Talk to us about pricing →' }).click();
  await fillForm(page, { restaurant });
  await page.locator('#submit-btn').click();

  await expect(page.locator('#modal-success')).toBeVisible();
  await expect(page.locator('#lead-form')).toBeHidden();

  const mail = fs.readFileSync(OUTBOX, 'utf8');
  const block = mail.slice(mail.indexOf(`Subject: New pricing enquiry: ${restaurant}`));
  expect(block).toContain('Type: Pricing enquiry');
  expect(block).toContain('Name: Test Enquiry');
  expect(block).toContain('Phone: +44 7700 900000');
  expect(block).toContain('Locations: 2-5');
  expect(block).toContain('Reply-To: Test Enquiry <test@example.com>');
});

test('shows an error and lets the user retry if the server fails', async ({ page }) => {
  await openHome(page);
  await page.route('**/send-demo-request.php', r => r.fulfill({ status: 500, body: '{"error":"x"}' }));
  await page.evaluate(() => openModal('demo'));
  await fillForm(page);
  await page.locator('#submit-btn').click();

  await expect(page.locator('#modal-error')).toBeVisible();
  await expect(page.locator('#submit-btn')).toBeEnabled();
  await expect(page.locator('#submit-btn')).toHaveText('Submit');
});

// Known bug: after a successful submit the Submit button stays disabled ("Submitting…"),
// so reopening the form leaves it unusable. Remove test.fail once fixed.
test('form is usable again when reopened after a successful submit', async ({ page }) => {
  test.fail();
  await openHome(page);
  await page.route('**/send-demo-request.php', r => r.fulfill({ status: 200, body: '{"success":true}' }));
  await page.evaluate(() => openModal('demo'));
  await fillForm(page);
  await page.locator('#submit-btn').click();
  await expect(page.locator('#modal-success')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.evaluate(() => openModal('trial'));
  await expect(page.locator('#lead-form')).toBeVisible();
  await expect(page.locator('#submit-btn')).toBeEnabled();
  await expect(page.locator('#submit-btn')).toHaveText('Submit');
});
