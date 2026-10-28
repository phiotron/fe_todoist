import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { WorkspaceRole } from '../../api/sharing';
import type { WorkspaceMemberResponse } from '../../api/workspaces';
import { ActionMenu, type ActionMenuItem } from '../../components/ActionMenu';
import { AppButton } from '../../components/AppButton';
import { Avatar } from '../../components/Avatar';
import { Chip } from '../../components/Chip';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ListRow } from '../../components/ListRow';
import { QueryStateView } from '../../components/QueryStateView';
import { useSnackbar } from '../../components/Snackbar';
import { SubHeader } from '../../components/SubHeader';
import { TextField } from '../../components/TextField';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe } from '../auth/session';
import { isValidInviteEmail } from '../sharing/sharingRules';
import { useRevokeInvitation } from '../sharing/useSharing';
import { ASSIGNABLE_ROLES, canManageTeam } from './teamRules';
import {
  useChangeMemberRole,
  useDisableWorkspaceInviteLink,
  useInviteToWorkspace,
  useLeaveWorkspace,
  useRemoveWorkspaceMember,
  useResetWorkspaceInviteLink,
  useWorkspaceInvitations,
  useWorkspaceInviteLink,
  useWorkspaceMembers,
  useWorkspaces,
} from './useTeam';

/**
 * People of a team (spec 11.2): roles Admin / Member / Guest, invite by email or link (Admin only), change role / remove
 * (Admin only), leave. The last Admin cannot leave, be demoted or removed (the server answers 409).
 */
export function TeamPeopleScreen({ workspaceId }: { workspaceId: string }) {
  const styles = useThemedStyles(createPeopleStyles);
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const me = useMe();
  const { teams } = useWorkspaces();
  const workspace = teams.find((team) => team.id === workspaceId);
  const isAdmin = workspace ? canManageTeam(workspace.role) : false;
  const members = useWorkspaceMembers(workspaceId);
  const invitations = useWorkspaceInvitations(workspaceId, isAdmin);
  const link = useWorkspaceInviteLink(workspaceId, isAdmin);
  const invite = useInviteToWorkspace();
  const revoke = useRevokeInvitation();
  const changeRole = useChangeMemberRole();
  const remove = useRemoveWorkspaceMember();
  const leave = useLeaveWorkspace();
  const resetLink = useResetWorkspaceInviteLink();
  const disableLink = useDisableWorkspaceInviteLink();
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [menuFor, setMenuFor] = useState<WorkspaceMemberResponse | null>(null);
  const [removing, setRemoving] = useState<WorkspaceMemberResponse | null>(null);
  const [leaving, setLeaving] = useState(false);

  const actionError = [changeRole.error, remove.error, revoke.error, resetLink.error, disableLink.error].find(Boolean);

  async function submitInvite() {
    const value = email.trim().toLowerCase();
    if (!isValidInviteEmail(value)) {
      setEmailError(t('team.peopleScreen.emailInvalid'));
      return;
    }
    setEmailError(undefined);
    setFormError(undefined);
    try {
      await invite.mutateAsync({ workspaceId, body: { email: value, role: inviteRole } });
      setEmail('');
      snackbar.show({ message: t('team.peopleScreen.invited', { email: value }) });
    } catch (failure) {
      const view = describeError(failure);
      setEmailError(view.fields.email);
      setFormError(view.fields.email ? undefined : view.message);
    }
  }

  async function copyLink() {
    setFormError(undefined);
    try {
      const url = link.data?.url ?? (await resetLink.mutateAsync(workspaceId)).url;
      if (!url) return;
      await Clipboard.setStringAsync(url);
      snackbar.show({ message: t('team.peopleScreen.linkCopied') });
    } catch (failure) {
      setFormError(describeError(failure).message);
    }
  }

  const menuItems: ActionMenuItem[] = menuFor
    ? [
        ...ASSIGNABLE_ROLES.filter((role) => role !== menuFor.role).map((role: WorkspaceRole) => ({
          key: `role-${role}`,
          label: t(`team.roles.${role}`),
          icon: 'user-check' as const,
          requiresOnline: true,
          onPress: () => changeRole.mutate({ workspaceId, userId: menuFor.userId, role }),
        })),
        { key: 'remove', label: t('team.peopleScreen.remove', { name: menuFor.displayName }), icon: 'user-x', destructive: true, requiresOnline: true, onPress: () => { remove.reset(); setRemoving(menuFor); } },
      ]
    : [];

  return (
    <View testID="team-people-screen" style={styles.fill}>
      <SubHeader title={workspace ? `${workspace.name} · ${t('team.peopleScreen.title')}` : t('team.peopleScreen.title')} onBack={() => router.back()} />
      {members.isPending || members.isError ? (
        <QueryStateView query={members} testID="team-people-state" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={members.isRefetching} onRefresh={() => void Promise.all([members.refetch(), invitations.refetch(), link.refetch()])} />}
        >
          {members.data.map((person) => (
            <View key={person.userId} testID={`team-member-${person.userId}`} style={styles.person}>
              <Avatar name={person.displayName} seed={person.userId} />
              <View style={styles.personTexts}>
                <Text style={[type.bodyStrong, styles.name]} numberOfLines={1}>
                  {person.displayName}
                  {person.userId === me.data?.id ? ` (${t('team.peopleScreen.you')})` : ''}
                </Text>
                <Text style={[type.meta, styles.meta]} numberOfLines={1}>
                  {t(`team.roles.${person.role}`)} · {person.email}
                </Text>
              </View>
              {isAdmin && person.userId !== me.data?.id ? (
                <IconButton icon="more-horizontal" label={t('team.peopleScreen.changeRole', { name: person.displayName })} requiresOnline testID={`team-member-menu-${person.userId}`} onPress={() => { changeRole.reset(); setMenuFor(person); }} />
              ) : null}
            </View>
          ))}

          {isAdmin && (invitations.data ?? []).length > 0 ? (
            <>
              <Text accessibilityRole="header" style={styles.section}>
                {t('team.peopleScreen.pending')}
              </Text>
              {(invitations.data ?? []).map((item) => (
                <View key={item.id} testID={`team-invitation-${item.id}`} style={styles.person}>
                  <Avatar name={item.email} seed={item.email} />
                  <View style={styles.personTexts}>
                    <Text style={[type.bodyStrong, styles.name]} numberOfLines={1}>
                      {item.email}
                    </Text>
                    <Text style={[type.meta, styles.meta]}>{t(`team.roles.${item.role}`)}</Text>
                  </View>
                  <IconButton icon="x" label={t('team.peopleScreen.revoke', { email: item.email })} requiresOnline testID={`team-revoke-${item.id}`} onPress={() => revoke.mutate(item.id)} />
                </View>
              ))}
            </>
          ) : null}

          {isAdmin ? (
            <>
              <Text accessibilityRole="header" style={styles.section}>
                {t('team.peopleScreen.inviteTitle')}
              </Text>
              <TextField
                testID="team-invite-email"
                placeholder={t('team.peopleScreen.invitePlaceholder')}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setEmailError(undefined);
                }}
                error={emailError}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[type.label, styles.roleLabel]}>{t('team.peopleScreen.roleLabel')}</Text>
              <View style={styles.roles}>
                {(['MEMBER', 'ADMIN'] as const).map((role) => (
                  <Chip key={role} label={t(`team.roles.${role}`)} selected={inviteRole === role} onPress={() => setInviteRole(role)} testID={`team-invite-role-${role}`} />
                ))}
              </View>
              <AppButton label={t('team.peopleScreen.inviteSubmit')} full requiresOnline busy={invite.isPending} onPress={() => void submitInvite()} testID="team-invite-submit" />
              <ListRow testID="team-copy-link" icon="link" iconBox title={t('team.peopleScreen.copyLink')} onPress={() => void copyLink()} />
              <Text style={[type.meta, styles.meta]}>{t('team.peopleScreen.linkHint')}</Text>
              {link.data?.token ? (
                <View style={styles.linkActions}>
                  <AppButton size="sm" variant="outline" label={t('team.peopleScreen.resetLink')} requiresOnline onPress={() => resetLink.mutate(workspaceId)} testID="team-reset-link" />
                  <AppButton size="sm" variant="ghost" label={t('team.peopleScreen.disableLink')} requiresOnline onPress={() => disableLink.mutate(workspaceId)} testID="team-disable-link" />
                </View>
              ) : null}
            </>
          ) : null}

          <View style={styles.leave}>
            <AppButton variant="outline" label={t('team.peopleScreen.leave')} requiresOnline onPress={() => { leave.reset(); setLeaving(true); }} testID="team-leave" />
          </View>
          <ErrorText message={formError ?? (actionError ? describeError(actionError).message : undefined)} testID="team-people-error" />
        </ScrollView>
      )}
      <ActionMenu visible={menuFor !== null} onClose={() => setMenuFor(null)} items={menuItems} title={menuFor?.displayName} testID="team-member-menu" />
      <ConfirmDialog
        visible={removing !== null}
        title={t('team.peopleScreen.removeTitle', { name: removing?.displayName ?? '' })}
        message={t('team.peopleScreen.removeMessage')}
        confirmLabel={t('team.peopleScreen.removeConfirm')}
        destructive
        busy={remove.isPending}
        error={remove.error ? describeError(remove.error).message : undefined}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate({ workspaceId, userId: removing.userId }, { onSuccess: () => setRemoving(null) })}
        testID="team-remove-dialog"
      />
      <ConfirmDialog
        visible={leaving}
        title={t('team.peopleScreen.leaveTitle', { name: workspace?.name ?? '' })}
        message={t('team.peopleScreen.leaveMessage')}
        confirmLabel={t('team.peopleScreen.leaveConfirm')}
        destructive
        busy={leave.isPending}
        error={leave.error ? describeError(leave.error).message : undefined}
        onCancel={() => setLeaving(false)}
        onConfirm={() => leave.mutate(workspaceId, { onSuccess: () => { setLeaving(false); router.replace('/browse'); } })}
        testID="team-leave-dialog"
      />
    </View>
  );
}

function createPeopleStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 48 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: palette.line },
    personTexts: { flex: 1 },
    name: { color: palette.ink },
    meta: { color: palette.mute },
    section: { ...type.section, color: palette.ink, paddingTop: 20, paddingBottom: 8 },
    roleLabel: { color: palette.ink2, marginTop: 4, marginBottom: 8 },
    roles: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    linkActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    leave: { marginTop: 24 },
  });
}
