import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { TeamProjectResponse } from '../../api/workspaces';
import { AppButton } from '../../components/AppButton';
import { Chip } from '../../components/Chip';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DialogFrame } from '../../components/DialogFrame';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ListRow } from '../../components/ListRow';
import { QueryStateView } from '../../components/QueryStateView';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionHeader } from '../../components/SectionHeader';
import { Segmented } from '../../components/Segmented';
import { StateView } from '../../components/StateView';
import { TextField } from '../../components/TextField';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { projectColorHex, projectDisplayName } from '../projects/appearance';
import { useProjects } from '../projects/useProjects';
import { sharingOf } from '../sharing/sharingRules';
import { useJoinProject } from '../sharing/useSharing';
import {
  TEAM_TABS,
  canBrowseTeam,
  canCreateInTeam,
  filterTeamProjects,
  groupByFolder,
  type TeamTab,
} from './teamRules';
import { useCreateFolder, useDeleteFolder, useTeamFolders, useTeamProjects, useWorkspaces } from './useTeam';

/**
 * Team tab (spec 3.2 M8a): Team Discovery with Active / Joined / "Projects I haven't joined", folders as headings, the
 * People button and "New team project". A guest has no Discovery: they see only the projects they were invited to.
 * No realtime: the list reloads when the tab opens and on pull to refresh.
 */
export function TeamScreen({ initialWorkspaceId }: { initialWorkspaceId?: string }) {
  const styles = useThemedStyles(createTeamStyles);
  const { t } = useTranslation();
  const { query: workspaces, teams } = useWorkspaces();
  const [chosen, setChosen] = useState<string | undefined>(initialWorkspaceId);
  const workspace = teams.find((team) => team.id === chosen) ?? teams[0];

  if (workspaces.isPending || workspaces.isError) {
    return (
      <View testID="team-screen" style={styles.fill}>
        <ScreenHeader compact title={t('team.title')} />
        <QueryStateView query={workspaces} testID="team-state" />
      </View>
    );
  }
  if (!workspace) {
    return (
      <View testID="team-screen" style={styles.fill}>
        <ScreenHeader compact title={t('team.title')} />
        <StateView tone="ok" icon="users" title={t('team.empty.active')} testID="team-none" />
      </View>
    );
  }
  return (
    <View testID="team-screen" style={styles.fill}>
      <ScreenHeader
        compact
        title={workspace.name}
        subtitle={t('team.members', { n: workspace.memberCount })}
        right={
          canBrowseTeam(workspace.role) ? (
            <IconButton icon="users" label={t('team.people')} testID="team-people" onPress={() => router.push({ pathname: '/team-people/[id]', params: { id: workspace.id } })} />
          ) : undefined
        }
      />
      {teams.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcher}>
          {teams.map((team) => (
            <Chip key={team.id} label={team.name} selected={team.id === workspace.id} onPress={() => setChosen(team.id)} testID={`team-switch-${team.id}`} />
          ))}
        </ScrollView>
      ) : null}
      {canBrowseTeam(workspace.role) ? (
        <Discovery key={workspace.id} workspaceId={workspace.id} canCreate={canCreateInTeam(workspace.role)} />
      ) : (
        <GuestProjects workspaceId={workspace.id} />
      )}
    </View>
  );
}

function Discovery({ workspaceId, canCreate }: { workspaceId: string; canCreate: boolean }) {
  const styles = useThemedStyles(createTeamStyles);
  const { t } = useTranslation();
  const [tab, setTab] = useState<TeamTab>('active');
  const projects = useTeamProjects(workspaceId);
  const folders = useTeamFolders(workspaceId);
  const join = useJoinProject();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState<string>();
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const groups = useMemo(
    () => groupByFolder(filterTeamProjects(projects.data ?? [], tab), folders.data ?? []),
    [projects.data, folders.data, tab],
  );

  async function addFolder() {
    const name = folderName.trim();
    if (!name) {
      setFolderError(t('team.folderNameRequired'));
      return;
    }
    try {
      await createFolder.mutateAsync({ workspaceId, name });
      setFolderDialog(false);
      setFolderName('');
      setFolderError(undefined);
    } catch (failure) {
      setFolderError(describeError(failure).message);
    }
  }

  if (projects.isPending || projects.isError) return <QueryStateView query={projects} testID="team-projects-state" />;

  return (
    <>
      <View style={styles.tabs}>
        <Segmented
          testID="team-tabs"
          value={tab}
          onChange={setTab}
          options={TEAM_TABS.map((key) => ({ key, label: t(`team.tabs.${key}`) }))}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={projects.isRefetching} onRefresh={() => void Promise.all([projects.refetch(), folders.refetch()])} />}
      >
        {canCreate ? (
          <View style={styles.actions}>
            <AppButton size="sm" variant="outline" icon="plus" label={t('team.newProject')} requiresOnline testID="team-new-project" onPress={() => router.push({ pathname: '/project-form', params: { workspaceId } })} />
            <AppButton size="sm" variant="ghost" icon="folder-plus" label={t('team.newFolder')} requiresOnline testID="team-new-folder" onPress={() => setFolderDialog(true)} />
          </View>
        ) : null}
        {groups.length === 0 ? (
          <StateView tone="ok" icon="folder" title={t(`team.empty.${tab}`)} testID="team-empty" />
        ) : (
          groups.map((group) => (
            <View key={group.folder?.id ?? 'none'} testID={`team-group-${group.folder?.id ?? 'none'}`}>
              {group.folder ? (
                <SectionHeader
                  title={group.folder.name}
                  count={group.projects.length}
                  right={
                    canCreate ? (
                      <IconButton icon="trash-2" label={t('team.deleteFolder', { name: group.folder.name })} requiresOnline testID={`team-folder-delete-${group.folder.id}`} onPress={() => { deleteFolder.reset(); setDeleting({ id: group.folder!.id, name: group.folder!.name }); }} />
                    ) : undefined
                  }
                />
              ) : folders.data && folders.data.length > 0 ? (
                <SectionHeader title={t('team.noFolder')} count={group.projects.length} />
              ) : null}
              {group.projects.map((project) => (
                <TeamProjectRow key={project.id} project={project} onJoin={() => join.mutate(project.id)} joining={join.isPending && join.variables === project.id} />
              ))}
            </View>
          ))
        )}
        <ErrorText message={join.error ? describeError(join.error).message : undefined} testID="team-error" />
      </ScrollView>
      <DialogFrame visible={folderDialog} title={t('team.newFolder')} onRequestClose={() => setFolderDialog(false)} testID="team-folder-dialog">
        <TextField testID="team-folder-name" label={t('team.folderName')} value={folderName} onChangeText={(value) => { setFolderName(value); setFolderError(undefined); }} error={folderError} autoFocus />
        <AppButton label={t('team.folderCreate')} full requiresOnline busy={createFolder.isPending} onPress={() => void addFolder()} testID="team-folder-submit" />
      </DialogFrame>
      <ConfirmDialog
        visible={deleting !== null}
        title={t('team.deleteFolderTitle', { name: deleting?.name ?? '' })}
        message={t('team.deleteFolderMessage')}
        confirmLabel={t('common.delete')}
        destructive
        busy={deleteFolder.isPending}
        error={deleteFolder.error ? describeError(deleteFolder.error).message : undefined}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteFolder.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        testID="team-folder-delete-dialog"
      />
    </>
  );
}

function TeamProjectRow({ project, onJoin, joining }: { project: TeamProjectResponse; onJoin: () => void; joining: boolean }) {
  const styles = useThemedStyles(createTeamStyles);
  const { t } = useTranslation();
  return (
    <View testID={`team-project-${project.id}`} style={styles.projectRow}>
      <View style={styles.projectMain}>
        <ListRow
          testID={`team-open-${project.id}`}
          title={project.name}
          icon="hash"
          iconColor={projectColorHex(project.color)}
          chevron
          onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}
        />
        <Text style={[type.meta, styles.projectMeta]}>
          {t('team.members', { n: project.memberCount })} · {t('team.tasks', { n: project.activeTaskCount })}
          {project.access === 'RESTRICTED' ? ` · ${t('team.restricted')}` : ''}
        </Text>
      </View>
      {!project.joined ? (
        <AppButton size="sm" label={t('team.join')} requiresOnline busy={joining} onPress={onJoin} testID={`team-join-${project.id}`} />
      ) : null}
    </View>
  );
}

/** A guest of the team: only the projects they were invited to (from the projects list, no Discovery). */
function GuestProjects({ workspaceId }: { workspaceId: string }) {
  const styles = useThemedStyles(createTeamStyles);
  const { t } = useTranslation();
  const { all, query } = useProjects();
  const mine = all.filter((project) => (project as { workspaceId?: string }).workspaceId === workspaceId && sharingOf(project).isTeamProject);
  if (query.isPending || query.isError) return <QueryStateView query={query} testID="team-guest-state" />;
  if (mine.length === 0) return <StateView tone="ok" icon="folder" title={t('team.empty.joined')} testID="team-empty" />;
  return (
    <ScrollView contentContainerStyle={styles.content} testID="team-guest-list">
      {mine.map((project) => (
        <ListRow key={project.id} testID={`team-project-${project.id}`} title={projectDisplayName(project)} icon="hash" chevron onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })} />
      ))}
    </ScrollView>
  );
}

function createTeamStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    switcher: { paddingHorizontal: gutter, gap: 8, paddingBottom: 8 },
    tabs: { paddingHorizontal: gutter, paddingBottom: 8 },
    content: { paddingHorizontal: gutter, paddingBottom: 120 },
    actions: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
    projectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    projectMain: { flex: 1 },
    projectMeta: { color: palette.mute, marginTop: -8, marginBottom: 8, paddingLeft: 36 },
  });
}
