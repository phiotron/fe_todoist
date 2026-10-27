import i18n from '../../i18n';

export interface LoginValues {
  email: string;
  password: string;
}

export interface RegisterValues extends LoginValues {
  displayName: string;
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const DISPLAY_NAME_MAX_LENGTH = 100;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(raw: string): string | undefined {
  const email = raw.trim();
  if (!email) return i18n.t('auth.validation.emailRequired');
  if (email.length > EMAIL_MAX_LENGTH) return i18n.t('auth.validation.emailTooLong');
  if (!EMAIL_PATTERN.test(email)) return i18n.t('auth.validation.emailInvalid');
  return undefined;
}

/** Spec 5.9 / 18.1 I18: the server rejects a new password longer than 72 bytes of UTF-8 as well as 72 characters. */
export const PASSWORD_MAX_BYTES = 72;

/** Length in UTF-8 bytes (accented letters take 2, most symbols 3, emoji 4). */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Rules for a password the user chooses — the one validator of register, change password and reset password
 * (spec 5.9); login only requires a value.
 */
export function newPasswordError(value: string): string | undefined {
  if (!value) return i18n.t('auth.validation.passwordRequired');
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return i18n.t('auth.validation.passwordLength');
  }
  if (utf8ByteLength(value) > PASSWORD_MAX_BYTES) return i18n.t('auth.validation.passwordBytes');
  return undefined;
}

export function displayNameError(raw: string): string | undefined {
  const displayName = raw.trim();
  if (!displayName) return i18n.t('auth.validation.displayNameRequired');
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) return i18n.t('auth.validation.displayNameTooLong');
  return undefined;
}

export function validateLogin(values: LoginValues): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {};
  const email = emailError(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = i18n.t('auth.validation.passwordRequired');
  return errors;
}

export function validateRegister(values: RegisterValues): FieldErrors<RegisterValues> {
  const errors: FieldErrors<RegisterValues> = {};
  const email = emailError(values.email);
  if (email) errors.email = email;

  const password = newPasswordError(values.password);
  if (password) errors.password = password;
  const displayName = displayNameError(values.displayName);
  if (displayName) errors.displayName = displayName;
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
