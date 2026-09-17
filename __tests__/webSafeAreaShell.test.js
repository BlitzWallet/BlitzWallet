const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, '../public/index.html'),
  'utf8',
);

test('iOS standalone uses a full-screen viewport with safe-area insets', () => {
  expect(html).toMatch(/name="viewport"[\s\S]*?viewport-fit=cover/);
  expect(html).toMatch(
    /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/,
  );
  expect(html).toMatch(/html,\s*body\s*\{[^}]*height:\s*100vh/s);
  expect(html).toContain('height: var(--app-viewport-height, 100vh)');
});
