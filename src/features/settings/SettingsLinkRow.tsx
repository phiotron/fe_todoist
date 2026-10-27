import { router } from 'expo-router';
import { ListRow } from '../../components/ListRow';
import type { IconName } from '../../components/IconButton';

interface SettingsLinkRowProps {
  testID: string;
  label: string;
  /** Route of the page this row opens (pushed on the stack). */
  href: string;
  /** Feather icon name, drawn in the 36×36 box of .lrow .ico. */
  icon?: IconName;
  /** Current value shown on the right (e.g. "Dark"). */
  value?: string;
}

/** .lrow that opens a settings page (spec 9.5): label, optional value, chevron. */
export function SettingsLinkRow({ testID, label, href, icon, value }: SettingsLinkRowProps) {
  return (
    <ListRow
      testID={testID}
      title={label}
      icon={icon}
      iconBox={icon !== undefined}
      right={value}
      chevron
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={() => router.push(href as never)}
    />
  );
}
