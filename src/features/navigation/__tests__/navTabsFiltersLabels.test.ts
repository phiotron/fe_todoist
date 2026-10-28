import fs from 'node:fs';
import path from 'node:path';
import '../../../i18n';
import { TAB_DEFS } from '../navTabs';

const TABS_DIR = path.resolve(__dirname, '../../../app/(app)/(tabs)');

describe('tab registry: Filters & Labels (spec 9.1 / 9.2; navTabs value FILTERS_LABELS, spec 12.1.1)', () => {
  it('points at the filters-labels route file, which is not on the bar by default', () => {
    expect(TAB_DEFS.FILTERS_LABELS).toMatchObject({ key: 'FILTERS_LABELS', route: 'filters-labels' });
    expect(TAB_DEFS.FILTERS_LABELS.title()).toBe('Bộ lọc & Nhãn');
    expect(fs.existsSync(path.join(TABS_DIR, 'filters-labels.tsx'))).toBe(true);
  });
});
