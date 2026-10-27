import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { palette, size, type } from '../../theme';
import { useSections } from '../sections/useSections';
import { projectDisplayName } from './appearance';
import { ProjectIcon } from './ProjectIcon';
import { projectTreeRows } from './projectTree';
import { useProjects } from './useProjects';

export interface ProjectSectionValue {
  /** undefined = the Inbox (not known yet). */
  projectId: string | undefined;
  sectionId: string | null;
}

interface ProjectSectionPickerProps {
  visible: boolean;
  value: ProjectSectionValue;
  onSelect: (value: { projectId: string; sectionId: string | null }) => void;
  onClose: () => void;
  /** false = projects only (sub-task parent's project, project filters). */
  withSections?: boolean;
  title?: string;
  testID?: string;
}

/** Inbox first, then the project tree; choosing a project shows its active sections ("no section" first). */
export function ProjectSectionPicker({
  visible,
  value,
  onSelect,
  onClose,
  withSections = true,
  title,
  testID = 'project-picker',
}: ProjectSectionPickerProps) {
  const { t } = useTranslation();
  const { all, inbox } = useProjects();
  const [chosen, setChosen] = useState<string | null>(null);
  const { query: sectionsQuery, sections } = useSections(chosen ?? undefined);
  const currentProject = value.projectId ?? inbox?.id;

  useEffect(() => {
    if (visible) setChosen(null);
  }, [visible]);

  function choose(projectId: string, sectionId: string | null) {
    setChosen(null);
    onSelect({ projectId, sectionId });
    onClose();
  }

  const rows = [
    ...(inbox ? [{ project: inbox, depth: 1 }] : []),
    ...projectTreeRows(all).map((row) => ({ project: row.project, depth: row.depth })),
  ];
  const chosenProject = all.find((project) => project.id === chosen);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title ?? t('schedule.picker.title')} testID={testID}>
      {chosenProject ? (
        <View>
          <Pressable
            testID={`${testID}-back`}
            accessibilityRole="button"
            accessibilityLabel={t('schedule.picker.back')}
            onPress={() => setChosen(null)}
            style={styles.row}
          >
            <Feather name="chevron-left" size={size.icon} color={palette.ink2} />
            <ProjectIcon project={chosenProject} />
            <Text style={[type.bodyStrong, styles.label]}>{projectDisplayName(chosenProject)}</Text>
          </Pressable>
          <Pressable
            testID={`${testID}-section-none`}
            accessibilityRole="button"
            onPress={() => choose(chosenProject.id, null)}
            style={[styles.row, styles.indented]}
          >
            <Text style={[type.body, styles.label]}>{t('schedule.picker.noSection')}</Text>
          </Pressable>
          {sectionsQuery.isPending ? <ActivityIndicator color={palette.acc} /> : null}
          {sections.map((section) => (
            <Pressable
              key={section.id}
              testID={`${testID}-section-${section.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: section.id === value.sectionId }}
              onPress={() => choose(chosenProject.id, section.id)}
              style={[styles.row, styles.indented]}
            >
              <Text style={[type.body, styles.label]}>{section.name}</Text>
              {section.id === value.sectionId ? <Feather name="check" size={size.iconSmall} color={palette.acc} /> : null}
            </Pressable>
          ))}
        </View>
      ) : (
        rows.map(({ project, depth }) => (
          <Pressable
            key={project.id}
            testID={`${testID}-project-${project.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: project.id === currentProject }}
            onPress={() => (withSections ? setChosen(project.id) : choose(project.id, null))}
            style={[styles.row, { paddingLeft: (depth - 1) * 20 }]}
          >
            <ProjectIcon project={project} />
            <Text style={[type.body, styles.label]} numberOfLines={1}>
              {projectDisplayName(project)}
            </Text>
            {project.id === currentProject ? <Feather name="check" size={size.iconSmall} color={palette.acc} /> : null}
            {withSections ? <Feather name="chevron-right" size={size.iconSmall} color={palette.mute} /> : null}
          </Pressable>
        ))
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: size.menuRow,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  indented: { paddingLeft: 32 },
  label: { flex: 1, color: palette.ink },
});
