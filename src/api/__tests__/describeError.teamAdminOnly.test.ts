import i18n from '../../i18n';
import en from '../../i18n/locales/en/team.json';
import vi from '../../i18n/locales/vi/team.json';
import { describeError } from '../describeError';
import { ApiError } from '../errors';

describe('describeError 403 team-admin-only (PERM)', () => {
  afterEach(() => void i18n.changeLanguage('vi'));

  it('explains in Vietnamese that only team admins can edit (not the generic 403 sentence)', () => {
    const error = new ApiError({ status: 403, title: 'Forbidden', code: 'team-admin-only', detail: 'server text' });
    expect(describeError(error).message).toBe(vi.team.adminOnly.error);
    expect(vi.team.adminOnly.error).toMatch(/quản trị viên/);
  });

  it('follows the app language', async () => {
    await i18n.changeLanguage('en');
    const error = new ApiError({ status: 403, title: 'Forbidden', code: 'team-admin-only' });
    expect(describeError(error).message).toBe(en.team.adminOnly.error);
  });
});
