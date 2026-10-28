import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { AcceptInvitationResponse } from '../../api/sharing';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { KeyboardScreen } from '../../components/KeyboardScreen';
import { useSnackbar } from '../../components/Snackbar';
import { SubHeader } from '../../components/SubHeader';
import { TextField } from '../../components/TextField';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { parseInviteToken } from './sharingRules';
import { useAcceptInvitationToken } from './useSharing';

/** Where an accepted invitation leads: the project, or the Team tab for a team. */
export function openAccepted(result: AcceptInvitationResponse): void {
  if (result.kind === 'PROJECT' && result.projectId) router.replace({ pathname: '/project/[id]', params: { id: result.projectId } });
  else router.replace('/team');
}

/**
 * Join screen (spec 11.2): paste an invite link / code, or arrive from `taskly://join/<token>` with the code filled in
 * (`initialCode`). The person must be signed in; joining never happens without pressing Join.
 */
export function JoinScreen({ initialCode = '' }: { initialCode?: string }) {
  const styles = useThemedStyles(createJoinStyles);
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const accept = useAcceptInvitationToken();
  const [code, setCode] = useState(initialCode);
  const [codeError, setCodeError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  async function submit() {
    const token = parseInviteToken(code);
    if (!token) {
      setCodeError(t('sharing.join.invalid'));
      return;
    }
    setCodeError(undefined);
    setFormError(undefined);
    try {
      const result = await accept.mutateAsync(token);
      snackbar.show({ message: result.kind === 'PROJECT' ? t('sharing.join.joinedProject') : t('sharing.join.joinedTeam') });
      openAccepted(result);
    } catch (failure) {
      setFormError(describeError(failure).message);
    }
  }

  return (
    <View testID="join-screen" style={styles.fill}>
      <SubHeader title={t('sharing.join.title')} onBack={() => router.back()} />
      <KeyboardScreen contentStyle={styles.content}>
        <Text style={[type.body, styles.hint]}>{t('sharing.join.hint')}</Text>
        <TextField
          testID="join-code"
          label={t('sharing.join.codeLabel')}
          placeholder={t('sharing.join.codePlaceholder')}
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setCodeError(undefined);
          }}
          error={codeError}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <AppButton label={t('sharing.join.submit')} full requiresOnline busy={accept.isPending} onPress={() => void submit()} testID="join-submit" />
        <ErrorText message={formError} testID="join-error" />
      </KeyboardScreen>
    </View>
  );
}

function createJoinStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 48 },
    hint: { color: palette.ink2, marginBottom: 16 },
  });
}
