import { enTranslation, viTranslation } from '..';

const KEYS = [
  'google.continue',
  'google.or',
  'google.linkRequired',
  'google.cancelLink',
  'google.linkedTitle',
  'google.linkedMessage',
  'google.linkFailedTitle',
  'google.errors.notConfigured',
  'google.errors.playServices',
  'google.errors.inProgress',
  'google.errors.failed',
  'google.errors.emailNotVerified',
  'google.errors.linkConflict',
  'google.errors.linkRejected',
  'google.settings.title',
  'google.settings.linked',
  'google.settings.notLinked',
  'google.settings.link',
  'google.settings.unlink',
  'google.settings.linkSuccess',
  'google.settings.unlinkSuccess',
  'google.settings.needPassword',
  'google.account.deleteNeedsPassword',
  'google.account.passwordNeedsReset',
] as const;

function lookup(tree: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
      tree,
    );
}

describe('Google sign-in strings', () => {
  it.each(KEYS)('%s is a non-empty string in the vi and en resources', (key) => {
    for (const locale of [viTranslation, enTranslation]) {
      const value = lookup(locale, key);
      expect(typeof value).toBe('string');
      expect((value as string).trim()).not.toBe('');
    }
  });

  it.each([
    'google.linkRequired',
    'google.settings.needPassword',
    'google.account.deleteNeedsPassword',
    'google.account.passwordNeedsReset',
  ])('%s quotes the forgot-password label of the login screen word for word', (key) => {
    for (const locale of [viTranslation, enTranslation]) {
      const label = lookup(locale, 'auth.login.forgotPassword') as string;
      expect(label).toBeTruthy();
      expect(lookup(locale, key) as string).toContain(label);
    }
  });

  it('the Google buttons read exactly as designed', () => {
    expect(lookup(viTranslation, 'google.continue')).toBe('Tiếp tục với Google');
    expect(lookup(enTranslation, 'google.continue')).toBe('Continue with Google');
    expect(lookup(viTranslation, 'google.settings.title')).toBe('Liên kết Google');
  });
});
