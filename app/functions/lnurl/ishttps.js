export function isHTTPS(fetchString) {
  try {
    return fetchString.startsWith('https://');
  } catch (err) {
    console.log('Error deternimming if url is https');
    return false;
  }
}
