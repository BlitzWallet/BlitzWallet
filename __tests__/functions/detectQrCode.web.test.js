jest.mock('jsqr', () => jest.fn(() => ({ data: 'lnbc123-test' })));

describe('detectQRCode on web (jsQR branch)', () => {
  function setupWebGlobals() {
    const getImageData = jest.fn(() => ({
      data: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 10,
      height: 10,
    }));
    const drawImage = jest.fn();
    const getContext = jest.fn(() => ({ drawImage, getImageData }));
    global.document = {
      createElement: jest.fn(() => ({
        width: 0,
        height: 0,
        getContext,
      })),
    };
    global.window = Object.assign(global.window || {}, {
      Image: class {
        constructor() {
          this.naturalWidth = 100;
          this.naturalHeight = 100;
        }
        set src(v) {
          this._src = v;
          setTimeout(() => this.onload && this.onload(), 0);
        }
        get src() {
          return this._src;
        }
      },
    });
  }

  function requireWebDetectQrCode() {
    jest.resetModules();
    setupWebGlobals();
    return require('../../app/functions/detectQrCode.web.js');
  }

  afterEach(() => {
    delete global.document;
    jest.resetModules();
  });

  test('decodes via browser canvas and preserves {type, values} contract', async () => {
    const { detectQRCode } = requireWebDetectQrCode();
    const result = await detectQRCode('blob:fake-qr-image');
    expect(result).toEqual({ type: 'QRCode', values: ['lnbc123-test'] });
  });

  test('returns null for non-string uri without throwing', async () => {
    const { detectQRCode } = requireWebDetectQrCode();
    await expect(detectQRCode(null)).resolves.toBeNull();
    await expect(detectQRCode(undefined)).resolves.toBeNull();
  });
});
