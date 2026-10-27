import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { CreateLabelRequest, Label, UpdateLabelRequest } from '../../api/labels';
import { DEFAULT_PROJECT_COLOR, type ProjectColor } from '../../api/models';
import { hasProblemCode } from '../../api/problem';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorText } from '../../components/ErrorText';
import { ColorSwatches } from '../../components/ColorSwatches';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { type, useTheme } from '../../theme';
import { LABEL_NAME_MAX, checkLabelName, type LabelNameProblem } from './labelRules';
import { useCreateLabel, useSetLabelFavorite, useUpdateLabel } from './useLabels';

interface LabelFormSheetProps {
  visible: boolean;
  /** Edit this label; create a new one when absent. */
  label?: Label;
  onClose: () => void;
  onSaved?: (label: Label) => void;
  testID?: string;
}

export function LabelFormSheet({ visible, label, onClose, onSaved, testID = 'label-form' }: LabelFormSheetProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const create = useCreateLabel();
  const update = useUpdateLabel();
  const setFavorite = useSetLabelFavorite();
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();
  const [name, setName] = useState('');
  const [color, setColor] = useState<ProjectColor>(DEFAULT_PROJECT_COLOR);
  const [favorite, setFavoriteValue] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  // Reset when the sheet opens or targets another label; a refetch of the same label keeps the typing.
  useEffect(() => {
    if (!visible) return;
    setName(label?.name ?? '');
    setColor(label?.color ?? DEFAULT_PROJECT_COLOR);
    setFavoriteValue(label?.isFavorite ?? false);
    setNameError(undefined);
    setFormError(undefined);
  }, [visible, label?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function nameMessage(problem: LabelNameProblem): string {
    if (problem === 'required') return t('labels.form.nameRequired');
    if (problem === 'tooLong') return t('labels.form.nameTooLong', { n: LABEL_NAME_MAX });
    return t('labels.form.nameInvalid');
  }

  async function save(): Promise<Label> {
    const trimmed = name.trim();
    if (label) {
      const body: UpdateLabelRequest = {};
      if (trimmed !== label.name) body.name = trimmed;
      if (color !== label.color) body.color = color;
      let saved = Object.keys(body).length > 0 ? await update.mutateAsync({ id: label.id, body }) : label;
      if (favorite !== label.isFavorite) saved = await setFavorite.mutateAsync({ id: label.id, favorite });
      return saved;
    }
    const body: CreateLabelRequest = { name: trimmed, color };
    let saved = await create.mutateAsync({ body, idempotencyKey: keys.keyFor(body) });
    if (favorite) saved = await setFavorite.mutateAsync({ id: saved.id, favorite: true });
    // Only now: if a step above failed, Save again reuses the key and the server replays the same label.
    keys.reset();
    return saved;
  }

  async function submit() {
    const problem = checkLabelName(name);
    setNameError(problem ? nameMessage(problem) : undefined);
    setFormError(undefined);
    if (problem) return;
    await run(async () => {
      try {
        const saved = await save();
        onSaved?.(saved);
        onClose();
      } catch (error) {
        if (hasProblemCode(error, 'label-name-taken')) setNameError(t('labels.form.nameTaken'));
        else setFormError(describeError(error).message);
      }
    });
  }

  return (
    <BottomSheet
      visible={visible}
      title={label ? t('labels.form.editTitle') : t('labels.form.createTitle')}
      onClose={onClose}
      testID={testID}
    >
      <TextField
        testID={`${testID}-name`}
        label={t('labels.form.name')}
        value={name}
        onChangeText={setName}
        error={nameError}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={[styles.fieldLabel, { color: palette.ink2 }]}>{t('labels.form.color')}</Text>
      <ColorSwatches value={color} onChange={setColor} testID={`${testID}-color`} />
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: palette.ink }]}>{t('labels.form.favorite')}</Text>
        <Toggle
          testID={`${testID}-favorite`}
          label={t('labels.form.favorite')}
          value={favorite}
          onChange={setFavoriteValue}
        />
      </View>
      <ErrorText message={formError} testID={`${testID}-error`} />
      <View style={styles.actions}>
        <AppButton
          variant="ghost"
          label={t('labels.form.cancel')}
          onPress={onClose}
          disabled={busy}
          testID={`${testID}-cancel`}
        />
        <AppButton
          label={t('labels.form.save')}
          onPress={() => void submit()}
          busy={busy}
          requiresOnline
          testID={`${testID}-save`}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...type.label, marginTop: 4, marginBottom: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, marginTop: 8 },
  switchLabel: { ...type.body, flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
