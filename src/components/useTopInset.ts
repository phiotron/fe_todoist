import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOnline } from '../lib/useIsOnline';

/**
 * Status-bar space a screen header must leave. While offline the banner at the very top already takes it
 * (OfflineBanner pads itself), so headers start right under the banner.
 */
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  return useIsOnline() ? insets.top : 0;
}
