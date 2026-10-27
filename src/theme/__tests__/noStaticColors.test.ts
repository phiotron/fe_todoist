import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(__dirname, '../..');
/** Colour literals are allowed only here: the design palettes, the themes, the shadow, the project colours users pick. */
const COLOUR_FILES = ['theme/palette.ts', 'theme/themes.ts', 'theme/metrics.ts', 'features/projects/appearance.ts'].map((file) =>
  path.join(SRC_DIR, file),
);
const COLOUR_LITERAL = /['"`](#[0-9a-fA-F]{3,8}|rgba?\()/;
/** `palette` (the static TASKLY-light object) imported from the theme barrel, or the M0 `colors` from lib/theme. */
const STATIC_PALETTE_IMPORT = /import\s*\{[^}]*\bpalette\b[^}]*\}\s*from\s*'[^']*\/theme'|lib\/theme'/;

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'test' ? [] : listSourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.gen.ts') ? [full] : [];
  });
}

const files = listSourceFiles(SRC_DIR);

describe('colours come from the theme', () => {
  it('scans the source tree', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no module imports the static palette or the M0 colours', () => {
    const offenders = files
      .filter((file) => STATIC_PALETTE_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });

  it('colour literals live only in the palette, theme, shadow and project colour files', () => {
    const offenders = files
      .filter((file) => !COLOUR_FILES.includes(file))
      .filter((file) => COLOUR_LITERAL.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });
});
