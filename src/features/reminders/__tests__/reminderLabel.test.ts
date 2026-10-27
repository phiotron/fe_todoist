import i18n from '../../../i18n';
import { offsetLabel, readLabelFormats, reminderChipLabel, reminderLabel } from '../reminderLabel';

const vi = i18n.getFixedT('vi');
const DMY24 = { dateFormat: 'DMY', timeFormat: 'H24' } as const;

describe('reminderLabel', () => {
  it('labels an absolute reminder with the account date and time format', () => {
    expect(reminderLabel({ type: 'ABSOLUTE', at: '2026-10-24T09:05:00' }, vi, DMY24)).toBe('24/10/2026 09:05');
    expect(reminderLabel({ type: 'ABSOLUTE', at: '2026-10-24T21:05' }, vi, { dateFormat: 'MDY', timeFormat: 'H12' }))
      .toBe('10/24/2026 9:05 PM');
  });

  it('labels a relative reminder by its offset', () => {
    expect(reminderLabel({ type: 'RELATIVE', minuteOffset: 0 }, vi, DMY24)).toBe('Đúng giờ hạn');
    expect(reminderLabel({ type: 'RELATIVE', minuteOffset: 30 }, vi, DMY24)).toBe('30 phút trước');
    expect(reminderLabel({ type: 'RELATIVE', minuteOffset: 120 }, vi, DMY24)).toBe('2 giờ trước');
    expect(reminderLabel({ type: 'RELATIVE', minuteOffset: 1440 }, vi, DMY24)).toBe('1 ngày trước');
  });

  it('falls back to the raw value when the time cannot be read', () => {
    expect(reminderLabel({ type: 'ABSOLUTE', at: 'nope' }, vi, DMY24)).toBe('nope');
  });

  it('reads the account formats with safe defaults', () => {
    expect(readLabelFormats({ dateFormat: 'MDY', timeFormat: 'H12' })).toEqual({ dateFormat: 'MDY', timeFormat: 'H12' });
    expect(readLabelFormats(undefined)).toEqual({ dateFormat: 'DMY', timeFormat: 'H24' });
  });

  it('shows the value on the chip like the approved design (M-TaskDetail)', () => {
    expect(reminderChipLabel([], vi)).toBe('Nhắc nhở');
    expect(reminderChipLabel(['30 phút trước'], vi)).toBe('30 phút trước');
    expect(reminderChipLabel(['24/10/2026 09:00', '30 phút trước', '1 ngày trước'], vi)).toBe('24/10/2026 09:00 +2');
  });
});
