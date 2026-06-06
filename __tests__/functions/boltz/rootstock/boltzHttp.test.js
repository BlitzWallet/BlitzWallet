jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: (key, opts) => opts?.defaultValue ?? key },
}));

const {
  fetchBoltzJson,
} = require('../../../../app/functions/boltz/rootstock/boltzHttp');

describe('fetchBoltzJson', () => {
  it('returns parsed JSON on success', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'x' }) });
    await expect(fetchBoltzJson('http://b')).resolves.toEqual({ id: 'x' });
  });

  it('throws on a non-ok response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ error: 'bad' }) });
    await expect(fetchBoltzJson('http://b')).rejects.toThrow('bad');
  });

  it('throws on a body-level error field', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ error: 'nope' }) });
    await expect(fetchBoltzJson('http://b')).rejects.toThrow('nope');
  });

  it('throws when the body is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    });
    await expect(fetchBoltzJson('http://b')).rejects.toThrow();
  });
});
