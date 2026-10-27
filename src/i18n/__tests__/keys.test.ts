import fs from 'node:fs';
import path from 'node:path';
import i18n, { viTranslation } from '..';

const SRC_DIR = path.resolve(__dirname, '../..');
const LOCALE_DIR = path.resolve(__dirname, '../locales/vi');
const KEY_PATTERN = /\bt\(\s*['"`]([^'"`]+)['"`]/g;
const VIETNAMESE_CHAR = /[À-ỹ]/;

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'test' ? [] : listSourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.gen.ts') ? [full] : [];
  });
}

function hasKey(tree: unknown, key: string): boolean {
  const value = key.split('.').reduce<unknown>(
    (node, part) =>
      node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    tree,
  );
  return typeof value === 'string';
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

const files = listSourceFiles(SRC_DIR);

describe('i18n', () => {
  it('scans at least one source file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('every t() key used in src exists in the Vietnamese resources', () => {
    const used = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(KEY_PATTERN)) {
        if (!match[1].includes('${')) used.add(match[1]);
      }
    }
    const missing = [...used].filter((key) => !hasKey(viTranslation, key));
    expect(missing).toEqual([]);
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
    expect(i18n.t('home.greeting', { name: 'An' })).toBe('Xin chào An');
  });

  it('each feature locale file owns exactly one top-level key, named after the file, used nowhere else', () => {
    const owners = new Map<string, string>();
    const core = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../locales/vi.json'), 'utf8')) as object;
    for (const key of Object.keys(core)) owners.set(key, 'vi.json');
    const problems: string[] = [];
    for (const file of fs.readdirSync(LOCALE_DIR).filter((name) => name.endsWith('.json'))) {
      const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, file), 'utf8')) as object);
      const expected = file.replace(/\.json$/, '');
      if (keys.length !== 1 || keys[0] !== expected) problems.push(`${file} has keys [${keys.join(', ')}]`);
      for (const key of keys) {
        const owner = owners.get(key);
        if (owner) problems.push(`${key} is defined in ${owner} and ${file}`);
        owners.set(key, file);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every feature locale file is wired into the i18n resources', () => {
    const names = fs
      .readdirSync(LOCALE_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''));
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !(name in viTranslation))).toEqual([]);
  });

  it('ships the titles used by the tab bar', () => {
    expect(i18n.t('views.inbox.title')).toBe('Inbox');
    expect(i18n.t('views.today.title')).toBe('Hôm nay');
    expect(i18n.t('views.upcoming.title')).toBe('Sắp tới');
    expect(i18n.t('views.browse.title')).toBe('Duyệt');
  });
});
