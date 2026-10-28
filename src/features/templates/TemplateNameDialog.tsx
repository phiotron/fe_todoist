import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { DialogFrame } from '../../components/DialogFrame';
import { ErrorText } from '../../components/ErrorText';
import { TextField } from '../../components/TextField';
import { LIMITS, checkRequiredText } from '../../lib/limits';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

export interface TemplateNameDialogProps {
  visible: boolean;
  title: string;
  label: string;
  submitLabel: string;
  initialName: string;
  hint?: string;
  requiredMessage: string;
  tooLongMessage: string;
  busy: boolean;
  /** Error of the last submit (stays until the next change). */
  error?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
  testID: string;
}

/** One-field dialog (1–120 characters, like a project name) for "Save as template" and "Use template". */
export function TemplateNameDialog({
  visible,
  title,
  label,
  submitLabel,
  initialName,
  hint,
  requiredMessage,
  tooLongMessage,
  busy,
  error,
  onSubmit,
  onClose,
  testID,
}: TemplateNameDialogProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setNameError(undefined);
    // Reset only when the dialog opens: a refetch must not wipe what the user is typing.
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    const problem = checkRequiredText(name, LIMITS.projectName);
    if (problem) {
      setNameError(problem === 'required' ? requiredMessage : tooLongMessage);
      return;
    }
    onSubmit(name.trim());
  }

  return (
    <DialogFrame visible={visible} title={title} onRequestClose={onClose} testID={testID}>
      <TextField
        testID={`${testID}-name`}
        label={label}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setNameError(undefined);
        }}
        error={nameError}
        autoFocus
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <ErrorText message={error} testID={`${testID}-error`} />
      <View style={styles.actions}>
        <AppButton variant="outline" label={t('common.cancel')} onPress={onClose} disabled={busy} testID={`${testID}-cancel`} />
        <AppButton label={submitLabel} onPress={submit} busy={busy} requiresOnline testID={`${testID}-submit`} />
      </View>
    </DialogFrame>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    hint: { ...type.meta, color: palette.mute, marginTop: 4 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  });
}
