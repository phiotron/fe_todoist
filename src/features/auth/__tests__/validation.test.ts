import vi from '../../../i18n/locales/vi.json';
import { hasErrors, validateLogin, validateRegister } from '../validation';

const messages = vi.auth.validation;

describe('validateLogin', () => {
  it('accepts a valid email (with surrounding spaces) and any non-empty password', () => {
    expect(validateLogin({ email: ' an@example.com ', password: 'x' })).toEqual({});
  });

  it('requires email and password', () => {
    expect(validateLogin({ email: '   ', password: '' })).toEqual({
      email: messages.emailRequired,
      password: messages.passwordRequired,
    });
  });

  it('rejects a malformed email with a Vietnamese message', () => {
    expect(validateLogin({ email: 'an@', password: 'x' }).email).toBe('Email không hợp lệ');
  });

  it('accepts 254 characters and rejects 255', () => {
    expect(validateLogin({ email: `${'a'.repeat(249)}@x.vn`, password: 'x' })).toEqual({});
    expect(validateLogin({ email: `${'a'.repeat(250)}@x.vn`, password: 'x' }).email).toBe(messages.emailTooLong);
  });
});

describe('validateRegister', () => {
  const valid = { email: 'an@example.com', password: '12345678', displayName: 'An' };

  it('accepts valid input', () => {
    expect(validateRegister(valid)).toEqual({});
  });

  it('enforces password length 8–72', () => {
    expect(validateRegister({ ...valid, password: '' }).password).toBe(messages.passwordRequired);
    expect(validateRegister({ ...valid, password: '1234567' }).password).toBe(messages.passwordLength);
    expect(validateRegister({ ...valid, password: 'a'.repeat(72) }).password).toBeUndefined();
    expect(validateRegister({ ...valid, password: 'a'.repeat(73) }).password).toBe(messages.passwordLength);
  });

  it('enforces displayName 1–100 after trimming', () => {
    expect(validateRegister({ ...valid, displayName: '   ' }).displayName).toBe(messages.displayNameRequired);
    expect(validateRegister({ ...valid, displayName: 'a'.repeat(100) }).displayName).toBeUndefined();
    expect(validateRegister({ ...valid, displayName: 'a'.repeat(101) }).displayName).toBe(
      messages.displayNameTooLong,
    );
  });

  it('validates the email like login does', () => {
    expect(validateRegister({ ...valid, email: 'khong-phai-email' }).email).toBe(messages.emailInvalid);
  });
});

describe('hasErrors', () => {
  it('is true only when at least one field has a message', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ email: undefined })).toBe(false);
    expect(hasErrors({ email: 'x' })).toBe(true);
  });
});
