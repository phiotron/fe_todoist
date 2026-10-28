import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ApiError } from '../../api/errors';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ListRow } from '../../components/ListRow';
import { AddButtonPlacementSection } from '../navMenu/AddButtonPlacementSection';
import { SettingsPage } from './SettingsPage';
import {
  DEFAULT_NAV_TABS,
  MAX_NAV_TABS,
  MIN_NAV_TABS,
  addTab,
  addableFixedTabs,
  canAddTab,
  canRemoveTab,
  effectiveNavTabs,
  moveTab,
  pinnedOf,
  removeTab,
  setPin,
  type FixedTab,
  type PinTarget,
} from './navTabsModel';
import { describeSettingsSaveError } from './settingsErrors';
import { TargetPicker } from './TargetPicker';
import { tabLabel } from './tabLabels';
import { SettingsSection, useSettingsStyles } from './ui';
import { usePinTargets } from './usePinTargets';
import { useSettings } from './useSettings';

export function NavigationSettingsScreen() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { settings, update } = useSettings();
  const targets = usePinTargets();
  const [error, setError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const tabs = effectiveNavTabs(settings.navTabs, targets.known);
  const pin = pinnedOf(tabs);
  const label = (key: string) => tabLabel(key, targets.nameOf, (i18nKey) => t(i18nKey));

  async function save(next: string[]): Promise<boolean> {
    setError(undefined);
    try {
      await update({ navTabs: next });
      return true;
    } catch (saveError) {
      const reason = describeSettingsSaveError(saveError);
      // 400 (e.g. the pinned target cannot be read any more): the provider already dropped the change, the bar stays as it was.
      setError(saveError instanceof ApiError && saveError.status === 400 ? t('settings.navigation.rejected', { reason }) : reason);
      return false;
    }
  }

  function onPick(target: PinTarget) {
    setPicking(false);
    const next = setPin(tabs, target);
    if (next) void save(next);
  }

  return (
    <SettingsPage testID="navigation-settings-screen" title={t('settings.pages.navigation')}>
      <AddButtonPlacementSection />
      <Text style={styles.hint}>{t('settings.navigation.intro')}</Text>
      <SettingsSection testID="settings-section-navCurrent" title={t('settings.navigation.current')}>
        {tabs.map((key, index) => {
          const isBrowse = key === 'BROWSE';
          return (
            <View key={key} testID={`nav-tab-${key}`} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {label(key)}
              </Text>
              {isBrowse ? null : (
                <>
                  <IconButton
                    testID={`nav-tab-${key}-up`}
                    icon="arrow-up"
                    label={t('settings.navigation.moveUp', { name: label(key) })}
                    disabled={index === 0}
                    onPress={() => void save(moveTab(tabs, key, -1))}
                  />
                  <IconButton
                    testID={`nav-tab-${key}-down`}
                    icon="arrow-down"
                    label={t('settings.navigation.moveDown', { name: label(key) })}
                    disabled={index >= tabs.length - 2}
                    onPress={() => void save(moveTab(tabs, key, 1))}
                  />
                  <IconButton
                    testID={`nav-tab-${key}-remove`}
                    icon="x"
                    label={t('settings.navigation.remove', { name: label(key) })}
                    disabled={!canRemoveTab(tabs, key)}
                    onPress={() => void save(removeTab(tabs, key))}
                  />
                </>
              )}
            </View>
          );
        })}
        {tabs.length <= MIN_NAV_TABS ? <Text style={styles.hint}>{t('settings.navigation.minimum')}</Text> : null}
      </SettingsSection>

      <SettingsSection testID="settings-section-navAvailable" title={t('settings.navigation.available')}>
        {addableFixedTabs(tabs).map((key: FixedTab) => (
          <View key={key} style={styles.row}>
            <Text style={styles.rowLabel}>{label(key)}</Text>
            <IconButton
              testID={`nav-add-${key}`}
              icon="plus"
              label={t('settings.navigation.add', { name: label(key) })}
              disabled={!canAddTab(tabs)}
              onPress={() => void save(addTab(tabs, key))}
            />
          </View>
        ))}
        <ListRow
          testID="nav-pin"
          title={pin ? t('settings.navigation.changePin') : t('settings.navigation.pin')}
          right={pin ? (targets.nameOf(pin) ?? t('settings.startPage.unknown')) : undefined}
          chevron
          onPress={() => setPicking(true)}
        />
        <Text style={styles.hint}>{t('settings.navigation.pinHint')}</Text>
        {tabs.length >= MAX_NAV_TABS ? <Text style={styles.hint}>{t('settings.navigation.full')}</Text> : null}
        <ErrorText testID="navigation-error" message={error} />
      </SettingsSection>

      <AppButton
        testID="nav-restore"
        variant="outline"
        full
        label={t('settings.navigation.restore')}
        requiresOnline
        onPress={() => setRestoring(true)}
      />
      <TargetPicker visible={picking} onClose={() => setPicking(false)} onSelect={onPick} selected={pin} />
      {/* BR-11: restoring the default tab bar needs an explicit confirmation; Cancel calls nothing. */}
      <ConfirmDialog
        testID="nav-restore-dialog"
        visible={restoring}
        title={t('settings.navigation.restoreConfirmTitle')}
        message={t('settings.navigation.restoreConfirmMessage')}
        confirmLabel={t('settings.navigation.restoreConfirm')}
        destructive={false}
        onConfirm={() => {
          setRestoring(false);
          void save([...DEFAULT_NAV_TABS]);
        }}
        onCancel={() => setRestoring(false)}
      />
    </SettingsPage>
  );
}
