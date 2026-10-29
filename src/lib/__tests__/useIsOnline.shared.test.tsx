import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useIsConnected, useIsOnline } from '../useIsOnline';

/** PERF4: 300 cards each calling useIsOnline used to open 300 NetInfo listeners. One shared listener now. */
function Probe({ id }: { id: number }) {
  return <Text testID={`probe-${id}`}>{useIsOnline() ? 'on' : 'off'}</Text>;
}
function Connected() {
  return <Text testID="connected">{useIsConnected() ? 'on' : 'off'}</Text>;
}

describe('useIsOnline / useIsConnected share ONE NetInfo subscription', () => {
  it('many callers = one listener, all follow it, and it is released when the last one unmounts', async () => {
    let emit: ((state: NetInfoState) => void) | undefined;
    const unsubscribe = jest.fn();
    jest.mocked(NetInfo.addEventListener).mockClear();
    jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
      emit = listener;
      return unsubscribe;
    });

    const view = await render(
      <>
        {Array.from({ length: 50 }, (_, id) => (
          <Probe key={id} id={id} />
        ))}
        <Connected />
      </>,
    );
    expect(jest.mocked(NetInfo.addEventListener)).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('probe-49')).toHaveTextContent('on');

    await act(() => emit?.({ isConnected: false } as NetInfoState));
    expect(view.getByTestId('probe-0')).toHaveTextContent('off');
    expect(view.getByTestId('probe-49')).toHaveTextContent('off');
    expect(view.getByTestId('connected')).toHaveTextContent('off');

    await view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    // a later mount starts online again, as before (state of a released subscription is not kept)
    jest.mocked(NetInfo.addEventListener).mockImplementation(() => jest.fn());
    const again = await render(<Probe id={1} />);
    expect(again.getByTestId('probe-1')).toHaveTextContent('on');
  });
});
