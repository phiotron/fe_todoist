import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { useSession } from '../auth/session';
import { effectiveNavTabs, parsePin, startPageRoutes } from './navTabsModel';
import { usePinTargets } from './usePinTargets';
import { useSettings } from './useSettings';

/** Entry of the app ("/"): opens the user's start page (spec 9.3), or the log in screen when signed out. */
export function StartPageRedirect() {
  const { palette } = useTheme();
  const { status } = useSession();
  const { settings } = useSettings();
  const pin = parsePin(settings.startPage);
  const targets = usePinTargets(pin ? [pin.kind] : []);
  const done = useRef(false);

  // Signed in: a project / label / filter start page needs its list (to know it still exists); errors settle too.
  const ready = status === 'signedOut' || (status === 'signedIn' && (!pin || targets.settled[pin.kind]));

  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    if (status === 'signedOut') {
      router.replace('/login');
      return;
    }
    const navTabs = effectiveNavTabs(settings.navTabs, targets.known);
    const [first, ...rest] = startPageRoutes(settings.startPage, navTabs, targets.known);
    router.replace(first as never);
    for (const route of rest) router.push(route as never);
  }, [ready, status, settings.startPage, settings.navTabs, targets.known]);

  // Nothing to show for the few milliseconds before the redirect.
  return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
}
