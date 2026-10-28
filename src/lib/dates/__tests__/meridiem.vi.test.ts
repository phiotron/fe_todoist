import i18n from '../../../i18n';
import { formatWallClock } from '../../reminders/reminderOptions';
import { formatTime } from '../displayFormat';

/** VIUI: the 12-hour clock uses the Vietnamese markers SA / CH when the app is in Vietnamese, AM / PM in English. */
describe('12-hour clock markers follow the app language', () => {
  afterEach(async () => {
    await i18n.changeLanguage('vi');
  });

  it('Vietnamese: SA before noon, CH from noon', () => {
    expect(formatTime('09:05', 'H12')).toBe('9:05 SA');
    expect(formatTime('14:30', 'H12')).toBe('2:30 CH');
    expect(formatWallClock({ year: 2026, month: 10, day: 4, hour: 23, minute: 45 }, 'DMY', 'H12')).toBe('04/10/2026 11:45 CH');
  });

  it('English keeps AM / PM', async () => {
    await i18n.changeLanguage('en');
    expect(formatTime('09:05', 'H12')).toBe('9:05 AM');
    expect(formatWallClock({ year: 2026, month: 10, day: 4, hour: 12, minute: 30 }, 'DMY', 'H12')).toBe('04/10/2026 12:30 PM');
  });

  it('the 24-hour clock has no marker in either language', () => {
    expect(formatTime('14:30', 'H24')).toBe('14:30');
  });
});
