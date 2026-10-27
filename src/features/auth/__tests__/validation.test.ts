import vi from '../../../i18n/locales/vi.json';
import {
  displayNameError,
  emailError,
  hasErrors,
  newPasswordError,
  utf8ByteLength,
  validateLogin,
  validateRegister,
} from '../validation';

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

describe('field validators shared by the M3 forms', () => {
  it('emailError trims and validates', () => {
    expect(emailError('  an@example.com ')).toBeUndefined();
    expect(emailError('   ')).toBe(messages.emailRequired);
    expect(emailError('an@')).toBe(messages.emailInvalid);
    expect(emailError(`${'a'.repeat(250)}@x.vn`)).toBe(messages.emailTooLong);
  });

  it('displayNameError enforces 1–100 characters after trimming', () => {
    expect(displayNameError('  An  ')).toBeUndefined();
    expect(displayNameError('   ')).toBe(messages.displayNameRequired);
    expect(displayNameError('a'.repeat(100))).toBeUndefined();
    expect(displayNameError('a'.repeat(101))).toBe(messages.displayNameTooLong);
  });

  it('newPasswordError enforces 8–72 characters', () => {
    expect(newPasswordError('')).toBe(messages.passwordRequired);
    expect(newPasswordError('1234567')).toBe(messages.passwordLength);
    expect(newPasswordError('12345678')).toBeUndefined();
    expect(newPasswordError('a'.repeat(72))).toBeUndefined();
    expect(newPasswordError('a'.repeat(73))).toBe(messages.passwordLength);
  });

  it('newPasswordError also enforces at most 72 bytes of UTF-8 (spec 5.9, 18.1 I18)', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
    expect(newPasswordError('é'.repeat(36))).toBeUndefined(); // 72 bytes
    expect(newPasswordError('é'.repeat(37))).toBe(messages.passwordBytes); // 37 characters, 74 bytes
    expect(newPasswordError('😀'.repeat(19))).toBe(messages.passwordBytes); // 38 UTF-16 units, 76 bytes
  });
});
