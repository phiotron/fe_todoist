import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS, type ProjectColor } from '../../api/models';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { KeyboardScreen } from '../../components/KeyboardScreen';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useTopInset } from '../../components/useTopInset';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { LIMITS, checkOptionalText, checkRequiredText } from '../../lib/limits';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { gutter, radius, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import type { ProjectSharingFields } from '../../api/sharing';
import { sharingOf } from '../sharing/sharingRules';
import { ProjectFolderField } from '../team/ProjectFolderField';
import { asProjectColor, projectColorHex, projectDisplayName } from './appearance';
import { projectColorName } from './colorNames';
import { ProjectIcon } from './ProjectIcon';
import { parentChoices, projectTreeRows } from './projectTree';
import { useCreateProject, useMoveProject, useProject, useProjects, useSetProjectFavorite, useUpdateProject } from './useProjects';

interface ProjectFormScreenProps {
  /** Edit this project; create a new one when absent. */
  projectId?: string;
  /** Preselected parent when creating (e.g. "add sub-project"). */
  parentId?: string;
  /** M8a: create the project in this team workspace (no parent, optional Restricted access). */
  workspaceId?: string;
}

/** M-NewProject (without workspace / access / layout, M8 / M7): name, description, 20 colours, parent, favorite. */
export function ProjectFormScreen({ projectId, parentId, workspaceId }: ProjectFormScreenProps) {
  const styles = useThemedStyles(createProjectFormScreenStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const top = useTopInset();
  const editing = projectId !== undefined;
  const existing = useProject(projectId).data;
  const { all } = useProjects();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ProjectColor>(DEFAULT_PROJECT_COLOR);
  const [parent, setParent] = useState<string | null>(parentId ?? null);
  const [favorite, setFavorite] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [parentOpen, setParentOpen] = useState(false);
  const create = useCreateProject();
  const update = useUpdateProject();
  const move = useMoveProject();
  const setProjectFavorite = useSetProjectFavorite();
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setDescription(existing.description);
    setColor(asProjectColor(existing.color));
    setParent(existing.parentId);
    setFavorite(existing.isFavorite);
    setRestricted((existing as ProjectSharingFields).access === 'RESTRICTED');
    setFolderId((existing as ProjectSharingFields).folderId ?? null);
    // Keyed on the id: a background refetch of the same project must not wipe what the user is typing.
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // M8a: a team project has no parent; its access (Team | Restricted) is set here by whoever manages it.
  const existingSharing = existing ? sharingOf(existing) : undefined;
  const teamMode = workspaceId !== undefined || existingSharing?.isTeamProject === true;
  const canSetAccess = workspaceId !== undefined || existingSharing?.canManage === true;
  const teamWorkspaceId = workspaceId ?? (existing as ProjectSharingFields | undefined)?.workspaceId;
  const choices = parentChoices(all, projectId);
  const parentProject = all.find((project) => project.id === parent);

  async function save() {
    const nameProblem = checkRequiredText(name, LIMITS.projectName);
    if (nameProblem) {
      setNameError(nameProblem === 'required' ? t('projects.form.nameRequired') : t('projects.form.nameTooLong'));
      return;
    }
    if (checkOptionalText(description, LIMITS.description)) {
      setFormError(t('taskList.validation.descriptionTooLong'));
      return;
    }
    await run(async () => {
      try {
        if (editing && existing) {
          const access = teamMode && canSetAccess ? { access: restricted ? 'RESTRICTED' : 'TEAM' } : {};
          // X2: null takes the project out of its folder, absent keeps it (only sent when changed).
          const folder = teamMode && canSetAccess && folderId !== ((existing as ProjectSharingFields).folderId ?? null) ? { folderId } : {};
          await update.mutateAsync({ projectId: existing.id, body: { name: name.trim(), color, description, ...access, ...folder } });
          if (!teamMode && parent !== existing.parentId) await move.mutateAsync({ projectId: existing.id, body: { parentId: parent } });
          if (favorite !== existing.isFavorite) await setProjectFavorite.mutateAsync({ projectId: existing.id, favorite });
        } else {
          const body = {
            name: name.trim(),
            color,
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(parent && !teamMode ? { parentId: parent } : {}),
            ...(workspaceId ? { workspaceId, access: restricted ? 'RESTRICTED' : 'TEAM', ...(folderId ? { folderId } : {}) } : {}),
          };
          // A retry after a later failure replays the same Idempotency-Key: the project is not created twice.
          const created = await create.mutateAsync({ body, idempotencyKey: keys.keyFor(body) });
          if (favorite) await setProjectFavorite.mutateAsync({ projectId: created.id, favorite: true });
        }
        keys.reset();
        router.back();
      } catch (failure) {
        // The screen stays open with everything the user entered (spec 4.1 2 / 5a).
        const view = describeError(failure);
        setNameError(view.fields.name);
        setFormError(view.fields.name ? undefined : view.message);
      }
    });
  }

  return (
    <View style={styles.fill}>
      <View style={[styles.bar, { paddingTop: top }]}>
        <IconButton icon="x" label={t('projects.form.close')} onPress={() => router.back()} testID="project-form-close" />
        <Text style={[type.dialogTitle, styles.barTitle]} accessibilityRole="header">
          {editing ? t('projects.form.editTitle') : t('projects.form.createTitle')}
        </Text>
        <AppButton
          variant="ghost"
          color={palette.acc}
          label={editing ? t('projects.form.save') : t('projects.form.create')}
          onPress={() => void save()}
          busy={busy}
          disabled={editing && !existing}
          requiresOnline
          testID="project-form-submit"
        />
      </View>
      <KeyboardScreen contentStyle={styles.content}>
        <TextField
          testID="project-form-name"
          label={t('projects.form.name')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNameError(undefined);
          }}
          maxCount={LIMITS.projectName}
          error={nameError}
          autoFocus={!editing}
        />
        <TextField
          testID="project-form-description"
          label={t('projects.form.description')}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Text style={styles.label}>{t('projects.form.color')}</Text>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {PROJECT_COLORS.map((option) => {
            const selected = option === color;
            return (
              <Pressable
                key={option}
                testID={`project-color-${option}`}
                accessibilityRole="radio"
                accessibilityLabel={t('projects.form.colorOption', { name: projectColorName(option) })}
                accessibilityState={{ selected }}
                onPress={() => setColor(option)}
                hitSlop={6}
                style={[styles.ring, selected && { borderColor: projectColorHex(option) }]}
              >
                <View style={[styles.swatch, { backgroundColor: projectColorHex(option) }]} />
              </Pressable>
            );
          })}
        </View>
        {teamMode ? null : (
          <>
            <Text style={styles.label}>{t('projects.form.parent')}</Text>
            <Pressable
              testID="project-form-parent"
              accessibilityRole="button"
              accessibilityLabel={t('projects.form.parent')}
              onPress={() => setParentOpen(true)}
              style={styles.parent}
            >
              {parentProject ? <ProjectIcon project={parentProject} /> : <Feather name="corner-left-up" size={size.icon} color={palette.mute} />}
              <Text style={[type.body, styles.parentText]} numberOfLines={1}>
                {parentProject ? projectDisplayName(parentProject) : t('projects.form.noParent')}
              </Text>
              <Feather name="chevron-down" size={size.iconSmall} color={palette.ink2} />
            </Pressable>
          </>
        )}
        {teamMode && canSetAccess ? (
          <View style={styles.favorite}>
            <Text style={[type.body, styles.parentText]}>{t('team.project.restricted')}</Text>
            <Toggle value={restricted} onChange={setRestricted} label={t('team.project.restricted')} testID="project-form-restricted" />
          </View>
        ) : null}
        {teamMode && canSetAccess && teamWorkspaceId ? (
          <ProjectFolderField workspaceId={teamWorkspaceId} value={folderId} onChange={setFolderId} />
        ) : null}
        <View style={styles.favorite}>
          <Text style={[type.body, styles.parentText]}>{t('projects.form.favorite')}</Text>
          <Toggle value={favorite} onChange={setFavorite} label={t('projects.form.favorite')} testID="project-form-favorite" />
        </View>
        <ErrorText message={formError} testID="project-form-error" />
      </KeyboardScreen>
      <BottomSheet visible={parentOpen} onClose={() => setParentOpen(false)} title={t('projects.form.parentTitle')} testID="project-form-parent-sheet">
        <Pressable
          testID="project-form-parent-option-none"
          accessibilityRole="radio"
          accessibilityState={{ selected: parent === null }}
          onPress={() => {
            setParent(null);
            setParentOpen(false);
          }}
          style={styles.option}
        >
          <Text style={[type.body, styles.parentText]}>{t('projects.form.noParent')}</Text>
          {parent === null ? <Feather name="check" size={size.iconSmall} color={palette.acc} /> : null}
        </Pressable>
        {projectTreeRows(choices).map(({ project, depth }) => (
          <Pressable
            key={project.id}
            testID={`project-form-parent-option-${project.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: parent === project.id }}
            onPress={() => {
              setParent(project.id);
              setParentOpen(false);
            }}
            style={[styles.option, { paddingLeft: (depth - 1) * 20 }]}
          >
            <ProjectIcon project={project} />
            <Text style={[type.body, styles.parentText]} numberOfLines={1}>
              {projectDisplayName(project)}
            </Text>
            {parent === project.id ? <Feather name="check" size={size.iconSmall} color={palette.acc} /> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

function createProjectFormScreenStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4 },
    barTitle: { flex: 1, textAlign: 'center', color: palette.ink },
    content: { paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 48 },
    label: { ...type.label, color: palette.ink2, marginTop: 4, marginBottom: 8 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
    ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    swatch: { width: size.swatch, height: size.swatch, borderRadius: size.swatch / 2, borderWidth: 3, borderColor: palette.bg },
    parent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: size.input,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: palette.line2,
      borderRadius: radius.control,
      marginBottom: 8,
    },
    parentText: { flex: 1, color: palette.ink },
    favorite: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: size.listRow },
    option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: size.menuRow, borderBottomWidth: 1, borderBottomColor: palette.line },
  });
}
