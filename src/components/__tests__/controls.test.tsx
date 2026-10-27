import '../../i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { lightPalette as palette, size } from '../../theme';
import { goOffline, goOnline } from '../../test/network';
import { AppButton } from '../AppButton';
import { Avatar, initialsOf } from '../Avatar';
import { Chip } from '../Chip';
import { ErrorText } from '../ErrorText';
import { ListRow } from '../ListRow';
import { RadioRow } from '../RadioRow';
import { Segmented } from '../Segmented';
import { TextField } from '../TextField';
import { Toggle } from '../Toggle';

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('controls', () => {
  afterEach(() => goOnline());

  it('AppButton with requiresOnline is disabled offline and does not fire', async () => {
    goOffline();
    const onPress = jest.fn();
    await render(<AppButton label="Lưu" onPress={onPress} requiresOnline testID="btn" />);

    expect(screen.getByTestId('btn')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('AppButton: primary is filled with the accent, danger with warn, busy hides the label', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<AppButton label="Lưu" onPress={onPress} requiresOnline testID="btn" />);
    expect(flat('btn')).toMatchObject({ backgroundColor: palette.acc, height: 44, borderRadius: 10 });
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<AppButton label="Xoá" variant="danger" size="sm" onPress={onPress} testID="btn" />);
    expect(flat('btn')).toMatchObject({ backgroundColor: palette.warn, height: 32, borderRadius: 8 });

    await rerender(<AppButton label="Lưu" onPress={onPress} busy testID="btn" />);
    expect(screen.queryByText('Lưu')).toBeNull();
    expect(screen.getByTestId('btn')).toBeDisabled();
  });

  it('AppButton has the four variants M2–M5 rely on (primary / danger / outline / ghost), sm size and full width', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<AppButton label="Google" variant="outline" full onPress={onPress} testID="btn" />);
    expect(flat('btn')).toMatchObject({ backgroundColor: palette.bg, borderColor: palette.line2, height: 44, alignSelf: 'stretch' });

    await rerender(<AppButton label="Bỏ liên kết" variant="outline" size="sm" onPress={onPress} testID="btn" />);
    expect(flat('btn')).toMatchObject({ height: 32, borderRadius: 8 });

    await rerender(<AppButton label="Để sau" variant="ghost" onPress={onPress} testID="btn" />);
    expect(flat('btn')).toMatchObject({ backgroundColor: 'transparent', borderColor: 'transparent' });
  });

  it('TextField shows its label, the character counter and the error', async () => {
    await render(<TextField testID="name" label="Tên" value="Nhập hàng" maxCount={120} error="Sai" onChangeText={jest.fn()} />);
    expect(screen.getByText('Tên')).toBeOnTheScreen();
    expect(screen.getByTestId('name-counter')).toHaveTextContent('9/120');
    expect(screen.getByTestId('name-error')).toHaveTextContent('Sai');
    expect(StyleSheet.flatten(screen.getByTestId('name').props.style)).toMatchObject({ borderColor: palette.warn });
  });

  it('Chip: tone colours text and border, selected uses the soft accent', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Chip label="P1" icon="flag" color={palette.p1} onPress={onPress} testID="chip" />);
    expect(flat('chip')).toMatchObject({ borderColor: palette.p1 });
    await fireEvent.press(screen.getByTestId('chip'));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<Chip label="Hôm nay" selected testID="chip" />);
    expect(flat('chip')).toMatchObject({ backgroundColor: palette.soft, borderColor: palette.acc });
  });

  it('Chip: large is 36 high (sheets, task detail), the default 32', async () => {
    const { rerender } = await render(<Chip label="Nhắc" icon="bell" onPress={jest.fn()} testID="chip" />);
    expect(flat('chip')).toMatchObject({ height: size.chip });
    await rerender(<Chip label="Nhắc" icon="bell" large onPress={jest.fn()} testID="chip" />);
    expect(flat('chip')).toMatchObject({ height: size.chipLarge });
    expect(size.chipLarge).toBe(36);
  });

  it('Toggle is a switch that reports and flips its state', async () => {
    const onChange = jest.fn();
    await render(<Toggle value={false} onChange={onChange} label="Completed tasks" testID="tog" />);
    expect(screen.getByRole('switch', { name: 'Completed tasks' })).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('tog'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Segmented selects one option', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        options={[
          { key: 'list', label: 'List' },
          { key: 'board', label: 'Board' },
        ]}
        value="list"
        onChange={onChange}
        testID="seg"
      />,
    );
    expect(screen.getByTestId('seg-list')).toBeSelected();
    await fireEvent.press(screen.getByTestId('seg-board'));
    expect(onChange).toHaveBeenCalledWith('board');
  });

  it('RadioRow is a radio: checked state, a check mark when chosen, one press to choose', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(
      <RadioRow title="30 phút trước" subtitle="Mặc định" selected={false} onPress={onPress} testID="radio" />,
    );
    expect(screen.getByRole('radio', { name: '30 phút trước' })).not.toBeChecked();
    expect(screen.queryByTestId('radio-check')).toBeNull();
    await fireEvent.press(screen.getByTestId('radio'));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<RadioRow title="30 phút trước" selected onPress={onPress} testID="radio" />);
    expect(screen.getByRole('radio', { name: '30 phút trước' })).toBeChecked();
    expect(screen.getByTestId('radio-check')).toBeOnTheScreen();
  });

  it('ListRow and Avatar', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <ListRow title="Inbox" icon="inbox" iconBox right="3" chevron onPress={onPress} testID="row" />
        <Avatar name="Linh Nguyễn" seed="u1" size="l" testID="av" />
      </>,
    );
    expect(screen.getByText('Inbox')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('av')).toHaveTextContent('LN');
    expect(initialsOf('an')).toBe('A');
    expect(initialsOf('  ')).toBe('?');
  });

  it('ErrorText renders nothing without a message and an alert with one', async () => {
    const { rerender } = await render(<ErrorText message={undefined} testID="err" />);
    expect(screen.queryByTestId('err')).toBeNull();
    await rerender(<ErrorText message="Có lỗi" testID="err" />);
    expect(screen.getByTestId('err')).toHaveTextContent('Có lỗi');
  });
});
