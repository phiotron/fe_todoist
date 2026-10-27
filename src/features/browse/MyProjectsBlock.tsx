import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { ActionMenu } from '../../components/ActionMenu';
import { IconButton } from '../../components/IconButton';
import { ReorderModal } from '../../components/ReorderModal';
import { gutter, palette, type } from '../../theme';
import { projectDisplayName } from '../projects/appearance';
import { projectTreeRows } from '../projects/projectTree';
import { useProjects, useReorderProject } from '../projects/useProjects';
import { BrowseProjectRow } from './BrowseProjectRow';

/** "Dự án của tôi": the project tree (collapsible), + creates a project, ⋯ → archived projects / sort. */
export function MyProjectsBlock() {
  const { t } = useTranslation();
  const { all } = useProjects();
  const reorder = useReorderProject();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const rows = useMemo(() => projectTreeRows(all, collapsed), [all, collapsed]);
  // Spec 12.4: one container at a time — here the root projects; sub-projects are sorted from their parent's menu.
  const roots = useMemo(() => projectTreeRows(all).filter((row) => row.depth === 1), [all]);

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <View>
      <View style={styles.header}>
        <Text style={[type.section, styles.title]} accessibilityRole="header">
          {t('browse.myProjects')}
        </Text>
        <IconButton icon="plus" label={t('browse.addProject')} requiresOnline onPress={() => router.push('/project-form')} testID="browse-add-project" />
        <IconButton icon="more-horizontal" label={t('browse.projectsMenu')} onPress={() => setMenuOpen(true)} testID="browse-projects-menu-open" />
      </View>
      {rows.length === 0 ? <Text style={styles.empty}>{t('browse.noProjects')}</Text> : null}
      {rows.map(({ project, depth, hasChildren }) => (
        <BrowseProjectRow
          key={project.id}
          project={project}
          depth={depth}
          hasChildren={hasChildren}
          collapsed={collapsed.has(project.id)}
          onToggleCollapse={() => toggle(project.id)}
          idPrefix="browse-project"
        />
      ))}
      <ActionMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        testID="browse-projects-menu"
        items={[
          { key: 'archived', label: t('browse.archivedProjects'), icon: 'archive', onPress: () => router.push('/projects/archived') },
          {
            key: 'reorder',
            label: t('browse.reorderProjects'),
            icon: 'move',
            disabled: roots.length < 2,
            requiresOnline: true,
            onPress: () => {
              reorder.reset();
              setReorderOpen(true);
            },
          },
        ]}
      />
      <ReorderModal
        visible={reorderOpen}
        title={t('browse.reorderTitle')}
        items={roots.map((row) => ({ id: row.project.id, label: projectDisplayName(row.project) }))}
        onMove={(id, afterId) => reorder.mutate({ id, afterId })}
        onClose={() => setReorderOpen(false)}
        error={reorder.error ? describeError(reorder.error).message : undefined}
        testID="browse-reorder"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: gutter, paddingRight: 8, paddingTop: 12 },
  title: { flex: 1, color: palette.ink },
  empty: { ...type.body, color: palette.mute, paddingHorizontal: gutter, paddingVertical: 12 },
});
