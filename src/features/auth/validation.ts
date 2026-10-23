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

function emailError(raw: string): string | undefined {
  const email = raw.trim();
  if (!email) return i18n.t('auth.validation.emailRequired');
  if (email.length > EMAIL_MAX_LENGTH) return i18n.t('auth.validation.emailTooLong');
  if (!EMAIL_PATTERN.test(email)) return i18n.t('auth.validation.emailInvalid');
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

  if (!values.password) {
    errors.password = i18n.t('auth.validation.passwordRequired');
  } else if (values.password.length < PASSWORD_MIN_LENGTH || values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = i18n.t('auth.validation.passwordLength');
  }

  const displayName = values.displayName.trim();
  if (!displayName) {
    errors.displayName = i18n.t('auth.validation.displayNameRequired');
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = i18n.t('auth.validation.displayNameTooLong');
  }
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
