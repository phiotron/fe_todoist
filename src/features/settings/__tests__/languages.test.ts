import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../../../i18n';
import { APP_LANGUAGES, DEFAULT_APP_LANGUAGE } from '../settingsModel';

describe('settings languages', () => {
  it('offers exactly the languages shipped by i18n', () => {
    expect([...APP_LANGUAGES]).toEqual([...SUPPORTED_LANGUAGES]);
    expect(DEFAULT_APP_LANGUAGE).toBe(DEFAULT_LANGUAGE);
  });
});
