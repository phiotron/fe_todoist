import { APP_ICON_NAMES, isAppIconName } from '../appIcons';
import {
  getTasklyAndroid,
  playCompletionTone,
  setTasklyAndroidForTests,
  supportsDynamicColor,
  type TasklyAndroidModule,
} from '../tasklyAndroid';

describe('TasklyAndroid native bridge', () => {
  afterEach(() => setTasklyAndroidForTests(undefined));

  it('is missing in Expo Go, on iOS and in tests: every helper degrades to "not available"', () => {
    expect(getTasklyAndroid()).toBeNull();
    expect(supportsDynamicColor('android', 34)).toBe(false);
    expect(() => playCompletionTone()).not.toThrow();
  });

  it('Dynamic Color needs Android 12 (API 31) and the module', () => {
    setTasklyAndroidForTests({} as TasklyAndroidModule);

    expect(supportsDynamicColor('android', 31)).toBe(true);
    expect(supportsDynamicColor('android', '34')).toBe(true);
    expect(supportsDynamicColor('android', 30)).toBe(false);
    expect(supportsDynamicColor('ios', 34)).toBe(false);
  });

  it('plays the completion tone through the module and never throws if it fails', () => {
    const playTone = jest.fn();
    setTasklyAndroidForTests({ playCompletionTone: playTone } as unknown as TasklyAndroidModule);
    playCompletionTone();
    expect(playTone).toHaveBeenCalledTimes(1);

    setTasklyAndroidForTests({
      playCompletionTone: () => {
        throw new Error('no audio');
      },
    } as unknown as TasklyAndroidModule);
    expect(() => playCompletionTone()).not.toThrow();
  });

  it('knows the three launcher icons', () => {
    expect([...APP_ICON_NAMES]).toEqual(['default', 'dark', 'light']);
    expect(isAppIconName('dark')).toBe(true);
    expect(isAppIconName('neon')).toBe(false);
  });
});
