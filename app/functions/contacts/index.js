import {uniqueNamesGenerator, animals, names} from 'unique-names-generator';
import i18next from 'i18next';

export function generateRandomContact() {
  const randomName = uniqueNamesGenerator({
    dictionaries: [names, animals],
    separator: '',
  }); // big_red_donkey

  return {uniqueName: randomName + Math.ceil(Math.random() * 99)};
}

export async function getBolt11InvoiceForContact(
  contactUniqueName,
  sendingValue,
  description,
  useBlitzContact = true,
) {
  try {
    let runCount = 0;
    let maxRunCount = 2;
    let invoice = null;

    while (runCount < maxRunCount) {
      try {
        const url = `https://blitz-wallet.com/.well-known/lnurlp/${contactUniqueName}?amount=${
          sendingValue * 1000
        }&isBlitzContact=${useBlitzContact ? true : false}${
          !!description
            ? `&comment=${encodeURIComponent(description || '')}`
            : ''
        }`;
        console.log(url);
        const response = await fetch(url);
        const data = await response.json();
        if (data.status !== 'OK') throw new Error('Not able to get invoice');
        invoice = data.pr;
        break;
      } catch (err) {
        console.log('Error getting invoice trying again', err);
        await new Promise(res => setTimeout(res, 1000));
      }
      runCount += 1;
    }

    return invoice;
  } catch (err) {
    console.log('get ln address for liquid payment error', err);
    return false;
  }
}

export function getTimeDisplay(
  timeDifferenceMinutes,
  timeDifferenceHours,
  timeDifferenceDays,
  timeDifferenceYears,
) {
  const timeValue =
    timeDifferenceMinutes <= 60
      ? timeDifferenceMinutes < 1
        ? ''
        : Math.round(timeDifferenceMinutes)
      : timeDifferenceHours <= 24
      ? Math.round(timeDifferenceHours)
      : timeDifferenceDays <= 365
      ? Math.round(timeDifferenceDays)
      : Math.round(timeDifferenceYears);

  const timeUnit =
    timeDifferenceMinutes <= 60
      ? timeDifferenceMinutes < 1
        ? i18next.t('transactionLabelText.txTime_just_now')
        : Math.round(timeDifferenceMinutes) === 1
        ? i18next.t('timeLabels.minute')
        : i18next.t('timeLabels.minutes')
      : timeDifferenceHours <= 24
      ? Math.round(timeDifferenceHours) === 1
        ? i18next.t('timeLabels.hour')
        : i18next.t('timeLabels.hours')
      : timeDifferenceDays <= 365
      ? Math.round(timeDifferenceDays) === 1
        ? i18next.t('timeLabels.day')
        : i18next.t('timeLabels.days')
      : Math.round(timeDifferenceYears) === 1
      ? i18next.t('timeLabels.year')
      : i18next.t('timeLabels.years');

  const suffix =
    timeDifferenceMinutes > 1
      ? ` ${i18next.t('transactionLabelText.ago')}`
      : '';

  return `${timeValue}${
    timeUnit === i18next.t('transactionLabelText.txTime_just_now') ? '' : ' '
  }${timeUnit}${suffix}`;
}
