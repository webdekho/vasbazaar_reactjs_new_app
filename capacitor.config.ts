import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vasbazaar.app',
  appName: 'vasbazaar',
  webDir: 'build',
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
  },
};

export default config;
