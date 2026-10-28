import { useTranslation } from 'react-i18next';
import { LocationsScreen } from '../../../features/locations/LocationsScreen';
import { SettingsPage } from '../../../features/settings/SettingsPage';

export default function PlacesRoute() {
  const { t } = useTranslation();
  return (
    <SettingsPage testID="places-page" title={t('reminders.places.title')}>
      <LocationsScreen />
    </SettingsPage>
  );
}
