import { openBrowserAsync } from 'expo-web-browser';
import openWebBrowser from '../app/functions/openWebBrowser';

beforeEach(() => jest.clearAllMocks());

test.each(['javascript:void(0)', 'data:text/html,receipt', 'http://merchant.example', '', null, {}])(
  'does not send rejected URLs to the browser: %p',
  async link => {
    expect(await openWebBrowser({ link })).toBe(false);
    expect(openBrowserAsync).not.toHaveBeenCalled();
  },
);

test('opens an HTTPS receipt without an opener or referrer', async () => {
  await openWebBrowser({ link: '  https://merchant.example/receipt  ' });
  expect(openBrowserAsync).toHaveBeenCalledWith('https://merchant.example/receipt', {
    windowFeatures: { noopener: true, noreferrer: true },
  });
});
