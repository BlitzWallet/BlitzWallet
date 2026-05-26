import { BrantaServerBaseUrl } from '@branta-ops/branta';
import { BrantaService } from '@branta-ops/branta/v2';

const service = new BrantaService({
  baseUrl: BrantaServerBaseUrl.Production,
  privacy: 'strict',
});

export async function handleBrantaVerification(qrCode) {
  try {
    const brantaResponse = await service.getPaymentsByQrCode(qrCode ?? '');
    console.log(brantaResponse);
    return brantaResponse;
  } catch (err) {
    console.log('Error retriving branta verification', err);
    return null;
  }
}
