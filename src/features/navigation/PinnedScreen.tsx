import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StateView } from '../../components/StateView';
import { FilterScreen } from '../filters/FilterScreen';
import { LabelScreen } from '../labels/LabelScreen';
import { ProjectScreen } from '../projects/ProjectScreen';
import { pinnedOf } from '../settings/navTabsModel';
import { useNavTabs } from './navTabs';

/**
 * The pinned tab (spec 9.1): the project / label / filter pinned in the tab bar.
 * Nothing pinned: the tab explains and links to the tab bar settings.
 */
export function PinnedScreen() {
  const { t } = useTranslation();
  const pin = pinnedOf(useNavTabs());
  if (pin?.kind === 'project') return <ProjectScreen projectId={pin.id} tab />;
  if (pin?.kind === 'label') return <LabelScreen labelId={pin.id} tab />;
  if (pin?.kind === 'filter') return <FilterScreen filterId={pin.id} tab />;
  return (
    <StateView
      tone="ok"
      icon="bookmark"
      title={t('settings.navigation.pin')}
      message={t('settings.navigation.pinnedEmpty')}
      actionLabel={t('settings.navigation.openSettings')}
      onAction={() => router.push('/settings/navigation')}
      testID="pinned-empty"
    />
  );
}
