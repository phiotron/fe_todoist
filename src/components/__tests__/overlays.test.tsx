import '../../i18n';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import viCommon from '../../i18n/locales/vi/common.json';
import vi from '../../i18n/locales/vi.json';
import { goOffline, goOnline } from '../../test/network';
import { ActionMenu } from '../ActionMenu';
import { BottomSheet } from '../BottomSheet';
import { ConfirmDialog } from '../ConfirmDialog';
import { Menu } from '../Menu';
import { NotFoundView } from '../NotFoundView';
import { SNACKBAR_DURATION_MS, SnackbarProvider, useSnackbar } from '../Snackbar';

function Trigger({ onAction }: { onAction: () => void }) {
  const snackbar = useSnackbar();
  return (
    <Pressable
      testID="trigger"
      onPress={() => snackbar.show({ message: 'Đã hoàn thành 1 công việc', actionLabel: viCommon.common.undo, onAction })}
    >
      <Text>show</Text>
    </Pressable>
  );
}

describe('overlays', () => {
  afterEach(() => {
    goOnline();
    jest.useRealTimers();
  });

  it('BottomSheet shows its title and children and closes from the scrim', async () => {
    const onClose = jest.fn();
    await render(
      <BottomSheet visible title="Chọn dự án" onClose={onClose} testID="sheet">
        <Text>nội dung</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Chọn dự án')).toBeOnTheScreen();
    expect(screen.getByText('nội dung')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sheet-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('BottomSheet wraps its children in a ScrollView by default; scroll={false} leaves them alone (they scroll themselves)', async () => {
    const { rerender } = await render(
      <BottomSheet visible onClose={jest.fn()} testID="sheet">
        <Text>nội dung</Text>
      </BottomSheet>,
    );
    expect(screen.getByTestId('sheet-scroll')).toBeOnTheScreen();

    await rerender(
      <BottomSheet visible onClose={jest.fn()} scroll={false} testID="sheet">
        <Text>nội dung</Text>
      </BottomSheet>,
    );
    expect(screen.queryByTestId('sheet-scroll')).toBeNull();
    expect(screen.getByText('nội dung')).toBeOnTheScreen();
  });

  it('ActionMenu closes itself then runs the chosen item; disabled and offline write items do nothing', async () => {
    const onClose = jest.fn();
    const subtask = jest.fn();
    const remove = jest.fn();
    const { rerender } = await render(
      <ActionMenu
        visible
        onClose={onClose}
        testID="menu"
        items={[
          { key: 'subtask', label: 'Thêm sub-task', icon: 'plus', onPress: subtask },
          { key: 'delete', label: 'Xoá công việc', icon: 'trash-2', onPress: remove, destructive: true, disabled: true },
        ]}
      />,
    );

    await fireEvent.press(screen.getByTestId('menu-subtask'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(subtask).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('menu-delete'));
    expect(remove).not.toHaveBeenCalled();

    goOffline();
    const archive = jest.fn();
    // key: remount so useIsOnline subscribes again (goOffline only affects subscribers made after it).
    await rerender(
      <ActionMenu
        key="offline"
        visible
        onClose={onClose}
        testID="menu"
        items={[{ key: 'archive', label: 'Lưu trữ', icon: 'archive', onPress: archive, requiresOnline: true }]}
      />,
    );
    await fireEvent.press(screen.getByTestId('menu-archive'));
    expect(archive).not.toHaveBeenCalled();
  });

  it('Menu (popover) marks the current item and returns the chosen one', async () => {
    const onSelect = jest.fn();
    await render(
      <Menu
        visible
        onClose={jest.fn()}
        testID="prio"
        items={[
          { key: '1', label: 'Ưu tiên 1', icon: 'flag', iconColor: '#C2362B', selected: true },
          { key: '2', label: 'Ưu tiên 2', icon: 'flag' },
        ]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByTestId('prio-1')).toBeSelected();
    await fireEvent.press(screen.getByTestId('prio-2'));
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('ConfirmDialog: Cancel never confirms; the red button does', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <ConfirmDialog
        visible
        title="Xoá “Nhà”?"
        message="Không hoàn tác được."
        confirmLabel="Xoá"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Không hoàn tác được.')).toBeOnTheScreen();
    expect(screen.getByText(viCommon.common.cancel)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('the toast shows its action for 5 seconds; the action runs once and hides it', async () => {
    jest.useFakeTimers();
    const onAction = jest.fn();
    await render(
      <SnackbarProvider>
        <Trigger onAction={onAction} />
      </SnackbarProvider>,
    );

    await fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.getByTestId('snackbar')).toHaveTextContent(/Đã hoàn thành 1 công việc/);
    await fireEvent.press(screen.getByTestId('snackbar-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('snackbar')).toBeNull();

    await fireEvent.press(screen.getByTestId('trigger'));
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS - 1);
    });
    expect(screen.getByTestId('snackbar')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('snackbar')).toBeNull();
    expect(SNACKBAR_DURATION_MS).toBe(5000);
  });

  it('useSnackbar without a provider is a harmless no-op', async () => {
    await render(<Trigger onAction={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.queryByTestId('snackbar')).toBeNull();
  });

  it('NotFoundView says the item is gone and offers the way back', async () => {
    const onBack = jest.fn();
    await render(<NotFoundView onBack={onBack} testID="gone" />);
    expect(screen.getByText(vi.errors.notFound)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('gone-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
