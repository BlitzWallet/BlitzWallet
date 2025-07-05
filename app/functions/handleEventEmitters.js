import {AppState} from 'react-native';

const eventQueue = [];
let appStateSubscription = null;

const handleEventEmitterPost = (eventEmitter, eventName, ...eventParams) => {
  try {
    const listenerCount = eventEmitter.listenerCount?.(eventName);
    if (AppState.currentState === 'active' || listenerCount) {
      eventEmitter.emit(eventName, ...eventParams);
    } else {
      eventQueue.push({
        eventEmitter,
        eventName,
        eventParams,
      });

      if (!appStateSubscription) {
        const handleAppStateChange = nextAppState => {
          if (nextAppState === 'active') {
            console.log(`Processing ${eventQueue.length} queued events`);

            while (eventQueue.length > 0) {
              const {eventEmitter, eventName, eventParams} = eventQueue.shift();

              const listenerCount = eventEmitter.listenerCount?.(eventName);

              if (!listenerCount) {
                console.log(
                  `No listeners found for ${eventName}, starting interval fallback`,
                );
                let attempts = 0;
                const maxAttempts = 3;
                const intervalId = setInterval(() => {
                  if (attempts >= maxAttempts) {
                    clearInterval(intervalId);
                  } else {
                    console.log(
                      `Fallback emit attempt ${attempts + 1} for ${eventName}`,
                    );
                    const response = eventEmitter.emit(
                      eventName,
                      ...eventParams,
                    );
                    if (response) clearInterval(intervalId);
                    attempts++;
                  }
                }, 2000);
              } else {
                eventEmitter.emit(eventName, ...eventParams);
              }
            }

            appStateSubscription?.remove();
            appStateSubscription = null;
          }
        };

        console.log('Adding single AppState subscription');
        appStateSubscription = AppState.addEventListener(
          'change',
          handleAppStateChange,
        );
      } else {
        console.log(`Event queued (${eventQueue.length} total queued)`);
      }
    }
  } catch (err) {
    console.log('Error handling event emitter', err);

    eventEmitter.emit(eventName, ...eventParams);
  }
};

const cleanupEventHandler = () => {
  if (appStateSubscription) {
    console.log('Cleaning up AppState subscription');
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  eventQueue.length = 0;
};

// Export functions
export {handleEventEmitterPost, cleanupEventHandler};
