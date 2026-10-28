import calendarEn from '../locales/en/calendar.json';
import calendarVi from '../locales/vi/calendar.json';
import socialEn from '../locales/en/social.json';
import socialVi from '../locales/vi/social.json';
import { enTranslation, viTranslation } from '..';

function leafKeys(tree: unknown, prefix = ''): string[] {
  if (tree === null || typeof tree !== 'object') return [prefix];
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

function lookup(tree: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
      tree,
    );
}

describe.each([
  ['social', socialVi, socialEn],
  ['calendar', calendarVi, calendarEn],
])('%s strings', (name, vi, en) => {
  it('has the same keys in vi and en', () => {
    expect(leafKeys(vi).sort()).toEqual(leafKeys(en).sort());
  });

  it('has a real (non-empty, not TODO) text for every key in both languages', () => {
    for (const [locale, tree] of [['vi', viTranslation], ['en', enTranslation]] as const) {
      for (const key of leafKeys(name === 'social' ? socialVi : calendarVi)) {
        const value = lookup(tree, key);
        expect(typeof value).toBe('string');
        expect((value as string).trim()).not.toBe('');
        expect(value as string).not.toMatch(/TODO/i);
        expect(`${locale}:${key}`).toBeTruthy();
      }
    }
  });
});

describe('social strings quote the forgot-password label of the login screen word for word', () => {
  it.each(['social.linkRequired', 'social.settings.needPassword'])('%s', (key) => {
    for (const locale of [viTranslation, enTranslation]) {
      const label = lookup(locale, 'auth.login.forgotPassword') as string;
      expect(lookup(locale, key) as string).toContain(label);
    }
  });

  it('the buttons read exactly as designed', () => {
    expect(lookup(viTranslation, 'social.continueApple')).toBe('Tiếp tục với Apple');
    expect(lookup(enTranslation, 'social.continueFacebook')).toBe('Continue with Facebook');
  });
});
