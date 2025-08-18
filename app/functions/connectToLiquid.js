import {
  connect,
  defaultConfig,
  LiquidNetwork,
} from '@breeztech/react-native-breez-sdk-liquid';
import {getOrCreateDirectory} from './connectToNode';
import {crashlyticsLogReport} from './crashlyticsLogs';

const logHandler = logEntry => {
  if (logEntry.level != 'TRACE') {
    console.log(`[${logEntry.level}]: ${logEntry.line}`);
  }
};
let didConnect = false;
export default async function connectToLiquidNode(accountMnemoinc) {
  crashlyticsLogReport('Starting connect to liquid function');
  // Create the default config

  // setLogger(logHandler);

  if (didConnect) {
    console.log('RUNNING IN DID CONNECT');
    return {
      isConnected: true,
      reason: null,
    };
  }

  didConnect = true;
  try {
    crashlyticsLogReport('Getting config and mnemoinc');
    // Create the default config, providing your Breez API key
    const [config, mnemonic] = await Promise.all([
      defaultConfig(
        LiquidNetwork[
          process.env.BOLTZ_ENVIRONMENT === 'testnet' ? 'TESTNET' : 'MAINNET'
        ],
        process.env.LIQUID_BREEZ_KEY,
      ),
      Promise.resolve(accountMnemoinc),
    ]);

    crashlyticsLogReport('Creating directory');
    const directoryPath = await getOrCreateDirectory(
      'liquidFilesystemUUID',
      config.workingDir,
    );
    config.workingDir = directoryPath;
    // By default in React Native the workingDir is set to:
    // `/<APPLICATION_SANDBOX_DIRECTORY>/breezSdkLiquid`
    // You can change this to another writable directory or a
    // subdirectory of the workingDir if managing multiple mnemonics.
    // console.log(`Working directory: ${config.workingDir}`);
    // config.workingDir = "path to writable directory"
    crashlyticsLogReport('Running connect request');
    await connect({mnemonic, config});
    // addEventListener(breezLiquidEvent);

    return {
      isConnected: true,
      reason: null,
    };
  } catch (err) {
    console.log(err, 'connect to node err LIQUID');
    return {
      isConnected: false,
      reason: err,
    };
  }
}
