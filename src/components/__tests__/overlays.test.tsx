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

  it('a newer toast waits for the one on screen (an error never wipes a toast with an action), then shows', async () => {
    jest.useFakeTimers();
    function Two() {
      const snackbar = useSnackbar();
      return (
        <Pressable
          testID="two"
          onPress={() => {
            snackbar.show({ message: 'first', actionLabel: 'Undo', onAction: () => undefined });
            snackbar.show({ message: 'second', tone: 'error' });
          }}
        >
          <Text>go</Text>
        </Pressable>
      );
    }
    await render(
      <SnackbarProvider>
        <Two />
      </SnackbarProvider>,
    );

    await fireEvent.press(screen.getByTestId('two'));
    expect(screen.getByTestId('snackbar')).toHaveTextContent(/first/);
    expect(screen.getByTestId('snackbar-action')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS);
    });
    expect(screen.getByTestId('snackbar')).toHaveTextContent(/second/);
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS);
    });
    expect(screen.queryByTestId('snackbar')).toBeNull();
  });

  it('a newer success toast with an action REPLACES the one on screen: its Undo is the newest action', async () => {
    jest.useFakeTimers();
    const first = jest.fn();
    const second = jest.fn();
    function Seq() {
      const snackbar = useSnackbar();
      return (
        <>
          <Pressable testID="a" onPress={() => snackbar.show({ message: 'one', actionLabel: 'Undo', onAction: first })} />
          <Pressable testID="b" onPress={() => snackbar.show({ message: 'two', actionLabel: 'Undo', onAction: second })} />
        </>
      );
    }
    await render(
      <SnackbarProvider>
        <Seq />
      </SnackbarProvider>,
    );

    await fireEvent.press(screen.getByTestId('a'));
    await fireEvent.press(screen.getByTestId('b'));
    expect(screen.getByTestId('snackbar')).toHaveTextContent(/two/);
    await fireEvent.press(screen.getByTestId('snackbar-action'));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(screen.queryByTestId('snackbar')).toBeNull();
  });

  it('error toasts queue without duplicates and the queue is capped at 3', async () => {
    jest.useFakeTimers();
    function Spam() {
      const snackbar = useSnackbar();
      return (
        <>
          <Pressable
            testID="same"
            onPress={() => {
              snackbar.show({ message: 'Undo toast', actionLabel: 'Undo', onAction: () => undefined });
              for (let i = 0; i < 6; i += 1) snackbar.show({ message: 'boom', tone: 'error' });
            }}
          />
          <Pressable
            testID="many"
            onPress={() => {
              snackbar.show({ message: 'Undo toast', actionLabel: 'Undo', onAction: () => undefined });
              for (let i = 0; i < 6; i += 1) snackbar.show({ message: `e${i}`, tone: 'error' });
            }}
          />
        </>
      );
    }
    await render(
      <SnackbarProvider>
        <Spam />
      </SnackbarProvider>,
    );

    await fireEvent.press(screen.getByTestId('same'));
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS);
    });
    expect(screen.getByTestId('snackbar')).toHaveTextContent(/boom/);
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS);
    });
    expect(screen.queryByTestId('snackbar')).toBeNull();

    await fireEvent.press(screen.getByTestId('many'));
    for (const expected of [/e0/, /e1/, /e2/]) {
      await act(async () => {
        jest.advanceTimersByTime(SNACKBAR_DURATION_MS);
      });
      expect(screen.getByTestId('snackbar')).toHaveTextContent(expected);
    }
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS);
    });
    expect(screen.queryByTestId('snackbar')).toBeNull();
  });

  /** Runs `steps` (show calls) in one press, then lists what each 5 s window shows (null = nothing). */
  async function windows(steps: (show: ReturnType<typeof useSnackbar>['show']) => void, count: number) {
    jest.useFakeTimers();
    function Run() {
      const snackbar = useSnackbar();
      return <Pressable testID="run" onPress={() => steps(snackbar.show)} />;
    }
    await render(
      <SnackbarProvider>
        <Run />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByTestId('run'));
    const seen: Array<string | null> = [];
    for (let i = 0; i < count; i += 1) {
      const toast = screen.queryByTestId('snackbar');
      seen.push(toast ? toast.props.children[1].props.children : null);
      await act(async () => {
        jest.advanceTimersByTime(SNACKBAR_DURATION_MS);
      });
    }
    return { seen, action: screen.queryByTestId('snackbar-action') };
  }
  const undo = { actionLabel: 'Undo', onAction: () => undefined };

  it('a plain toast (no action) does not wipe a toast with an Undo: it waits (duplicate / detail-screen scenario)', async () => {
    const { seen } = await windows((show) => {
      show({ message: 'Đã hoàn thành', ...undo });
      show({ message: 'Đã nhân bản' });
    }, 3);
    expect(seen).toEqual(['Đã hoàn thành', 'Đã nhân bản', null]);
  });

  it('a plain toast replaces a plain toast', async () => {
    const { seen } = await windows((show) => {
      show({ message: 'a' });
      show({ message: 'b' });
    }, 2);
    expect(seen).toEqual(['b', null]);
  });

  it('an error on screen goes back to the front of the line when a toast with an Undo arrives', async () => {
    const { seen } = await windows((show) => {
      show({ message: 'boom', tone: 'error' });
      show({ message: 'Undo toast', ...undo });
    }, 3);
    expect(seen).toEqual(['Undo toast', 'boom', null]);
  });

  it('the re-queued error respects the cap of 3 waiting toasts', async () => {
    const { seen } = await windows((show) => {
      show({ message: 'e0', tone: 'error' });
      for (const m of ['e1', 'e2', 'e3']) show({ message: m, tone: 'error' });
      show({ message: 'Undo toast', ...undo });
    }, 5);
    expect(seen).toEqual(['Undo toast', 'e1', 'e2', 'e3', null]);
  });

  it('a repeated toast is dropped against the whole queue and the tone counts: [A,B] then A is not [A,B,A]', async () => {
    const { seen } = await windows((show) => {
      show({ message: 'Undo toast', ...undo });
      show({ message: 'A', tone: 'error' });
      show({ message: 'B', tone: 'error' });
      show({ message: 'A', tone: 'error' });
      show({ message: 'B' });
    }, 5);
    expect(seen).toEqual(['Undo toast', 'A', 'B', 'B', null]);
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
