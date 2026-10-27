import { describeError } from '../../../api/describeError';
import { ApiError, NetworkError, TimeoutError } from '../../../api/errors';
import { viTranslation as vi } from '../../../i18n';
import { describeSettingsSaveError } from '../settingsErrors';

describe('describeSettingsSaveError', () => {
  it.each([
    ['offline', new NetworkError()],
    ['timeout', new TimeoutError()],
    ['server down', new ApiError({ status: 503, title: 'x' })],
    ['rate limited', new ApiError({ status: 429, title: 'x' })],
  ])('%s: the choice is kept and will be resent', (_label, error) => {
    expect(describeSettingsSaveError(error)).toBe(vi.settings.saveFailed);
  });

  it('shows the server explanation of a rejected field', () => {
    const error = new ApiError({
      status: 400,
      title: 'Bad Request',
      errors: [{ field: 'timeZone', message: 'Múi giờ không hợp lệ' }],
    });
    expect(describeSettingsSaveError(error)).toBe('Múi giờ không hợp lệ');
  });

  it('falls back to the shared error sentences of describeError', () => {
    const error = new ApiError({ status: 404, title: 'x' });
    expect(describeSettingsSaveError(error)).toBe(describeError(error).message);
  });
});
