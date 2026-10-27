import { StyleSheet } from 'react-native';
import { gutter, palette, radius, size, type } from '../../theme';

export const authStyles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: gutter, paddingTop: 48, paddingBottom: 24, backgroundColor: palette.bg },
  title: { ...type.screenTitle, color: palette.ink, marginBottom: 24 },
  notice: { ...type.meta, color: palette.warn, marginBottom: 16 },
  formError: { ...type.meta, color: palette.warn, marginBottom: 12 },
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
  link: { ...type.body, color: palette.acc, textAlign: 'center', marginTop: 20 },
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
