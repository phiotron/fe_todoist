import { renderHook } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { authStyles } from '../../features/auth/styles';
import { colors } from '../../lib/theme';
import { AVATAR_COLORS, PROJECT_PALETTE, darkPalette, fonts, palette, radius, size, type, useTheme } from '..';

describe('design tokens (design-mobile/screens/taskly.css)', () => {
  it('keeps the light colours of the approved design', () => {
    expect(palette).toMatchObject({
      bg: '#FFFFFF',
      bg2: '#FAF9F7',
      side: '#F5F3EF',
      line: '#E7E4DE',
      line2: '#CFCBC3',
      ink: '#1F2328',
      ink2: '#4F555D',
      mute: '#646A72',
      acc: '#0F766E',
      acc2: '#0B5F58',
      soft: '#E2F1EF',
      onacc: '#FFFFFF',
      p1: '#C2362B',
      p1s: '#FCEAE8',
      p2: '#B45309',
      p2s: '#FDF0DC',
      p3: '#1D5FD0',
      p3s: '#E6EEFB',
      p4: '#6B7078',
      ok: '#1E7A3F',
      warn: '#B3261E',
      vio: '#6B3FA0',
      tog: '#80868E',
    });
    expect(AVATAR_COLORS).toEqual(['#0F766E', '#7C3AED', '#B45309', '#1D5FD0', '#BE185D']);
    expect(Object.keys(PROJECT_PALETTE)).toHaveLength(20);
    expect(PROJECT_PALETTE).toMatchObject({ teal: '#0F766E', orange: '#B45309', charcoal: '#4F555D' });
  });

  it('has a dark value for every light token (used from M3)', () => {
    expect(Object.keys(darkPalette).sort()).toEqual(Object.keys(palette).sort());
    expect(darkPalette.acc).toBe('#4FB8AD');
  });

  it('sets text styles with a Figtree family per weight and never a fontWeight (Android drops custom fonts)', () => {
    for (const style of Object.values(type)) {
      expect(Object.values(fonts)).toContain(style.fontFamily);
      expect(style).not.toHaveProperty('fontWeight');
    }
    expect(type.screenTitle).toMatchObject({ fontFamily: fonts.bold, fontSize: 26 });
    expect(type.taskTitle).toMatchObject({ fontFamily: fonts.medium, fontSize: 16 });
    expect(type.tab).toMatchObject({ fontFamily: fonts.semibold, fontSize: 11 });
  });

  it('keeps touch targets at least 44 and the design radii', async () => {
    expect(size.touch).toBe(44);
    expect(size.input).toBe(48);
    expect(size.fab).toBe(56);
    expect(radius).toMatchObject({ chip: 8, control: 10, card: 12, dialog: 16, sheet: 20 });
    // useTheme() is a hook now (it reads the theme context): TASKLY light outside a provider.
    const { result } = await renderHook(() => useTheme());
    expect(result.current.palette).toBe(palette);
  });

  it('maps the M0 colour names onto the tokens and styles the auth screens with them', () => {
    expect(colors.primary).toBe(palette.acc);
    expect(colors.danger).toBe(palette.warn);
    expect(StyleSheet.flatten(authStyles.title)?.fontFamily).toBe(fonts.bold);
    expect(StyleSheet.flatten(authStyles.button)?.backgroundColor).toBe(palette.acc);
  });
});
