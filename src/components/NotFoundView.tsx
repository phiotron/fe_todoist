import { useTranslation } from 'react-i18next';
import { AppButton } from './AppButton';
import { StateView } from './StateView';
import { View } from 'react-native';

/** Spec 9.3: the item is gone (deleted for good / no access): say so and offer the way back. */
export function NotFoundView({ onBack, testID = 'not-found' }: { onBack: () => void; testID?: string }) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }} testID={testID}>
      <StateView tone="error" icon="slash" title={t('errors.notFound')} testID={`${testID}-state`} />
      <View style={{ alignItems: 'center' }}>
        <AppButton variant="outline" label={t('common.back')} onPress={onBack} testID={`${testID}-back`} />
      </View>
    </View>
  );
}
