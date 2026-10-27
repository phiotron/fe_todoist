import { ApiError, NetworkError, TimeoutError } from '../../api/errors';
import i18n from '../../i18n';

export type AuthFormKind = 'login' | 'register';
export type AuthField = 'email' | 'password' | 'displayName';

export interface AuthErrorView {
  /** Message shown above the submit button. */
  form?: string;
  /** Messages shown under each input. */
  fields: Partial<Record<AuthField, string>>;
}

/** Fields each form actually renders: errors for any other field go to the form message. */
const FORM_FIELDS: Record<AuthFormKind, readonly AuthField[]> = {
  login: ['email', 'password'],
  register: ['email', 'password', 'displayName'],
};

function isFormField(kind: AuthFormKind, field: string): field is AuthField {
  return (FORM_FIELDS[kind] as readonly string[]).includes(field);
}

export function describeAuthError(error: unknown, kind: AuthFormKind, isOnline: boolean): AuthErrorView {
  if (error instanceof TimeoutError) {
    // Slow or flaky network: say so instead of the generic "cannot reach the server".
    return { form: i18n.t('errors.timeout'), fields: {} };
  }
  if (error instanceof NetworkError) {
    return { form: isOnline ? i18n.t('errors.network') : i18n.t('errors.offline'), fields: {} };
  }
  if (error instanceof ApiError) {
    if (kind === 'login' && error.status === 401) {
      return { form: i18n.t('auth.errors.invalidCredentials'), fields: {} };
    }
    if (kind === 'register' && error.status === 409) {
      return { fields: { email: i18n.t('auth.errors.emailTaken') } };
    }
    if (error.status === 400 && error.errors && error.errors.length > 0) {
      const fields: AuthErrorView['fields'] = {};
      const other: string[] = [];
      for (const fieldError of error.errors) {
        if (isFormField(kind, fieldError.field)) {
          fields[fieldError.field] ??= fieldError.message;
        } else {
          other.push(fieldError.message);
        }
      }
      return other.length > 0 ? { form: other.join('\n'), fields } : { fields };
    }
  }
  return { form: i18n.t('errors.unknown'), fields: {} };
}
