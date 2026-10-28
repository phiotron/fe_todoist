import * as Clipboard from 'expo-clipboard';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '../../components/Snackbar';
import { buildDeepLink, type DeepLinkTarget } from '../../lib/links/deepLinks';

/** "Copy link" of the task / project / section / Inbox menus (M12): copies `taskly://…` and says so in a snackbar. */
export function useCopyLink() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  return useCallback(
    async (target: DeepLinkTarget): Promise<void> => {
      try {
        await Clipboard.setStringAsync(buildDeepLink(target));
        snackbar.show({ message: t('android.link.copied') });
      } catch {
        snackbar.show({ message: t('android.link.failed'), tone: 'error' });
      }
    },
    [snackbar, t],
  );
}
