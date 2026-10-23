import { ApiError, NetworkError } from '../../../api/errors';
import vi from '../../../i18n/locales/vi.json';
import { describeAuthError } from '../authErrors';

describe('describeAuthError', () => {
  it('reports "server unreachable" for network errors while online', () => {
    expect(describeAuthError(new NetworkError(), 'login', true)).toEqual({ form: vi.errors.network, fields: {} });
  });

  it('reports "offline" for network errors while offline', () => {
    expect(describeAuthError(new NetworkError(), 'register', false)).toEqual({ form: vi.errors.offline, fields: {} });
  });

  it('maps 401 on login to "wrong email or password"', () => {
    const error = new ApiError({ status: 401, title: 'Unauthorized' });
    expect(describeAuthError(error, 'login', true)).toEqual({
      form: 'Email hoặc mật khẩu không đúng',
      fields: {},
    });
  });

  it('maps 401 on login with the real backend detail to the same message', () => {
    const error = new ApiError({ status: 401, title: 'Unauthorized', detail: 'Email hoặc mật khẩu không đúng' });
    expect(describeAuthError(error, 'login', true)).toEqual({
      form: vi.auth.errors.invalidCredentials,
      fields: {},
    });
  });

  it('maps 409 on register to an error under the email field', () => {
    const error = new ApiError({ status: 409, title: 'Conflict' });
    expect(describeAuthError(error, 'register', true)).toEqual({ fields: { email: 'Email đã được dùng' } });
  });

  it('maps 400 field errors to their fields and unknown fields to the form', () => {
    const error = new ApiError({
      status: 400,
      title: 'Bad Request',
      errors: [
        { field: 'email', message: 'email sai' },
        { field: 'password', message: 'password ngắn' },
        { field: 'password', message: 'bị bỏ qua vì đã có lỗi trước' },
        { field: 'locale', message: 'locale sai' },
      ],
    });
    expect(describeAuthError(error, 'register', true)).toEqual({
      form: 'locale sai',
      fields: { email: 'email sai', password: 'password ngắn' },
    });
  });

  it('shows the server message verbatim for a too-long password (backend 400)', () => {
    const error = new ApiError({
      status: 400,
      title: 'Bad Request',
      errors: [{ field: 'password', message: 'Mật khẩu quá dài, hãy dùng mật khẩu ngắn hơn' }],
    });
    expect(describeAuthError(error, 'register', true)).toEqual({
      fields: { password: 'Mật khẩu quá dài, hãy dùng mật khẩu ngắn hơn' },
    });
  });

  it('falls back to the generic message for other API errors', () => {
    expect(describeAuthError(new ApiError({ status: 500, title: 'Oops' }), 'login', true)).toEqual({
      form: vi.errors.unknown,
      fields: {},
    });
    expect(describeAuthError(new ApiError({ status: 401, title: 'x' }), 'register', true)).toEqual({
      form: vi.errors.unknown,
      fields: {},
    });
  });

  it('falls back to the generic message for unexpected errors', () => {
    expect(describeAuthError(new Error('boom'), 'login', true)).toEqual({ form: vi.errors.unknown, fields: {} });
  });
});
