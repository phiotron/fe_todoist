import appConfig from '../../../app.json';
import packageJson from '../../../package.json';

describe('app config for M3', () => {
  it('lets the OS colour scheme reach the app', () => {
    expect(appConfig.expo.userInterfaceStyle).toBe('automatic');
  });

  it.each(['expo-system-ui', 'react-native-svg', 'qrcode', 'expo-clipboard'])('ships %s', (name) => {
    expect(Object.keys(packageJson.dependencies)).toContain(name);
  });

  it('has the QR code typings', () => {
    expect(Object.keys(packageJson.devDependencies)).toContain('@types/qrcode');
  });
});
