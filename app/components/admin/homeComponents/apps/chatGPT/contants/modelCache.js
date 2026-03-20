const MODEL_API_URL = 'https://api.ppq.ai/v1/models';
let cachedModels = null;
let fetchPromise = null;

export async function getAIModels() {
  console.log('Calling models');
  if (cachedModels !== null) return cachedModels;
  if (fetchPromise !== null) return fetchPromise;

  fetchPromise = fetch(MODEL_API_URL)
    .then(res => res.json())
    .then(data => {
      const list = Array.isArray(data) ? data : data.data ?? [];
      cachedModels = list
        .filter(m => m.pricing?.input_per_1M_tokens >= 0)
        .map(m => ({
          id: m.id,
          name: m.name,
          shortName: m.id,
          inputPrice: m.pricing.input_per_1M_tokens,
          outputPrice: m.pricing.output_per_1M_tokens,
        }));
      fetchPromise = null;
      return cachedModels;
    })
    .catch(err => {
      fetchPromise = null;
      throw err;
    });

  return fetchPromise;
}
