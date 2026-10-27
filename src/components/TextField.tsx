import type { ComponentRef, Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';
import { ErrorText } from './ErrorText';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'testID'> {
  testID: string;
  label?: string;
  error?: string;
  /** Shows "used/max" under the field (M-NewProject name counter). */
  maxCount?: number;
  /** React 19 passes ref as a regular prop to function components. */
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** .lab + .in (48 high, radius 10, line2 border) + .err. */
export function TextField({ testID, label, error, maxCount, ref, multiline, value, ...inputProps }: TextFieldProps) {
  const styles = useThemedStyles(createTextFieldStyles);
  const { palette } = useTheme();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        testID={testID}
        accessibilityLabel={label ?? inputProps.placeholder}
        multiline={multiline}
        value={value}
        style={[styles.input, multiline && styles.multiline, error ? styles.inputError : null]}
        placeholderTextColor={palette.mute}
        {...inputProps}
      />
      {maxCount !== undefined ? (
        <Text testID={`${testID}-counter`} style={styles.counter}>{`${(value ?? '').length}/${maxCount}`}</Text>
      ) : null}
      <ErrorText message={error} testID={`${testID}-error`} />
    </View>
  );
}

function createTextFieldStyles(palette: Palette) {
  return StyleSheet.create({
    field: { marginBottom: 14 },
    label: { ...type.label, color: palette.ink2, marginBottom: 6 },
    input: {
      ...type.body,
      minHeight: size.input,
      borderWidth: 1,
      borderColor: palette.line2,
      borderRadius: radius.control,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: palette.ink,
      backgroundColor: palette.bg,
    },
    multiline: { minHeight: 88, textAlignVertical: 'top' },
    inputError: { borderColor: palette.warn },
    counter: { ...type.caption, color: palette.mute, textAlign: 'right', marginTop: 4 },
  });
}
