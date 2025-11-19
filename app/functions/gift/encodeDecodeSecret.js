function createGiftUrl(giftId, randomSecret) {
  const secretBase64 = randomSecret
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return {
    webUrl: `https://blitzwalletapp.com/gift/${giftId}#${secretBase64}`,
    appUrl: `blitzwallet://gift/${giftId}/${secretBase64}`,
    qrData: `blitzwallet://gift/${giftId}/${secretBase64}`,
  };
}

function parseGiftUrl(url) {
  let match = url.match(/\/gift\/([^#]+)#(.+)/);
  if (match) {
    const [, giftId, secretBase64] = match;
    const paddedSecret = secretBase64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(secretBase64.length + ((4 - (secretBase64.length % 4)) % 4), '=');

    const secret = Buffer.from(paddedSecret, 'base64').toString('hex');
    return { giftId, secret };
  }

  match = url.match(/blitzwallet:\/\/gift\/([^\/]+)\/(.+)/);
  if (match) {
    const [, giftId, secretBase64] = match;
    const paddedSecret = secretBase64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(secretBase64.length + ((4 - (secretBase64.length % 4)) % 4), '=');

    const secret = Buffer.from(paddedSecret, 'base64').toString('hex');
    return { giftId, secret };
  }

  return null;
}

export { createGiftUrl, parseGiftUrl };
