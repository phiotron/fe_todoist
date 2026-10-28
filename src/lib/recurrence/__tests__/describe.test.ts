import i18n from '../../../i18n';
import { describeRecurrence } from '../describe';
import { fromRRule } from '../rrule';

const text = (rule: string, fromCompletion = false) => describeRecurrence({ ...fromRRule(rule), fromCompletion });

describe('describeRecurrence (vi)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
  });

  it.each([
    ['FREQ=DAILY', 'Mỗi ngày'],
    ['FREQ=DAILY;INTERVAL=3', 'Mỗi 3 ngày'],
    ['FREQ=WEEKLY;BYDAY=MO', 'Mỗi tuần vào Thứ Hai'],
    ['FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR', 'Mỗi 2 tuần vào Thứ Hai, Thứ Sáu'],
    ['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'Mỗi ngày làm việc'],
    ['FREQ=MONTHLY;BYMONTHDAY=31', 'Mỗi tháng vào ngày 31'],
    ['FREQ=MONTHLY;BYMONTHDAY=-1', 'Mỗi tháng vào ngày cuối'],
    ['FREQ=MONTHLY;BYDAY=3FR', 'Mỗi tháng vào Thứ Sáu thứ ba'],
    ['FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1', 'Ngày làm việc cuối cùng của tháng'],
    ['FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29', 'Mỗi năm vào 29/02'],
    ['FREQ=YEARLY', 'Mỗi năm'],
  ])('%s', (rule, expected) => {
    expect(text(rule)).toBe(expected);
  });

  it('adds the end date and the based-on-completion note', () => {
    expect(text('FREQ=DAILY;UNTIL=20261231', true)).toBe('Mỗi ngày, đến 31/12/2026, tính từ ngày hoàn thành');
  });
});

describe('describeRecurrence (en)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('vi');
  });

  it('reads naturally', () => {
    expect(text('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO')).toBe('Every 2 weeks on Monday');
    expect(text('FREQ=MONTHLY;BYDAY=3FR')).toBe('Every month on the 3rd Friday');
    expect(text('FREQ=MONTHLY;BYMONTHDAY=-1')).toBe('Every month on the last day');
    expect(text('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1')).toBe('Last workday of the month');
  });
});
