/**
 * Web entry point. Mirrors index.js but uses web polyfills and omits the
 * native background handler (FCM / expo-task-manager have no web equivalent).
 * App.tsx calls registerRootComponent(App), which mounts into the DOM on web.
 */
import '@expo/metro-runtime';
import './pollyfills.web.js';
import './disableFontScalling.js';
import './i18n';
import './App';

// index.web.js — add after the existing side-effect imports
import * as Font from 'expo-font';

Font.loadAsync({
  'Poppins-Light': require('./app/assets/fonts/Poppins-Light.ttf'),
  'Poppins-Regular': require('./app/assets/fonts/Poppins-Regular.ttf'),
  'Poppins-Medium': require('./app/assets/fonts/Poppins-Medium.ttf'),
  'Poppins-SemiBold': require('./app/assets/fonts/Poppins-SemiBold.ttf'),
  'Poppins-Bold': require('./app/assets/fonts/Poppins-Bold.ttf'),
  Blitzicons1: require('./app/assets/fonts/Blitzicons1.ttf'),
});
