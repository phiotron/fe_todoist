import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { describeError, isNotFound } from '../../api/describeError';
import type { Section } from '../../api/models';
import { ActionMenu } from '../../components/ActionMenu';
import { AddRow } from '../../components/AddRow';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconButton } from '../../components/IconButton';
import { ReorderModal } from '../../components/ReorderModal';
import { gutter, palette, type } from '../../theme';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { SectionFormDialog } from '../sections/SectionFormDialog';
import {
  useArchiveSection,
  useDeleteSection,
  useReorderSection,
  useSections,
  useUnarchiveSection,
} from '../sections/useSections';
import { nodeRow, sectionRow, type TaskListRow } from '../tasks/taskRows';
import { useReorderTask } from '../tasks/useTaskActions';
import { useTaskList } from '../tasks/useTaskList';
import { groupProjectTasks } from './projectGroups';

type Dialog =
  | { kind: 'none' }
  | { kind: 'form'; section?: Section }
  | { kind: 'menu'; section: Section }
  | { kind: 'archive'; section: Section }
  | { kind: 'delete'; section: Section }
  | { kind: 'reorderSections' }
  | { kind: 'reorderTasks'; sectionId: string | null };

interface Options {
  projectId: string;
  /** Archived project: nothing can change (decision #22). */
  readOnly: boolean;
}

/**
 * Body of a project / Inbox screen (spec 9.2): task rows by section (collapsible), section menu, add rows, archived
 * sections, "Thêm section", and every dialog those need (`dialogs` must be rendered by the screen).
 */
export function useProjectRows({ projectId, readOnly }: Options) {
  const { t } = useTranslation();
  const { query, tasks } = useTaskList({ projectId });
  const { sections, archived } = useSections(projectId);
  const groups = useMemo(() => groupProjectTasks(tasks, sections), [tasks, sections]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const archive = useArchiveSection(projectId);
  const unarchive = useUnarchiveSection(projectId);
  const remove = useDeleteSection(projectId);
  const reorderSection = useReorderSection();
  const reorderTask = useReorderTask();
  const close = () => setDialog({ kind: 'none' });

  function toggle(sectionId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const rows = useMemo(() => {
    const result: TaskListRow[] = [];
    for (const group of groups) {
      const section = group.section;
      const key = section?.id ?? 'none';
      const isCollapsed = section !== null && collapsed.has(section.id);
      if (section) {
        result.push(
          sectionRow(`s-${section.id}`, {
            title: section.name,
            count: section.activeTaskCount,
            collapsed: isCollapsed,
            onToggle: () => toggle(section.id),
            right: readOnly ? undefined : (
              <IconButton
                icon="more-horizontal"
                label={t('projectScreen.section.menu', { name: section.name })}
                onPress={() => setDialog({ kind: 'menu', section })}
                testID={`section-menu-open-${section.id}`}
              />
            ),
          }),
        );
        if (section.description && !isCollapsed) {
          result.push(nodeRow(`sd-${section.id}`, <Text style={styles.description}>{section.description}</Text>));
        }
      }
      if (isCollapsed) continue;
      for (const { task, depth } of group.rows) result.push({ type: 'task', key: task.id, task, depth });
      if (!readOnly) {
        result.push(
          nodeRow(
            `add-${key}`,
            <View style={styles.pad}>
              <AddRow
                label={t('views.addTask')}
                requiresOnline
                onPress={() => openQuickAdd({ projectId, ...(section ? { sectionId: section.id } : {}) })}
                testID={`project-add-${key}`}
              />
            </View>,
          ),
        );
      }
    }
    for (const section of archived) {
      result.push(
        sectionRow(`a-${section.id}`, {
          title: section.name,
          tone: 'muted',
          // Archived project: read-only, a Restore / Delete would answer 409 project-archived.
          right: readOnly ? undefined : (
            <View style={styles.archivedActions}>
              <AppButton
                variant="outline"
                size="sm"
                label={t('projectScreen.section.restore')}
                requiresOnline
                busy={unarchive.isPending && unarchive.variables === section.id}
                onPress={() => unarchive.mutate(section.id)}
                testID={`section-restore-${section.id}`}
              />
              <IconButton
                icon="trash-2"
                label={t('projectScreen.section.delete')}
                color={palette.warn}
                requiresOnline
                onPress={() => setDialog({ kind: 'delete', section })}
                testID={`section-delete-${section.id}`}
              />
            </View>
          ),
        }),
      );
    }
    if (!readOnly) {
      result.push(
        nodeRow(
          'add-section',
          <View style={styles.pad}>
            <AddRow
              accent
              label={t('projectScreen.addSection')}
              requiresOnline
              onPress={() => setDialog({ kind: 'form' })}
              testID="project-add-section"
            />
          </View>,
        ),
      );
    }
    return result;
    // The dialog setters and mutation callbacks are stable enough: rows only call them from event handlers.
  }, [groups, archived, collapsed, readOnly, projectId, t, unarchive.isPending, unarchive.variables]); // eslint-disable-line react-hooks/exhaustive-deps

  const menuSection = dialog.kind === 'menu' ? dialog.section : null;
  const reorderGroup = dialog.kind === 'reorderTasks' ? groups.find((g) => (g.section?.id ?? null) === dialog.sectionId) : undefined;

  const dialogs: ReactNode = (
    <>
      <SectionFormDialog
        visible={dialog.kind === 'form'}
        projectId={projectId}
        section={dialog.kind === 'form' ? dialog.section : undefined}
        onClose={close}
      />
      <ActionMenu
        visible={dialog.kind === 'menu'}
        onClose={close}
        title={menuSection?.name}
        testID="section-menu"
        items={
          menuSection
            ? [
                { key: 'edit', label: t('projectScreen.section.edit'), icon: 'edit-2', requiresOnline: true, onPress: () => setDialog({ kind: 'form', section: menuSection }) },
                {
                  key: 'add-task',
                  label: t('projectScreen.section.addTask'),
                  icon: 'plus',
                  requiresOnline: true,
                  onPress: () => openQuickAdd({ projectId, sectionId: menuSection.id }),
                },
                {
                  key: 'reorder-tasks',
                  label: t('projectScreen.section.reorderTasks'),
                  icon: 'move',
                  requiresOnline: true,
                  disabled: (groups.find((g) => g.section?.id === menuSection.id)?.rootTasks.length ?? 0) < 2,
                  onPress: () => {
                    reorderTask.reset();
                    setDialog({ kind: 'reorderTasks', sectionId: menuSection.id });
                  },
                },
                { key: 'archive', label: t('projectScreen.section.archive'), icon: 'archive', requiresOnline: true, onPress: () => { archive.reset(); setDialog({ kind: 'archive', section: menuSection }); } },
                { key: 'delete', label: t('projectScreen.section.delete'), icon: 'trash-2', destructive: true, requiresOnline: true, onPress: () => { remove.reset(); setDialog({ kind: 'delete', section: menuSection }); } },
              ]
            : []
        }
      />
      <ConfirmDialog
        visible={dialog.kind === 'archive'}
        destructive={false}
        title={dialog.kind === 'archive' ? t('projectScreen.section.archiveTitle', { name: dialog.section.name }) : ''}
        message={dialog.kind === 'archive' ? t('projectScreen.section.archiveMessage', { n: dialog.section.activeTaskCount }) : undefined}
        confirmLabel={t('projectScreen.section.archiveConfirm')}
        busy={archive.isPending}
        error={archive.error ? describeError(archive.error).message : undefined}
        onCancel={close}
        onConfirm={() => {
          if (dialog.kind === 'archive') archive.mutate(dialog.section.id, { onSuccess: close });
        }}
        testID="section-archive-dialog"
      />
      <ConfirmDialog
        visible={dialog.kind === 'delete'}
        title={dialog.kind === 'delete' ? t('projectScreen.section.deleteTitle', { name: dialog.section.name }) : ''}
        message={
          dialog.kind === 'delete'
            ? t('projectScreen.section.deleteMessage', { name: dialog.section.name, n: dialog.section.activeTaskCount })
            : undefined
        }
        confirmLabel={t('common.delete')}
        busy={remove.isPending}
        error={remove.error && !isNotFound(remove.error) ? describeError(remove.error).message : undefined}
        onCancel={close}
        onConfirm={() => {
          // A 404 means it is already gone: treat it as deleted (spec 5.6).
          if (dialog.kind === 'delete') remove.mutate(dialog.section.id, { onSuccess: close, onError: (error) => isNotFound(error) && close() });
        }}
        testID="section-delete-dialog"
      />
      <ReorderModal
        visible={dialog.kind === 'reorderSections'}
        title={t('projectScreen.section.reorderSectionsTitle')}
        items={sections.map((section) => ({ id: section.id, label: section.name }))}
        onMove={(id, afterId) => reorderSection.mutate({ id, afterId })}
        onClose={close}
        error={reorderSection.error ? describeError(reorderSection.error).message : undefined}
        testID="project-reorder-sections"
      />
      <ReorderModal
        visible={dialog.kind === 'reorderTasks'}
        title={t('projectScreen.section.reorderTasksTitle')}
        items={(reorderGroup?.rootTasks ?? []).map((task) => ({ id: task.id, label: task.content }))}
        onMove={(id, afterId) => reorderTask.mutate({ id, afterId })}
        onClose={close}
        error={reorderTask.error ? describeError(reorderTask.error).message : undefined}
        testID="project-reorder-tasks"
      />
    </>
  );

  return {
    rows,
    query,
    groups,
    sections,
    dialogs,
    actions: {
      addSection: () => setDialog({ kind: 'form' }),
      reorderSections: () => {
        reorderSection.reset();
        setDialog({ kind: 'reorderSections' });
      },
      reorderTasks: (sectionId: string | null) => {
        reorderTask.reset();
        setDialog({ kind: 'reorderTasks', sectionId });
      },
    },
  };
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: gutter },
  description: { ...type.meta, color: palette.mute, paddingHorizontal: gutter, paddingTop: 8 },
  archivedActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
