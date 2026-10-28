import { Platform } from 'react-native';

/**
 * X5: Jest runs as iOS by default (jest-expo). Call at the top of a describe / test file to run its tests as the given
 * OS (Platform.OS is switched before each test and restored after it).
 */
export function runAsPlatform(os: 'android' | 'ios'): void {
  let restore: { restore(): void } | null = null;
  beforeEach(() => {
    restore = jest.replaceProperty(Platform, 'OS', os);
  });
  afterEach(() => {
    restore?.restore();
    restore = null;
  });
}
