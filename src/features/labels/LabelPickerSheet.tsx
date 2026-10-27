import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Label } from '../../api/labels';
import { hasProblemCode } from '../../api/problem';
import { AppButton, type AppButtonVariant } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { TextField } from '../../components/TextField';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { projectColorHex } from '../projects/appearance';
import { type, useTheme } from '../../theme';
import { LABELS_PER_TASK_MAX, checkLabelName, sameLabelName } from './labelRules';
import { useCreateLabel, useLabels } from './useLabels';

export interface LabelPickerAction {
  key: string;
  label: string;
  onPress: (labelIds: string[]) => void;
  variant?: AppButtonVariant;
  /** Disabled while nothing is ticked (multi-select add / remove). */
  requiresSelection?: boolean;
  requiresOnline?: boolean;
}

interface LabelPickerSheetProps {
  visible: boolean;
  /** Ticked when the sheet opens; reset on every opening. */
  initialIds: readonly string[];
  actions: readonly LabelPickerAction[];
  onClose: () => void;
  busy?: boolean;
  error?: string;
  testID?: string;
}

/** Labels whose name contains the search text (ignoring case and outer spaces), in label order. */
export function matchLabels(labels: readonly Label[], search: string): Label[] {
  const needle = search.trim().toLocaleLowerCase('vi');
  if (!needle) return [...labels];
  return labels.filter((label) => label.name.toLocaleLowerCase('vi').includes(needle));
}

/** Pick labels: search, tick, or create the typed name on the spot (as Todoist does). */
export function LabelPickerSheet({
  visible,
  initialIds,
  actions,
  onClose,
  busy = false,
  error,
  testID = 'label-picker',
}: LabelPickerSheetProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { query, labels } = useLabels(visible);
  const create = useCreateLabel();
  const keys = useIdempotencyKeys();
  const { run, busy: creating } = useSingleFlight();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelected([...initialIds]);
    setSearch('');
    create.reset();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => matchLabels(labels, search), [labels, search]);
  const name = search.trim();
  const canCreate =
    name.length > 0 && checkLabelName(name) === null && !labels.some((label) => sameLabelName(label.name, name));
  const full = selected.length >= LABELS_PER_TASK_MAX;

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length >= LABELS_PER_TASK_MAX ? current : [...current, id];
    });
  }

  async function createAndTick() {
    const body = { name };
    await run(async () => {
      try {
        const label = await create.mutateAsync({ body, idempotencyKey: keys.keyFor(body) });
        keys.reset();
        setSearch('');
        setSelected((current) => (current.length >= LABELS_PER_TASK_MAX ? current : [...current, label.id]));
      } catch {
        // create.error is shown below; the typed name stays so a retry reuses the same key.
      }
    });
  }

  let createError: string | undefined;
  if (create.error) {
    createError = hasProblemCode(create.error, 'label-name-taken')
      ? t('labels.form.nameTaken')
      : describeError(create.error).message;
  }

  return (
    <BottomSheet visible={visible} title={t('labels.picker.title')} onClose={onClose} testID={testID}>
      <TextField
        testID={`${testID}-search`}
        placeholder={t('labels.picker.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {labels.length === 0 && (query.isPending || query.isError) ? (
        <QueryStateView query={query} testID={`${testID}-state`} />
      ) : null}
      {query.isSuccess && labels.length === 0 && !name ? (
        <Text testID={`${testID}-empty`} style={[styles.note, { color: palette.mute }]}>
          {t('labels.picker.empty')}
        </Text>
      ) : null}
      {shown.map((label) => {
        const isChecked = selected.includes(label.id);
        const blocked = !isChecked && full;
        return (
          <Pressable
            key={label.id}
            testID={`${testID}-item-${label.id}`}
            accessibilityRole="checkbox"
            accessibilityLabel={label.name}
            accessibilityState={{ checked: isChecked, disabled: blocked }}
            disabled={blocked}
            onPress={() => toggle(label.id)}
            style={[styles.row, { borderBottomColor: palette.line }, blocked && styles.blocked]}
          >
            <Feather name="tag" size={20} color={projectColorHex(label.color)} />
            <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
              {label.name}
            </Text>
            <Feather
              name={isChecked ? 'check-square' : 'square'}
              size={22}
              color={isChecked ? palette.acc : palette.mute}
            />
          </Pressable>
        );
      })}
      {canCreate ? (
        <AppButton
          variant="ghost"
          label={t('labels.picker.create', { name })}
          onPress={() => void createAndTick()}
          busy={creating}
          requiresOnline
          testID={`${testID}-create`}
        />
      ) : null}
      {full ? (
        <Text testID={`${testID}-full`} style={[styles.note, { color: palette.mute }]}>
          {t('labels.picker.full', { n: LABELS_PER_TASK_MAX })}
        </Text>
      ) : null}
      <ErrorText message={error ?? createError} testID={`${testID}-error`} />
      <View style={styles.actions}>
        {actions.map((action) => (
          <AppButton
            key={action.key}
            label={action.label}
            variant={action.variant ?? 'primary'}
            onPress={() => action.onPress([...selected])}
            disabled={(action.requiresSelection ?? false) && selected.length === 0}
            busy={busy}
            requiresOnline={action.requiresOnline ?? false}
            testID={`${testID}-action-${action.key}`}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  blocked: { opacity: 0.5 },
  name: { ...type.body, flex: 1 },
  note: { ...type.meta, paddingVertical: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
