import { AppState } from 'react-native';
import { getWallet, selectSparkRuntime } from './index';
import sha256Hash from '../hash';
import {
  sendWebViewRequestGlobal,
  OPERATION_TYPES,
} from '../../../context-store/webViewContext';

// Global state for optimization
const optimizationState = {
  isLeafOptimizationRunning: false,
  isTokenOptimizationRunning: false,
  controller: null,
  timeout: null,
};

/**
 * Abort any running optimization immediately
 */
export const abortOptimization = async mnemonic => {
  console.log('Aborting optimization immediately...');

  const runtime = await selectSparkRuntime(mnemonic);

  if (runtime === 'native') {
    if (optimizationState.controller) {
      optimizationState.controller.abort();
      optimizationState.controller = null;
    }

    if (optimizationState.timeout) {
      clearTimeout(optimizationState.timeout);
      optimizationState.timeout = null;
    }

    optimizationState.isLeafOptimizationRunning = false;
    optimizationState.isTokenOptimizationRunning = false;
  } else {
    await sendWebViewRequestGlobal(OPERATION_TYPES.abortOptimization, {
      mnemonic,
    });
  }
};

/**
 * Check if any optimization is currently running
 */
export const isOptimizationRunning = async mnemonic => {
  const runtime = await selectSparkRuntime(mnemonic);
  if (runtime === 'native') {
    return (
      optimizationState.isLeafOptimizationRunning ||
      optimizationState.isTokenOptimizationRunning
    );
  } else {
    const result = await sendWebViewRequestGlobal(
      OPERATION_TYPES.isOptimizationRunning,
      { mnemonic },
    );
    console.log('is opimization running result');
    return result;
  }
};

/**
 * Check if optimization is needed for a wallet
 */
export const checkIfOptimizationNeeded = async mnemonic => {
  try {
    const runtime = await selectSparkRuntime(mnemonic);

    if (runtime === 'native') {
      const wallet = await getWallet(mnemonic);
      if (!wallet) return false;

      const [isLeafOptInProgress, isTokenOptInProgress] = await Promise.all([
        wallet.isOptimizationInProgress(),
        wallet.isTokenOptimizationInProgress(),
      ]);

      // If already in progress, don't start another
      if (isLeafOptInProgress || isTokenOptInProgress) {
        return false;
      }
      const leaves = await wallet.getLeaves();
      console.log(leaves);

      return false;
    } else {
      const result = await sendWebViewRequestGlobal(
        OPERATION_TYPES.checkIfOptimizationNeeded,
        { mnemonic },
      );
      return result?.needed || false;
    }
  } catch (error) {
    console.error('Error checking if optimization needed:', error);
    return false;
  }
};

/**
 * Run leaf optimization
 */
export const runLeafOptimization = async (mnemonic, identityPubKey) => {
  if (await isOptimizationRunning(mnemonic)) {
    console.log('Optimization already running, skipping');
    return { didWork: false, reason: 'already_running' };
  }

  if (AppState.currentState !== 'active') {
    console.log('App not active, skipping optimization');
    return { didWork: false, reason: 'app_not_active' };
  }

  if (!identityPubKey) {
    console.log('No identity pub key, skipping optimization');
    return { didWork: false, reason: 'no_identity' };
  }

  try {
    optimizationState.isLeafOptimizationRunning = true;
    const runtime = await selectSparkRuntime(mnemonic);

    console.log('Starting leaf optimization...');

    if (runtime === 'native') {
      const wallet = await getWallet(mnemonic);
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }
      for await (const progress of wallet.optimizeLeaves()) {
        // Store controller for abortion
        optimizationState.controller = progress.controller;

        console.log(
          `Optimization progress: ${progress.step}/${progress.total}`,
        );
        // Check if we should abort
        if (!optimizationState.isLeafOptimizationRunning) {
          console.log('Optimization aborted by external signal');
          progress.controller.abort();
          break;
        }
      }
    } else {
      // WebView optimization
      await sendWebViewRequestGlobal(OPERATION_TYPES.runLeafOptimization, {
        mnemonic,
      });
    }

    console.log('Leaf optimization complete');
    return { didWork: true };
  } catch (error) {
    console.error('Error during leaf optimization:', error);
    return { didWork: false, error: error.message };
  } finally {
    optimizationState.isLeafOptimizationRunning = false;
    optimizationState.controller = null;
  }
};

/**
 * Run token optimization
 */
export const runTokenOptimization = async (mnemonic, identityPubKey) => {
  if (await isOptimizationRunning(mnemonic)) {
    console.log('Optimization already running, skipping');
    return { didWork: false, reason: 'already_running' };
  }

  if (AppState.currentState !== 'active') {
    console.log('App not active, skipping token optimization');
    return { didWork: false, reason: 'app_not_active' };
  }

  if (!identityPubKey) {
    console.log('No identity pub key, skipping token optimization');
    return { didWork: false, reason: 'no_identity' };
  }

  try {
    optimizationState.isTokenOptimizationRunning = true;
    const runtime = await selectSparkRuntime(mnemonic);

    console.log('Starting token optimization...');

    if (runtime === 'native') {
      const wallet = await getWallet(mnemonic);
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }
      await wallet.optimizeTokenOutputs();
    } else {
      await sendWebViewRequestGlobal(OPERATION_TYPES.runTokenOptimization, {
        mnemonic,
      });
    }

    console.log('Token optimization complete');
    return { didWork: true };
  } catch (error) {
    console.error('Error during token optimization:', error);
    return { didWork: false, error: error.message };
  } finally {
    optimizationState.isTokenOptimizationRunning = false;
  }
};

/**
 * Schedule optimization to run after a delay
 */
export const scheduleOptimization = async (
  mnemonic,
  identityPubKey,
  delayMs = 5000,
) => {
  // Clear any existing scheduled optimization
  if (optimizationState.timeout) {
    clearTimeout(optimizationState.timeout);
    optimizationState.timeout = null;
  }

  console.log(`Scheduling optimization in ${delayMs}ms...`);

  optimizationState.timeout = setTimeout(async () => {
    if (AppState.currentState !== 'active') {
      console.log('App not active, skipping scheduled optimization');
      return;
    }

    if (!identityPubKey) {
      console.log('No identity pub key, skipping scheduled optimization');
      return;
    }

    const needed = await checkIfOptimizationNeeded(mnemonic);
    if (needed) {
      console.log('Running scheduled optimization...');
      // Run leaf optimization first, then token optimization
      const leafResult = await runLeafOptimization(mnemonic, identityPubKey);
      if (leafResult.didWork) {
        await runTokenOptimization(mnemonic, identityPubKey);
      }
    } else {
      console.log('Optimization not needed at this time');
    }
  }, delayMs);
};

/**
 * Cleanup optimization state (call on logout/unmount)
 */
export const cleanupOptimization = mnemoinc => {
  if (!mnemoinc) return;
  abortOptimization(mnemoinc);
};
