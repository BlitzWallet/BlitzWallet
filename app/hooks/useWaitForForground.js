import { AppState } from 'react-native';

export async function useWaitForForground() {
  if (AppState.currentState === 'active') return Promise.resolve();

  return new Promise(resolve => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        subscription.remove();
        setTimeout(() => {
          resolve();
        }, 100);
      }
    });
  });
}
