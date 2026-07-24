import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.slimflow.app',
  appName: 'Slimflow',
  webDir: 'dist',
  android: {
    // Lets you open chrome://inspect on a desktop Chrome plugged into the
    // phone and see this WebView's console/network/IndexedDB — the only
    // real way to debug the OCR worker once it's running inside the app.
    webContentsDebuggingEnabled: true,
  },
};

export default config;
