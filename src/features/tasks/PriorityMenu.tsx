import { useTranslation } from 'react-i18next';
import { Menu } from '../../components/Menu';
import { useTheme } from '../../theme';
import { PRIORITIES, priorityColor } from './priority';

interface PriorityMenuProps {
  visible: boolean;
  value: number;
  onSelect: (priority: number) => void;
  onClose: () => void;
  /** Distance from the bottom edge (above the Quick Add chips by default). */
  bottom?: number;
}

/** M-AddTask priority menu: four flags in the priority colours, the current one checked. */
export function PriorityMenu({ visible, value, onSelect, onClose, bottom }: PriorityMenuProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  return (
    <Menu
      visible={visible}
      onClose={onClose}
      bottom={bottom}
      testID="priority-menu"
      items={PRIORITIES.map((priority) => ({
        key: String(priority),
        label: t('schedule.priority.option', { n: priority }),
        icon: 'flag' as const,
        iconColor: priorityColor(priority, palette),
        selected: priority === value,
      }))}
      onSelect={(key) => onSelect(Number(key))}
    />
  );
}
