import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { authStyles as styles } from './styles';

interface AuthTextFieldProps extends Omit<TextInputProps, 'style' | 'testID'> {
  label: string;
  testID: string;
  error?: string;
}

export function AuthTextField({ label, testID, error, ...inputProps }: AuthTextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        style={[styles.input, error ? styles.inputError : null]}
        {...inputProps}
      />
      {error ? (
        <Text testID={`${testID}-error`} style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
