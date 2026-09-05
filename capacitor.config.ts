import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.hydrusweb.client',
  appName: 'Hydrus Web',
  webDir: 'dist/hydrus-web',
  backgroundColor: '#121318',
  ios: {
    allowsLinkPreview: false,
    contentInset: 'never',
    preferredContentMode: 'mobile'
  }
};

export default config;
