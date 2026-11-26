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
