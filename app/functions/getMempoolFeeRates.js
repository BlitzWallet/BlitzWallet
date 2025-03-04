import {recommendedFees} from '@breeztech/react-native-breez-sdk-liquid';

export async function getMempoolReccomenededFee(feeTime = 'fastestFee') {
  try {
    const sdkFee = await recommendedFees();
    return Math.round(sdkFee[feeTime]);
  } catch (err) {
    console.log('get recommended mempool fee error', err);
    return false;
  }
}
