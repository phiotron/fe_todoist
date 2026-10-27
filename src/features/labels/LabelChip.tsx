import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '../../components/Chip';
import { labelSummary, orderedLabels, sameLabelIds } from './labelDisplay';
import { LabelPickerSheet } from './LabelPickerSheet';
import { useLabelMap } from './useLabels';

interface LabelChipProps {
  labelIds: readonly string[];
  /** Called once, on Done, only when the set changed. */
  onChange: (labelIds: string[]) => void;
  disabled?: boolean;
  /** 36 high like the other chips of the task sheet / Quick Add sheet. */
  large?: boolean;
  testID?: string;
}

/** "Labels" chip of the task sheet and Quick Add (M-TaskDetail / M-AddTask chip row). */
export function LabelChip({ labelIds, onChange, disabled = false, large = false, testID = 'label-chip' }: LabelChipProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const labels = useLabelMap(labelIds.length > 0 || open);
  const chosen = orderedLabels(labelIds, labels);
  return (
    <>
      <Chip
        icon="tag"
        label={chosen.length > 0 ? labelSummary(chosen) : t('labels.chip.empty')}
        selected={chosen.length > 0}
        large={large}
        disabled={disabled}
        onPress={() => setOpen(true)}
        testID={testID}
      />
      <LabelPickerSheet
        visible={open}
        initialIds={labelIds}
        onClose={() => setOpen(false)}
        testID={`${testID}-picker`}
        actions={[
          {
            key: 'done',
            label: t('labels.picker.done'),
            onPress: (ids) => {
              setOpen(false);
              if (!sameLabelIds(ids, labelIds)) onChange(ids);
            },
          },
        ]}
      />
    </>
  );
}
