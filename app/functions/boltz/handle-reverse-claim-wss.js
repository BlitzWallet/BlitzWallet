import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';
import {getBoltzApiUrl} from './boltzEndpoitns';
import getBoltzFeeRates from './getBoltzFeerate,';

const SWAP_STATUS = {
  CREATED: 'swap.created',
  MEMPOOL: 'transaction.mempool',
  CONFIRMED: 'transaction.confirmed',
  SETTLED: 'invoice.settled',
};

const getNetworkFeeRate = async () =>
  process.env.BOLTZ_ENVIRONMENT === 'testnet' ? 0.11 : await getBoltzFeeRates();

class ReverseSwapWebSocketHandler {
  constructor({
    ref,
    webSocket,
    liquidAddress,
    swapInfo,
    preimage,
    privateKey,
    fromPage,
    contactsFunction,
  }) {
    this.webSocket = webSocket;
    this.ref = ref;
    this.liquidAddress = liquidAddress;
    this.swapInfo = swapInfo;
    this.preimage = preimage;
    this.privateKey = privateKey;
    this.fromPage = fromPage;
    this.contactsFunction = contactsFunction;
    this.didRunClaim = false;
    this.isWebSocketOpen = false;
    this.errorHandled = false;
  }

  initialize() {
    // Log all instance variables
    console.log('WebSocket Handler Initialized with the following variables:');
    console.log('WebSocket:', this.webSocket);
    console.log('Ref:', this.ref);
    console.log('Liquid Address:', this.liquidAddress);
    console.log('Swap Info:', this.swapInfo);
    console.log('Preimage:', this.preimage);
    console.log('From Page:', this.fromPage);
    console.log('Contacts Function:', this.contactsFunction);
    console.log('Did Run Claim:', this.didRunClaim);
    console.log('Is WebSocket Open:', this.isWebSocketOpen);
    console.log('Did handle error:', this.errorHandled);

    return new Promise(resolve => {
      this.setupWebSocketEvents(resolve);
    });
  }

  setupWebSocketEvents(resolve) {
    this.webSocket.onopen = () => {
      this.isWebSocketOpen = true;
      this.subscribeToSwapUpdates();
      console.log('WebSocket connection established');
    };

    this.webSocket.onerror = error => {
      // Check if the error is already handled
      if (this.errorHandled) return;
      this.errorHandled = true;

      console.error('WebSocket error:', {
        message: error.message,
        type: error.type,
        isTrusted: error?.isTrusted,
        stack: error?.stack,
      });

      // Clean up
      this.cleanupWebSocket();

      if (!this.isWebSocketOpen) resolve(false);
    };

    this.webSocket.onmessage = this.handleMessage.bind(this, resolve);
  }

  cleanupWebSocket() {
    if (this.webSocket) {
      this.webSocket.onopen = null;
      this.webSocket.onerror = null;
      this.webSocket.onmessage = null;
      this.webSocket.onclose = null;

      if (this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.close();
      }
    }
  }

  subscribeToSwapUpdates() {
    this.webSocket.send(
      JSON.stringify({
        op: 'subscribe',
        channel: 'swap.update',
        args: [this.swapInfo.id],
      }),
    );
  }

  async handleMessage(resolve, rawMsg) {
    try {
      const msg = JSON.parse(rawMsg.data);
      console.log(`Swap Status: ${msg.args[0].status} ${msg.event}`);

      switch (msg.event) {
        case 'subscribe':
          resolve(true);
          break;
        case 'update':
          await this.handleSwapUpdate(msg.args[0]);
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  async handleSwapUpdate(swapUpdate) {
    const {status} = swapUpdate;

    switch (status) {
      case SWAP_STATUS.CREATED:
        await this.handleSwapCreated();
        break;
      case SWAP_STATUS.MEMPOOL:
        this.handleTransactionMempool();
        break;
      case SWAP_STATUS.CONFIRMED:
        this.handleTransactionConfirmed();
        break;
      case SWAP_STATUS.SETTLED:
        await this.handleInvoiceSettled();
        break;
    }
  }

  async handleSwapCreated() {
    const feeRate = await getNetworkFeeRate();

    handleSavedReverseClaims(
      {
        apiUrl: getBoltzApiUrl(process.env.BOLTZ_ENVIRONMENT),
        network: process.env.BOLTZ_ENVIRONMENT,
        address: this.liquidAddress,
        feeRate,
        swapInfo: this.swapInfo,
        privateKey: this.privateKey,
        preimage: this.preimage,
        createdOn: new Date(),
        numberOfTries: 0,
      },
      true,
    );
  }

  handleTransactionMempool() {
    this.executeClaimProcess();
    this.didRunClaim = true;
  }

  handleTransactionConfirmed() {
    if (!this.didRunClaim) {
      this.executeClaimProcess();
    }
  }

  async executeClaimProcess() {
    const feeRate = await getNetworkFeeRate();

    getClaimReverseSubmarineSwapJS({
      webViewRef: this.ref,
      address: this.liquidAddress,
      swapInfo: this.swapInfo,
      preimage: this.preimage,
      privateKey: this.privateKey,
      feeRate,
    });
  }

  async handleInvoiceSettled() {
    handleSavedReverseClaims(null, false);

    if (this.fromPage === 'contacts') {
      try {
        await this.contactsFunction();
      } catch (err) {
        console.error('Contacts function error:', err);
      }
    }

    this.webSocket.close();
  }
}

export default async function handleReverseClaimWSS(params) {
  try {
    const handler = new ReverseSwapWebSocketHandler(params);
    return await handler.initialize();
  } catch (error) {
    console.error('Reverse swap handler error:', error);
    return false;
  }
}
async function handleSavedReverseClaims(claim, shouldSave) {
  let savedClaimInfo =
    JSON.parse(await getLocalStorageItem('savedReverseSwapInfo')) || [];

  if (shouldSave) savedClaimInfo.push(claim);
  else savedClaimInfo.pop();

  setLocalStorageItem('savedReverseSwapInfo', JSON.stringify(savedClaimInfo));
}

export function getClaimReverseSubmarineSwapJS({
  webViewRef,
  address,
  swapInfo,
  preimage,
  privateKey,
  feeRate,
}) {
  const args = JSON.stringify({
    apiUrl: getBoltzApiUrl(process.env.BOLTZ_ENVIRONMENT),
    network: process.env.BOLTZ_ENVIRONMENT,
    address,
    feeRate,
    swapInfo,
    privateKey,
    preimage,
  });

  webViewRef.current.injectJavaScript(
    `
    window.ReactNativeWebView.postMessage(Object.keys(window).join(', '));
    window.claimReverseSubmarineSwap(${args}); void(0);
    `,
  );
}
