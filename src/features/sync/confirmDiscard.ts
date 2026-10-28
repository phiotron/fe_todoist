import { Alert } from 'react-native';
import i18n from '../../i18n';
import { pendingSyncCount, syncEngine } from '../../lib/sync/runtime';

/**
 * Spec 3.2 (M9): signing out while changes are not on the server loses them. Online, the queue is flushed first (most
 * of the time that empties it); if changes still wait, the user must confirm. Resolves true = go ahead and sign out.
 */
export async function confirmDiscardUnsynced(): Promise<boolean> {
  if (pendingSyncCount() === 0) return true;
  try {
    await syncEngine.run(); // no-op offline
  } catch {
    // The engine never rejects in practice; whatever is left is asked about below.
  }
  const pending = pendingSyncCount();
  if (pending === 0) return true;
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      i18n.t('sync.discard.title'),
      i18n.t('sync.discard.message', { n: pending }),
      [
        { text: i18n.t('sync.discard.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: i18n.t('sync.discard.confirm'), style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
