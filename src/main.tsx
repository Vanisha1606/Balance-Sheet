import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeDataLayer } from './data';
import { initializeEdgeToEdgeStatusBar } from './hooks/useStatusBar';
import { setupEnglishKeyboard } from './utils/english-input';
import { ensureBalanceSheetFreshStorage } from './utils/balance-sheet-storage-reset';
async function initApp() {
  try {
    await initializeEdgeToEdgeStatusBar();
    setupEnglishKeyboard();

    const didReset = await ensureBalanceSheetFreshStorage();
    if (didReset && import.meta.env.DEV) {
      console.log('[BalanceSheet] Cleared legacy storage — onboarding will show');
    }

    await initializeDataLayer();
    if (import.meta.env.DEV) console.log('[BalanceSheet] Data layer initialized');
  } catch (error) {
    console.error('[BalanceSheet] Failed to initialize:', error);
  }

  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initApp();
