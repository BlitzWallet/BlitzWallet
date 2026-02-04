/**
 * @format
 */
import './pollyfills.js';
import './disableFontScalling.js';
import './i18n'; // for translation option
import { AppRegistry } from 'react-native';
// import App from './App';
import { name as appName } from './app.json';

// Register background task immediately
import './index.background';
import LendaswapTest from './app/screens/lendaswapTest.js';

AppRegistry.registerComponent(appName, () => LendaswapTest);
