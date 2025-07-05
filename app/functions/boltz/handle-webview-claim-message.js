import {getBoltzApiUrl} from './boltzEndpoitns';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';

export default function handleWebviewClaimMessage(
  // navigate,
  event,
  // receiveingPage,
  // confirmFunction,
  // saveBotlzSwapIdFunction,
) {
  console.log(event.nativeEvent.data, 'Webview claim message');
  (async () => {
    const data = JSON.parse(event.nativeEvent.data);
    try {
      if (data.error) throw Error(data.error);

      console.log(data, 'WEBVIEW DATA');

      if (typeof data === 'object' && data?.tx) {
        let didPost = false;
        let numberOfTries = 0;
        while (!didPost && numberOfTries < 5) {
          console.log('RUNNING BOLTZ POST');
          numberOfTries += 1;
          try {
            const fetchRequse = await fetch(
              `${getBoltzApiUrl(
                process.env.BOLTZ_ENVIRONMENT,
              )}/v2/chain/L-BTC/transaction`,
              {
                method: 'POST',
                headers: {
                  accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  hex: data.tx,
                }),
              },
            );

            const response = await fetchRequse.json();

            if (response?.id) {
              didPost = true;
            } else await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (err) {
            console.log(err);
            // if (receiveingPage === 'loadingScreen') {
            //   confirmFunction(1);
            // }
          }
        }

        let [savedClaimInfo, claimTxs] = await Promise.all([
          getLocalStorageItem('savedReverseSwapInfo')
            .then(JSON.parse)
            .catch(() => []),
          getLocalStorageItem('boltzClaimTxs')
            .then(JSON.parse)
            .catch(() => []),
        ]);

        savedClaimInfo = savedClaimInfo.filter(
          claim => claim?.swapInfo?.id !== data.id,
        );

        setLocalStorageItem(
          'savedReverseSwapInfo',
          JSON.stringify(savedClaimInfo),
        );

        if (didPost) return;

        claimTxs.push([data.tx, new Date()]);

        setLocalStorageItem('boltzClaimTxs', JSON.stringify(claimTxs));
      }
    } catch (err) {
      console.log(err, 'Webview claim error');
    }
  })();
}
