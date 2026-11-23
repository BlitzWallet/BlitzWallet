import { uniqueNamesGenerator, animals, names } from 'unique-names-generator';
import i18next from 'i18next';
import { decode as decodeBolt11 } from '../decodeBolt11';

export function generateRandomContact() {
  const randomName = uniqueNamesGenerator({
    dictionaries: [names, animals],
    separator: '',
  }); // big_red_donkey

  const cleanName = randomName.replace(/[^\p{L}\p{N}_]/gu, ''); //staralize output

  return {
    uniqueName: cleanName + Math.ceil(Math.random() * 99),
  };
}

export async function getBolt11InvoiceForContact(
  contactUniqueName,
  sendingValue,
  description,
  useBlitzContact = true,
  domain = 'blitzwalletapp.com',
  sendingUUID,
) {
  try {
    let runCount = 0;
    let maxRunCount = 2;
    let invoice = null;

    while (runCount < maxRunCount) {
      try {
        const url = `https://${domain}/.well-known/lnurlp/${contactUniqueName}?amount=${
          sendingValue * 1000
        }&isBlitzContact=${useBlitzContact ? true : false}${
          !!description
            ? `&comment=${encodeURIComponent(description || '')}`
            : ''
        }&sendingUUID=${sendingUUID}`;
        console.log(url);
        const response = await fetch(url);
        const data = await response.json();
        if (data.status !== 'OK' && !data?.pr)
          throw new Error('Not able to get invoice');
        const decodedInvoice = decodeBolt11(data.pr);
        const requestedMsats = sendingValue * 1000;
        if (
          !decodedInvoice.millisatoshis ||
          decodedInvoice.millisatoshis != requestedMsats
        ) {
          throw new Error(
            `Invoice amount (${decodedInvoice.millisatoshis} msat) does not match requested amount (${requestedMsats} msat)`,
          );
        }
        invoice = data.pr;
        break;
      } catch (err) {
        console.log('Error getting invoice trying again', err);
        await new Promise(res => setTimeout(res, 1000));
      }
      runCount += 1;
    }

    return { pr: invoice, successAction: null };
  } catch (err) {
    console.log('get ln address for liquid payment error', err);
    return { pr: '', successAction: null };
  }
}

export function getTimeDisplay(
  timeDifferenceMinutes,
  timeDifferenceHours,
  timeDifferenceDays,
  timeDifferenceYears,
) {
  if (timeDifferenceMinutes < 1)
    return i18next.t('transactionLabelText.txTime_just_now');

  const [unit, count] =
    timeDifferenceMinutes <= 60
      ? ['minutes', timeDifferenceMinutes]
      : timeDifferenceHours <= 24
      ? ['hours', timeDifferenceHours]
      : timeDifferenceDays <= 365
      ? ['days', timeDifferenceDays]
      : ['years', timeDifferenceYears];

  // One key per unit with i18next plural suffixes, so each language controls
  // its own word order and plural forms.
  return i18next.t(`timeLabels.${unit}Ago`, { count: Math.round(count) });
}
