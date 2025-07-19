import {uniqueNamesGenerator, animals, names} from 'unique-names-generator';

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
) {
  try {
    let runCount = 0;
    let maxRunCount = 2;
    let invoice = null;

    while (runCount < maxRunCount) {
      try {
        const url = `https://blitz-wallet.com/.well-known/lnurlp/${contactUniqueName}?amount=${
          sendingValue * 1000
        }&isBlitzContact=true${
          !!description
            ? `&comment=${encodeURIComponent(description || '')}`
            : ''
        }`;

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
