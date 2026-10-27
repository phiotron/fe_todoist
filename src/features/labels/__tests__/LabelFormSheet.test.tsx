import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeLabel } from '../../../test/m2Fixtures';
import { goOffline, goOnline } from '../../../test/network';
import { renderSignedIn } from '../../../test/screen';
import type { Label } from '../../../api/labels';
import { LabelFormSheet } from '../LabelFormSheet';

const created = makeLabel({ id: 'l-9', name: 'gấp', color: 'red' });

async function openForm(routes: ApiRoutes, label?: Label) {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const rendered = await renderSignedIn(
    <LabelFormSheet visible label={label} onClose={onClose} onSaved={onSaved} />,
    routes,
  );
  return { onClose, onSaved, ...rendered };
}

describe('LabelFormSheet — create', () => {
  afterEach(() => goOnline());

  it('creates with name, colour and favorite', async () => {
    const { fetchMock, onSaved, onClose } = await openForm({
      'POST /api/v1/labels': () => jsonResponse(201, created),
      'PUT /api/v1/labels/l-9/favorite': () => jsonResponse(200, { ...created, isFavorite: true }),
    });

    await fireEvent.changeText(screen.getByTestId('label-form-name'), ' gấp ');
    await fireEvent.press(screen.getByTestId('label-form-color-red'));
    await fireEvent.press(screen.getByTestId('label-form-favorite'));
    await fireEvent.press(screen.getByTestId('label-form-save'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const post = requestsTo(fetchMock, 'POST', '/api/v1/labels')[0];
    expect(post.body).toEqual({ name: 'gấp', color: 'red' });
    expect(post.headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/labels/l-9/favorite')).toHaveLength(1);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'l-9', isFavorite: true }));
  });

  it.each([
    ['', 'Hãy nhập tên label'],
    ['a b', 'Tên label không được có dấu cách và các ký tự @ % # / , ( ) | & ! \\ *'],
    ['a'.repeat(61), 'Tên label tối đa 60 ký tự'],
  ])('rejects %p before any request', async (name, message) => {
    const { fetchMock } = await openForm({});
    await fireEvent.changeText(screen.getByTestId('label-form-name'), name);
    await fireEvent.press(screen.getByTestId('label-form-save'));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/labels')).toHaveLength(0);
  });

  it('shows a taken name under the name field and keeps the form open', async () => {
    const { onClose } = await openForm({
      'POST /api/v1/labels': () => problem(409, 'Conflict', { code: 'label-name-taken' }),
    });
    await fireEvent.changeText(screen.getByTestId('label-form-name'), 'gap');
    await fireEvent.press(screen.getByTestId('label-form-save'));
    expect(await screen.findByTestId('label-form-name-error')).toBeTruthy();
    expect(screen.getByText('Đã có label cùng tên')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the limit message of a 422', async () => {
    await openForm({
      'POST /api/v1/labels': () => problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'LABELS', max: 500 }),
    });
    await fireEvent.changeText(screen.getByTestId('label-form-name'), 'gap');
    await fireEvent.press(screen.getByTestId('label-form-save'));
    expect(await screen.findByTestId('label-form-error')).toBeTruthy();
  });

  it('retries with the same Idempotency-Key when the favorite step failed', async () => {
    let favoriteCalls = 0;
    const { fetchMock, onClose } = await openForm({
      'POST /api/v1/labels': () => jsonResponse(201, created),
      'PUT /api/v1/labels/l-9/favorite': () => {
        favoriteCalls += 1;
        return favoriteCalls === 1 ? problem(500, 'Server Error') : jsonResponse(200, created);
      },
    });
    await fireEvent.changeText(screen.getByTestId('label-form-name'), 'gấp');
    await fireEvent.press(screen.getByTestId('label-form-favorite'));
    await fireEvent.press(screen.getByTestId('label-form-save'));
    await screen.findByTestId('label-form-error');
    await fireEvent.press(screen.getByTestId('label-form-save'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const keys = requestsTo(fetchMock, 'POST', '/api/v1/labels').map((r) => r.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('cannot save while offline', async () => {
    goOffline();
    await openForm({});
    expect(screen.getByTestId('label-form-save').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('LabelFormSheet — edit', () => {
  const label = makeLabel({ id: 'l-1', name: 'gap', color: 'red', isFavorite: true });

  it('sends only the changed fields and the favorite change', async () => {
    const { fetchMock, onClose } = await openForm(
      {
        'PATCH /api/v1/labels/l-1': () => jsonResponse(200, { ...label, color: 'blue' }),
        'DELETE /api/v1/labels/l-1/favorite': () => jsonResponse(200, { ...label, color: 'blue', isFavorite: false }),
      },
      label,
    );
    expect(screen.getByTestId('label-form-name').props.value).toBe('gap');

    await fireEvent.press(screen.getByTestId('label-form-color-blue'));
    await fireEvent.press(screen.getByTestId('label-form-favorite'));
    await fireEvent.press(screen.getByTestId('label-form-save'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/labels/l-1')[0].body).toEqual({ color: 'blue' });
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/labels/l-1/favorite')).toHaveLength(1);
  });

  it('closes without a request when nothing changed', async () => {
    const { fetchMock, onClose } = await openForm({}, label);
    await fireEvent.press(screen.getByTestId('label-form-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/labels/l-1')).toHaveLength(0);
  });
});
