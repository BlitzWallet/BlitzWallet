import {getBoltzApiUrl} from './boltzEndpoitns';

export async function getBoltzSwapPairInformation(swapType) {
  try {
    const resposne = await fetch(
      `${getBoltzApiUrl(process.env.BOLTZ_ENVIRONMENT)}/v2/swap/${
        swapType === 'liquid-ln' ? 'submarine' : 'reverse'
      }`,
    );
    const responseData = await resposne.json();

    const data =
      swapType === 'liquid-ln'
        ? responseData['L-BTC']['BTC']
        : responseData['BTC']['L-BTC'];
    return new Promise(resolve => {
      resolve(data);
    });
  } catch (err) {
    console.log(err, 'get boltz swap information error');
    return new Promise(resolve => {
      resolve(false);
    });
  }
}
