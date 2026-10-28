import { StyleSheet } from 'react-native';
import { gutter, radius, size, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

/** Auth screens after the approved M-Auth frame (taskly.css .lab / .in / .err / .btn). */
export function createAuthStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flexGrow: 1, paddingHorizontal: gutter, paddingTop: 48, paddingBottom: 24, backgroundColor: palette.bg },
    title: { ...type.screenTitle, color: palette.ink, marginBottom: 24 },
    intro: { ...type.body, color: palette.mute, marginBottom: 20 },
    muted: { ...type.meta, color: palette.mute },
    notice: { ...type.meta, color: palette.warn, marginBottom: 16 },
    formError: { ...type.meta, color: palette.warn, marginBottom: 12 },
    successText: { ...type.body, color: palette.mute, marginBottom: 20 },
    // M5 Google: a plain information line (link-required notice) and the "or" divider after the M-Auth frame.
    info: { ...type.body, color: palette.ink, marginBottom: 8 },
    orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
    orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.line },
    orText: { ...type.meta, color: palette.mute },
    mailIcon: {
      width: size.avatarXL,
      height: size.avatarXL,
      borderRadius: radius.round,
      backgroundColor: palette.soft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    button: {
      backgroundColor: palette.acc,
      borderRadius: radius.control,
      height: size.button,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { ...type.button, color: palette.onacc },
    secondaryButton: {
      borderRadius: radius.control,
      height: size.button,
      borderWidth: 1,
      borderColor: palette.line2,
      backgroundColor: palette.bg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    secondaryButtonText: { ...type.button, color: palette.ink },
    ghostLink: { ...type.button, color: palette.acc, textAlign: 'center', paddingVertical: 12 },
    link: { ...type.bodyStrong, color: palette.acc, textAlign: 'center', marginTop: 20 },
    backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: size.touch, marginBottom: 8 },
    field: { marginBottom: 16 },
    label: { ...type.label, color: palette.ink2, marginBottom: 6 },
    input: {
      ...type.body,
      height: size.input,
      borderWidth: 1,
      borderColor: palette.line2,
      borderRadius: radius.control,
      paddingHorizontal: 14,
      color: palette.ink,
      backgroundColor: palette.bg,
    },
    inputError: { borderColor: palette.warn },
    fieldError: { ...type.meta, color: palette.warn, marginTop: 6 },
  });
}

export type AuthStyles = ReturnType<typeof createAuthStyles>;

export function useAuthStyles(): AuthStyles {
  return useThemedStyles(createAuthStyles);
}
