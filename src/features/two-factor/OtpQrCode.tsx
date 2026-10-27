import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { lightPalette } from '../../theme/palette';
import { qrModules, qrPath } from './qrModules';

const QUIET_ZONE = 2;
const SIDE = 200;

/**
 * QR code of the otpauth:// URI, drawn with react-native-svg from the `qrcode` module matrix.
 * Always dark on white (scanners need the contrast), whatever the theme. The accessibility label
 * is the generic title: the URI holds the secret, so it never goes to a screen reader or a log.
 */
export function OtpQrCode({ value }: { value: string }) {
  const { t } = useTranslation();
  const modules = useMemo(() => qrModules(value), [value]);
  const path = useMemo(() => qrPath(modules), [modules]);
  const span = modules.size + QUIET_ZONE * 2;
  return (
    <View testID="qr-code" accessibilityRole="image" accessibilityLabel={t('twoFactor.settings.scanTitle')} style={styles.frame}>
      <Svg width={SIDE} height={SIDE} viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${span} ${span}`}>
        <Rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={span} height={span} fill={lightPalette.bg} />
        <Path d={path} fill={lightPalette.ink} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', padding: 12, borderRadius: 12, backgroundColor: lightPalette.bg, marginVertical: 12 },
});
