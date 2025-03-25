import {getBoltzApiUrl} from './boltzEndpoitns';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';

export default function handleWebviewClaimMessage(
  // navigate,
  event,
  // receiveingPage,
  // confirmFunction,
  // saveBotlzSwapIdFunction,
) {
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

        if (didPost) return;

        let claimTxs =
          JSON.parse(await getLocalStorageItem('boltzClaimTxs')) || [];

        claimTxs.push([data.tx, new Date()]);

        setLocalStorageItem('boltzClaimTxs', JSON.stringify(claimTxs));
      }
    } catch (err) {
      console.log(err, 'WEBVIEW ERROR');
      if (typeof data === 'object' && data?.tx) {
        let claimTxs =
          JSON.parse(await getLocalStorageItem('boltzClaimTxs')) || [];

        claimTxs.push([data.tx, new Date()]);

        setLocalStorageItem('boltzClaimTxs', JSON.stringify(claimTxs));
      }
    }
  })();
}
