import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Section } from '../../api/models';
import { AppButton } from '../../components/AppButton';
import { DialogFrame } from '../../components/DialogFrame';
import { ErrorText } from '../../components/ErrorText';
import { TextField } from '../../components/TextField';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { LIMITS, checkOptionalText, checkRequiredText } from '../../lib/limits';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { descriptionError } from '../tasks/validation';
import { useCreateSection, useUpdateSection } from './useSections';

interface SectionFormDialogProps {
  visible: boolean;
  projectId: string;
  /** Edit this section; create a new one when absent. */
  section?: Section;
  onClose: () => void;
}

/** Create / edit a section: name (1–2048) + description (≤ 16 383), spec 5.9. The dialog stays open on an error. */
export function SectionFormDialog({ visible, projectId, section, onClose }: SectionFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const create = useCreateSection(projectId);
  const update = useUpdateSection(projectId);
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();

  useEffect(() => {
    if (!visible) return;
    setName(section?.name ?? '');
    setDescription(section?.description ?? '');
    setNameError(undefined);
    setFormError(undefined);
    // Reset only when the dialog opens for a section: a refetch must not wipe what the user is typing.
  }, [visible, section?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const problem = checkRequiredText(name, LIMITS.sectionName);
    if (problem) {
      setNameError(problem === 'required' ? t('projectScreen.section.nameRequired') : t('projectScreen.section.nameTooLong'));
      return;
    }
    if (checkOptionalText(description, LIMITS.description)) {
      setFormError(descriptionError(description));
      return;
    }
    await run(async () => {
      try {
        if (section) {
          await update.mutateAsync({ sectionId: section.id, body: { name: name.trim(), description } });
        } else {
          const body = { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) };
          await create.mutateAsync({ body, idempotencyKey: keys.keyFor({ projectId, ...body }) });
        }
        keys.reset();
        onClose();
      } catch (failure) {
        const view = describeError(failure);
        setNameError(view.fields.name);
        setFormError(view.fields.name ? undefined : view.message);
      }
    });
  }

  return (
    <DialogFrame
      visible={visible}
      title={section ? t('projectScreen.section.editTitle') : t('projectScreen.section.createTitle')}
      onRequestClose={onClose}
      testID="section-form"
    >
      <TextField
        testID="section-form-name"
        label={t('projectScreen.section.name')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setNameError(undefined);
        }}
        error={nameError}
        autoFocus
      />
      <TextField
        testID="section-form-description"
        label={t('projectScreen.section.description')}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <ErrorText message={formError} testID="section-form-error" />
      <View style={styles.actions}>
        <AppButton variant="outline" label={t('common.cancel')} onPress={onClose} disabled={busy} testID="section-form-cancel" />
        <AppButton
          label={section ? t('projectScreen.section.save') : t('projectScreen.section.create')}
          onPress={() => void save()}
          busy={busy}
          requiresOnline
          testID="section-form-submit"
        />
      </View>
    </DialogFrame>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 } });
