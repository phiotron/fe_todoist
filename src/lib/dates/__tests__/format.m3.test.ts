import { describeDue } from '..';
import { DEFAULT_DISPLAY_PREFS, setDisplayPrefs } from '../displayFormat';
import { formatDateKey, formatDayHeader, formatDueLabel } from '../format';

const ZONE = 'Asia/Ho_Chi_Minh';
const NOW = new Date('2026-03-01T03:00:00Z');

function timedLabel() {
  const label = describeDue({ dueDate: null, dueDatetime: '2026-12-05T14:30:00', durationMinutes: 30 }, NOW, ZONE);
  if (!label) throw new Error('expected a due label');
  return label;
}

afterEach(() => setDisplayPrefs(DEFAULT_DISPLAY_PREFS));

describe('date text follows the display preferences', () => {
  it('defaults: day/month and 24-hour time (M1 behaviour unchanged)', () => {
    expect(formatDateKey('2026-12-05', false)).toBe('05/12');
    expect(formatDueLabel(timedLabel())).toBe('05/12 14:30–15:00');
  });

  it('month/day', () => {
    setDisplayPrefs({ dateFormat: 'MDY', timeFormat: 'H24' });
    expect(formatDateKey('2026-12-05', true)).toBe('12/05/2026');
    expect(formatDueLabel(timedLabel())).toBe('12/05 14:30–15:00');
  });

  it('12-hour time, in the label and with a duration', () => {
    setDisplayPrefs({ dateFormat: 'DMY', timeFormat: 'H12' });
    expect(formatDueLabel(timedLabel())).toBe('05/12 2:30 CH–3:00 CH');
  });

  it('the Upcoming day header uses the date format', () => {
    setDisplayPrefs({ dateFormat: 'MDY', timeFormat: 'H24' });
    expect(formatDayHeader('2026-12-05', '2026-12-04')).toMatch(/^12\/05 /);
  });
});
