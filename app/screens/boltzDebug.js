import {SafeAreaView, Text, TouchableOpacity} from 'react-native';
import {CENTER} from '../constants';
import {getBoltzWsUrl} from '../functions/boltz/boltzEndpoitns';

import handleReverseClaimWSS from '../functions/boltz/handle-reverse-claim-wss';
import {useWebView} from '../../context-store/webViewContext';
import {contactsLNtoLiquidSwapInfo} from '../components/admin/homeComponents/contacts/internalComponents/LNtoLiquidSwap';

export default function BotlzDebug() {
  const {webViewRef} = useWebView();
  // SDK events listener

  const createBoltzSwap = async () => {
    try {
      console.log(process.env.BOLTZ_ENVIRONMENT);
      const {data, publicKey, privateKey, keys, preimage, liquidAddress} =
        await contactsLNtoLiquidSwapInfo(
          'tlq1qqw2f02stlujv98qem3gwd6jgccdg7ycwe2dfrruu6nglczdd5a6wac44mdt27qdxqjnpazjsc2uafs4rcudk5rrsx8ewdecrr',
          Number(1000),
          'Testing Boltz Swap',
        );
      if (!data?.invoice) throw new Error('No Swap invoice genereated');

      const webSocket = new WebSocket(
        `${getBoltzWsUrl(process.env.BOLTZ_ENVIRONMENT)}`,
      );
      const didHandle = await handleReverseClaimWSS({
        ref: webViewRef,
        webSocket: webSocket,
        liquidAddress: liquidAddress,
        swapInfo: data,
        preimage: preimage,
        privateKey: privateKey,
      });
      if (!didHandle) throw new Error('Unable to open websocket');
    } catch (err) {
      console.log(err, 'Error creating Boltz swap');
    }
  };

  return (
    <SafeAreaView
      style={{flex: 1, width: '90%', ...CENTER, paddingVertical: '20%'}}>
      <TouchableOpacity onPress={createBoltzSwap}>
        <Text>Testing</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
