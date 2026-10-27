import fs from 'node:fs';
import path from 'node:path';
import '../../../i18n';
import { TAB_DEFS } from '../navTabs';

const TABS_DIR = path.resolve(__dirname, '../../../app/(app)/(tabs)');

describe('tab registry: Search (spec 9.1 / 9.2; navTabs value SEARCH, spec 12.1.1)', () => {
  it('points at the search route file, which is not on the bar by default', () => {
    expect(TAB_DEFS.SEARCH).toMatchObject({ key: 'SEARCH', route: 'search' });
    expect(TAB_DEFS.SEARCH.title()).toBe('Tìm kiếm');
    expect(fs.existsSync(path.join(TABS_DIR, 'search.tsx'))).toBe(true);
  });
});
