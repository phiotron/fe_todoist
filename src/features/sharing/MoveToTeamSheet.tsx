import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { ProjectAccess } from '../../api/sharing';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorText } from '../../components/ErrorText';
import { RadioRow } from '../../components/RadioRow';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { canCreateInTeam } from '../team/teamRules';
import { useWorkspaces } from '../team/useTeam';
import { useMoveToWorkspace } from './useSharing';

interface MoveToTeamSheetProps {
  visible: boolean;
  projectId: string;
  onClose: () => void;
  onMoved?: () => void;
}

/**
 * "Move to a team" (spec 3.2 M8a): a personal project goes INTO a team workspace and never comes back out. The person
 * picks the team (Admin / Member only) and whether the whole team or only invited people see it.
 */
export function MoveToTeamSheet({ visible, projectId, onClose, onMoved }: MoveToTeamSheetProps) {
  const styles = useThemedStyles(createMoveStyles);
  const { t } = useTranslation();
  const { teams } = useWorkspaces();
  const move = useMoveToWorkspace();
  const choices = teams.filter((team) => canCreateInTeam(team.role));
  const [teamId, setTeamId] = useState<string | undefined>();
  const [access, setAccess] = useState<ProjectAccess>('TEAM');
  const selected = teamId ?? choices[0]?.id;

  async function submit() {
    if (!selected) return;
    try {
      await move.mutateAsync({ projectId, body: { workspaceId: selected, access } });
      onClose();
      onMoved?.();
    } catch {
      // the error shows under the button; the sheet stays open with the choice
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('sharing.moveToTeam.title')} testID="move-to-team-sheet">
      <View style={styles.body}>
        <Text style={[type.bodySmall, styles.message]}>{t('sharing.moveToTeam.message')}</Text>
        <Text style={[type.label, styles.label]}>{t('sharing.moveToTeam.team')}</Text>
        {choices.map((team) => (
          <RadioRow key={team.id} testID={`move-team-${team.id}`} title={team.name} selected={team.id === selected} onPress={() => setTeamId(team.id)} />
        ))}
        <RadioRow testID="move-access-TEAM" title={t('sharing.moveToTeam.accessTeam')} selected={access === 'TEAM'} onPress={() => setAccess('TEAM')} />
        <RadioRow testID="move-access-RESTRICTED" title={t('sharing.moveToTeam.accessRestricted')} selected={access === 'RESTRICTED'} onPress={() => setAccess('RESTRICTED')} />
        <AppButton label={t('sharing.moveToTeam.confirm')} full requiresOnline disabled={!selected} busy={move.isPending} onPress={() => void submit()} testID="move-to-team-confirm" />
        <ErrorText message={move.error ? describeError(move.error).message : undefined} testID="move-to-team-error" />
      </View>
    </BottomSheet>
  );
}

function createMoveStyles(palette: Palette) {
  return StyleSheet.create({
    body: { paddingHorizontal: 20, paddingBottom: 24, gap: 4 },
    message: { color: palette.ink2, marginBottom: 8 },
    label: { color: palette.ink2, marginTop: 8 },
  });
}
