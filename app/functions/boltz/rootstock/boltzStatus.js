import { getBoltzApiUrl } from '../boltzEndpoitns';
import { rootstockEnvironment } from '.';
import { fetchBoltzJson } from './boltzHttp';

// Poll a single swap's status. Used as a fallback when the websocket goes quiet
// without closing. Returns null on any error so the caller can simply skip it.
export async function fetchBoltzSwapStatus(swapId) {
  try {
    return await fetchBoltzJson(
      getBoltzApiUrl(rootstockEnvironment) + `/v2/swap/${swapId}`,
    );
  } catch (err) {
    console.log('Error polling Boltz swap status', swapId, err);
    return null;
  }
}
