import { BITCOIN_SATS_ICON } from '../../constants';
import i18n from 'i18next';
import { shareMessage } from '../handleShare';

export async function handleGiftCardShare({ amount, giftLink }) {
  const message = i18n.t('screens.inAccount.giftPages.shareMessage', {
    icon: BITCOIN_SATS_ICON,
    amount,
    link: giftLink,
  });

  await shareMessage({ message });
}
