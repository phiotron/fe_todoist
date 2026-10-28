import * as Clipboard from 'expo-clipboard';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SnackbarProvider } from '../../../components/Snackbar';
import { renderWithProviders } from '../../../test/render';
import { setTasklyAndroidForTests, type TasklyAndroidModule } from '../../../lib/native/tasklyAndroid';
import { parseQuickAddParams } from '../../quickAdd/quickAddTarget';
import { ShareIntentHandler, openSharedText } from '../../share/ShareIntentHandler';
import { useCopyLink } from '../useCopyLink';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
// quickAddTarget imports the router, which is ESM-only; these tests never navigate.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockedClipboard = jest.mocked(Clipboard);

const TASK_ID = '5b0d6c3e-9a4f-4f6e-8a51-2f2d7e4c1b90';
const SECTION_ID = '0a1b2c3d-1111-4222-8333-444455556666';

function CopyButtons() {
  const copyLink = useCopyLink();
  return (
    <>
      <Pressable testID="copy-task" onPress={() => void copyLink({ kind: 'task', id: TASK_ID })}>
        <Text>task</Text>
      </Pressable>
      <Pressable testID="copy-section" onPress={() => void copyLink({ kind: 'project', id: 'p-1', sectionId: SECTION_ID })}>
        <Text>section</Text>
      </Pressable>
      <Pressable testID="copy-inbox" onPress={() => void copyLink({ kind: 'inbox' })}>
        <Text>inbox</Text>
      </Pressable>
    </>
  );
}

describe('Copy link', () => {
  it('copies the taskly:// link of a task, a section and the Inbox, and says so', async () => {
    await renderWithProviders(
      <SnackbarProvider>
        <CopyButtons />
      </SnackbarProvider>,
    );

    await fireEvent.press(screen.getByTestId('copy-task'));
    await waitFor(() => expect(mockedClipboard.setStringAsync).toHaveBeenLastCalledWith(`taskly://task/${TASK_ID}`));
    await waitFor(() => expect(screen.getByText('Đã chép liên kết')).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('copy-section'));
    await waitFor(() =>
      expect(mockedClipboard.setStringAsync).toHaveBeenLastCalledWith(`taskly://project/p-1?section=${SECTION_ID}`),
    );
    await fireEvent.press(screen.getByTestId('copy-inbox'));
    await waitFor(() => expect(mockedClipboard.setStringAsync).toHaveBeenLastCalledWith('taskly://inbox'));
  });

  it('says it could not copy when the clipboard fails', async () => {
    mockedClipboard.setStringAsync.mockRejectedValueOnce(new Error('denied'));
    await renderWithProviders(
      <SnackbarProvider>
        <CopyButtons />
      </SnackbarProvider>,
    );

    await fireEvent.press(screen.getByTestId('copy-task'));

    await waitFor(() => expect(screen.getByText('Không chép được liên kết')).toBeOnTheScreen());
  });
});

describe('share-to-app', () => {
  afterEach(() => setTasklyAndroidForTests(undefined));

  it('opens Quick Add with the first line as name and the rest as description', () => {
    const open = jest.fn();

    expect(openSharedText('Mua sữa\nhttps://shop.example/p/1', open)).toBe(true);

    expect(open).toHaveBeenCalledWith({ content: 'Mua sữa', description: 'https://shop.example/p/1' });
  });

  it('a one-line share has no description; an empty share opens nothing', () => {
    const open = jest.fn();

    expect(openSharedText('https://example.com', open)).toBe(true);
    expect(open).toHaveBeenCalledWith({ content: 'https://example.com' });
    expect(openSharedText('  \n ', open)).toBe(false);
    expect(openSharedText(null, open)).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('Quick Add reads the shared text from its route params', () => {
    expect(parseQuickAddParams({ content: 'Tên', description: ['Mô tả', 'khác'], projectId: undefined })).toEqual({
      content: 'Tên',
      description: 'Mô tả',
    });
  });

  it('the handler takes the share that started the app and listens for later ones, then unsubscribes', async () => {
    const remove = jest.fn();
    let listener: ((event: { text: string }) => void) | undefined;
    const module = {
      takeSharedText: jest.fn(() => null),
      addListener: jest.fn((_event: string, callback: (event: { text: string }) => void) => {
        listener = callback;
        return { remove };
      }),
    } as unknown as TasklyAndroidModule;

    const view = await renderWithProviders(<ShareIntentHandler module={module} />);

    expect(module.takeSharedText).toHaveBeenCalledTimes(1);
    expect(module.addListener).toHaveBeenCalledWith('onSharedText', expect.any(Function));
    expect(listener).toBeDefined();
    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the native module', async () => {
    await expect(renderWithProviders(<ShareIntentHandler module={null} />)).resolves.toBeDefined();
  });
});
