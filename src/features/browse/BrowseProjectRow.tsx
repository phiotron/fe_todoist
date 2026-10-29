import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { Project } from '../../api/models';
import { useIsOnline } from '../../lib/useIsOnline';
import { gutter, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { projectDisplayName } from '../projects/appearance';
import { ProjectIcon } from '../projects/ProjectIcon';
import { swipeSide } from '../tasks/swipe';

interface BrowseProjectRowProps {
  project: Project;
  /** 1 = root; each level indents by 20. */
  depth?: number;
  /** Shows a collapse arrow (My Projects tree). */
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: (projectId: string) => void;
  /** testID prefix: "browse-project" (tree) or "favorite-project" (Favorites block). */
  idPrefix: string;
  /** Swipe right: the block that owns the list runs ONE favorite mutation for all its rows (a hook per row cost 77 mutations). */
  onToggleFavorite: (project: Project) => void;
}

/** A project line of M-Browse: arrow, "#" icon in the project colour, name, open-task count; swipe right = favorite. */
export const BrowseProjectRow = memo(function BrowseProjectRow({ project, depth = 1, hasChildren = false, collapsed = false, onToggleCollapse, idPrefix, onToggleFavorite }: BrowseProjectRowProps) {
  const styles = useThemedStyles(createBrowseProjectRowStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const online = useIsOnline();
  const swipeRef = useRef<SwipeableMethods>(null);
  const name = projectDisplayName(project);

  const row = (
    <View style={[styles.row, { paddingLeft: gutter + (depth - 1) * 20 }]}>
      {hasChildren ? (
        <Pressable
          testID={`${idPrefix}-toggle-${project.id}`}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? t('common.expand', { name }) : t('common.collapse', { name })}
          accessibilityState={{ expanded: !collapsed }}
          onPress={() => onToggleCollapse?.(project.id)}
          style={styles.arrow}
        >
          <Feather name={collapsed ? 'chevron-right' : 'chevron-down'} size={size.iconSmall} color={palette.ink2} />
        </Pressable>
      ) : (
        <View style={styles.arrowSpace} />
      )}
      <Pressable
        testID={`${idPrefix}-${project.id}`}
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={() => router.push(`/project/${project.id}`)}
        style={styles.main}
      >
        <ProjectIcon project={project} />
        <Text style={[type.body, styles.name]} numberOfLines={1}>
          {name}
        </Text>
        {project.activeTaskCount > 0 ? <Text style={styles.count}>{project.activeTaskCount}</Text> : null}
      </Pressable>
    </View>
  );

  if (!online) return row;
  return (
    <Swipeable
      ref={swipeRef}
      testID={`${idPrefix}-swipe-${project.id}`}
      friction={2}
      leftThreshold={80}
      renderLeftActions={() => (
        <View style={styles.panel} accessibilityLabel={t('browse.toggleFavorite', { name })}>
          <Feather name="heart" size={size.iconLarge} color={palette.onacc} />
        </View>
      )}
      onSwipeableOpen={(direction: string) => {
        swipeRef.current?.close();
        if (swipeSide(direction) === 'right') {
          onToggleFavorite(project);
        }
      }}
    >
      {row}
    </Swipeable>
  );
});

function createBrowseProjectRowStyles(palette: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      paddingRight: gutter,
      backgroundColor: palette.bg,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    arrow: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center', marginLeft: -12 },
    arrowSpace: { width: 32 },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
    name: { flex: 1, color: palette.ink },
    count: { ...type.meta, color: palette.mute },
    panel: { flex: 1, backgroundColor: palette.acc, justifyContent: 'center', paddingHorizontal: 24 },
  });
}
