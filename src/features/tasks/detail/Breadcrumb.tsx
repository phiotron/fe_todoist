import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { Task } from '../../../api/models';
import { palette, type } from '../../../theme';
import { projectDisplayName } from '../../projects/appearance';
import { ProjectIcon } from '../../projects/ProjectIcon';
import { useProjects } from '../../projects/useProjects';
import { useSections } from '../../sections/useSections';

/** Top bar of M-TaskDetail: "# Project / Section" (tap = move the task, Task 27). */
export function Breadcrumb({ task, onPress }: { task: Pick<Task, 'projectId' | 'sectionId' | 'projectName'>; onPress?: () => void }) {
  const { t } = useTranslation();
  const { byId } = useProjects();
  const project = byId.get(task.projectId);
  const { sections } = useSections(task.sectionId ? task.projectId : undefined);
  const sectionName = sections.find((section) => section.id === task.sectionId)?.name;
  const projectName = project ? projectDisplayName(project) : task.projectName;
  const place = sectionName ? `${projectName} / ${sectionName}` : projectName;
  return (
    <Pressable
      testID="task-breadcrumb"
      accessibilityRole="button"
      accessibilityLabel={t('taskDetail.breadcrumb', { place })}
      disabled={!onPress}
      onPress={onPress}
      style={styles.row}
    >
      {project ? <ProjectIcon project={project} size={16} /> : null}
      <Text style={styles.text} numberOfLines={1}>
        {place}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  text: { ...type.meta, color: palette.mute, flexShrink: 1 },
});
