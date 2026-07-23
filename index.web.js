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
