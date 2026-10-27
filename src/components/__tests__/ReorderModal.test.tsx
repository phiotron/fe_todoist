import '../../i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { goOffline, goOnline } from '../../test/network';
import { ReorderModal, type ReorderItem } from '../ReorderModal';

const items: ReorderItem[] = [
  { id: 'a', label: 'Việc A' },
  { id: 'b', label: 'Việc B' },
  { id: 'c', label: 'Việc C' },
];

async function renderModal(onMove = jest.fn()) {
  await render(<ReorderModal visible title="Sắp xếp" items={items} onMove={onMove} onClose={jest.fn()} />);
  return onMove;
}

describe('ReorderModal', () => {
  afterEach(() => goOnline());

  it('moving down sends the item and the id now before it', async () => {
    const onMove = await renderModal();

    await fireEvent.press(screen.getByTestId('reorder-down-a'));

    expect(onMove).toHaveBeenCalledWith('a', 'b');
  });

  it('moving to the top sends afterId = null, and the local order follows the moves', async () => {
    const onMove = await renderModal();

    await fireEvent.press(screen.getByTestId('reorder-up-b'));
    expect(onMove).toHaveBeenLastCalledWith('b', null);

    // Order is now b, a, c: moving c up puts it right after b.
    await fireEvent.press(screen.getByTestId('reorder-up-c'));
    expect(onMove).toHaveBeenLastCalledWith('c', 'b');
  });

  it('a drag that ends at a new index sends the same afterId rule', async () => {
    const onMove = await renderModal();

    await fireEvent(screen.getByTestId('reorder-list'), 'dragEnd', { data: items, from: 2, to: 0 });

    expect(onMove).toHaveBeenCalledWith('c', null);
  });

  it('disables the first "up" and the last "down"', async () => {
    await renderModal();
    expect(screen.getByTestId('reorder-up-a')).toBeDisabled();
    expect(screen.getByTestId('reorder-down-c')).toBeDisabled();
  });

  it('does nothing offline', async () => {
    goOffline();
    const onMove = await renderModal();
    await fireEvent.press(screen.getByTestId('reorder-down-a'));
    await fireEvent(screen.getByTestId('reorder-list'), 'dragEnd', { data: items, from: 0, to: 2 });
    expect(onMove).not.toHaveBeenCalled();
  });
});
