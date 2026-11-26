const base = require('./playwright.config.js');
for (const p of base.projects) p.use = { ...p.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } };
module.exports = base;
