const fs = require('fs');
const path = require('path');

test('Netlify receives the production policy while Expo development has no CSP meta policy', () => {
  const headers = fs.readFileSync(path.join(__dirname, '../public/_headers'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  expect(headers).toMatch(/^\/\*$/m);
  const policy = headers.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1];
  expect(policy).toBeDefined();
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)[1]).not.toContain("'unsafe-inline'");
  expect(html).not.toMatch(/http-equiv=["']Content-Security-Policy["']/i);
});
