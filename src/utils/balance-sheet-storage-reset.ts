import { Preferences } from '@capacitor/preferences';
import { ONBOARDING_STORAGE_KEY } from '../constants/onboarding';

const STORAGE_VERSION_KEY = 'balance_sheet_storage_version';
const CURRENT_STORAGE_VERSION = '8';

function clearWebLocalStorage(): void {
  localStorage.clear();
}

async function clearNativePreferences(): Promise<void> {
  const { keys } = await Preferences.keys();
  await Promise.all(keys.map((key) => Preferences.remove({ key })));
}

/** One-time migration from vacation/house-maintenance leftovers. */
export async function ensureBalanceSheetFreshStorage(): Promise<boolean> {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
  if (storedVersion === CURRENT_STORAGE_VERSION) {
    return false;
  }

  clearWebLocalStorage();

  try {
    await clearNativePreferences();
  } catch (error) {
    console.warn('[BalanceSheet] Could not clear native preferences:', error);
  }

  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
  return true;
}

export function readOnboardingCompleted(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
}
