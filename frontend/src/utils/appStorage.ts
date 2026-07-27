// The main and demo apps are served from the same origin (different paths),
// so they share one localStorage. Prefix every key with the app identity to
// keep logins and UI state separate between the two apps.
const APP_STORAGE_PREFIX =
  process.env.REACT_APP_DEMO_MODE === "true" ? "toplista-demo:" : "toplista:";

export function getStorageItem(key: string): string | null {
  return localStorage.getItem(`${APP_STORAGE_PREFIX}${key}`);
}

export function setStorageItem(key: string, value: string): void {
  localStorage.setItem(`${APP_STORAGE_PREFIX}${key}`, value);
}

export function removeStorageItem(key: string): void {
  localStorage.removeItem(`${APP_STORAGE_PREFIX}${key}`);
}
