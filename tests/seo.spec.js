const { test, expect } = require('@playwright/test');
const { openHome } = require('./helpers');

test('home page has SEO tags', async ({ page }) => {
  await openHome(page);
  await expect(page).toHaveTitle(/AI Phone Ordering for UK Takeaways/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://inordera.com/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /commission/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://inordera.com/og-image.png');
});

test('structured data parses and the FAQ matches the page', async ({ page }) => {
  await openHome(page);
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length).toBe(1);
  const data = JSON.parse(blocks[0]);
  const types = data['@graph'].map(n => n['@type']);
  expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']));
  const faq = data['@graph'].find(n => n['@type'] === 'FAQPage');
  const onPage = await page.locator('#faq summary.faq-q').evaluateAll(els =>
    els.map(e => e.childNodes[0].textContent.trim()));
  expect(faq.mainEntity.map(q => q.name)).toEqual(onPage);
});

for (const f of ['/robots.txt', '/sitemap.xml', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/og-image.png']) {
  test(`${f} is served`, async ({ request }) => {
    expect((await request.get(f)).status()).toBe(200);
  });
}

for (const f of ['/YumDial.html', '/YumDial%20v2.html', '/downloader.html']) {
  test(`${f} is marked noindex`, async ({ request }) => {
    expect(await (await request.get(f)).text()).toContain('<meta name="robots" content="noindex, nofollow">');
  });
}

test.describe('delivery app commission guide', () => {
  const url = '/delivery-app-commission-uk.html';

  test('has SEO tags and valid structured data', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await expect(page.locator('h1')).toContainText('Deliveroo, Uber Eats and Just Eat commission');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://inordera.com' + url);
    const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    const faq = data['@graph'].find(n => n['@type'] === 'FAQPage');
    const onPage = await page.locator('#faq ~ h3').allTextContents();
    expect(faq.mainEntity.map(q => q.name)).toEqual(onPage);
    expect(errors).toEqual([]);
  });

  test('calculator works out yearly commission and savings', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('#c-year')).toHaveText('£51,480');
    await expect(page.locator('#c-keep')).toHaveText('£12,870');
    await page.fill('#c-orders', '100');
    await page.fill('#c-aov', '20');
    await page.fill('#c-rate', '14');
    await page.fill('#c-shift', '50');
    await expect(page.locator('#c-year')).toHaveText('£14,560');
    await expect(page.locator('#c-keep')).toHaveText('£7,280');
  });

  test('does not scroll sideways', async ({ page }) => {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('is in the sitemap and linked from the home page', async ({ page, request }) => {
    expect(await (await request.get('/sitemap.xml')).text()).toContain('https://inordera.com' + url);
    await page.goto('/InOrdera.html');
    expect(await page.locator('a[href="delivery-app-commission-uk.html"]').count()).toBeGreaterThan(0);
  });
});

test.describe('restaurant staff costs guide', () => {
  const url = '/restaurant-staff-costs-uk.html';

  test('has SEO tags and valid structured data', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await expect(page.locator('h1')).toContainText('Restaurant staff costs in the UK');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://inordera.com' + url);
    const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    const faq = data['@graph'].find(n => n['@type'] === 'FAQPage');
    const onPage = await page.locator('#faq ~ h3').allTextContents();
    expect(faq.mainEntity.map(q => q.name)).toEqual(onPage);
    expect(errors).toEqual([]);
  });

  test('calculator matches the worked example', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('#s-total')).toHaveText('£21,176');
    await expect(page.locator('#s-hourly')).toHaveText('£16.29');
    await page.fill('#s-rate', '12.71');
    await expect(page.locator('#s-total')).toHaveText('£20,339');
    await page.fill('#s-hours', '0');
    await expect(page.locator('#s-total')).toHaveText('£0');
  });

  test('does not scroll sideways', async ({ page }) => {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('is in the sitemap and linked from the home page and commission guide', async ({ page, request }) => {
    expect(await (await request.get('/sitemap.xml')).text()).toContain('https://inordera.com' + url);
    for (const from of ['/InOrdera.html', '/delivery-app-commission-uk.html']) {
      await page.goto(from);
      expect(await page.locator('a[href="restaurant-staff-costs-uk.html"]').count(), from).toBeGreaterThan(0);
    }
  });
});
