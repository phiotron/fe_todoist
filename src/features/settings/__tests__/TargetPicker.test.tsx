import { fireEvent, screen } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { routeFetch } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { TargetPicker } from '../TargetPicker';

const P1 = '11111111-1111-4111-8111-111111111111';
const L1 = '33333333-3333-4333-8333-333333333333';

function serveTargets(projects: unknown[] = [{ id: P1, name: 'Marketing', isInbox: false, archivedAt: null }]) {
  routeFetch(mockFetch(), {
    'GET /api/v1/projects': () => jsonResponse(200, projects),
    'GET /api/v1/labels': () => jsonResponse(200, [{ id: L1, name: 'urgent' }]),
    'GET /api/v1/filters': () => jsonResponse(200, []),
  });
}

describe('TargetPicker', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('lists projects, labels and filters and reports the chosen target', async () => {
    serveTargets();
    const onSelect = jest.fn();
    await renderWithProviders(<TargetPicker visible onClose={jest.fn()} onSelect={onSelect} />);

    expect(await screen.findByText('Marketing')).toBeTruthy();
    expect(screen.getByText('urgent')).toBeTruthy();
    expect(screen.getByText(vi.settings.picker.projects)).toBeTruthy();
    expect(screen.getByText(vi.settings.picker.labels)).toBeTruthy();
    expect(screen.queryByText(vi.settings.picker.filters)).toBeNull();

    await fireEvent.press(screen.getByTestId(`target-picker-label-${L1}`));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'label', id: L1 });
  });

  it('can be limited to some kinds and marks the current target', async () => {
    serveTargets();
    await renderWithProviders(
      <TargetPicker visible kinds={['project']} selected={{ kind: 'project', id: P1 }} onClose={jest.fn()} onSelect={jest.fn()} />,
    );

    expect(await screen.findByTestId(`target-picker-project-${P1}`)).toBeTruthy();
    expect(screen.getByTestId(`target-picker-project-${P1}`).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByText('urgent')).toBeNull();
  });

  it('says so when there is nothing to pick', async () => {
    routeFetch(mockFetch(), {
      'GET /api/v1/projects': () => jsonResponse(200, []),
      'GET /api/v1/labels': () => jsonResponse(200, []),
      'GET /api/v1/filters': () => jsonResponse(200, []),
    });
    await renderWithProviders(<TargetPicker visible onClose={jest.fn()} onSelect={jest.fn()} />);

    expect(await screen.findByText(vi.settings.picker.empty)).toBeTruthy();
  });
});
