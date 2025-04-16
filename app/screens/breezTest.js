import {StyleSheet} from 'react-native';
import {
  EnvironmentType,
  NodeConfigVariant,
  connect,
  // defaultConfig,
  mnemonicToSeed,
} from '@breeztech/react-native-breez-sdk';
import {btoa, atob, toByteArray} from 'react-native-quick-base64';
import {generateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english';
import {GlobalThemeView, ThemeText} from '../functions/CustomElements';
import CustomButton from '../functions/CustomElements/button';
import {INSET_WINDOW_WIDTH} from '../constants/theme';
import {CENTER} from '../constants';
import {
  LiquidNetwork,
  defaultConfig,
} from '@breeztech/react-native-breez-sdk-liquid';

const onBreezEvent = e => {
  console.log(`Received event ${e.type}`);
};
const onBreezLiquidEvent = e => {
  console.log(`Received event ${e.type}`);
};

export default function BreezTest() {
  return (
    <GlobalThemeView styles={styles.container}>
      <ThemeText
        styles={styles.labelText}
        content={
          'When trying to run the connect function, the app crashes. Click Connect to reproduce.'
        }
      />
      <CustomButton
        actionFunction={() => connectToLiquidNode(onBreezLiquidEvent)}
        textContent={'Run connect'}
      />
    </GlobalThemeView>
  );
}

async function connectToBreezNode() {
  try {
    // Create the default config
    // const mnemoinc = await retrieveData('mnemonic');
    const mnemonic = generateMnemonic(wordlist);

    const seed = await mnemonicToSeed(mnemonic);

    const nodeConfig = {
      type: NodeConfigVariant.GREENLIGHT,
      config: {
        // inviteCode: inviteCode,
        partnerCredentials: {
          //IOS needs to be developerKey abd developerCert
          developerKey: unit8ArrayConverter(
            toByteArray(btoa(process.env.GL_CUSTOM_NOBODY_KEY)),
          ),
          developerCert: unit8ArrayConverter(
            toByteArray(btoa(process.env.GL_CUSTOM_NOBODY_CERT)),
          ),
        },
      },
    };

    const config = await defaultConfig(
      EnvironmentType.PRODUCTION,
      process.env.API_KEY,
      nodeConfig,
    );

    // config.workingDir = filesystem.documentDirectory;

    // Connect to the Breez SDK make it ready for use
    const connectRequest = {config, seed};

    console.log(connectRequest);
    await connect(connectRequest, onBreezEvent);
  } catch (err) {
    console.error(err);
  }
}

async function connectToLiquidNode(breezLiquidEvent) {
  // setLogger(logHandler);

  try {
    // Create the default config, providing your Breez API key
    const mnemonic = generateMnemonic(wordlist);

    const config = await defaultConfig(
      LiquidNetwork.MAINNET,
      process.env.LIQUID_BREEZ_KEY,
    );

    await connect({mnemonic, config});
    addEventListener(breezLiquidEvent);

    return new Promise(resolve => {
      resolve({
        isConnected: true,
        reason: null,
      });
    });
  } catch (err) {
    console.log(err, 'connect to node err LIQUID');
    return new Promise(resolve => {
      resolve({
        isConnected: false,
        reason: err,
      });
    });
  }
}

function unit8ArrayConverter(unitArray) {
  return Array.from(
    unitArray.filter(num => Number.isInteger(num) && num >= 0 && num <= 255),
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    textAlign: 'center',
    width: INSET_WINDOW_WIDTH,
    marginBottom: 20,
    ...CENTER,
  },
});
