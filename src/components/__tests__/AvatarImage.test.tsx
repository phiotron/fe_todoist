import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { API_URL } from '../../lib/config';
import { tokenStore } from '../../lib/tokenStore';
import { Avatar } from '../Avatar';

describe('Avatar with a profile picture (M8b)', () => {
  beforeEach(async () => {
    await tokenStore.clear();
  });

  it('shows only the initials when there is no picture', async () => {
    await render(<Avatar name="Nguyễn An" seed="u1" testID="av" />);

    expect(screen.getByText('NA')).toBeOnTheScreen();
    expect(screen.queryByTestId('av-image')).toBeNull();
  });

  it('draws the picture with the Bearer token over the initials', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-9', refreshToken: 'ref-9' });
    await render(<Avatar name="An" seed="u1" testID="av" uri="/api/v1/users/u1/avatar?v=5" />);

    const image = await screen.findByTestId('av-image');
    expect(image.props.source).toEqual({
      uri: `${API_URL}/api/v1/users/u1/avatar?v=5`,
      headers: { Authorization: 'Bearer acc-9' },
    });
    expect(screen.getByText('A')).toBeOnTheScreen();
  });

  it('falls back to the initials when the picture fails to load', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-9', refreshToken: 'ref-9' });
    await render(<Avatar name="An" seed="u1" testID="av" uri="/api/v1/users/u1/avatar?v=5" />);
    const image = await screen.findByTestId('av-image');

    await act(async () => {
      await fireEvent(image, 'error');
    });

    await waitFor(() => expect(screen.queryByTestId('av-image')).toBeNull());
    expect(screen.getByText('A')).toBeOnTheScreen();
  });

  it('draws no picture while signed out (no token)', async () => {
    await render(<Avatar name="An" seed="u1" testID="av" uri="/api/v1/users/u1/avatar?v=5" />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('av-image')).toBeNull();
  });
});
