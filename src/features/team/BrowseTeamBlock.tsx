import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { gutter, type, useTheme } from '../../theme';
import { useMyInvitations } from '../sharing/useSharing';
import { CreateTeamDialog } from './CreateTeamDialog';
import { useWorkspaces } from './useTeam';

/**
 * "Teams" block of Browse (spec 3.2 M8a): the teams I belong to, the invitations sent to me, joining with a link or a
 * pasted code, and creating a team. Always shown: it is also how a person without a team gets their first one.
 */
export function BrowseTeamBlock() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { teams } = useWorkspaces();
  const invitations = useMyInvitations();
  const [creating, setCreating] = useState(false);
  const pending = invitations.data?.length ?? 0;
  return (
    <View testID="browse-team-block">
      <Text accessibilityRole="header" style={[type.section, styles.title, { color: palette.ink }]}>
        {t('team.browse.title')}
      </Text>
      <View style={styles.rows}>
        {teams.map((team) => (
          <ListRow
            key={team.id}
            testID={`browse-team-${team.id}`}
            icon="users"
            iconBox
            title={team.name}
            right={t(`team.roles.${team.role}`)}
            chevron
            onPress={() => router.navigate({ pathname: '/team', params: { workspaceId: team.id } })}
          />
        ))}
        <ListRow
          testID="browse-invitations"
          icon="mail"
          iconBox
          title={t('team.browse.invitations')}
          right={pending > 0 ? String(pending) : undefined}
          chevron
          onPress={() => router.push('/invitations')}
        />
        <ListRow testID="browse-join" icon="log-in" iconBox title={t('team.browse.join')} chevron onPress={() => router.push('/join')} />
        <ListRow testID="browse-create-team" icon="plus" iconBox title={t('team.create.entry')} onPress={() => setCreating(true)} />
      </View>
      <CreateTeamDialog visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 4 },
  rows: { paddingHorizontal: gutter },
});
