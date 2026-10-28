import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { IconButton } from '../../components/IconButton';
import { ListRow } from '../../components/ListRow';
import { QueryStateView } from '../../components/QueryStateView';
import { ScreenHeader } from '../../components/ScreenHeader';
import { gutter, size, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe } from '../auth/session';
import { NotificationBell } from '../notifications/NotificationBell';
import { useProjects } from '../projects/useProjects';
import { AccountDialog } from './AccountDialog';
import { BROWSE_EXTRA_BLOCKS, BROWSE_SHORTCUTS } from './browseBlocks';
import { FavoritesBlock } from './FavoritesBlock';
import { MyProjectsBlock } from './MyProjectsBlock';

/** Browse (M-Browse): account avatar, shortcuts, Favorites, My Projects tree and the blocks later milestones add. */
export function BrowseScreen() {
  const styles = useThemedStyles(createBrowseScreenStyles);
  const { t } = useTranslation();
  const me = useMe();
  const { query, inbox } = useProjects();
  const [accountOpen, setAccountOpen] = useState(false);
  const showState = (query.isPending || query.isError) && !query.data;

  return (
    <View style={styles.fill}>
      <ScreenHeader
        compact
        title={t('views.browse.title')}
        left={
          <Pressable
            testID="browse-account"
            accessibilityRole="button"
            accessibilityLabel={t('browse.account')}
            onPress={() => setAccountOpen(true)}
            hitSlop={(size.touch - size.avatarL) / 2}
          >
            <Avatar name={me.data?.displayName ?? '?'} seed={me.data?.id ?? 'me'} size="l" uri={me.data?.avatarUrl} />
          </Pressable>
        }
        right={
          <View style={styles.headerActions}>
            <IconButton icon="search" label={t('search.open')} onPress={() => router.push('/search')} testID="browse-search" />
            <NotificationBell />
            <IconButton icon="settings" label={t('settings.title')} testID="browse-settings" onPress={() => router.push('/settings')} />
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {BROWSE_SHORTCUTS.map((shortcut) => (
          <View key={shortcut.key} style={styles.shortcut}>
            <ListRow
              testID={`browse-shortcut-${shortcut.key}`}
              title={shortcut.title()}
              icon={shortcut.icon}
              iconBox
              bold
              chevron={shortcut.chevron}
              right={shortcut.count === 'inbox' && inbox && inbox.activeTaskCount > 0 ? String(inbox.activeTaskCount) : undefined}
              onPress={() => (shortcut.kind === 'tab' ? router.navigate(shortcut.href) : router.push(shortcut.href))}
            />
          </View>
        ))}
        {showState ? (
          <QueryStateView query={query} testID="browse-state" />
        ) : (
          <>
            <FavoritesBlock />
            <MyProjectsBlock />
            {BROWSE_EXTRA_BLOCKS.map((Block, index) => (
              <Block key={index} />
            ))}
          </>
        )}
      </ScrollView>
      <AccountDialog visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}

function createBrowseScreenStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    headerActions: { flexDirection: 'row' },
    content: { paddingBottom: 120 },
    shortcut: { paddingHorizontal: gutter },
  });
}
