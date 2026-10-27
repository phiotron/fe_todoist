import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../../theme';
import { darkPalette, lightPalette } from '../../theme/palette';
import { PALETTES } from '../../theme/themes';
import { AppButton } from '../AppButton';
import { ErrorText } from '../ErrorText';
import { Toggle } from '../Toggle';
import { TextField } from '../TextField';

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

describe('shared components follow the theme', () => {
  it('use TASKLY light without a provider', async () => {
    await render(<AppButton testID="btn" label="Save" onPress={jest.fn()} />);
    expect(styleOf('btn').backgroundColor).toBe(lightPalette.acc);
  });

  it('use the dark palette inside a dark theme', async () => {
    await render(
      <ThemeProvider theme="TASKLY" appearance="DARK">
        <AppButton testID="btn" label="Save" onPress={jest.fn()} />
        <AppButton testID="danger" variant="danger" label="Delete" onPress={jest.fn()} />
        <TextField testID="field" label="Name" value="" onChangeText={jest.fn()} error="Required" />
        <ErrorText testID="err" message="Broken" />
        <Toggle testID="tog" label="On" value onChange={jest.fn()} />
      </ThemeProvider>,
    );

    expect(styleOf('btn').backgroundColor).toBe(darkPalette.acc);
    expect(styleOf('danger').backgroundColor).toBe(darkPalette.warn);
    expect(styleOf('field').color).toBe(darkPalette.ink);
    expect(styleOf('field').borderColor).toBe(darkPalette.warn);
    expect(screen.getByTestId('field').props.placeholderTextColor).toBe(darkPalette.mute);
    expect(styleOf('err').color).toBe(darkPalette.warn);
    expect(styleOf('tog').backgroundColor).toBe(darkPalette.acc);
  });

  it('use the accent of the chosen theme', async () => {
    await render(
      <ThemeProvider theme="RASPBERRY" appearance="LIGHT">
        <AppButton testID="btn" label="Save" onPress={jest.fn()} />
      </ThemeProvider>,
    );
    expect(styleOf('btn').backgroundColor).toBe(PALETTES.RASPBERRY.light.acc);
  });
});
