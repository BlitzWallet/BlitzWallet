import {retrieveData, storeData} from './secureStore';

export default async function toggleSecureStoreData(secureStoreItem, update) {
  const storedInformation = JSON.parse(await retrieveData(secureStoreItem));

  const stored = await storeData(
    'blitzWalletContact',
    JSON.stringify({
      ...storedInformation,
      ...update,
    }),
  );

  return new Promise(resolve => {
    resolve(stored);
  });
}
