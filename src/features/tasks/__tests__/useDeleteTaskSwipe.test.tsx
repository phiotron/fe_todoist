import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { mockFetch } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { useDeleteTaskSwipe } from '../useDeleteTaskSwipe';

function Harness() {
  const { requestDelete, dialog } = useDeleteTaskSwipe();
  return (
    <>
      <Text testID="swipe" onPress={() => requestDelete({ id: 't1', content: 'Pay rent', subtaskCount: 0 })}>
        swipe
      </Text>
      {dialog}
    </>
  );
}

describe('useDeleteTaskSwipe', () => {
  it('requestDelete opens the confirmation for that task; Cancel closes it', async () => {
    mockFetch();
    await renderWithProviders(<Harness />);
    expect(screen.queryByText(vi.settings.swipeDelete.title)).toBeNull();

    await fireEvent.press(screen.getByTestId('swipe'));
    expect(screen.getByText(vi.settings.swipeDelete.title)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('swipe-delete-dialog-cancel'));
    expect(screen.queryByText(vi.settings.swipeDelete.title)).toBeNull();
  });
});
