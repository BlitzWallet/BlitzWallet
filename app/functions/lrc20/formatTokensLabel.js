import { TOKEN_TICKER_MAX_LENGTH } from '../../constants';

export default function formatTokensLabel(label) {
  try {
    label?.toLowerCase() === 'usdb'
      ? 'USD'
      : label?.toUpperCase()?.slice(0, TOKEN_TICKER_MAX_LENGTH);
  } catch (err) {
    return '';
  }
}
