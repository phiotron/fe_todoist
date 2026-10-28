import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../api/describeError';
import type { Project } from '../../api/models';
import type { ActionMenuItem } from '../../components/ActionMenu';
import { useSnackbar } from '../../components/Snackbar';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { TemplateNameDialog } from './TemplateNameDialog';
import { TemplatePickerSheet } from './TemplatePickerSheet';
import { useDuplicateProject, useSaveTemplate } from './useTemplates';

/**
 * M11 entries of the project ⋯ menu (Todoist: Duplicate · Save as template · Apply a template) and their dialogs.
 * Not for the Inbox (Todoist has none of them there) nor for an archived (read-only) project.
 */
export function useProjectTemplateMenu(project: Project, readOnly: boolean): { items: ActionMenuItem[]; dialogs: ReactNode } {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const duplicate = useDuplicateProject();
  const save = useSaveTemplate();
  const duplicateKeys = useIdempotencyKeys();
  const saveKeys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();
  const [saveOpen, setSaveOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  function duplicateProject() {
    void run(async () => {
      try {
        const copy = await duplicate.mutateAsync({
          projectId: project.id,
          idempotencyKey: duplicateKeys.keyFor({ duplicate: project.id }),
        });
        duplicateKeys.reset();
        snackbar.show({ message: t('templates.duplicated.project', { name: copy.name }) });
        router.push(`/project/${copy.id}`);
      } catch (failure) {
        snackbar.show({ message: describeError(failure).message, tone: 'error' });
      }
    });
  }

  function saveAsTemplate(name: string) {
    void run(async () => {
      try {
        const body = { projectId: project.id, name };
        const template = await save.mutateAsync({ body, idempotencyKey: saveKeys.keyFor(body) });
        saveKeys.reset();
        setSaveOpen(false);
        snackbar.show({ message: t('templates.save.saved', { name: template.name }) });
      } catch {
        // The dialog shows save.error and stays open.
      }
    });
  }

  if (project.isInbox || readOnly) return { items: [], dialogs: null };

  const items: ActionMenuItem[] = [
    { key: 'duplicate', label: t('templates.menu.duplicate'), icon: 'copy', requiresOnline: true, disabled: busy, onPress: duplicateProject },
    {
      key: 'save-template',
      label: t('templates.menu.saveAsTemplate'),
      icon: 'bookmark',
      requiresOnline: true,
      onPress: () => {
        save.reset();
        setSaveOpen(true);
      },
    },
    { key: 'apply-template', label: t('templates.menu.applyTemplate'), icon: 'layers', requiresOnline: true, onPress: () => setPickerOpen(true) },
  ];

  const dialogs = (
    <>
      <TemplateNameDialog
        visible={saveOpen}
        title={t('templates.save.title')}
        label={t('templates.save.name')}
        submitLabel={t('templates.save.submit')}
        initialName={project.name}
        hint={t('templates.save.hint')}
        requiredMessage={t('templates.save.nameRequired')}
        tooLongMessage={t('templates.save.nameTooLong')}
        busy={busy}
        error={save.error ? describeError(save.error).message : undefined}
        onSubmit={saveAsTemplate}
        onClose={() => setSaveOpen(false)}
        testID="save-template"
      />
      <TemplatePickerSheet visible={pickerOpen} projectId={project.id} onClose={() => setPickerOpen(false)} />
    </>
  );
  return { items, dialogs };
}
