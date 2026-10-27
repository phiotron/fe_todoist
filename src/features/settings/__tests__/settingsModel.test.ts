import { ApiError, NetworkError, TimeoutError } from '../../../api/errors';
import {
  APP_LANGUAGES,
  applyLocally,
  defaultSettings,
  effectiveData,
  effectiveSettings,
  emptyStored,
  extraFields,
  hasTimeZoneMismatch,
  isRetryableSaveError,
  mergePending,
  normalizeLanguage,
  normalizePatch,
  normalizeSettings,
  parseStoredSettings,
  settlePending,
  splitThemePatch,
  timeZonePairKey,
  type AppSettings,
  type StoredSettings,
} from '../settingsModel';

const P1 = '11111111-1111-4111-8111-111111111111';
const base: AppSettings = defaultSettings('vi', 'Asia/Ho_Chi_Minh');

function stored(overrides: Partial<StoredSettings> = {}): StoredSettings {
  return { ...emptyStored(base), ...overrides };
}

describe('normalizeLanguage', () => {
  it('supports Vietnamese and English, anything else is Vietnamese (UC 11/8a)', () => {
    expect(APP_LANGUAGES).toEqual(['vi', 'en']);
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('EN-us')).toBe('en');
    expect(normalizeLanguage('en_GB')).toBe('en');
    expect(normalizeLanguage('vi-VN')).toBe('vi');
    expect(normalizeLanguage('fr')).toBe('vi');
    expect(normalizeLanguage(null)).toBe('vi');
    expect(normalizeLanguage('')).toBe('vi');
  });
});

describe('defaultSettings', () => {
  it('uses the spec 10 defaults, the current language and the device time zone', () => {
    expect(defaultSettings('en', 'Asia/Tokyo')).toEqual({
      theme: 'TASKLY',
      appearance: 'AUTO',
      locale: 'en',
      timeZone: 'Asia/Tokyo',
      startDay: 1,
      nextWeek: 1,
      weekendStartDay: 6,
      dateFormat: 'DMY',
      timeFormat: 'H24',
      startPage: 'TODAY',
      smartDateRecognition: true,
      swipeLeft: 'SCHEDULE',
      swipeRight: 'COMPLETE',
      navTabs: ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'],
    });
  });

  it('falls back to Vietnamese and Asia/Ho_Chi_Minh', () => {
    expect(defaultSettings('fr', null)).toEqual(base);
  });

  it('returns a fresh navTabs array every time', () => {
    expect(defaultSettings('vi', null).navTabs).not.toBe(defaultSettings('vi', null).navTabs);
  });
});

describe('normalizeSettings', () => {
  it('keeps valid server values and ignores unknown fields', () => {
    const server = {
      theme: 'KALE',
      appearance: 'DARK',
      locale: 'en',
      timeZone: 'Europe/Paris',
      startDay: 7,
      nextWeek: 3,
      weekendStartDay: 5,
      dateFormat: 'MDY',
      timeFormat: 'H12',
      startPage: `project:${P1}`,
      smartDateRecognition: false,
      swipeLeft: 'DELETE',
      swipeRight: 'SELECT',
      navTabs: ['TODAY', 'SEARCH', 'BROWSE'],
      remindersEnabled: true,
    };
    const { remindersEnabled: _ignored, ...core } = server;
    expect(normalizeSettings(server, base)).toEqual(core);
  });

  it('maps a language that is not supported any more to Vietnamese (UC 11/8a)', () => {
    expect(normalizeSettings({ ...base, locale: 'fr' }, { ...base, locale: 'en' }).locale).toBe('vi');
  });

  it('falls back field by field on unknown or missing values', () => {
    const fallback: AppSettings = { ...base, theme: 'LAVENDER', startDay: 7, navTabs: ['TODAY', 'INBOX', 'BROWSE'] };
    expect(
      normalizeSettings(
        {
          theme: 'PINK',
          appearance: 'SYSTEM',
          timeZone: '  ',
          startDay: 0,
          nextWeek: 8,
          weekendStartDay: '6',
          dateFormat: 'YMD',
          timeFormat: 'H25',
          startPage: 'project:abc',
          smartDateRecognition: 'yes',
          swipeLeft: 'JUMP',
          navTabs: ['INBOX'],
        },
        fallback,
      ),
    ).toEqual(fallback);
    expect(normalizeSettings(null, base)).toEqual(base);
  });
});

describe('extraFields (settings added by later milestones, e.g. M4 reminders)', () => {
  it('keeps every non-core field with a plain value (null and string lists included) and drops the rest', () => {
    expect(
      extraFields({
        ...base,
        remindersEnabled: true,
        autoReminderMinutes: null,
        quickAddChips: ['DATE', 'PRIORITY'],
        nested: { a: 1 },
        mixed: ['a', 1],
      }),
    ).toEqual({ remindersEnabled: true, autoReminderMinutes: null, quickAddChips: ['DATE', 'PRIORITY'] });
    expect(extraFields(null)).toEqual({});
  });
});

describe('normalizePatch', () => {
  it('keeps a null value: "Off" for the M4 auto reminder is a real change, even when it is the only key', () => {
    expect(normalizePatch({ autoReminderMinutes: null })).toEqual({ autoReminderMinutes: null });
    expect(normalizePatch({ theme: 'KALE', autoReminderMinutes: null })).toEqual({ theme: 'KALE', autoReminderMinutes: null });
  });

  it('keeps valid core fields and plain extra fields, drops invalid core values', () => {
    expect(
      normalizePatch({
        theme: 'KALE',
        locale: 'fr',
        startDay: 9,
        navTabs: ['TODAY', 'INBOX', 'BROWSE'],
        swipeLeft: 'NONE',
        autoReminderMinutes: null,
      }),
    ).toEqual({ theme: 'KALE', navTabs: ['TODAY', 'INBOX', 'BROWSE'], swipeLeft: 'NONE', autoReminderMinutes: null });
  });

  it('returns null for empty or invalid input', () => {
    expect(normalizePatch({})).toBeNull();
    expect(normalizePatch({ nested: { a: 1 } })).toBeNull();
    expect(normalizePatch(['TODAY'])).toBeNull();
    expect(normalizePatch('x')).toBeNull();
    expect(normalizePatch(null)).toBeNull();
  });
});

describe('effective settings', () => {
  it('lays the pending change over the applied settings', () => {
    expect(effectiveSettings(stored({ pending: { theme: 'KALE', startDay: 7, remindersEnabled: false } }))).toEqual({
      ...base,
      theme: 'KALE',
      startDay: 7,
    });
    expect(effectiveSettings(stored())).toEqual(base);
  });

  it('with "Sync theme" off, the theme kept on this device wins', () => {
    const value = stored({
      pending: { theme: 'KALE' },
      syncTheme: false,
      localTheme: { theme: 'RASPBERRY', appearance: 'DARK' },
    });
    expect(effectiveSettings(value)).toMatchObject({ theme: 'RASPBERRY', appearance: 'DARK' });
    expect(effectiveSettings({ ...value, syncTheme: true })).toMatchObject({ theme: 'KALE', appearance: 'AUTO' });
  });

  it('effectiveData is the server shape: extra fields, applied settings, then pending changes', () => {
    const value = stored({
      extra: { remindersEnabled: true, autoReminderMinutes: 30 },
      pending: { theme: 'KALE', autoReminderMinutes: null },
      syncTheme: false,
      localTheme: { theme: 'RASPBERRY', appearance: 'DARK' },
    });
    expect(effectiveData(value)).toEqual({ ...base, theme: 'KALE', remindersEnabled: true, autoReminderMinutes: null });
  });
});

describe('changes', () => {
  it('splitThemePatch separates theme / appearance from the rest', () => {
    expect(splitThemePatch({ theme: 'KALE', appearance: 'DARK', startDay: 7 })).toEqual({
      theme: { theme: 'KALE', appearance: 'DARK' },
      rest: { startDay: 7 },
    });
    expect(splitThemePatch({ startDay: 7 })).toEqual({ theme: null, rest: { startDay: 7 } });
    expect(splitThemePatch({ appearance: 'LIGHT' })).toEqual({ theme: { appearance: 'LIGHT' }, rest: null });
  });

  it('applyLocally writes a change straight into the applied / extra settings (signed out)', () => {
    expect(applyLocally(stored({ extra: { remindersEnabled: true } }), { theme: 'KALE', remindersEnabled: false })).toEqual(
      stored({ applied: { ...base, theme: 'KALE' }, extra: { remindersEnabled: false } }),
    );
  });

  it('mergePending keeps earlier keys and overrides repeated ones', () => {
    expect(mergePending(null, { theme: 'KALE' })).toEqual({ theme: 'KALE' });
    expect(mergePending({ theme: 'KALE', locale: 'en' }, { theme: 'TASKLY' })).toEqual({ theme: 'TASKLY', locale: 'en' });
  });

  it('settlePending removes only the keys that were sent and not changed since (lists compared by value)', () => {
    expect(settlePending({ theme: 'KALE' }, { theme: 'KALE' })).toBeNull();
    expect(settlePending({ theme: 'TASKLY', locale: 'en' }, { theme: 'KALE', locale: 'en' })).toEqual({ theme: 'TASKLY' });
    expect(settlePending({ navTabs: ['TODAY', 'INBOX', 'BROWSE'] }, { navTabs: ['TODAY', 'INBOX', 'BROWSE'] })).toBeNull();
    expect(settlePending({ navTabs: ['INBOX', 'TODAY', 'BROWSE'] }, { navTabs: ['TODAY', 'INBOX', 'BROWSE'] })).toEqual({
      navTabs: ['INBOX', 'TODAY', 'BROWSE'],
    });
    expect(settlePending(null, { theme: 'KALE' })).toBeNull();
  });

  it('null values merge, settle and survive like any other value', () => {
    expect(mergePending({ autoReminderMinutes: 15 }, { autoReminderMinutes: null })).toEqual({ autoReminderMinutes: null });
    expect(settlePending({ autoReminderMinutes: null }, { autoReminderMinutes: null })).toBeNull();
    expect(settlePending({ autoReminderMinutes: 60 }, { autoReminderMinutes: null })).toEqual({ autoReminderMinutes: 60 });
    expect(settlePending({ autoReminderMinutes: null, theme: 'KALE' }, { theme: 'KALE' })).toEqual({ autoReminderMinutes: null });
  });
});

describe('isRetryableSaveError', () => {
  it.each([
    ['network', new NetworkError(), true],
    ['timeout', new TimeoutError(), true],
    ['500', new ApiError({ status: 500, title: 'x' }), true],
    ['503', new ApiError({ status: 503, title: 'x' }), true],
    ['429', new ApiError({ status: 429, title: 'x' }), true],
    ['400', new ApiError({ status: 400, title: 'x' }), false],
    ['401', new ApiError({ status: 401, title: 'x' }), false],
    ['plain Error', new Error('x'), false],
  ])('%s → %p', (_label, error, expected) => {
    expect(isRetryableSaveError(error)).toBe(expected);
  });
});

describe('time zone mismatch', () => {
  it('is reported only when the device zone is known and differs', () => {
    expect(hasTimeZoneMismatch('Asia/Tokyo', 'Asia/Ho_Chi_Minh', null)).toBe(true);
    expect(hasTimeZoneMismatch('Asia/Ho_Chi_Minh', 'Asia/Ho_Chi_Minh', null)).toBe(false);
    expect(hasTimeZoneMismatch(null, 'Asia/Ho_Chi_Minh', null)).toBe(false);
  });

  it('stays hidden for a dismissed pair but comes back when either zone changes', () => {
    const dismissed = timeZonePairKey('Asia/Tokyo', 'Asia/Ho_Chi_Minh');
    expect(dismissed).toBe('Asia/Tokyo|Asia/Ho_Chi_Minh');
    expect(hasTimeZoneMismatch('Asia/Tokyo', 'Asia/Ho_Chi_Minh', dismissed)).toBe(false);
    expect(hasTimeZoneMismatch('Europe/Paris', 'Asia/Ho_Chi_Minh', dismissed)).toBe(true);
    expect(hasTimeZoneMismatch('Asia/Tokyo', 'UTC', dismissed)).toBe(true);
  });
});

describe('parseStoredSettings', () => {
  it('reads back what was saved', () => {
    const value = stored({
      applied: { ...base, theme: 'KALE', locale: 'en', navTabs: ['TODAY', 'INBOX', 'BROWSE'] },
      extra: { remindersEnabled: true, autoReminderMinutes: null },
      pending: { theme: 'TASKLY' },
      dismissedTimeZone: 'Asia/Tokyo|UTC',
      syncTheme: false,
      localTheme: { theme: 'RASPBERRY', appearance: 'DARK' },
    });
    expect(parseStoredSettings(JSON.stringify(value), base)).toEqual(value);
  });

  it('keeps a null in a pending change and in the extra fields (JSON round trip)', () => {
    const value = stored({ extra: { remindersEnabled: true, autoReminderMinutes: 30 }, pending: { autoReminderMinutes: null } });
    expect(parseStoredSettings(JSON.stringify(value), base)).toEqual(value);
  });

  it('defaults "Sync theme" to on and drops an invalid device theme', () => {
    const text = JSON.stringify({ applied: base, localTheme: { theme: 'PINK', appearance: 'DARK' } });
    expect(parseStoredSettings(text, base)).toEqual(stored());
  });

  it('falls back to defaults for missing or corrupted data', () => {
    expect(parseStoredSettings(null, base)).toEqual(stored());
    expect(parseStoredSettings('{not json', base)).toEqual(stored());
    expect(parseStoredSettings('"text"', base)).toEqual(stored());
  });
});
