import i18n from '../../i18n';
import { describeError } from '../describeError';
import { ApiError } from '../errors';

const api = (status: number, init: { code?: string; limit?: string; max?: number }) =>
  new ApiError({ status, title: 'x', ...init });

describe('describeError — label and filter cases of M2 (spec 12.10)', () => {
  it('gives a sentence for each of the two M2 limits', () => {
    expect(describeError(api(422, { code: 'limit-reached', limit: 'LABELS', max: 500 })).message).toBe(
      i18n.t('errors.limit.labels', { max: 500 }),
    );
    expect(describeError(api(422, { code: 'limit-reached', limit: 'FILTERS', max: 150 })).message).toBe(
      i18n.t('errors.limit.filters', { max: 150 }),
    );
    expect(i18n.t('errors.limit.labels', { max: 500 })).toBe('Bạn chỉ có thể tạo tối đa 500 label');
    expect(i18n.t('errors.limit.filters', { max: 150 })).toBe('Bạn chỉ có thể tạo tối đa 150 filter');
  });

  it('explains a taken label name and a filter syntax error', () => {
    expect(describeError(api(409, { code: 'label-name-taken' })).message).toBe('Đã có label cùng tên');
    expect(describeError(api(400, { code: 'filter-syntax' })).message).toBe('Truy vấn không đúng cú pháp');
  });

  it('keeps the generic conflict sentence for id-conflict (M2 never sends a client id; M9 adds its own wording)', () => {
    expect(describeError(api(409, { code: 'id-conflict' })).message).toBe(i18n.t('errors.conflict'));
  });
});
