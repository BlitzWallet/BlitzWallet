// import {
//   connect,
//   defaultConfig,
//   LiquidNetwork,
// } from '@breeztech/react-native-breez-sdk-liquid';
import { getOrCreateDirectory } from './connectToNode';
import { crashlyticsLogReport } from './crashlyticsLogs';

// let _cachedBreezLiquidModule = null;
// function getBreezLiquidSDK() {
//   if (!_cachedBreezLiquidModule) {
//     _cachedBreezLiquidModule = require('@breeztech/react-native-breez-sdk-liquid');
//   }
//   return _cachedBreezLiquidModule;
// }

// const logHandler = logEntry => {
//   if (logEntry.level != 'TRACE') {
//     console.log(`[${logEntry.level}]: ${logEntry.line}`);
//   }
// };
// Lazy require so the native module is only loaded when the Liquid page opens.
export default async function connectToLiquidNode(accountMnemoinc) {
  crashlyticsLogReport('Starting connect to liquid function');
  try {
    const {
      connect,
      defaultConfig,
      LiquidNetwork,
    } = require('@breeztech/react-native-breez-sdk-liquid');
    const config = await defaultConfig(
      LiquidNetwork[
        process.env.BOLTZ_ENVIRONMENT === 'testnet' ? 'TESTNET' : 'MAINNET'
      ],
      process.env.LIQUID_BREEZ_KEY,
    );
    config.workingDir = await getOrCreateDirectory(
      'liquidFilesystemUUID',
      config.workingDir,
    );
    await connect({ mnemonic: accountMnemoinc, config });
    return { isConnected: true, reason: null };
  } catch (err) {
    console.log(err, 'connect to node err LIQUID');
    return { isConnected: false, reason: err };
  }
}
