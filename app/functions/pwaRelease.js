// Native no-op. PWA release updates live in pwaRelease.web.js — native updates
// ship through the app stores.

/** @returns {Promise<{ version: string, mandatory: boolean } | null>} */
export async function checkForWebUpdate() {
  return null;
}

/** @returns {{ version: string, mandatory: boolean } | null} */
export function getPendingWebUpdate() {
  return null;
}

export async function applyWebUpdate() {}
