import {getBoltzApiUrl} from './boltzEndpoitns';

export async function getBoltzSwapPairInformation(swapType) {
  try {
    const resposne = await fetch(
      `${getBoltzApiUrl(process.env.BOLTZ_ENVIRONMENT)}/v2/swap/${
        swapType === 'submarine' ? 'submarine' : 'reverse'
      }`,
    );
    const responseData = await resposne.json();
    return responseData;
  } catch (err) {
    console.log(err, 'get boltz swap information error');
    return new Promise(resolve => {
      resolve(false);
    });
  }
}
