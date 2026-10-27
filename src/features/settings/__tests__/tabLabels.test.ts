import { viTranslation as vi } from '../../../i18n';
import { tabLabel } from '../tabLabels';

const P1 = '11111111-1111-4111-8111-111111111111';

describe('tabLabel', () => {
  const translate = (key: string) => key;

  it('fixed tabs use the settings.targets labels', () => {
    expect(tabLabel('TODAY', () => null, translate)).toBe('settings.targets.TODAY');
    expect(tabLabel('FILTERS_LABELS', () => null, translate)).toBe('settings.targets.FILTERS_LABELS');
    expect(tabLabel('TEAM', () => null, translate)).toBe('settings.targets.TEAM');
    expect(vi.settings.targets.BROWSE).toBeTruthy();
  });

  it('a pinned target shows its name, or "no longer exists" when unknown', () => {
    expect(tabLabel(`project:${P1}`, () => 'Marketing', translate)).toBe('Marketing');
    expect(tabLabel(`project:${P1}`, () => null, translate)).toBe('settings.startPage.unknown');
  });
});
