import { useWindowDimensions } from 'react-native';
import { MAX_WEB_CONTENT_WIDTH } from '../constants';

// QrCard's default horizontal padding.
export const QR_CARD_PADDING = 22;
// The QR never takes more than this share of the window height, so it stays
// scannable-but-not-huge on wide / short windows (web, tablets, landscape).
// ponytail: height cap is a ratio, measure the free space with onLayout if small screens still crowd
const QR_MAX_HEIGHT_RATIO = 0.42;

// One sizing rule for every full-page QR. The QR fills the page content width
// on phones and is capped by window height on wide screens. `cardWidth` is the
// white card around it: render the card at that width (not 100%) so text above
// or beside the QR can line up with the card edges.
export default function useQrSize({ cardPadding = QR_CARD_PADDING } = {}) {
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const qrSize = Math.min(
    contentWidth - cardPadding * 2,
    Math.round(height * QR_MAX_HEIGHT_RATIO),
  );
  return { qrSize, cardWidth: qrSize + cardPadding * 2, contentWidth };
}
