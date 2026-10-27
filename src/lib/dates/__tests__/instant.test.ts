import { nowLocal } from '..';
import { parseInstant } from '../instant';

describe('parseInstant (backend Instant strings)', () => {
  it.each([
    ['2026-10-23T03:00:00Z', '2026-10-23T03:00:00.000Z'],
    ['2026-10-23T03:00:00.5Z', '2026-10-23T03:00:00.500Z'],
    ['2026-10-23T03:00:00.123Z', '2026-10-23T03:00:00.123Z'],
    // Instant serialises up to nanoseconds: Hermes can reject more than 3 fraction digits, so cut to milliseconds.
    ['2026-10-23T03:00:00.123456Z', '2026-10-23T03:00:00.123Z'],
    ['2026-10-23T03:00:00.123456789Z', '2026-10-23T03:00:00.123Z'],
    ['2026-10-23T10:00:00.123456+07:00', '2026-10-23T03:00:00.123Z'],
  ])('%s', (input, iso) => {
    expect(parseInstant(input).toISOString()).toBe(iso);
  });

  it('feeds nowLocal with the account time zone', () => {
    expect(nowLocal(parseInstant('2026-10-23T03:05:09.654321Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-10-23T10:05:09');
  });
});
