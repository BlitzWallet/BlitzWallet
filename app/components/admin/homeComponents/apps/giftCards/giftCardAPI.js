const serverURL =
  process.env.BOLTZ_ENVIRONMENT === 'liquid'
    ? 'https://api.thebitcoincompany.com'
    : 'https://api.dev.thebitcoincompany.com';

export default async function getGiftCardsList() {
  try {
    const response = await fetch(`${serverURL}/giftcards`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: {
        giftCards: data.result.svs,
      },
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 400,
      body: {
        error: 'Error getting options',
      },
    };
  }
}
