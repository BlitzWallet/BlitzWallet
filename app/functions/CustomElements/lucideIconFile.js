// Maps a lucide export name (PascalCase) to its filename in
// lucide-react-native/dist/esm/icons. Kept separate from themeIcon.js so it can
// be tested without Metro's require.context.

// Deprecated lucide aliases whose export name doesn't match their filename.
const ALIASES = {
  AlertTriangle: 'triangle-alert',
  CircleHelp: 'circle-question-mark',
  Edit: 'square-pen',
  Home: 'house',
  IceCream2: 'ice-cream-bowl',
  Train: 'tram-front',
  Users2: 'users-round',
};

export default function lucideIconFile(iconName) {
  if (!iconName) return null;
  return (
    ALIASES[iconName] ||
    iconName
      .replace(/([a-z])([A-Z0-9])/g, '$1-$2')
      .replace(/([A-Z0-9])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase()
  );
}

export { ALIASES };
