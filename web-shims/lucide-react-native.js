// Web shim for lucide-react-native. lucide-react exposes the same icon set with
// a compatible prop API (size/color/strokeWidth/fill/style). themeIcon.js sets
// color via style={{ color }} and lucide-react's SVG uses stroke="currentColor",
// so the color cascades on web. Covers the namespace import in themeIcon.js and
// the direct named imports elsewhere.
export * from 'lucide-react';
