/**
 * Lucide's barrel re-exports ~1,700 icons, so `import * as LucidIcons` built
 * every one of them the first time any icon rendered. require.context bundles
 * the same modules but only evaluates the one actually asked for.
 *
 * Metro-only API — jest maps this module to __mocks__/lucideIcons.js.
 */
const ICONS = require.context(
  '../../../node_modules/lucide-react-native/dist/esm/icons',
  false,
  /^\.\/[a-z0-9-]+\.js$/,
);

export default function lucideIcon(fileName) {
  return ICONS(`./${fileName}.js`).default;
}
