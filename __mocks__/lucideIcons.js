// jest stand-in for lucideIcons.js, which uses Metro's require.context.
module.exports = {
  __esModule: true,
  default: fileName =>
    require(`lucide-react-native/dist/esm/icons/${fileName}.js`).default,
};
