import type { ComponentRef, Ref } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme';
import { useAuthStyles } from './styles';

/** Instance type of a TextInput ref (focus, blur…). */
export type TextInputHandle = ComponentRef<typeof TextInput>;

interface AuthTextFieldProps extends Omit<TextInputProps, 'style' | 'testID'> {
  label: string;
  testID: string;
  error?: string;
  /** React 19 passes ref as a regular prop to function components. */
  ref?: Ref<TextInputHandle>;
}

export function AuthTextField({ label, testID, error, ref, ...inputProps }: AuthTextFieldProps) {
  const styles = useAuthStyles();
  const { palette } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        testID={testID}
        placeholderTextColor={palette.mute}
        style={[styles.input, error ? styles.inputError : null]}
        {...inputProps}
      />
      {error ? (
        <Text
          testID={`${testID}-error`}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.fieldError}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
