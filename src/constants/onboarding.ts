export const ONBOARDING_STORAGE_KEY = 'balance_sheet_onboarding_completed';

export const BALANCE_SHEET_LOGO = '/img/bi.png';

/** Single welcome slide — Balance Sheet icon (from introduction.html) */
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
];
