import { BrantaServerBaseUrl, V2BrantaClient } from '@branta-ops/branta';

const brantaClient = new V2BrantaClient({
  baseUrl: BrantaServerBaseUrl.Production,
  privacy: 'strict',
});

export async function handleBrantaVerification(qrCode) {
  try {
    const brantaResponse = await brantaClient.getPaymentsByQRCode(qrCode ?? '');
    return brantaResponse;
  } catch (err) {
    console.log('Error retriving branta verification', err);
    return null;
  }
}
