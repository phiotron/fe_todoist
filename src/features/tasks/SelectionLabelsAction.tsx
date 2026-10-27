import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { describeError } from '../../api/describeError';
import type { AddOrRemoveLabelsAction } from '../../api/models';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useIsOnline } from '../../lib/useIsOnline';
import { size, type, useTheme } from '../../theme';
import { LabelPickerSheet } from '../labels/LabelPickerSheet';
import { useBatchLabels } from '../labels/useLabels';

interface SelectionLabelsActionProps {
  taskIds: readonly string[];
  /** Called after the batch succeeded, so the bar can leave selection mode like after the other actions. */
  onDone: () => void;
}

/**
 * Label button of the multi-select bar (same look as the M1 buttons): pick labels, then add them to / remove them
 * from every selected task with ONE tasks/batch request. A retry after an error reuses the Idempotency-Key.
 */
export function SelectionLabelsAction({ taskIds, onDone }: SelectionLabelsActionProps) {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const online = useIsOnline();
  const [open, setOpen] = useState(false);
  const batch = useBatchLabels();
  const keys = useIdempotencyKeys();
  const inactive = taskIds.length === 0 || !online;

  function apply(action: AddOrRemoveLabelsAction, labelIds: string[]) {
    const payload = { action, taskIds: [...taskIds], labelIds };
    batch.mutate(
      { ...payload, idempotencyKey: keys.keyFor(payload) },
      {
        onSuccess: () => {
          keys.reset();
          setOpen(false);
          onDone();
        },
      },
    );
  }

  return (
    <>
      <Pressable
        testID="selection-labels"
        accessibilityRole="button"
        accessibilityLabel={t('labels.batch.open')}
        accessibilityState={{ disabled: inactive }}
        disabled={inactive}
        onPress={() => {
          batch.reset();
          setOpen(true);
        }}
        style={[styles.action, inactive && styles.inactive]}
      >
        <Feather name="tag" size={size.icon} color={palette.ink2} />
        <Text style={[type.caption, { color: palette.ink2 }]}>{t('labels.batch.open')}</Text>
      </Pressable>
      <LabelPickerSheet
        visible={open}
        initialIds={[]}
        onClose={() => setOpen(false)}
        busy={batch.isPending}
        error={batch.error ? describeError(batch.error).message : undefined}
        testID="selection-label-picker"
        actions={[
          {
            key: 'add',
            label: t('labels.batch.add'),
            onPress: (labelIds) => apply('ADD_LABELS', labelIds),
            requiresSelection: true,
            requiresOnline: true,
          },
          {
            key: 'remove',
            label: t('labels.batch.remove'),
            variant: 'outline',
            onPress: (labelIds) => apply('REMOVE_LABELS', labelIds),
            requiresSelection: true,
            requiresOnline: true,
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  /** Same box as the M1 buttons of SelectionBar. */
  action: { alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: size.touch, minHeight: size.tabItem },
  inactive: { opacity: 0.4 },
});
