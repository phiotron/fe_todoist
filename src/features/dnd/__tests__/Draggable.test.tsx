import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Task } from '../../../api/models';
import { autoScrollStep, DragProvider, Draggable, LONG_PRESS_MS } from '../dnd';

const task = { id: 't1', content: 'Việc A' } as Task;

async function setup(enabled = true) {
  const onPress = jest.fn();
  const onLongPress = jest.fn();
  await render(
    <DragProvider>
      <Draggable testID="row" enabled={enabled} payload={() => ({ taskIds: [task.id], task })} onPress={onPress} onLongPress={onLongPress}>
        <Text>Việc A</Text>
      </Draggable>
    </DragProvider>,
  );
  return { onPress, onLongPress, row: screen.getByTestId('row') };
}

const at = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });
const holdLongEnough = () => act(() => new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS + 50)));

describe('Draggable: hold = select, hold and drag = drag (Todoist)', () => {
  it('a short tap opens (onPress)', async () => {
    const { onPress, onLongPress, row } = await setup();
    await fireEvent(row, 'responderGrant', at(10, 10));
    await fireEvent(row, 'responderRelease', at(10, 10));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('holding lifts the task, releasing without moving = long press (selection), no drop', async () => {
    const { onPress, onLongPress, row } = await setup();
    await fireEvent(row, 'responderGrant', at(10, 10));
    expect(await screen.findByTestId('drag-ghost')).toBeTruthy();
    await fireEvent(row, 'responderMove', at(13, 12)); // a tremble inside the slop
    await fireEvent(row, 'responderRelease', at(13, 12));
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('drag-ghost')).toBeNull());
  });

  it('holding then moving = a drag: no long press, no press, the ghost goes away on release', async () => {
    const { onPress, onLongPress, row } = await setup();
    await fireEvent(row, 'responderGrant', at(10, 10));
    expect(await screen.findByTestId('drag-ghost')).toBeTruthy();
    await fireEvent(row, 'responderMove', at(10, 80));
    await fireEvent(row, 'responderRelease', at(10, 80));
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('drag-ghost')).toBeNull());
  });

  it('not draggable: holding is still a long press (released in place after LONG_PRESS_MS)', async () => {
    const { onPress, onLongPress, row } = await setup(false);
    await fireEvent(row, 'responderGrant', at(10, 10));
    await holdLongEnough();
    expect(screen.queryByTestId('drag-ghost')).toBeNull();
    await fireEvent(row, 'responderRelease', at(10, 10));
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('autoScrollStep', () => {
  // list from y=100 to y=700, edge band 64 px
  it('scrolls up near the top, down near the bottom, faster closer to the edge', () => {
    expect(autoScrollStep(400, 100, 700)).toBe(0);
    expect(autoScrollStep(130, 100, 700)).toBeLessThan(0);
    expect(autoScrollStep(670, 100, 700)).toBeGreaterThan(0);
    expect(autoScrollStep(690, 100, 700)).toBeGreaterThan(autoScrollStep(670, 100, 700));
    expect(autoScrollStep(2000, 100, 700)).toBe(autoScrollStep(700, 100, 700)); // capped
  });
});
