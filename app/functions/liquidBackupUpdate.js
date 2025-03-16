import {getInfo, listPayments} from '@breeztech/react-native-breez-sdk-liquid';

const runIntervalTimes = (callback, interval, times) => {
  let count = 0;

  // Run first execution immediately
  callback();

  // Set up interval
  const intervalId = setInterval(() => {
    if (count >= times) {
      clearInterval(intervalId);
      return;
    }

    callback();
    count++;
  }, interval);

  // Return the interval ID in case you want to clear it manually
  return intervalId;
};

// Usage example with your function:
const startLiquidUpdateInterval = (toggleLiquidNodeInformation, runCount) => {
  const updateNodeInfo = async () => {
    console.log('RUNNING UPDATE LIQUID DATA');
    try {
      const [info, payments] = await Promise.all([getInfo(), listPayments({})]);

      const balanceSat = info.walletInfo.balanceSat;

      const liquidNodeObject = {
        transactions: payments,
        userBalance: balanceSat,
        pendingReceive: info.walletInfo.pendingReceiveSat,
        pendingSend: info.walletInfo.pendingSendSat,
      };

      toggleLiquidNodeInformation(liquidNodeObject);
    } catch (err) {
      console.log(err);
    }
  };

  // Run 2 times with 30 second interval
  return runIntervalTimes(updateNodeInfo, 1000 * 30, runCount);
};

export default startLiquidUpdateInterval;
