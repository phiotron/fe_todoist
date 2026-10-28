import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError, isNotFound } from '../../api/describeError';
import { parseTemplateRef, type TemplateTaskItem } from '../../api/templates';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconButton } from '../../components/IconButton';
import { NotFoundView } from '../../components/NotFoundView';
import { QueryStateView } from '../../components/QueryStateView';
import { SectionHeader } from '../../components/SectionHeader';
import { useSnackbar } from '../../components/Snackbar';
import { SubHeader } from '../../components/SubHeader';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { TemplateNameDialog } from './TemplateNameDialog';
import { useApplyTemplate, useDeleteTemplate, useTemplateDetail } from './useTemplates';

/** Preview of one template (M11 F6 / F7): sections and tasks (read-only), "Use template", and delete for my own. */
export function TemplatePreviewScreen({ param }: { param: string }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const ref = parseTemplateRef(param);
  const detail = useTemplateDetail(param);
  const apply = useApplyTemplate();
  const remove = useDeleteTemplate();
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();
  const [useOpen, setUseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isNotFound(detail.error)) return <NotFoundView onBack={() => router.back()} testID="template-not-found" />;
  const template = detail.data;
  if (!template) {
    return (
      <View style={styles.fill}>
        <SubHeader onBack={() => router.back()} testID="template-loading-header" />
        <QueryStateView query={detail} testID="template-state" />
      </View>
    );
  }

  function create(name: string) {
    void run(async () => {
      try {
        const body = { name };
        const project = await apply.mutateAsync({ ref, body, idempotencyKey: keys.keyFor({ ...ref, ...body }) });
        keys.reset();
        setUseOpen(false);
        snackbar.show({ message: t('templates.apply.created', { name: project.name }) });
        router.replace(`/project/${project.id}`);
      } catch {
        // The dialog shows apply.error and stays open.
      }
    });
  }

  const renderTasks = (tasks: TemplateTaskItem[], depth: number, prefix: string): React.ReactNode =>
    tasks.map((task, index) => (
      <View key={`${prefix}-${index}`}>
        <Text style={[type.body, styles.task, { paddingLeft: gutter + depth * 20 }]}>{task.content}</Text>
        {renderTasks(task.children, depth + 1, `${prefix}-${index}`)}
      </View>
    ));

  return (
    <View style={styles.fill}>
      <SubHeader
        title={template.name}
        onBack={() => router.back()}
        right={
          ref.source === 'MINE' ? (
            <IconButton
              icon="trash-2"
              label={t('templates.preview.delete')}
              requiresOnline
              onPress={() => {
                remove.reset();
                setDeleteOpen(true);
              }}
              testID="template-delete-open"
            />
          ) : undefined
        }
        testID="template-header"
      />
      <ScrollView contentContainerStyle={styles.content}>
        {template.description ? <Text style={styles.description}>{template.description}</Text> : null}
        <Text style={styles.meta}>{t('templates.counts', { sections: template.sectionCount, tasks: template.taskCount })}</Text>
        {template.tasks.length > 0 ? (
          <View testID="template-tasks">
            {template.sections.length > 0 ? <SectionHeader title={t('templates.preview.noSection')} /> : null}
            {renderTasks(template.tasks, 0, 'root')}
          </View>
        ) : null}
        {template.sections.map((section, index) => (
          <View key={`s-${index}`} testID={`template-section-${index}`}>
            <SectionHeader title={section.name} />
            {section.description ? <Text style={[styles.description, styles.sectionNote]}>{section.description}</Text> : null}
            {renderTasks(section.tasks, 0, `s${index}`)}
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <AppButton label={t('templates.preview.use')} requiresOnline onPress={() => { apply.reset(); setUseOpen(true); }} testID="template-use" />
      </View>
      <TemplateNameDialog
        visible={useOpen}
        title={t('templates.apply.title')}
        label={t('templates.apply.name')}
        submitLabel={t('templates.apply.submit')}
        initialName={template.name}
        requiredMessage={t('templates.apply.nameRequired')}
        tooLongMessage={t('templates.apply.nameTooLong')}
        busy={busy}
        error={apply.error ? describeError(apply.error).message : undefined}
        onSubmit={create}
        onClose={() => setUseOpen(false)}
        testID="template-use-dialog"
      />
      <ConfirmDialog
        visible={deleteOpen}
        title={t('templates.preview.deleteTitle', { name: template.name })}
        message={t('templates.preview.deleteMessage')}
        confirmLabel={t('common.delete')}
        busy={remove.isPending}
        error={remove.error && !isNotFound(remove.error) ? describeError(remove.error).message : undefined}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          const done = () => {
            setDeleteOpen(false);
            snackbar.show({ message: t('templates.preview.deleted') });
            router.back();
          };
          remove.mutate(template.id, { onSuccess: done, onError: (error) => isNotFound(error) && done() });
        }}
        testID="template-delete-dialog"
      />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingBottom: 24 },
    description: { ...type.bodySmall, color: palette.mute, paddingHorizontal: gutter, paddingBottom: 4 },
    sectionNote: { paddingTop: 4 },
    meta: { ...type.meta, color: palette.mute, paddingHorizontal: gutter, paddingBottom: 8 },
    task: { color: palette.ink, paddingRight: gutter, paddingVertical: 8 },
    footer: { paddingHorizontal: gutter, paddingVertical: 12 },
  });
}
