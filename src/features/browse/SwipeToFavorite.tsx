import { Feather } from '@expo/vector-icons';
import { useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '../../theme';

interface SwipeToFavoriteProps {
  /** Only picks the icon; the caller decides what a swipe does. */
  isFavorite: boolean;
  onToggle: () => void;
  children: ReactNode;
  testID?: string;
}

/** Swipe a Browse row to the right to add / remove it from Favorites (spec 9.2); the row snaps back at once. */
export function SwipeToFavorite({ isFavorite, onToggle, children, testID }: SwipeToFavoriteProps) {
  const { palette } = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  return (
    <Swipeable
      ref={ref}
      testID={testID}
      friction={2}
      leftThreshold={72}
      renderLeftActions={() => (
        <View style={[styles.action, { backgroundColor: palette.acc }]}>
          <Feather name="heart" size={22} color={palette.onacc} style={isFavorite ? styles.off : undefined} />
        </View>
      )}
      onSwipeableOpen={() => {
        ref.current?.close();
        onToggle();
      }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: { width: 72, justifyContent: 'center', alignItems: 'center' },
  off: { opacity: 0.6 },
});
