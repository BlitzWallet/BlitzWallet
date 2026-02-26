export function formatLightningAddress(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    console.log(urlObj, hostname, pathname);

    const pathParts = pathname.split('/').filter(part => part !== '');
    const username = pathParts[pathParts.length - 1];

    if (!username) {
      throw new Error('Could not extract username from URL');
    }

    return `${username}@${hostname}`;
  } catch (error) {
    throw new Error(`Invalid URL or unable to parse: ${error.message}`);
  }
}
