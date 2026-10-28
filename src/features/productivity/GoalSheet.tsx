import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../components/BottomSheet';
import { ChoiceList } from '../settings/ui';

interface GoalSheetProps {
  visible: boolean;
  title: string;
  choices: readonly number[];
  value: number;
  onSelect: (goal: number) => void;
  onClose: () => void;
  testID?: string;
}

/** "Edit goal": one radio row per goal ("5 tasks"); choosing one closes the sheet and reports it. */
export function GoalSheet({ visible, title, choices, value, onSelect, onClose, testID = 'goal-sheet' }: GoalSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} testID={testID}>
      <ChoiceList
        testIDPrefix={`${testID}-option`}
        choices={choices.map((goal) => ({ value: String(goal), label: t('productivity.goal.tasks', { n: goal }) }))}
        selected={String(value)}
        onSelect={(goal) => {
          onClose();
          onSelect(Number(goal));
        }}
      />
    </BottomSheet>
  );
}
