// import {listPayments, nodeInfo} from '@breeztech/react-native-breez-sdk';

// const runIntervalTimes = (callback, interval, times) => {
//   let count = 0;

//   // Run first execution immediately
//   callback();
//   count++;

//   // Set up interval
//   const intervalId = setInterval(() => {
//     if (count >= times) {
//       clearInterval(intervalId);
//       return;
//     }

//     callback();
//     count++;
//   }, interval);

//   // Return the interval ID in case you want to clear it manually
//   return intervalId;
// };

// // Usage example with your function:
// const startUpdateInterval = toggleNodeInformation => {
//   const updateNodeInfo = async () => {
//     console.log('RUNNING UPDATE LN DATA');
//     try {
//       const [nodeState, transactions] = await Promise.all([
//         nodeInfo(),
//         listPayments({}),
//       ]);

//       const userBalance = nodeState.channelsBalanceMsat / 1000;
//       const inboundLiquidityMsat = nodeState.totalInboundLiquidityMsats;
//       const blockHeight = nodeState.blockHeight;
//       const onChainBalance = nodeState.onchainBalanceMsat;

//       const nodeInfoObject = {
//         transactions: transactions,
//         userBalance: userBalance,
//         inboundLiquidityMsat: inboundLiquidityMsat,
//         blockHeight: blockHeight,
//         onChainBalance: onChainBalance,
//       };

//       toggleNodeInformation(nodeInfoObject);
//     } catch (err) {
//       console.log(err);
//     }
//   };

//   // Run 2 times with 30 second interval
//   return runIntervalTimes(updateNodeInfo, 1000 * 30, 2);
// };

// export default startUpdateInterval;
