import fs from 'node:fs';
import path from 'node:path';
import i18n, { enTranslation, viTranslation } from '..';

const SRC_DIR = path.resolve(__dirname, '../..');
const LOCALES_DIR = path.resolve(__dirname, '../locales');
const KEY_PATTERN = /\bt\(\s*['"`]([^'"`]+)['"`]/g;
const VIETNAMESE_CHAR = /[À-ỹ]/;
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const TRANSLATIONS: Record<string, unknown> = { vi: viTranslation, en: enTranslation };

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'test' ? [] : listSourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.gen.ts') ? [full] : [];
  });
}

function valueAt(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) =>
      node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    tree,
  );
}

function hasKey(tree: unknown, key: string): boolean {
  return typeof valueAt(tree, key) === 'string';
}

function leafKeys(tree: unknown, prefix = ''): string[] {
  if (tree === null || typeof tree !== 'object') return [prefix];
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

function placeholders(text: string): string {
  return [...text.matchAll(PLACEHOLDER)]
    .map((match) => match[1])
    .sort()
    .join(',');
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function featureFiles(language: string): string[] {
  return fs
    .readdirSync(path.join(LOCALES_DIR, language))
    .filter((name) => name.endsWith('.json'))
    .sort();
}

const files = listSourceFiles(SRC_DIR);

function usedKeys(): string[] {
  const used = new Set<string>();
  for (const file of files) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(KEY_PATTERN)) {
      if (!match[1].includes('${')) used.add(match[1]);
    }
  }
  return [...used];
}

describe('i18n', () => {
  afterEach(async () => {
    await i18n.changeLanguage('vi');
  });

  it('scans at least one source file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(TRANSLATIONS))('every t() key used in src exists in the %s resources', (_language, tree) => {
    expect(usedKeys().filter((key) => !hasKey(tree, key))).toEqual([]);
  });

  it.each(['vi', 'en'])(
    'each %s feature locale file owns exactly one top-level key, named after the file, used nowhere else',
    (language) => {
      const owners = new Map<string, string>();
      for (const key of Object.keys(readJson(path.join(LOCALES_DIR, `${language}.json`)))) {
        owners.set(key, `${language}.json`);
      }
      const problems: string[] = [];
      for (const file of featureFiles(language)) {
        const keys = Object.keys(readJson(path.join(LOCALES_DIR, language, file)));
        const expected = file.replace(/\.json$/, '');
        if (keys.length !== 1 || keys[0] !== expected) problems.push(`${file} has keys [${keys.join(', ')}]`);
        for (const key of keys) {
          const owner = owners.get(key);
          if (owner) problems.push(`${key} is defined in ${owner} and ${file}`);
          owners.set(key, file);
        }
      }
      expect(problems).toEqual([]);
    },
  );

  it.each(Object.entries(TRANSLATIONS))('every %s feature locale file is wired into the resources', (language, tree) => {
    const names = featureFiles(language).map((name) => name.replace(/\.json$/, ''));
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !(name in (tree as object)))).toEqual([]);
  });

  it('vi and en have the same feature files', () => {
    expect(featureFiles('en')).toEqual(featureFiles('vi'));
  });

  it('vi and en have exactly the same keys', () => {
    expect(leafKeys(enTranslation).sort()).toEqual(leafKeys(viTranslation).sort());
  });

  it('no translation is empty and both languages use the same {{placeholders}}', () => {
    const problems = leafKeys(viTranslation).filter((key) => {
      const viText = valueAt(viTranslation, key);
      const enText = valueAt(enTranslation, key);
      if (typeof viText !== 'string' || typeof enText !== 'string') return true;
      if (!viText.trim() || !enText.trim()) return true;
      return placeholders(viText) !== placeholders(enText);
    });
    expect(problems).toEqual([]);
  });

  it('components contain no hard-coded Vietnamese text', () => {
    const offenders = files
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => VIETNAMESE_CHAR.test(stripComments(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });

  it('translates to Vietnamese with interpolation', () => {
    expect(i18n.language).toBe('vi');
    expect(i18n.t('auth.login.title')).toBe('Đăng nhập');
    expect(i18n.t('settings.timeZone.current', { zone: 'UTC' })).toBe('Múi giờ tài khoản: UTC');
  });

  it('translates to English after switching language', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('auth.login.title')).toBe('Log in');
    expect(i18n.t('settings.title')).toBe('Settings');
    expect(i18n.t('settings.timeZone.current', { zone: 'UTC' })).toBe('Account time zone: UTC');
  });
});

describe('i18n (kept from M1)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('vi');
  });

  it('translates a navigation label to Vietnamese', () => {
    expect(i18n.t('nav.tabs')).toBe('Điều hướng chính');
  });

  it('ships the titles used by the tab bar', () => {
    expect(i18n.t('views.inbox.title')).toBe('Inbox');
    expect(i18n.t('views.today.title')).toBe('Hôm nay');
    expect(i18n.t('views.upcoming.title')).toBe('Sắp tới');
    expect(i18n.t('views.browse.title')).toBe('Duyệt');
  });
});
