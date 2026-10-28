import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError, isNotFound } from '../../api/describeError';
import { AppButton } from '../../components/AppButton';
import { Avatar } from '../../components/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ListRow } from '../../components/ListRow';
import { NotFoundView } from '../../components/NotFoundView';
import { QueryStateView } from '../../components/QueryStateView';
import { useSnackbar } from '../../components/Snackbar';
import { SubHeader } from '../../components/SubHeader';
import { TextField } from '../../components/TextField';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import type { ProjectAccess, ProjectMemberResponse } from '../../api/sharing';
import { useMe } from '../auth/session';
import { projectDisplayName } from '../projects/appearance';
import { useProject } from '../projects/useProjects';
import { MAX_PROJECT_MEMBERS, canChangeAccess, isValidInviteEmail, otherAccess, seatsLeft, sharingOf } from './sharingRules';
import {
  useChangeProjectAccess,
  useDisableProjectInviteLink,
  useInviteToProject,
  useProjectInvitations,
  useProjectInviteLink,
  useProjectMembers,
  useRemoveProjectMember,
  useResetProjectInviteLink,
  useRevokeInvitation,
} from './useSharing';

/**
 * Share screen of a project (Todoist "Share project", spec 3.2 M8a): Copy link, Access, "In this project" and the invite
 * field. Everyone ends up with the same Can edit access. No realtime: it reloads when opened and on pull to refresh.
 */
export function ShareProjectScreen({ projectId }: { projectId: string }) {
  const styles = useThemedStyles(createShareStyles);
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const me = useMe();
  const projectQuery = useProject(projectId);
  const project = projectQuery.data;
  const sharing = project ? sharingOf(project) : undefined;
  const members = useProjectMembers(projectId);
  const invitations = useProjectInvitations(projectId, sharing?.canShare === true);
  const link = useProjectInviteLink(projectId, sharing?.canShare === true);
  const invite = useInviteToProject();
  const revoke = useRevokeInvitation();
  const resetLink = useResetProjectInviteLink();
  const disableLink = useDisableProjectInviteLink();
  const removeMember = useRemoveProjectMember();
  const changeAccess = useChangeProjectAccess();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [removing, setRemoving] = useState<ProjectMemberResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  if (projectQuery.isError && isNotFound(projectQuery.error)) return <NotFoundView onBack={() => router.back()} testID="share-not-found" />;

  const pending = invitations.data ?? [];
  const people = members.data ?? [];
  const isPersonal = sharing ? !sharing.isTeamProject : true;
  const free = seatsLeft(sharing?.memberCount ?? people.length, pending.length);
  const actionError = [invite.error, revoke.error, resetLink.error, disableLink.error, removeMember.error, changeAccess.error].find(Boolean);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([projectQuery.refetch(), members.refetch(), invitations.refetch(), link.refetch()]);
    setRefreshing(false);
  }

  async function copyLink() {
    setFormError(undefined);
    try {
      const url = link.data?.url ?? (await resetLink.mutateAsync(projectId)).url;
      if (!url) return;
      await Clipboard.setStringAsync(url);
      snackbar.show({ message: t('sharing.linkCopied') });
    } catch (failure) {
      setFormError(describeError(failure).message);
    }
  }

  async function submitInvite() {
    const value = email.trim().toLowerCase();
    if (!isValidInviteEmail(value)) {
      setEmailError(t('sharing.emailInvalid'));
      return;
    }
    setEmailError(undefined);
    setFormError(undefined);
    try {
      const created = await invite.mutateAsync({ projectId, email: value });
      setEmail('');
      snackbar.show({ message: created.accepted ? t('sharing.invitedAdded', { email: value }) : t('sharing.invited', { email: value }) });
    } catch (failure) {
      const view = describeError(failure);
      setEmailError(view.fields.email);
      setFormError(view.fields.email ? undefined : view.message);
    }
  }

  const canRemove = sharing?.canManage === true;
  const projectName = project ? projectDisplayName(project) : '';

  return (
    <View testID="share-screen" style={styles.fill}>
      <SubHeader title={t('sharing.title')} onBack={() => router.back()} />
      {!project || members.isPending || members.isError ? (
        <QueryStateView query={!project ? projectQuery : members} testID="share-state" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        >
          <Text style={[type.bodySmall, styles.subtitle]} numberOfLines={1}>
            {projectName}
          </Text>
          {isPersonal ? (
            <>
              <ListRow testID="share-copy-link" icon="link" iconBox bold title={t('sharing.copyLink')} onPress={() => void copyLink()} />
              <Text style={styles.hint}>{t('sharing.linkHint', { max: MAX_PROJECT_MEMBERS })}</Text>
              {link.data?.token ? (
                <View style={styles.linkActions}>
                  <AppButton size="sm" variant="outline" label={t('sharing.resetLink')} requiresOnline busy={resetLink.isPending} onPress={() => resetLink.mutate(projectId)} testID="share-reset-link" />
                  <AppButton size="sm" variant="ghost" label={t('sharing.disableLink')} requiresOnline busy={disableLink.isPending} onPress={() => disableLink.mutate(projectId)} testID="share-disable-link" />
                </View>
              ) : null}
            </>
          ) : null}
          {isPersonal || !project ? (
            <ListRow testID="share-access" icon="lock" iconBox title={t('sharing.access')} right={t('sharing.accessEveryone', { name: projectName })} />
          ) : (
            <ListRow
              testID="share-access"
              icon="lock"
              iconBox
              title={t('sharing.access')}
              right={(project as { access?: ProjectAccess | null }).access === 'RESTRICTED' ? t('sharing.accessRestrictedValue') : t('sharing.accessTeamValue')}
              onPress={
                canChangeAccess(project)
                  ? () => changeAccess.mutate({ projectId, access: otherAccess((project as { access?: ProjectAccess | null }).access) })
                  : undefined
              }
            />
          )}

          <Text accessibilityRole="header" style={styles.section}>
            {t('sharing.inProject')}
          </Text>
          {people.map((person) => (
            <View key={person.userId} testID={`share-member-${person.userId}`} style={styles.person}>
              <Avatar name={person.displayName} seed={person.userId} uri={person.avatarUrl} testID={`share-avatar-${person.userId}`} />
              <View style={styles.personTexts}>
                <Text style={[type.bodyStrong, styles.name]} numberOfLines={1}>
                  {person.displayName}
                  {person.userId === me.data?.id ? ` (${t('sharing.you')})` : ''}
                </Text>
                <Text style={[type.meta, styles.meta]} numberOfLines={1}>
                  {person.isOwner ? `${t('sharing.owner')} · ${person.email}` : person.email}
                </Text>
              </View>
              {canRemove && !person.isOwner && person.userId !== me.data?.id ? (
                <IconButton icon="user-x" label={t('sharing.removeMember', { name: person.displayName })} requiresOnline onPress={() => { removeMember.reset(); setRemoving(person); }} testID={`share-remove-${person.userId}`} />
              ) : null}
            </View>
          ))}
          {pending.length > 0 ? (
            <>
              <Text accessibilityRole="header" style={styles.section}>
                {t('sharing.pending')}
              </Text>
              {pending.map((item) => (
                <View key={item.id} testID={`share-invitation-${item.id}`} style={styles.person}>
                  <Avatar name={item.email} seed={item.email} />
                  <View style={styles.personTexts}>
                    <Text style={[type.bodyStrong, styles.name]} numberOfLines={1}>
                      {item.email}
                    </Text>
                    <Text style={[type.meta, styles.meta]}>{t('sharing.pendingMeta')}</Text>
                  </View>
                  <IconButton icon="x" label={t('sharing.revoke', { email: item.email })} requiresOnline onPress={() => revoke.mutate(item.id)} testID={`share-revoke-${item.id}`} />
                </View>
              ))}
            </>
          ) : null}

          <Text accessibilityRole="header" style={styles.section}>
            {t('sharing.inviteTitle')}
          </Text>
          <TextField
            testID="share-invite-email"
            label={t('sharing.inviteLabel')}
            placeholder={t('sharing.invitePlaceholder')}
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
          {isPersonal ? <Text style={styles.hint}>{free > 0 ? t('sharing.seatsLeft', { n: free }) : t('sharing.seatsFull')}</Text> : null}
          <AppButton label={t('sharing.inviteSubmit')} full requiresOnline busy={invite.isPending} onPress={() => void submitInvite()} testID="share-invite-submit" />
          <ErrorText message={formError ?? (actionError ? describeError(actionError).message : undefined)} testID="share-error" />
        </ScrollView>
      )}
      <ConfirmDialog
        visible={removing !== null}
        title={t('sharing.removeMemberTitle', { name: removing?.displayName ?? '' })}
        message={t('sharing.removeMemberMessage')}
        confirmLabel={t('sharing.removeConfirm')}
        destructive
        busy={removeMember.isPending}
        error={removeMember.error ? describeError(removeMember.error).message : undefined}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && removeMember.mutate({ projectId, userId: removing.userId }, { onSuccess: () => setRemoving(null) })}
        testID="share-remove-dialog"
      />
    </View>
  );
}

function createShareStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 48 },
    subtitle: { color: palette.mute, marginBottom: 8 },
    hint: { ...type.meta, color: palette.mute, marginVertical: 8 },
    linkActions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    section: { ...type.section, color: palette.ink, paddingTop: 20, paddingBottom: 8 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: palette.line },
    personTexts: { flex: 1 },
    name: { color: palette.ink },
    meta: { color: palette.mute },
  });
}
