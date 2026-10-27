import fs from 'node:fs';
import path from 'node:path';
import '../../../i18n';
import { DEFAULT_NAV_TABS, TAB_DEFS, tabKeyForRoute } from '../navTabs';

const APP_DIR = path.resolve(__dirname, '../../../app/(app)');

describe('tab registry', () => {
  it('M1 shows Inbox, Today, Upcoming, Browse in that order, Browse last (spec 9.2)', () => {
    expect(DEFAULT_NAV_TABS).toEqual(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE']);
    expect(DEFAULT_NAV_TABS[DEFAULT_NAV_TABS.length - 1]).toBe('BROWSE');
  });

  it('every tab has a route file under (tabs), a title and an icon', () => {
    for (const key of DEFAULT_NAV_TABS) {
      const def = TAB_DEFS[key];
      expect(fs.existsSync(path.join(APP_DIR, '(tabs)', `${def.route}.tsx`))).toBe(true);
      expect(def.title()).not.toMatch(/^views\./);
      expect(def.icon).toBeTruthy();
    }
    expect(TAB_DEFS.TODAY.title()).toBe('Hôm nay');
  });

  it('maps a route name back to its tab key', () => {
    expect(tabKeyForRoute('upcoming')).toBe('UPCOMING');
    expect(tabKeyForRoute('not-a-tab')).toBeUndefined();
  });

  it('the pushed screens, the sheets and the root redirect exist; the old M0 home route is gone', () => {
    for (const file of ['project/[id].tsx', 'projects/archived.tsx', 'completed.tsx', 'task/[id].tsx', 'quick-add.tsx', 'project-form.tsx']) {
      expect(fs.existsSync(path.join(APP_DIR, file))).toBe(true);
    }
    expect(fs.existsSync(path.resolve(__dirname, '../../../app/index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(APP_DIR, 'index.tsx'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../../home'))).toBe(false);
  });
});
