import i18next from 'i18next';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';
import {SATSPERBITCOIN} from '../../constants';
import {isMoreThanADayOld} from '../rotateAddressDateChecker';

export default async function giftCardPurchaseAmountTracker({
  sendingAmountSat,
  USDBTCValue,
  testOnly = false,
}) {
  const currentTime = new Date();
  try {
    const dailyPurchaseAmount = await getLocalStorageItem(
      'dailyPurchaeAmount',
    ).then(JSON.parse);

    if (dailyPurchaseAmount) {
      if (isMoreThanADayOld(dailyPurchaseAmount.date)) {
        if (!testOnly) {
          setLocalStorageItem(
            'dailyPurchaeAmount',
            JSON.stringify({date: currentTime, amount: sendingAmountSat}),
          );
        }
      } else {
        const totalPurchaseAmount = Math.round(
          ((dailyPurchaseAmount.amount + sendingAmountSat) / SATSPERBITCOIN) *
            USDBTCValue.value,
        );

        if (totalPurchaseAmount > 9000)
          throw new Error(
            i18next.t(
              'apps.giftCards.expandedGiftCardPage.dailyPurchaseAmountError',
            ),
          );

        if (!testOnly) {
          setLocalStorageItem(
            'dailyPurchaeAmount',
            JSON.stringify({
              date: dailyPurchaseAmount.date,
              amount: dailyPurchaseAmount.amount + sendingAmountSat,
            }),
          );
        }
      }
    } else {
      if (!testOnly) {
        setLocalStorageItem(
          'dailyPurchaeAmount',
          JSON.stringify({
            date: currentTime,
            amount: sendingAmountSat,
          }),
        );
      }
    }
    return {shouldBlock: false};
  } catch (err) {
    console.log(err);
    return {shouldBlock: true, reason: err.message};
  }
}
