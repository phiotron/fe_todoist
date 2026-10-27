import '../../i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ApiError } from '../../api/errors';
import viCommon from '../../i18n/locales/vi/common.json';
import vi from '../../i18n/locales/vi.json';
import { goOffline, goOnline } from '../../test/network';
import { layout, palette, size } from '../../theme';
import { AddRow } from '../AddRow';
import { Fab } from '../Fab';
import { OfflineBanner } from '../OfflineBanner';
import { QueryStateView } from '../QueryStateView';
import { ScreenHeader } from '../ScreenHeader';
import { SectionHeader } from '../SectionHeader';
import { StateView } from '../StateView';
import { SubHeader } from '../SubHeader';

const idleQuery = { isPending: false, isError: false, error: null, fetchStatus: 'idle', refetch: jest.fn() };

describe('layout pieces and states', () => {
  afterEach(() => goOnline());

  it('ScreenHeader shows the 26pt title and the subtitle; SubHeader goes back', async () => {
    const onBack = jest.fn();
    await render(
      <>
        <ScreenHeader title="Hôm nay" subtitle="5 công việc" testID="hdr" />
        <SubHeader title="Đã hoàn thành" onBack={onBack} testID="sub" />
      </>,
    );
    expect(StyleSheet.flatten(screen.getByText('Hôm nay').props.style)).toMatchObject({ fontSize: 26 });
    expect(screen.getByText('5 công việc')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sub-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('SectionHeader: count, danger tone, collapse toggle and a side action', async () => {
    const onToggle = jest.fn();
    const onAction = jest.fn();
    await render(
      <SectionHeader
        title="Quá hạn"
        count={2}
        tone="danger"
        collapsed={false}
        onToggle={onToggle}
        right={<AddRow label="Dời lịch" onPress={onAction} testID="act" />}
        testID="sec"
      />,
    );
    expect(StyleSheet.flatten(screen.getByText('Quá hạn').props.style)).toMatchObject({ color: palette.warn });
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByTestId('sec-toggle')).toHaveProp('accessibilityState', { expanded: true });
    await fireEvent.press(screen.getByTestId('sec-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('act'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('Fab is the 56pt round accent button 20 from the right and 100 from the bottom', async () => {
    const onPress = jest.fn();
    await render(<Fab label="Thêm công việc" onPress={onPress} testID="fab" />);
    expect(StyleSheet.flatten(screen.getByTestId('fab').props.style)).toMatchObject({
      width: size.fab,
      height: size.fab,
      right: layout.fabRight,
      bottom: layout.fabBottom,
      backgroundColor: palette.acc,
    });
    await fireEvent.press(screen.getByTestId('fab'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('OfflineBanner shows only while offline, with the M1 sentence', async () => {
    const { unmount } = await render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    await unmount();

    goOffline();
    await render(<OfflineBanner />);
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(viCommon.common.offlineBanner, { exact: false });
  });

  it('StateView: icon circle, title, message and action', async () => {
    const onAction = jest.fn();
    await render(
      <StateView tone="ok" icon="check-circle" title="Xong hết" message="Nghỉ ngơi" actionLabel="Thêm" onAction={onAction} testID="st" />,
    );
    expect(screen.getByText('Xong hết')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('st-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('QueryStateView: skeleton while loading, offline state without cache, error + retry', async () => {
    const { rerender } = await render(
      <QueryStateView query={{ ...idleQuery, isPending: true, fetchStatus: 'fetching' }} />,
    );
    expect(screen.getByTestId('query-state-loading')).toBeOnTheScreen();

    await rerender(<QueryStateView query={{ ...idleQuery, isPending: true, fetchStatus: 'paused' }} />);
    expect(screen.getByText(vi.errors.offline)).toBeOnTheScreen();

    const refetch = jest.fn();
    await rerender(
      <QueryStateView
        query={{ ...idleQuery, isError: true, error: new ApiError({ status: 404, title: 'x' }), refetch }}
      />,
    );
    expect(screen.getByText(viCommon.common.loadErrorTitle)).toBeOnTheScreen();
    expect(screen.getByText(vi.errors.notFound)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('query-state-action'));
    expect(refetch).toHaveBeenCalledTimes(1);

    await rerender(<QueryStateView query={idleQuery} />);
    expect(screen.queryByTestId('query-state-loading')).toBeNull();
  });
});
