import '../../i18n';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { layout, size } from '../../theme';
import { Fab } from '../Fab';
import { FAB_CLEARANCE, fabBottomAboveTabBar, tabBarHeight } from '../tabBarMetrics';

let mockInsetBottom = 0;
jest.mock('react-native-safe-area-context', () => {
  const base = jest.requireActual('react-native-safe-area-context/jest/mock').default;
  return { ...base, useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: mockInsetBottom }) };
});

/** The tab layout's + sits a fixed gap above the REAL tab bar, which grows with the system navigation bar. */
describe('tab bar metrics and the + above it', () => {
  afterEach(() => {
    mockInsetBottom = 0;
  });

  it('measures the bar like AppTabBar: 6 top + 48 item + 1 border + max(inset, 22)', () => {
    expect(tabBarHeight(0)).toBe(77);
    expect(tabBarHeight(16)).toBe(77);
    expect(tabBarHeight(48)).toBe(103); // 3-button navigation (Samsung A13)
  });

  it('keeps the design position (100) on a gesture-navigation phone', () => {
    expect(fabBottomAboveTabBar(0)).toBe(layout.fabBottom);
  });

  it('moves the + up with a tall navigation bar so it never touches the tab bar', () => {
    for (const inset of [0, 24, 48, 64]) {
      expect(fabBottomAboveTabBar(inset) - tabBarHeight(inset)).toBeGreaterThanOrEqual(16);
    }
    expect(fabBottomAboveTabBar(48)).toBe(126);
  });

  it('gives lists one bottom padding that clears the + in a tab and on a pushed screen', () => {
    expect(FAB_CLEARANCE).toBeGreaterThanOrEqual(layout.fabBottom + size.fab); // pushed screen: + at fabBottom
    expect(FAB_CLEARANCE).toBeGreaterThanOrEqual(fabBottomAboveTabBar(48) - tabBarHeight(48) + size.fab);
  });

  it('Fab aboveTabBar follows the safe-area inset; without it the fixed design value stays', async () => {
    mockInsetBottom = 48;
    await render(
      <View>
        <Fab label="Add" onPress={jest.fn()} aboveTabBar testID="tab-fab" />
        <Fab label="Add" onPress={jest.fn()} testID="screen-fab" />
      </View>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('tab-fab').props.style).bottom).toBe(126);
    expect(StyleSheet.flatten(screen.getByTestId('screen-fab').props.style).bottom).toBe(layout.fabBottom);
  });
});
