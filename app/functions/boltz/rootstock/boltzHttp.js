import i18next from 'i18next';

// Single choke point for Rootstock Boltz REST calls. Guarantees a non-error
// JSON body or throws — callers never see a half-parsed/HTTP-error response.
export async function fetchBoltzJson(url, options) {
  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(
      i18next.t('errors.boltzInvalidResponse', {
        defaultValue: 'Invalid response from Boltz',
      }),
    );
  }
  if (!res.ok || data?.error) {
    throw new Error(
      data?.error ||
        i18next.t('errors.boltzRequestFailed', {
          defaultValue: 'Boltz request failed',
        }),
    );
  }
  return data;
}
