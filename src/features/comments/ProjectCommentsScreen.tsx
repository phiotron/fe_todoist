import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { isNotFound } from '../../api/describeError';
import { KeyboardScreen } from '../../components/KeyboardScreen';
import { NotFoundView } from '../../components/NotFoundView';
import { SubHeader } from '../../components/SubHeader';
import { gutter, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { isProjectReadOnly } from '../projects/projectReadOnly';
import { useProject } from '../projects/useProjects';
import { CommentThread } from './CommentThread';

/** Comments of a project (menu ⋯ of the project / Inbox → Comment). Archived project: readable, no composer. */
export function ProjectCommentsScreen({ projectId }: { projectId: string }) {
  const styles = useThemedStyles(createProjectCommentsStyles);
  const { t } = useTranslation();
  const project = useProject(projectId);
  if (project.isError && isNotFound(project.error)) {
    return <NotFoundView onBack={() => router.back()} testID="project-comments-not-found" />;
  }
  return (
    <View testID="project-comments-screen" style={styles.fill}>
      <SubHeader title={t('comments.projectTitle')} onBack={() => router.back()} testID="project-comments-header" />
      <KeyboardScreen contentStyle={styles.content}>
        <CommentThread target={{ kind: 'project', id: projectId }} readOnly={isProjectReadOnly(project.data)} />
      </KeyboardScreen>
    </View>
  );
}

function createProjectCommentsStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 48 },
  });
}
