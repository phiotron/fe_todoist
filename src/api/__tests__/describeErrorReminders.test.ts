import vi from '../../i18n/locales/vi.json';
import { describeError } from '../describeError';
import { ApiError } from '../errors';

const limitReached = new ApiError({ status: 422, title: 'x', code: 'limit-reached', limit: 'REMINDERS', max: 700 });

describe('describeError — reminder limit', () => {
  it('says how many reminders are allowed', () => {
    const { message } = describeError(limitReached);

    expect(message).toBe(vi.errors.limit.reminders.replace('{{max}}', '700'));
    expect(message).toContain('700');
    expect(message).not.toBe(vi.errors.limit.other.replace('{{max}}', '700'));
  });
});
