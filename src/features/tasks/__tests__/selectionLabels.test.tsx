import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeLabel } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { SelectionBar } from '../SelectionBar';
import { SelectionLabelsAction } from '../SelectionLabelsAction';
import { TaskSelectionProvider, useTaskSelection } from '../selection';

const routes = {
  'GET /api/v1/labels': () => jsonResponse(200, [makeLabel({ id: 'l-1', name: 'gap' })]),
  'POST /api/v1/tasks/batch': () => jsonResponse(200, { affectedTaskIds: ['t-1', 't-2'] }),
};

async function pickLabelAnd(action: 'add' | 'remove') {
  await fireEvent.press(screen.getByTestId('selection-labels'));
  await fireEvent.press(await screen.findByTestId('selection-label-picker-item-l-1'));
  await fireEvent.press(screen.getByTestId(`selection-label-picker-action-${action}`));
}

describe('multi-select → Label (spec 12.5)', () => {
  it('adds the labels to every selected task in one request (with an Idempotency-Key) and leaves selection mode', async () => {
    const onDone = jest.fn();
    const { fetchMock } = await renderSignedIn(<SelectionLabelsAction taskIds={['t-1', 't-2']} onDone={onDone} />, routes);
    await pickLabelAnd('add');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const request = requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0];
    expect(request.body).toEqual({ action: 'ADD_LABELS', taskIds: ['t-1', 't-2'], labelIds: ['l-1'] });
    expect(request.headers['Idempotency-Key']).toEqual(expect.any(String));
  });

  it('removes the labels', async () => {
    const { fetchMock } = await renderSignedIn(<SelectionLabelsAction taskIds={['t-1']} onDone={jest.fn()} />, routes);
    await pickLabelAnd('remove');
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0].body).toMatchObject({ action: 'REMOVE_LABELS' });
  });

  it('keeps the sheet open with the error when the batch fails (e.g. more than 100 labels)', async () => {
    const onDone = jest.fn();
    await renderSignedIn(<SelectionLabelsAction taskIds={['t-1']} onDone={onDone} />, {
      ...routes,
      'POST /api/v1/tasks/batch': () => problem(400, 'Bad Request', { detail: 'Quá 100 label' }),
    });
    await pickLabelAnd('add');
    expect(await screen.findByTestId('selection-label-picker-error')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('is part of the multi-select bar of M1 and ends the selection mode after the batch', async () => {
    function StartSelecting() {
      const selection = useTaskSelection();
      useEffect(() => {
        selection?.start('t-1');
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return null;
    }
    const { fetchMock } = await renderSignedIn(
      <TaskSelectionProvider>
        <StartSelecting />
        <SelectionBar />
      </TaskSelectionProvider>,
      routes,
    );
    expect(await screen.findByTestId('selection-count')).toBeTruthy();

    await pickLabelAnd('add');

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0].body).toEqual({
      action: 'ADD_LABELS',
      taskIds: ['t-1'],
      labelIds: ['l-1'],
    });
    await waitFor(() => expect(screen.queryByTestId('selection-count')).toBeNull());
  });
});
