import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { describeError } from '../../api/describeError';
import { Chip } from '../../components/Chip';
import { ErrorText } from '../../components/ErrorText';
import { describeDue } from '../../lib/dates';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDueLabel } from '../../lib/dates/format';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useIsOnline } from '../../lib/useIsOnline';
import { useNow } from '../../lib/useNow';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { radius, shadow, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import type { TextInputHandle } from '../auth/AuthTextField';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { projectDisplayName } from '../projects/appearance';
import { ProjectSectionPicker } from '../projects/ProjectSectionPicker';
import { useProjects } from '../projects/useProjects';
import { NO_DUE, type DueValue } from '../schedule/dueValue';
import { ScheduleSheet } from '../schedule/ScheduleSheet';
import { useSections } from '../sections/useSections';
import { dueTone } from '../tasks/dueTone';
import { DEFAULT_PRIORITY, priorityColor } from '../tasks/priority';
import { PriorityMenu } from '../tasks/PriorityMenu';
import { useCreateTask } from '../tasks/useTaskActions';
import { taskContentError } from '../tasks/validation';
import { buildCreateBody } from './buildTask';
import type { QuickAddParams } from './quickAddTarget';

type Overlay = 'none' | 'date' | 'priority' | 'project';

/**
 * M-AddTask: scrim + bottom sheet. Type a name (+ description), chips for date, priority and project, send. The sheet
 * stays open after a successful add; an error keeps everything and a retry reuses the Idempotency-Key.
 */
export function QuickAddSheet({ params }: { params: QuickAddParams }) {
  const styles = useThemedStyles(createQuickAddSheetStyles);
  // Redraw when the user changes the date / time format (the formatting functions read the same store).
  useDisplayPrefs();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const { inbox, byId } = useProjects();
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [due, setDue] = useState<DueValue>(() => (params.dueDate ? { ...NO_DUE, dueDate: params.dueDate } : NO_DUE));
  const [target, setTarget] = useState<{ projectId?: string; sectionId: string | null }>({
    projectId: params.projectId,
    sectionId: params.sectionId ?? null,
  });
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const create = useCreateTask();
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();
  const nameRef = useRef<TextInputHandle>(null);
  const isSubtask = !!params.parentId;

  const projectId = target.projectId ?? inbox?.id;
  const project = projectId ? byId.get(projectId) : undefined;
  const { sections } = useSections(target.sectionId ? projectId : undefined);
  const sectionName = sections.find((section) => section.id === target.sectionId)?.name;
  const projectLabel = project ? projectDisplayName(project) : '';
  const dueLabel = describeDue(due, now, timeZone);

  async function submit() {
    const problem = taskContentError(content);
    if (problem) {
      setError(problem);
      return;
    }
    const body = buildCreateBody({
      projectId,
      sectionId: isSubtask ? (params.sectionId ?? null) : target.sectionId,
      parentId: params.parentId,
      content,
      description,
      priority,
      due,
    });
    await run(async () => {
      try {
        await create.mutateAsync({ body, idempotencyKey: keys.keyFor(body) });
        keys.reset();
        setContent('');
        setDescription('');
        setError(undefined);
        setNotice(t('quickAdd.added', { name: isSubtask ? content.trim() : projectLabel }));
        nameRef.current?.focus();
      } catch (failure) {
        const view = describeError(failure);
        setNotice(undefined);
        setError(view.fields.content ?? view.message);
      }
    });
  }

  function show(next: Overlay) {
    Keyboard.dismiss();
    setOverlay(next);
  }

  const sendInactive = busy || !content.trim() || !online;
  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding" accessibilityViewIsModal>
      <Pressable
        testID="quick-add-scrim"
        accessibilityRole="button"
        accessibilityLabel={t('quickAdd.closeSheet')}
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={() => router.back()}
      />
      <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
        <View style={styles.grab} />
        <TextInput
          ref={nameRef}
          testID="quick-add-name"
          value={content}
          onChangeText={(value) => {
            setContent(value);
            if (error) setError(undefined);
          }}
          placeholder={isSubtask ? t('quickAdd.subtaskPlaceholder') : t('quickAdd.placeholder')}
          placeholderTextColor={palette.mute}
          accessibilityLabel={t('quickAdd.placeholder')}
          autoFocus
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void submit()}
          style={styles.name}
        />
        <TextInput
          testID="quick-add-description"
          value={description}
          onChangeText={setDescription}
          placeholder={t('quickAdd.description')}
          placeholderTextColor={palette.mute}
          accessibilityLabel={t('quickAdd.description')}
          style={styles.description}
        />
        <View style={styles.chips}>
          <Chip
            large
            icon="calendar"
            label={dueLabel ? formatDueLabel(dueLabel) : t('quickAdd.date')}
            color={dueLabel ? dueTone(due, now, timeZone, palette) : undefined}
            onPress={() => show('date')}
            testID="quick-add-date"
          />
          <Chip
            large
            icon="flag"
            label={priority < DEFAULT_PRIORITY ? `P${priority}` : t('quickAdd.priority')}
            color={priority < DEFAULT_PRIORITY ? priorityColor(priority, palette) : undefined}
            onPress={() => show('priority')}
            testID="quick-add-priority"
          />
        </View>
        {notice ? (
          <Text testID="quick-add-notice" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        <ErrorText message={error} testID="quick-add-error" />
        <View style={styles.rule} />
        <View style={styles.bottom}>
          {isSubtask ? (
            <View style={styles.flex} />
          ) : (
            <Pressable
              testID="quick-add-project"
              accessibilityRole="button"
              accessibilityLabel={t('quickAdd.project')}
              onPress={() => show('project')}
              style={styles.project}
            >
              <Feather name="inbox" size={size.icon} color={palette.acc} />
              <Text style={[type.bodyStrong, styles.projectText]} numberOfLines={1}>
                {sectionName ? `${projectLabel} · ${sectionName}` : projectLabel}
              </Text>
              <Feather name="chevron-down" size={size.iconSmall} color={palette.ink2} />
            </Pressable>
          )}
          <Pressable
            testID="quick-add-submit"
            accessibilityRole="button"
            accessibilityLabel={t('quickAdd.send')}
            accessibilityState={{ disabled: sendInactive, busy }}
            disabled={sendInactive}
            onPress={() => void submit()}
            style={[styles.send, sendInactive && styles.sendInactive]}
          >
            <Feather name="arrow-up" size={size.icon} color={palette.onacc} />
          </Pressable>
        </View>
      </View>
      <ScheduleSheet
        visible={overlay === 'date'}
        value={due}
        onSelect={setDue}
        onClose={() => setOverlay('none')}
        testID="quick-add-schedule"
      />
      <PriorityMenu
        visible={overlay === 'priority'}
        value={priority}
        onSelect={setPriority}
        onClose={() => setOverlay('none')}
      />
      <ProjectSectionPicker
        visible={overlay === 'project'}
        value={{ projectId, sectionId: target.sectionId }}
        onSelect={setTarget}
        onClose={() => setOverlay('none')}
        testID="quick-add-picker"
      />
    </KeyboardAvoidingView>
  );
}

function createQuickAddSheetStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    scrim: { backgroundColor: palette.scrim },
    sheet: {
      backgroundColor: palette.bg,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingTop: 12,
      paddingHorizontal: 20,
      ...shadow,
    },
    grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: palette.line2, marginBottom: 14 },
    name: { ...type.composerTitle, color: palette.ink, paddingVertical: 2 },
    description: { ...type.body, color: palette.ink, height: 40, paddingVertical: 0 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 6 },
    notice: { ...type.meta, color: palette.ok, marginBottom: 4 },
    rule: { height: 1, backgroundColor: palette.line, marginHorizontal: -20, marginTop: 8, marginBottom: 10 },
    bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    flex: { flex: 1 },
    project: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: size.touch },
    projectText: { color: palette.ink, flexShrink: 1 },
    send: {
      width: size.input,
      height: size.input,
      borderRadius: size.input / 2,
      backgroundColor: palette.acc,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendInactive: { opacity: 0.4 },
  });
}
