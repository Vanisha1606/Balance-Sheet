import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aspiring.BalanceSheet',
  appName: 'BalanceSheet',
  webDir: 'dist',
  ios: {
    preferredContentMode: 'mobile',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
