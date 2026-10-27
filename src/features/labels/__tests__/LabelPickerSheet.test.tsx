import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeLabel } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { LabelPickerSheet, matchLabels, type LabelPickerAction } from '../LabelPickerSheet';

const labels = [makeLabel({ id: 'l-1', name: 'gap', sortOrder: 1 }), makeLabel({ id: 'l-2', name: 'Nhà', sortOrder: 2 })];
const routes: ApiRoutes = { 'GET /api/v1/labels': () => jsonResponse(200, labels) };

function done(onPress: LabelPickerAction['onPress'] = jest.fn()): LabelPickerAction[] {
  return [{ key: 'done', label: 'done', onPress }];
}

async function open(initialIds: string[], actions: LabelPickerAction[], extra: ApiRoutes = {}) {
  const rendered = await renderSignedIn(
    <LabelPickerSheet visible initialIds={initialIds} actions={actions} onClose={jest.fn()} />,
    { ...routes, ...extra },
  );
  await screen.findByTestId('label-picker-item-l-2');
  return rendered;
}

const checked = (id: string) => screen.getByTestId(`label-picker-item-${id}`).props.accessibilityState?.checked;

describe('matchLabels', () => {
  it('keeps label order and ignores case and outer spaces', () => {
    expect(matchLabels(labels, '  NH ').map((l) => l.id)).toEqual(['l-2']);
    expect(matchLabels(labels, '').map((l) => l.id)).toEqual(['l-1', 'l-2']);
  });
});

describe('LabelPickerSheet', () => {
  it('starts from the given labels and hands the new set to the action', async () => {
    const onPress = jest.fn();
    await open(['l-1'], done(onPress));
    expect(checked('l-1')).toBe(true);
    expect(checked('l-2')).toBe(false);

    await fireEvent.press(screen.getByTestId('label-picker-item-l-2'));
    await fireEvent.press(screen.getByTestId('label-picker-item-l-1'));
    await fireEvent.press(screen.getByTestId('label-picker-action-done'));

    expect(onPress).toHaveBeenCalledWith(['l-2']);
  });

  it('filters the list by the search text', async () => {
    await open([], done());
    await fireEvent.changeText(screen.getByTestId('label-picker-search'), 'nh');
    expect(screen.queryByTestId('label-picker-item-l-1')).toBeNull();
    expect(screen.getByTestId('label-picker-item-l-2')).toBeTruthy();
  });

  it('creates a missing label from the search text and ticks it', async () => {
    const onPress = jest.fn();
    const { fetchMock } = await open([], done(onPress), {
      'POST /api/v1/labels': () => jsonResponse(201, makeLabel({ id: 'l-9', name: 'mới' })),
    });

    await fireEvent.changeText(screen.getByTestId('label-picker-search'), ' mới ');
    await fireEvent.press(screen.getByTestId('label-picker-create'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/labels')).toHaveLength(1));
    const request = requestsTo(fetchMock, 'POST', '/api/v1/labels')[0];
    expect(request.body).toEqual({ name: 'mới' });
    expect(request.headers['Idempotency-Key']).toEqual(expect.any(String));

    await waitFor(() => expect(screen.getByTestId('label-picker-search').props.value).toBe(''));
    await fireEvent.press(screen.getByTestId('label-picker-action-done'));
    expect(onPress).toHaveBeenCalledWith(['l-9']);
  });

  it('offers no create row for an invalid name or a name that exists (any case)', async () => {
    await open([], done());
    await fireEvent.changeText(screen.getByTestId('label-picker-search'), 'a b');
    expect(screen.queryByTestId('label-picker-create')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('label-picker-search'), 'GAP');
    expect(screen.queryByTestId('label-picker-create')).toBeNull();
  });

  it('shows the server message when the name was taken meanwhile', async () => {
    await open([], done(), {
      'POST /api/v1/labels': () => problem(409, 'Conflict', { code: 'label-name-taken' }),
    });
    await fireEvent.changeText(screen.getByTestId('label-picker-search'), 'khac');
    await fireEvent.press(screen.getByTestId('label-picker-create'));
    expect(await screen.findByText('Đã có label cùng tên')).toBeTruthy();
  });

  it('blocks a 101st label (spec 2.1: 100 labels per task)', async () => {
    const hundred = Array.from({ length: 100 }, (_, index) => `x-${index}`);
    await open(hundred, done());
    expect(screen.getByTestId('label-picker-item-l-1').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('label-picker-full')).toBeTruthy();
  });

  it('disables an action that needs a selection until a label is ticked', async () => {
    await open([], [{ key: 'add', label: 'add', onPress: jest.fn(), requiresSelection: true }]);
    expect(screen.getByTestId('label-picker-action-add').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('label-picker-item-l-1'));
    expect(screen.getByTestId('label-picker-action-add').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('resets the ticks every time it opens', async () => {
    const { rerender } = await open(['l-1'], done());
    await fireEvent.press(screen.getByTestId('label-picker-item-l-2'));
    await rerender(<LabelPickerSheet visible={false} initialIds={['l-2']} actions={done()} onClose={jest.fn()} />);
    await rerender(<LabelPickerSheet visible initialIds={['l-2']} actions={done()} onClose={jest.fn()} />);
    await screen.findByTestId('label-picker-item-l-1');
    expect(checked('l-1')).toBe(false);
    expect(checked('l-2')).toBe(true);
  });
});
