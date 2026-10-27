import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ThemeProvider, useTheme, useThemedStyles } from '..';
import { darkPalette, lightPalette, type Palette } from '../palette';
import { PALETTES } from '../themes';
import { useSystemColorScheme } from '../useSystemColorScheme';

jest.mock('../useSystemColorScheme', () => ({ useSystemColorScheme: jest.fn() }));
const mockedSystemScheme = jest.mocked(useSystemColorScheme);

function Probe() {
  const { name, scheme, palette, radius } = useTheme();
  return <Text testID="probe">{`${name}|${scheme}|${palette.acc}|${radius.control}`}</Text>;
}

function createProbeStyles(palette: Palette) {
  return StyleSheet.create({ box: { backgroundColor: palette.bg2 } });
}

function StyledProbe() {
  const styles = useThemedStyles(createProbeStyles);
  return (
    <Text testID="styled" style={styles.box}>
      x
    </Text>
  );
}

function probeText(): string {
  return screen.getByTestId('probe').props.children;
}

describe('ThemeProvider / useTheme', () => {
  beforeEach(() => {
    mockedSystemScheme.mockReturnValue('light');
  });

  it('without a provider: TASKLY light, with the M1 metrics', async () => {
    await render(<Probe />);
    expect(probeText()).toBe(`TASKLY|light|${lightPalette.acc}|10`);
  });

  it('LIGHT and DARK ignore the OS setting', async () => {
    mockedSystemScheme.mockReturnValue('dark');
    await render(
      <ThemeProvider theme="TASKLY" appearance="LIGHT">
        <Probe />
      </ThemeProvider>,
    );
    expect(probeText()).toBe(`TASKLY|light|${lightPalette.acc}|10`);

    mockedSystemScheme.mockReturnValue('light');
    await render(
      <ThemeProvider theme="TASKLY" appearance="DARK">
        <Probe />
      </ThemeProvider>,
    );
    expect(probeText()).toBe(`TASKLY|dark|${darkPalette.acc}|10`);
  });

  it('AUTO follows the OS setting and reacts when it changes', async () => {
    const { rerender } = await render(
      <ThemeProvider theme="TASKLY" appearance="AUTO">
        <Probe />
      </ThemeProvider>,
    );
    expect(probeText()).toBe(`TASKLY|light|${lightPalette.acc}|10`);

    mockedSystemScheme.mockReturnValue('dark');
    await rerender(
      <ThemeProvider theme="TASKLY" appearance="AUTO">
        <Probe />
      </ThemeProvider>,
    );
    expect(probeText()).toBe(`TASKLY|dark|${darkPalette.acc}|10`);
  });

  it('uses the palette of the chosen theme', async () => {
    await render(
      <ThemeProvider theme="BLUEBERRY" appearance="DARK">
        <Probe />
      </ThemeProvider>,
    );
    expect(probeText()).toBe(`BLUEBERRY|dark|${PALETTES.BLUEBERRY.dark.acc}|10`);
  });

  it('keeps the colors alias used by the M4 / M5 plans in step with the palette', async () => {
    function ColorsProbe() {
      const { colors, palette } = useTheme();
      return <Text testID="colors">{`${colors.primary}|${colors.text}|${colors.danger}|${palette.acc}`}</Text>;
    }
    await render(
      <ThemeProvider theme="LAVENDER" appearance="DARK">
        <ColorsProbe />
      </ThemeProvider>,
    );
    const dark = PALETTES.LAVENDER.dark;
    expect(screen.getByTestId('colors').props.children).toBe(`${dark.acc}|${dark.ink}|${dark.warn}|${dark.acc}`);
  });

  it('useThemedStyles builds styles from the active palette', async () => {
    await render(
      <ThemeProvider theme="TASKLY" appearance="DARK">
        <StyledProbe />
      </ThemeProvider>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('styled').props.style).backgroundColor).toBe(darkPalette.bg2);
  });
});
