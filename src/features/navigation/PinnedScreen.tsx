import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StateView } from '../../components/StateView';
import { ProjectScreen } from '../projects/ProjectScreen';
import { pinnedOf } from '../settings/navTabsModel';
import { useNavTabs } from './navTabs';

/**
 * The pinned tab (spec 9.1): the project / label / filter pinned in the tab bar.
 * Label and filter screens come with M2: until they exist the tab says so and links to the settings.
 */
export function PinnedScreen() {
  const { t } = useTranslation();
  const pin = pinnedOf(useNavTabs());
  if (pin?.kind === 'project') return <ProjectScreen projectId={pin.id} tab />;
  return (
    <StateView
      tone="ok"
      icon="bookmark"
      title={t('settings.navigation.pin')}
      message={pin ? t('settings.navigation.pinnedUnavailable') : t('settings.navigation.pinnedEmpty')}
      actionLabel={t('settings.navigation.openSettings')}
      onAction={() => router.push('/settings/navigation')}
      testID="pinned-empty"
    />
  );
}
