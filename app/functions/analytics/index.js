import { USDB_TOKEN_ID } from '../../constants';
import { convertToDecimals, satsToDollars } from '../spark/flashnet';

export function getDollarsFromTx(tx, currentPrice = 0, direction) {
  try {
    const details = JSON.parse(tx.details);
    let amount = 0;

    if (details.LRC20Token === USDB_TOKEN_ID) {
      amount = convertToDecimals(details.amount / Math.pow(10, 6));
    }

    if (direction === 'OUTGOING') {
      amount += convertToDecimals(
        satsToDollars(
          Number(details.totalFee || details.fee || 0),
          currentPrice,
        ),
      );
    }

    return convertToDecimals(amount);
  } catch (err) {
    return 0;
  }
}

export function getSatsFromTx(tx, currentPrice = 0, direction) {
  try {
    const details = JSON.parse(tx.details);
    let amount = 0;

    if (!details.isLRC20Payment) {
      amount = Number(JSON.parse(tx.details).amount || 0);
    }

    if (direction === 'OUTGOING') {
      amount += Number(details.totalFee || details.fee || 0);
    }
    return Math.round(amount);
  } catch (err) {
    return 0;
  }
}
