import { fireEvent, screen } from '@testing-library/react-native';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeLabel } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { LabelChip } from '../LabelChip';
import { TaskLabels } from '../TaskLabels';

const labels = [makeLabel({ id: 'l-1', name: 'gap', sortOrder: 1 }), makeLabel({ id: 'l-2', name: 'nha', sortOrder: 2 })];
const routes = { 'GET /api/v1/labels': () => jsonResponse(200, labels) };

describe('LabelChip', () => {
  it('shows "Nhãn" when empty', async () => {
    await renderSignedIn(<LabelChip labelIds={[]} onChange={jest.fn()} />, routes);
    expect(screen.getByText('Nhãn')).toBeTruthy();
  });

  it('applies the new set when Done is pressed', async () => {
    const onChange = jest.fn();
    await renderSignedIn(<LabelChip labelIds={['l-2', 'l-1']} onChange={onChange} />, routes);
    expect(await screen.findByText('gap, nha')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('label-chip'));
    await fireEvent.press(await screen.findByTestId('label-chip-picker-item-l-2'));
    await fireEvent.press(screen.getByTestId('label-chip-picker-action-done'));

    expect(onChange).toHaveBeenCalledWith(['l-1']);
  });

  it('sends nothing when the set did not change', async () => {
    const onChange = jest.fn();
    await renderSignedIn(<LabelChip labelIds={['l-1']} onChange={onChange} />, routes);
    await fireEvent.press(screen.getByTestId('label-chip'));
    await fireEvent.press(await screen.findByTestId('label-chip-picker-action-done'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('TaskLabels', () => {
  it('shows the label names in label order', async () => {
    await renderSignedIn(<TaskLabels labelIds={['l-2', 'l-1']} testID="row-labels" />, routes);
    expect(await screen.findByText('gap')).toBeTruthy();
    expect(screen.getByText('nha')).toBeTruthy();
  });

  it('renders nothing and requests nothing without labels', async () => {
    const { fetchMock } = await renderSignedIn(<TaskLabels labelIds={[]} testID="row-labels" />, routes);
    expect(screen.queryByTestId('row-labels')).toBeNull();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/labels')).toHaveLength(0);
  });
});
