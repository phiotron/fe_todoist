import i18n from '../../../i18n';
import { THEME_NAMES } from '../../../theme/themeNames';
import { THEME_NAME_KEYS } from '../themeLabels';

describe('THEME_NAME_KEYS', () => {
  it('has a key for each of the 7 themes and every key exists in vi and en', () => {
    expect(Object.keys(THEME_NAME_KEYS).sort()).toEqual([...THEME_NAMES].sort());
    for (const key of Object.values(THEME_NAME_KEYS)) {
      expect(i18n.exists(key, { lng: 'vi' })).toBe(true);
      expect(i18n.exists(key, { lng: 'en' })).toBe(true);
    }
  });
});
