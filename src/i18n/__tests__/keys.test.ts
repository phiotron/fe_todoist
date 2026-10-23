import fs from 'node:fs';
import path from 'node:path';
import i18n from '..';
import vi from '../locales/vi.json';

const SRC_DIR = path.resolve(__dirname, '../..');
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

  it('every t() key used in src exists in vi.json', () => {
    const used = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(KEY_PATTERN)) {
        if (!match[1].includes('${')) used.add(match[1]);
      }
    }
    const missing = [...used].filter((key) => !hasKey(vi, key));
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
});
