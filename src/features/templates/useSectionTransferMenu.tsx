import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../api/describeError';
import type { Section } from '../../api/models';
import type { ActionMenuItem } from '../../components/ActionMenu';
import { useSnackbar } from '../../components/Snackbar';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { MoveSectionSheet } from './MoveSectionSheet';
import { useDuplicateSection } from './useTemplates';

interface Options {
  projectId: string;
  /** Number of active sections: "Reorder" needs at least two. */
  sectionCount: number;
  /** Opens the existing "Reorder sections" dialog (M1). */
  onReorder: () => void;
}

/** M11 entries of the section ⋯ menu (Todoist: Reorder · Move · Duplicate) and the Move sheet. */
export function useSectionTransferMenu({ projectId, sectionCount, onReorder }: Options): {
  itemsFor: (section: Section) => ActionMenuItem[];
  dialogs: ReactNode;
} {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const duplicate = useDuplicateSection(projectId);
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();
  const [moving, setMoving] = useState<Section | null>(null);

  function duplicateSection(section: Section) {
    void run(async () => {
      try {
        await duplicate.mutateAsync({ sectionId: section.id, idempotencyKey: keys.keyFor({ duplicate: section.id }) });
        keys.reset();
        snackbar.show({ message: t('templates.duplicated.section', { name: section.name }) });
      } catch (failure) {
        snackbar.show({ message: describeError(failure).message, tone: 'error' });
      }
    });
  }

  const itemsFor = (section: Section): ActionMenuItem[] => [
    { key: 'reorder', label: t('templates.menu.reorder'), icon: 'move', requiresOnline: true, disabled: sectionCount < 2, onPress: onReorder },
    { key: 'move', label: t('templates.menu.move'), icon: 'log-out', requiresOnline: true, onPress: () => setMoving(section) },
    { key: 'duplicate', label: t('templates.menu.duplicate'), icon: 'copy', requiresOnline: true, disabled: busy, onPress: () => duplicateSection(section) },
  ];

  const dialogs = (
    <MoveSectionSheet projectId={projectId} section={moving} onClose={() => setMoving(null)} />
  );
  return { itemsFor, dialogs };
}
