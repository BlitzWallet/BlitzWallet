import { isUsableRate } from './money';

export const initialMarketRate = coin => ({
  coin,
  value: null,
  fetchedAt: null,
  status: 'loading',
});

const ok = (state, rate, fetchedAt) => ({
  coin: state.coin,
  value: rate.value,
  fetchedAt,
  status: 'ready',
});

export function marketRateReducer(state, event) {
  switch (event.type) {
    case 'RESET':
      return initialMarketRate(event.coin);
    case 'SEED':
      if (state.status === 'ready') return state;
      if (state.fetchedAt != null && state.fetchedAt > event.fetchedAt)
        return state;
      if (!isUsableRate(event.rate, state.coin)) return state;
      return ok(state, event.rate, event.fetchedAt);
    case 'FETCH_OK':
      // A rate for another coin is a stale response, not a failure.
      if (event.rate?.coin?.toUpperCase() !== state.coin.toUpperCase())
        return state;
      if (isUsableRate(event.rate, state.coin))
        return ok(state, event.rate, event.fetchedAt);
      return marketRateReducer(state, { type: 'FETCH_FAILED' });
    case 'FETCH_FAILED':
      return state.status === 'loading'
        ? { ...state, status: 'failed' }
        : state;
    default:
      return state;
  }
}
