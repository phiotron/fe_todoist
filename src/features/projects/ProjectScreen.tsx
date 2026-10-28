import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { describeError, isNotFound } from '../../api/describeError';
import type { Project } from '../../api/models';
import { invalidateData, queryKeys } from '../../api/queryKeys';
import { ActionMenu, type ActionMenuItem } from '../../components/ActionMenu';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { Fab } from '../../components/Fab';
import { IconButton } from '../../components/IconButton';
import { NotFoundView } from '../../components/NotFoundView';
import { QueryStateView } from '../../components/QueryStateView';
import { ReorderModal } from '../../components/ReorderModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SubHeader } from '../../components/SubHeader';
import { gutter, radius, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { DisplaySheet } from '../display/DisplaySheet';
import { BoardView } from '../board/BoardView';
import { projectBoardColumns } from '../board/boardColumns';
import { CalendarView } from '../calendar/CalendarView';
import { calendarFilters, projectScope } from '../calendar/useCalendarTasks';
import { layoutOf, projectViewKey } from '../display/displayRules';
import { useGroupContext } from '../display/useGroupContext';
import { EmailAddressDialog } from '../email/EmailAddressDialog';
import { useViewDisplay, type ViewDisplay } from '../display/useViewDisplay';
import { useAddButtonPlacement } from '../navMenu/useNavigationSettings';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { SelectionScope } from '../tasks/SelectionScope';
import { useTaskSelection } from '../tasks/selection';
import { useProjectTemplateMenu } from '../templates/useProjectTemplateMenu';
import { TaskListView } from '../tasks/TaskListView';
import { nodeRow } from '../tasks/taskRows';
import { projectDisplayName } from './appearance';
import { CompletedTasksBlock } from './CompletedTasksBlock';
import { MAX_PROJECT_DEPTH, deleteImpact, projectDepth, projectTreeRows } from './projectTree';
import { isProjectReadOnly } from './projectReadOnly';
import { useProjectRows } from './useProjectRows';
import {
  useArchiveProject,
  useDeleteProject,
  useProject,
  useProjects,
  useReorderProject,
  useSetProjectFavorite,
  useUnarchiveProject,
} from './useProjects';

interface ProjectScreenProps {
  projectId: string;
  /** The Inbox tab: no back button, no FAB (the tab layout draws the + button). */
  tab?: boolean;
}

function ProjectBody({
  project,
  tab,
  onLeave,
  display,
}: {
  project: Project;
  tab: boolean;
  onLeave: () => void;
  display: ViewDisplay;
}) {
  const styles = useThemedStyles(createProjectScreenStyles);
  const { t } = useTranslation();
  const selection = useTaskSelection();
  const addButtonPlacement = useAddButtonPlacement();
  const readOnly = isProjectReadOnly(project);
  const body = useProjectRows({ projectId: project.id, readOnly, display });
  const { all } = useProjects();
  const favorite = useSetProjectFavorite();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const remove = useDeleteProject();
  const reorderProject = useReorderProject();
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const templateMenu = useProjectTemplateMenu(project, readOnly); // M11: Duplicate � Save as template � Apply a template
  const [emailOpen, setEmailOpen] = useState(false);

  const showCompleted = display.options.showCompleted === true;
  // M7: List / Board / Calendar of this project (saved with the Display).
  const layout = layoutOf(display.options);
  const groupBy = display.options.groupBy;
  const groupContext = useGroupContext(groupBy);
  const boardColumns = useMemo(
    () => projectBoardColumns(body.tasks, body.sections, project.id, groupBy, groupContext, readOnly),
    [body.tasks, body.sections, project.id, groupBy, groupContext, readOnly],
  );
  const calendarScope = useMemo(() => projectScope(project.id), [project.id]);

  // Spec 3.1: the numbers of the delete dialog are the server's (never re-summed from `all`).
  const counts = deleteImpact(project);
  const children = useMemo(() => projectTreeRows(all).filter((row) => row.project.parentId === project.id), [all, project.id]);
  const noSectionRoots = body.groups.find((group) => group.section === null)?.rootTasks.length ?? 0;
  const canAddSubproject = !project.isInbox && !readOnly && projectDepth(all, project.id) < MAX_PROJECT_DEPTH;

  const rows = useMemo(
    () =>
      showCompleted
        ? [...body.rows, nodeRow('completed', <CompletedTasksBlock projectId={project.id} readOnly={readOnly} />)]
        : body.rows,
    [body.rows, showCompleted, project.id, readOnly],
  );

  const items: ActionMenuItem[] = [];
  if (!project.isInbox && !readOnly) {
    items.push({ key: 'edit', label: t('projectScreen.menuEdit'), icon: 'edit-2', requiresOnline: true, onPress: () => router.push({ pathname: '/project-form', params: { projectId: project.id } }) });
    items.push({
      key: 'add-subproject',
      label: t('projectScreen.menuAddSubproject'),
      icon: 'corner-down-right',
      requiresOnline: true,
      disabled: !canAddSubproject,
      onPress: () => router.push({ pathname: '/project-form', params: { parentId: project.id } }),
    });
  }
  if (!readOnly) {
    items.push({ key: 'add-section', label: t('projectScreen.menuAddSection'), icon: 'plus-square', requiresOnline: true, onPress: body.actions.addSection });
  }
  if (!project.isInbox) {
    items.push({
      key: 'favorite',
      label: project.isFavorite ? t('projectScreen.menuUnfavorite') : t('projectScreen.menuFavorite'),
      icon: 'heart',
      requiresOnline: true,
      onPress: () => favorite.mutate({ projectId: project.id, favorite: !project.isFavorite }),
    });
  }
  if (!readOnly) {
    // M13a: Todoist "Email tasks to this project" / "Email tasks to Inbox".
    items.push({
      key: 'email',
      label: project.isInbox ? t('email.menuInbox') : t('email.menuProject'),
      icon: 'mail',
      requiresOnline: true,
      onPress: () => setEmailOpen(true),
    });
  }
  items.push({ key: 'display', label: t('projectScreen.menuDisplay'), icon: 'sliders', onPress: () => setDisplayOpen(true) });
  if (!readOnly) {
    items.push({ key: 'select', label: t('views.selectTasks'), icon: 'check-square', onPress: () => selection?.start() });
    items.push({ key: 'reorder-tasks', label: t('projectScreen.menuReorderTasks'), icon: 'move', requiresOnline: true, disabled: !body.manualOrder || noSectionRoots < 2, onPress: () => body.actions.reorderTasks(null) });
    items.push({ key: 'reorder-sections', label: t('projectScreen.menuReorderSections'), icon: 'move', requiresOnline: true, disabled: body.sections.length < 2, onPress: body.actions.reorderSections });
    if (!project.isInbox) {
      items.push({
        key: 'reorder-subprojects',
        label: t('projectScreen.menuReorderSubprojects'),
        icon: 'move',
        requiresOnline: true,
        disabled: children.length < 2,
        onPress: () => {
          reorderProject.reset();
          setReorderOpen(true);
        },
      });
      items.push(...templateMenu.items);
      // Archive asks nothing: it hides the project (with its sub-projects) and can be undone from Browse.
      items.push({ key: 'archive', label: t('projectScreen.menuArchive'), icon: 'archive', requiresOnline: true, onPress: () => archive.mutate(project.id, { onSuccess: onLeave }) });
    }
  }
  if (!project.isInbox) {
    items.push({ key: 'delete', label: t('projectScreen.menuDelete'), icon: 'trash-2', destructive: true, requiresOnline: true, onPress: () => { remove.reset(); setDeleteOpen(true); } });
  }

  const actionError = [favorite.error, archive.error, unarchive.error].find(Boolean);
  const header = (
    <>
      {readOnly ? (
        <View style={styles.banner} testID="project-archived-banner">
          <Text style={[type.bodySmall, styles.bannerText]}>{t('projectScreen.archivedBanner')}</Text>
          <AppButton
            variant="outline"
            size="sm"
            label={t('projectScreen.restore')}
            requiresOnline
            busy={unarchive.isPending}
            onPress={() => unarchive.mutate(project.id)}
            testID="project-restore"
          />
        </View>
      ) : null}
      {project.description ? <Text style={styles.description}>{project.description}</Text> : null}
      <View style={styles.pad}>
        <ErrorText message={actionError ? describeError(actionError).message : undefined} testID="project-error" />
      </View>
    </>
  );

  return (
    <View style={styles.fill}>
      <ScreenHeader
        title={projectDisplayName(project)}
        subtitle={t('projectScreen.subtitle', { n: project.activeTaskCount })}
        left={tab ? undefined : <IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} testID="project-back" />}
        right={<IconButton icon="more-horizontal" label={t('projectScreen.menu')} onPress={() => setMenuOpen(true)} testID="project-menu-open" />}
      />
      {header}
      {layout === 'BOARD' ? (
        <BoardView
          columns={boardColumns}
          query={body.query}
          readOnly={readOnly}
          testID="project-board"
        />
      ) : layout === 'CALENDAR' ? (
        <CalendarView scope={calendarScope} filters={calendarFilters(display.params)} readOnly={readOnly} testID="project-calendar" />
      ) : (
        <TaskListView rows={rows} query={body.query} readOnly={readOnly} testID="project-list" />
      )}
      {!tab && !readOnly && !selection?.active ? <Fab label={t('views.addTask')} onPress={() => openQuickAdd({ projectId: project.id })} placement={addButtonPlacement} testID="project-fab" /> : null}
      {body.dialogs}
      {templateMenu.dialogs}
      <ActionMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={items} testID="project-menu" />
      <EmailAddressDialog visible={emailOpen} target={{ kind: 'project', id: project.id }} onClose={() => setEmailOpen(false)} testID="project-email" />
      <DisplaySheet visible={displayOpen} viewKey={projectViewKey(project.id)} onClose={() => setDisplayOpen(false)} />
      <ConfirmDialog
        visible={deleteOpen}
        title={t('projectScreen.deleteTitle', { name: project.name })}
        message={
          counts.subprojects > 0
            ? t('projectScreen.deleteMessageWithChildren', { projects: counts.subprojects, tasks: counts.openTasks })
            : t('projectScreen.deleteMessage', { tasks: counts.openTasks })
        }
        confirmLabel={t('common.delete')}
        busy={remove.isPending}
        error={remove.error && !isNotFound(remove.error) ? describeError(remove.error).message : undefined}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate(project.id, { onSuccess: onLeave, onError: (error) => isNotFound(error) && onLeave() })}
        testID="project-delete-dialog"
      />
      <ReorderModal
        visible={reorderOpen}
        title={t('projectScreen.reorderSubprojectsTitle')}
        items={children.map((row) => ({ id: row.project.id, label: projectDisplayName(row.project) }))}
        onMove={(id, afterId) => reorderProject.mutate({ id, afterId })}
        onClose={() => setReorderOpen(false)}
        error={reorderProject.error ? describeError(reorderProject.error).message : undefined}
        testID="project-reorder-subprojects"
      />
    </View>
  );
}

/** Waits for the saved Display, so the open tasks are fetched once with the right parameters (Quyết định 14). */
function ProjectWithDisplay({ project, tab, onLeave }: { project: Project; tab: boolean; onLeave: () => void }) {
  const styles = useThemedStyles(createProjectScreenStyles);
  const { palette } = useTheme();
  const display = useViewDisplay(projectViewKey(project.id));
  if (!display.ready) {
    return <ActivityIndicator testID="project-display-loading" color={palette.acc} style={styles.loading} />;
  }
  return <ProjectBody project={project} tab={tab} onLeave={onLeave} display={display} />;
}

/** Project / Inbox screen (spec 9.2 "Màn dự án / Inbox (List)"): header, menu ⋯, sections, Completed tasks, read-only when archived. */
export function ProjectScreen({ projectId, tab = false }: ProjectScreenProps) {
  const styles = useThemedStyles(createProjectScreenStyles);
  const queryClient = useQueryClient();
  const projectQuery = useProject(projectId);

  function leave() {
    queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });
    void invalidateData(queryClient);
    router.back();
  }

  if (isNotFound(projectQuery.error)) return <NotFoundView onBack={leave} testID="project-not-found" />;
  const project = projectQuery.data;
  if (!project) {
    return (
      <View style={styles.fill}>
        {tab ? null : <SubHeader onBack={() => router.back()} testID="project-loading-header" />}
        <QueryStateView query={projectQuery} testID="project-state" />
      </View>
    );
  }
  return (
    <SelectionScope>
      <ProjectWithDisplay project={project} tab={tab} onLeave={leave} />
    </SelectionScope>
  );
}

function createProjectScreenStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    pad: { paddingHorizontal: gutter },
    loading: { padding: 24 },
    description: { ...type.bodySmall, color: palette.mute, paddingHorizontal: gutter, paddingBottom: 8 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: gutter,
      marginBottom: 8,
      paddingVertical: 8,
      paddingLeft: 12,
      paddingRight: 8,
      borderRadius: radius.control,
      backgroundColor: palette.soft,
    },
    bannerText: { flex: 1, color: palette.acc2 },
  });
}
