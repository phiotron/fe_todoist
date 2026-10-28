import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '../../components/Chip';
import { DEFAULT_TIME_ZONE, draftId } from '../../lib/reminders';
import { ReminderEditorModal } from './ReminderEditorModal';
import { reminderChipLabel, reminderLabel } from './reminderLabel';
import type { QuickAddReminders } from './useQuickAddReminders';
import { useReminderFormats } from './useReminderFormats';

interface QuickAddReminderChipProps {
  reminders: QuickAddReminders;
  hasTime: boolean;
  /** Account time zone (the sheet already has it). */
  timeZone?: string;
  /** M6b Quick Add "Show action labels" off: icon only while there is no reminder. */
  iconOnly?: boolean;
}

/** "Reminders" chip of Quick Add (spec 9.2, design M-AddTask chip row): edits drafts created after the task. */
export function QuickAddReminderChip({
  reminders,
  hasTime,
  timeZone = DEFAULT_TIME_ZONE,
  iconOnly = false,
}: QuickAddReminderChipProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const formats = useReminderFormats();

  const items = reminders.drafts.map((draft) => ({ id: draftId(draft), label: reminderLabel(draft, t, formats) }));
  const label = reminderChipLabel(items.map((item) => item.label), t);

  return (
    <>
      <Chip
        large
        testID="quick-add-reminder-chip"
        icon="bell"
        label={label}
        onPress={() => setOpen(true)}
        iconOnly={iconOnly && items.length === 0}
      />
      <ReminderEditorModal
        visible={open}
        onClose={() => setOpen(false)}
        items={items}
        onAdd={reminders.add}
        onRemove={reminders.remove}
        hasTime={hasTime}
        timeZone={timeZone}
        timeFormat={formats.timeFormat}
      />
    </>
  );
}
