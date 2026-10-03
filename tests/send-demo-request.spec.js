const { test, expect } = require('@playwright/test');

// Server-side checks on the PHP handler; browser-independent, so desktop only.
test.skip(({ isMobile }) => isMobile);

const VALID = {
  first_name: 'Test', last_name: 'Enquiry', email: 'test@example.com',
  restaurant_name: 'Endpoint Bistro', phone: '+44 7700 900000', locations: '1', interest: 'demo',
};

test('rejects GET with 405', async ({ request }) => {
  const res = await request.get('/send-demo-request.php');
  expect(res.status()).toBe(405);
});

test('accepts a valid enquiry', async ({ request }) => {
  const res = await request.post('/send-demo-request.php', { form: VALID });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ success: true });
});

for (const field of ['first_name', 'last_name', 'email', 'restaurant_name', 'phone', 'locations']) {
  test(`rejects a missing ${field} with 400`, async ({ request }) => {
    const res = await request.post('/send-demo-request.php', { form: { ...VALID, [field]: '' } });
    expect(res.status()).toBe(400);
  });
}

test('rejects an invalid email with 400', async ({ request }) => {
  const res = await request.post('/send-demo-request.php', { form: { ...VALID, email: 'not-an-email' } });
  expect(res.status()).toBe(400);
});

test('strips newlines so headers cannot be injected', async ({ request }) => {
  const res = await request.post('/send-demo-request.php', {
    form: { ...VALID, first_name: 'Eve\r\nBcc: victim@example.com' },
  });
  expect(res.status()).toBe(200);
  const fs = require('fs');
  const outbox = fs.readFileSync(require('path').join(__dirname, '..', 'test-results', 'outbox.log'), 'utf8');
  expect(outbox).not.toMatch(/^Bcc: victim@example\.com/m);
});
