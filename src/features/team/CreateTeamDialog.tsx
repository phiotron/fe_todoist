import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../api/describeError';
import { AppButton } from '../../components/AppButton';
import { DialogFrame } from '../../components/DialogFrame';
import { TextField } from '../../components/TextField';
import { checkRequiredText } from '../../lib/limits';
import { TEAM_NAME_MAX } from './teamRules';
import { useCreateWorkspace } from './useTeam';

/** "Create a team": a name (1–100 characters); the creator becomes its Admin and lands on the Team tab. */
export function CreateTeamDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateWorkspace();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  async function submit() {
    if (checkRequiredText(name, TEAM_NAME_MAX)) {
      setError(t('team.create.nameRequired'));
      return;
    }
    try {
      const created = await create.mutateAsync(name.trim());
      setName('');
      setError(undefined);
      onClose();
      router.navigate({ pathname: '/team', params: { workspaceId: created.id } });
    } catch (failure) {
      const view = describeError(failure);
      setError(view.fields.name ?? view.message);
    }
  }

  return (
    <DialogFrame visible={visible} title={t('team.create.title')} onRequestClose={onClose} testID="create-team-dialog">
      <TextField
        testID="create-team-name"
        label={t('team.create.nameLabel')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(undefined);
        }}
        maxCount={TEAM_NAME_MAX}
        error={error}
        autoFocus
      />
      <AppButton label={t('team.create.submit')} full requiresOnline busy={create.isPending} onPress={() => void submit()} testID="create-team-submit" />
    </DialogFrame>
  );
}
