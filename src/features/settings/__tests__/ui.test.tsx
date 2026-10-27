import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ThemeProvider } from '../../../theme';
import { darkPalette, lightPalette } from '../../../theme/palette';
import { ChoiceList, PickerRow, SettingsSection, SuccessText, SwitchRow } from '../ui';

describe('settings UI kit', () => {
  it('ChoiceList marks the selected choice as a checked radio and reports presses', async () => {
    const onSelect = jest.fn();
    await render(
      <ChoiceList
        testIDPrefix="day"
        selected="7"
        onSelect={onSelect}
        choices={[
          { value: '1', label: 'Monday' },
          { value: '7', label: 'Sunday' },
        ]}
      />,
    );

    expect(screen.getByTestId('day-7').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('day-1').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('day-1').props.accessibilityRole).toBe('radio');

    await fireEvent.press(screen.getByTestId('day-1'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });

  it('ChoiceList can mark nothing as selected and show an accessory before the label', async () => {
    await render(
      <ChoiceList
        testIDPrefix="x"
        selected={null}
        onSelect={jest.fn()}
        choices={[{ value: 'a', label: 'A', accessory: <Text testID="swatch">•</Text> }]}
      />,
    );
    expect(screen.getByTestId('x-a').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('swatch')).toBeTruthy();
  });

  it('SwitchRow is a switch with its label, a hint, and reports the new value', async () => {
    const onChange = jest.fn();
    await render(<SwitchRow testID="sync" label="Sync theme" hint="Same theme everywhere" value onChange={onChange} />);

    const toggle = screen.getByTestId('sync');
    expect(toggle.props.accessibilityRole).toBe('switch');
    expect(toggle.props.accessibilityLabel).toBe('Sync theme');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('Same theme everywhere')).toBeTruthy();
    await fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('PickerRow shows the current value, opens the options in a sheet and closes after choosing', async () => {
    const onSelect = jest.fn();
    await render(
      <PickerRow
        testID="start-day"
        label="Start of the week"
        valueLabel="Monday"
        title="Start of the week"
        selected="1"
        onSelect={onSelect}
        options={[
          { value: '1', label: 'Monday' },
          { value: '7', label: 'Sunday' },
        ]}
      />,
    );

    expect(screen.getByText('Monday')).toBeTruthy();
    expect(screen.queryByTestId('start-day-option-7')).toBeNull();

    await fireEvent.press(screen.getByTestId('start-day'));
    expect(screen.getByTestId('start-day-option-1').props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByTestId('start-day-option-7'));

    expect(onSelect).toHaveBeenCalledWith('7');
    expect(screen.queryByTestId('start-day-option-7')).toBeNull();
  });

  it('SuccessText renders nothing without text and a polite live region otherwise', async () => {
    await render(
      <>
        <SuccessText testID="none" />
        <SuccessText testID="ok" text="Saved" />
      </>,
    );

    expect(screen.queryByTestId('none')).toBeNull();
    expect(screen.getByTestId('ok').props.accessibilityLiveRegion).toBe('polite');
    expect(StyleSheet.flatten(screen.getByTestId('ok').props.style).color).toBe(lightPalette.ok);
  });

  it('SettingsSection shows its title (.sec) and follows the dark palette', async () => {
    await render(
      <ThemeProvider theme="TASKLY" appearance="DARK">
        <SettingsSection testID="settings-section-demo" title="Demo">
          <Text>child</Text>
        </SettingsSection>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('settings-section-demo')).toBeTruthy();
    expect(screen.getByText('child')).toBeTruthy();
    expect(screen.getByText('Demo').props.accessibilityRole).toBe('header');
    expect(StyleSheet.flatten(screen.getByText('Demo').props.style).color).toBe(darkPalette.ink);
  });
});
