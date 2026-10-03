// Stubs external services so tests are fast and never touch the network.
// Calendly's widget is replaced with a fake that records the popup URL.
const CALENDLY_STUB = `window.Calendly = { initPopupWidget(opts) { (window.__calendlyCalls = window.__calendlyCalls || []).push(opts.url); } };`;

async function stubExternal(page, { calendly = true } = {}) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ body: '' }));
  await page.route(/assets\.calendly\.com/, route => {
    if (!calendly) return route.abort();
    const isJs = route.request().url().endsWith('.js');
    return route.fulfill({ contentType: isJs ? 'text/javascript' : 'text/css', body: isJs ? CALENDLY_STUB : '' });
  });
}

async function openHome(page, opts) {
  await stubExternal(page, opts);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/InOrdera.html');
  return errors;
}

module.exports = { stubExternal, openHome };
