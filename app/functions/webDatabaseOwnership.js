// Native no-op. The real single-tab ownership lock lives in
// webDatabaseOwnership.web.js — native has one process owning its databases.

export async function acquireWebDatabaseOwnership() {
  return true;
}

export function isTabConflictError() {
  return false;
}
