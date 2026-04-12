import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vasbazaar.app',
  appName: 'VasBazaar',
  webDir: 'build',
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'http',
    allowNavigation: [
      'api.vasbazaar.com',
      'apis.vasbazaar.com',
      '*.vasbazaar.com',
      '192.168.1.4',
    ],
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
  },
};

export default config;
