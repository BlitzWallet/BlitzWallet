import { AppState } from 'react-native';

const eventQueue = [];
let appStateSubscription = null;
let lastAppState = AppState.currentState;

// Track if we're currently processing the queue to prevent double-processing
let isProcessingQueue = false;

const handleEventEmitterPost = (eventEmitter, eventName, ...eventParams) => {
  try {
    const listenerCount = eventEmitter.listenerCount?.(eventName);
    const [updateType] = eventParams;
    const currentAppState = AppState.currentState;

    // Determine if we should emit immediately
    const isAppActive = currentAppState === 'active';
    const hasListeners = listenerCount > 0;

    // Only emit immediately if:
    // 1. App is active AND has listeners, OR
    // 2. It's a user-initiated action AND has listeners (these happen during active state)
    if (hasListeners && isAppActive) {
      console.log(
        `Emitting ${eventName} immediately (type: ${updateType}, active: ${isAppActive})`,
      );
      eventEmitter.emit(eventName, ...eventParams);
      return;
    }

    // Otherwise, queue the event for later processing
    console.log(
      `Queueing ${eventName} (type: ${updateType}, active: ${isAppActive}, listeners: ${listenerCount})`,
    );
    eventQueue.push({
      eventEmitter,
      eventName,
      eventParams,
      timestamp: Date.now(),
    });

    // Set up AppState listener if not already set up
    if (!appStateSubscription) {
      setupAppStateListener();
    }
  } catch (err) {
    console.log('Error handling event emitter', err);
    // Fallback: try to emit anyway
    try {
      eventEmitter.emit(eventName, ...eventParams);
    } catch (emitErr) {
      console.log('Failed to emit event in fallback', emitErr);
    }
  }
};

const setupAppStateListener = () => {
  const handleAppStateChange = nextAppState => {
    console.log(`AppState changed from ${lastAppState} to ${nextAppState}`);

    // Only process queue when transitioning TO active state
    if (nextAppState === 'active') {
      processQueuedEvents();
    }

    lastAppState = nextAppState;
  };

  console.log('Adding single AppState subscription');
  appStateSubscription = AppState.addEventListener(
    'change',
    handleAppStateChange,
  );
};

const processQueuedEvents = async () => {
  if (isProcessingQueue) {
    console.log('Already processing queue, skipping...');
    return;
  }

  if (eventQueue.length === 0) {
    console.log('No events to process');
    return;
  }

  isProcessingQueue = true;
  console.log(`Processing ${eventQueue.length} queued events`);

  // Process all queued events
  const eventsToProcess = [...eventQueue];
  eventQueue.length = 0; // Clear the queue

  for (const queuedEvent of eventsToProcess) {
    const { eventEmitter, eventName, eventParams, timestamp } = queuedEvent;
    const age = Date.now() - timestamp;

    try {
      const listenerCount = eventEmitter.listenerCount?.(eventName);

      if (!listenerCount) {
        console.log(
          `No listeners found for ${eventName} after ${age}ms, using fallback`,
        );
        await attemptEmitWithRetry(eventEmitter, eventName, eventParams);
      } else {
        console.log(`Emitting queued ${eventName} after ${age}ms`);
        eventEmitter.emit(eventName, ...eventParams);
      }

      // Small delay between events to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (err) {
      console.error(`Error processing queued event ${eventName}:`, err);
    }
  }

  isProcessingQueue = false;
  console.log('Finished processing queued events');
};

const attemptEmitWithRetry = async (eventEmitter, eventName, eventParams) => {
  let attempts = 0;
  const maxAttempts = 3;
  const retryDelay = 2000;

  return new Promise(resolve => {
    const attemptEmit = () => {
      attempts++;
      console.log(`Retry attempt ${attempts}/${maxAttempts} for ${eventName}`);

      const listenerCount = eventEmitter.listenerCount?.(eventName);

      if (listenerCount > 0) {
        const success = eventEmitter.emit(eventName, ...eventParams);
        if (success) {
          console.log(
            `Successfully emitted ${eventName} on attempt ${attempts}`,
          );
          resolve(true);
          return;
        }
      }

      if (attempts >= maxAttempts) {
        console.log(
          `Failed to emit ${eventName} after ${maxAttempts} attempts`,
        );
        resolve(false);
        return;
      }

      setTimeout(attemptEmit, retryDelay);
    };

    attemptEmit();
  });
};

const cleanupEventHandler = () => {
  if (appStateSubscription) {
    console.log('Cleaning up AppState subscription');
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  eventQueue.length = 0;
  isProcessingQueue = false;
  lastAppState = AppState.currentState;
};

// Export functions
export { handleEventEmitterPost, cleanupEventHandler };
