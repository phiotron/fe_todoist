import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useSettingsStyles } from '../settings/ui';

interface RecoveryCodesPanelProps {
  codes: string[];
  onDone: () => void;
}

/** The 10 one-time recovery codes, shown once (spec 5.9). Kept in this component's props only: never logged or stored. */
export function RecoveryCodesPanel({ codes, onDone }: RecoveryCodesPanelProps) {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const own = useThemedStyles(createStyles);
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await Clipboard.setStringAsync(codes.join('\n'));
    setCopied(true);
  }

  return (
    <View>
      <Text accessibilityRole="header" style={styles.body}>
        {t('twoFactor.settings.recoveryTitle')}
      </Text>
      <Text style={styles.hint}>{t('twoFactor.settings.recoveryHint')}</Text>
      <View style={own.grid}>
        {codes.map((code, index) => (
          <Text key={code} testID={`two-factor-code-${index + 1}`} selectable style={own.code}>
            {code}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
        <AppButton testID="two-factor-copy-codes" variant="outline" size="sm" label={t('twoFactor.settings.copyCodes')} onPress={() => void onCopy()} />
      </View>
      {copied ? (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          {t('twoFactor.settings.copied')}
        </Text>
      ) : null}
      <AppButton testID="two-factor-codes-saved" full label={t('twoFactor.settings.savedCodes')} onPress={onDone} />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    grid: { backgroundColor: palette.bg2, borderRadius: 12, padding: 12, gap: 6, marginVertical: 8 },
    code: { ...type.bodyStrong, color: palette.ink, fontVariant: ['tabular-nums'] },
  });
}
