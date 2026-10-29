import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { tokenStore } from '../tokenStore';
import { resetAuthImageTokenCache, useAuthImageSource } from '../useAuthImageSource';

function Probe({ id }: { id: number }) {
  const source = useAuthImageSource('/api/v1/users/u-1/avatar');
  return <Text testID={`probe-${id}`}>{source ? (source.headers.Authorization as string) : 'none'}</Text>;
}

describe('useAuthImageSource (PERF4)', () => {
  beforeEach(() => resetAuthImageTokenCache());

  it('200 avatars read the keychain ONCE, and a later avatar has its token in its first render', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-9', refreshToken: 'ref-9' });
    const read = jest.spyOn(tokenStore, 'getAccessToken');
    const view = await render(
      <>
        {Array.from({ length: 200 }, (_, id) => (
          <Probe key={id} id={id} />
        ))}
      </>,
    );
    await act(async () => undefined);
    expect(view.getByTestId('probe-199')).toHaveTextContent('Bearer acc-9');
    expect(read).toHaveBeenCalledTimes(1);

    const later = await render(<Probe id={1000} />);
    expect(later.getByTestId('probe-1000')).toHaveTextContent('Bearer acc-9'); // no "none" frame, no new read
    expect(read).toHaveBeenCalledTimes(1);
    read.mockRestore();
  });

  it('a path of null gives no source', async () => {
    function Empty() {
      return <Text testID="empty">{useAuthImageSource(null) === null ? 'null' : 'x'}</Text>;
    }
    const view = await render(<Empty />);
    expect(view.getByTestId('empty')).toHaveTextContent('null');
  });
});
