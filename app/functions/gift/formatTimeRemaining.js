import i18n from 'i18next';

export function formatTimeRemaining(expireTime) {
  const now = Date.now();
  const diff = expireTime - now;

  if (diff <= 0) {
    return {
      string: i18n.t('screens.inAccount.giftPages.expired'),
      time: diff,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return {
      string: i18n.t('screens.inAccount.giftPages.timeLeft.days', {
        count: days,
      }),
      time: diff,
    };
  }

  if (hours > 0) {
    return {
      string: i18n.t('screens.inAccount.giftPages.timeLeft.hours', {
        count: hours,
      }),
      time: diff,
    };
  }

  if (minutes > 0) {
    return {
      string: i18n.t('screens.inAccount.giftPages.timeLeft.minutes', {
        count: minutes,
      }),
      time: diff,
    };
  }

  return {
    string: i18n.t('screens.inAccount.giftPages.lessThanMin'),
    time: diff,
  };
}
