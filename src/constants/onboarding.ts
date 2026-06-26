export const ONBOARDING_STORAGE_KEY = 'balance_sheet_onboarding_completed';

export const BALANCE_SHEET_LOGO = '/img/bi.png';

export const SUPPORT_EMAIL = 'marketing@tickervalue.com';

/** First and last slides only — Balance Sheet icon on both (from introduction.html) */
export const ONBOARDING_SLIDES = [
  {
    id: 'welcome',
    title: 'Welcome to Balance Sheet',
    subtitle: 'Tap any cell in the balance sheet spreadsheet to enter your financial data.',
    image: BALANCE_SHEET_LOGO,
    isLogo: true,
    features: [
      'Introduction & multiple balance sheet templates',
      'Save files locally on your device',
      'Works on iPad and iPhone',
    ],
  },
  {
    id: 'ready',
    title: 'Sync and backup to server',
    subtitle:
      'Use Save As under sync and backup to server to access your balance sheets from any browser.',
    image: BALANCE_SHEET_LOGO,
    isLogo: true,
    caption: `Questions? Email ${SUPPORT_EMAIL}`,
  },
];
