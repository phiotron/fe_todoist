import { Feather } from '@expo/vector-icons';
import { Figtree_600SemiBold, useFonts } from '@expo-google-fonts/figtree';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { render, renderHook, screen } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import { Text } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

describe('native module mocks for M1 libraries', () => {
  it('renders gesture-handler root, swipeable and icons as plain views', async () => {
    await render(
      <GestureHandlerRootView>
        <Swipeable testID="swipe">
          <Text>row</Text>
        </Swipeable>
        <Feather name="check" testID="icon" size={12} />
      </GestureHandlerRootView>,
    );
    expect(screen.getByText('row')).toBeOnTheScreen();
    expect(screen.getByTestId('swipe')).toBeOnTheScreen();
    expect(screen.getByTestId('icon')).toHaveTextContent('check');
  });

  it('renders DraggableFlatList items through renderItem', async () => {
    await render(
      <DraggableFlatList
        testID="drag"
        data={[{ id: 'a' }, { id: 'b' }]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text>{`item-${item.id}`}</Text>}
        onDragEnd={() => undefined}
      />,
    );
    expect(screen.getByText('item-a')).toBeOnTheScreen();
    expect(screen.getByText('item-b')).toBeOnTheScreen();
  });

  it('gives RFC 4122 v4 UUIDs and a mockable Android date picker', () => {
    expect(Crypto.randomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(jest.isMockFunction(DateTimePickerAndroid.open)).toBe(true);
  });

  it('reports the Figtree fonts as loaded and zero safe-area insets', async () => {
    expect(useFonts({ Figtree_600SemiBold })).toEqual([true, null]);
    // useSafeAreaInsets reads a context, so it needs a component (a hook cannot run in the test body).
    const { result } = await renderHook(() => useSafeAreaInsets());
    expect(result.current).toMatchObject({ top: 0, bottom: 0 });
  });
});
