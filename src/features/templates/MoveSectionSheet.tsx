import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Section } from '../../api/models';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorText } from '../../components/ErrorText';
import { useSnackbar } from '../../components/Snackbar';
import { useIsOnline } from '../../lib/useIsOnline';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { size, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { projectDisplayName } from '../projects/appearance';
import { ProjectIcon } from '../projects/ProjectIcon';
import { projectTreeRows } from '../projects/projectTree';
import { useProjects } from '../projects/useProjects';
import { useMoveSection } from './useTemplates';

interface MoveSectionSheetProps {
  projectId: string;
  /** The section to move; null = closed. */
  section: Section | null;
  onClose: () => void;
}

/** Move section (M11 F3): Inbox then the project tree (the current project left out); the section goes to the end. */
export function MoveSectionSheet(props: MoveSectionSheetProps) {
  // Mounted only while open: the project list is not loaded for every project screen.
  return props.section ? <MoveSectionSheetBody {...props} /> : null;
}

function MoveSectionSheetBody({ projectId, section, onClose }: MoveSectionSheetProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const online = useIsOnline();
  const snackbar = useSnackbar();
  const { all, inbox } = useProjects();
  const move = useMoveSection(projectId);
  const { run, busy } = useSingleFlight();

  const rows = [
    ...(inbox ? [{ project: inbox, depth: 1 }] : []),
    ...projectTreeRows(all).map((row) => ({ project: row.project, depth: row.depth })),
  ].filter((row) => row.project.id !== projectId);

  function close() {
    move.reset();
    onClose();
  }

  function choose(targetId: string, targetName: string) {
    if (!section) return;
    void run(async () => {
      try {
        await move.mutateAsync({ sectionId: section.id, body: { projectId: targetId } });
        close();
        snackbar.show({ message: t('templates.moveSection.moved', { name: targetName }) });
      } catch {
        // move.error is shown in the sheet.
      }
    });
  }

  const inactive = busy || !online;
  return (
    <BottomSheet visible={section !== null} onClose={close} title={t('templates.moveSection.title')} testID="move-section">
      <ErrorText message={move.error ? describeError(move.error).message : undefined} testID="move-section-error" />
      {rows.map(({ project, depth }) => (
        <Pressable
          key={project.id}
          testID={`move-section-project-${project.id}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: inactive }}
          disabled={inactive}
          onPress={() => choose(project.id, projectDisplayName(project))}
          style={[styles.row, { paddingLeft: (depth - 1) * 20 }, inactive && styles.inactive]}
        >
          <ProjectIcon project={project} />
          <Text style={[type.body, styles.label]} numberOfLines={1}>
            {projectDisplayName(project)}
          </Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: size.menuRow,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    label: { flex: 1, color: palette.ink },
    inactive: { opacity: 0.4 },
  });
}
