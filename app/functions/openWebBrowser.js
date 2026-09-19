import * as WebBrowser from 'expo-web-browser';
import { getNormalizedWebsiteUrl } from './getNormalizedWebsiteUrl';

export default async function openWebBrowser({ navigate, link }) {
  try {
    // Shared sink: only https URLs may reach the browser. Payee-controlled
    // values (LNURL LUD-09 successAction) arrive here unvalidated from stored
    // history, so a javascript:/data: URL must never reach window.open on web
    // (same-origin XSS with opener access to the unlocked wallet).
    const safeLink = getNormalizedWebsiteUrl(link);
    if (!safeLink) return false;
    // noopener/noreferrer severs window.opener on web so the opened page can
    // never script the wallet window even if a check is bypassed. Ignored on
    // native where the URL opens in a separate browser/Custom Tab.
    await WebBrowser.openBrowserAsync(safeLink, {
      windowFeatures: { noopener: true, noreferrer: true },
    });
    return true;
  } catch (err) {
    if (navigate) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Cannot open web broswer',
      });
    }
    console.log(err, 'OPENING LINK ERROR');
  }
}
