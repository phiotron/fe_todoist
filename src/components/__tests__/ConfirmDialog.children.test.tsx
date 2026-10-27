import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog children (password / code fields, M3)', () => {
  it('shows the children between the message and the buttons', async () => {
    const onConfirm = jest.fn();
    await render(
      <ConfirmDialog
        visible
        title="Delete account?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
        testID="dlg"
      >
        <TextInput testID="dlg-password" />
      </ConfirmDialog>,
    );

    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    expect(screen.getByTestId('dlg-password')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('dlg-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
