/**
 * @format
 */
import './pollyfills.js';
import './disableFontScalling.js';
import './i18n'; // for translation option
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {registerBackgroundNotificationTask} from './context-store/notificationManager.js';

// Register background task immediately
registerBackgroundNotificationTask();

AppRegistry.registerComponent(appName, () => App);
