import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { NavMenuItem } from '../../api/navigationSettings';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { Toggle } from '../../components/Toggle';
import { describeSettingsSaveError } from '../settings/settingsErrors';
import { SettingsPage } from '../settings/SettingsPage';
import { SettingsSection, SwitchRow, useSettingsStyles } from '../settings/ui';
import { useSettings } from '../settings/useSettings';
import {
  hideMenuItem,
  isMenuItemAvailable,
  isOnTabBar,
  menuItemRows,
  moveMenuItem,
  readNavigationSettings,
  showMenuItem,
} from './navMenuModel';

/**
 * Settings › Navigation menu (Todoist): "Show task count" and the menu items of the Browse screen — shown ones in menu
 * order (move up / down, switch off), then hidden ones (switch on = add at the end). Every change is saved at once.
 */
export function NavigationMenuSettingsScreen() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { data, settings, update } = useSettings();
  const [error, setError] = useState<string>();
  const { navMenuShowTaskCount, navMenuItems } = readNavigationSettings(data);
  const label = (item: NavMenuItem) => t(`navMenu.items.${item}`);

  async function save(patch: { navMenuShowTaskCount?: boolean; navMenuItems?: NavMenuItem[] }) {
    setError(undefined);
    try {
      await update(patch);
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  function noteFor(item: NavMenuItem): string | undefined {
    if (!isMenuItemAvailable(item)) return t('navMenu.comingLater');
    if (isOnTabBar(item, settings.navTabs)) return t('navMenu.onTabBar');
    return undefined;
  }

  return (
    <SettingsPage testID="navigation-menu-settings-screen" title={t('navMenu.title')}>
      <Text style={styles.hint}>{t('navMenu.intro')}</Text>
      <SettingsSection testID="settings-section-navMenuCount">
        <SwitchRow
          testID="nav-menu-count"
          label={t('navMenu.showTaskCount')}
          hint={t('navMenu.showTaskCountHint')}
          value={navMenuShowTaskCount}
          onChange={(value) => void save({ navMenuShowTaskCount: value })}
        />
      </SettingsSection>
      <SettingsSection testID="settings-section-navMenuItems" title={t('navMenu.itemsTitle')}>
        {menuItemRows(navMenuItems).map(({ item, shown }, index) => {
          const note = noteFor(item);
          return (
            <View key={item} testID={`nav-menu-${item}`} style={styles.row}>
              <View style={styles.rowTexts}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {label(item)}
                </Text>
                {note ? <Text style={styles.rowHint}>{note}</Text> : null}
              </View>
              {shown ? (
                <>
                  <IconButton
                    testID={`nav-menu-${item}-up`}
                    icon="arrow-up"
                    label={t('navMenu.moveUp', { name: label(item) })}
                    disabled={index === 0}
                    onPress={() => void save({ navMenuItems: moveMenuItem(navMenuItems, item, -1) })}
                  />
                  <IconButton
                    testID={`nav-menu-${item}-down`}
                    icon="arrow-down"
                    label={t('navMenu.moveDown', { name: label(item) })}
                    disabled={index >= navMenuItems.length - 1}
                    onPress={() => void save({ navMenuItems: moveMenuItem(navMenuItems, item, 1) })}
                  />
                </>
              ) : null}
              <Toggle
                testID={`nav-menu-${item}-toggle`}
                label={t('navMenu.toggle', { name: label(item) })}
                value={shown}
                onChange={(on) =>
                  void save({ navMenuItems: on ? showMenuItem(navMenuItems, item) : hideMenuItem(navMenuItems, item) })
                }
              />
            </View>
          );
        })}
        <ErrorText testID="nav-menu-error" message={error} />
      </SettingsSection>
    </SettingsPage>
  );
}
