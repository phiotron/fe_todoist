import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputSelectionChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { describeError } from '../../api/describeError';
import { labelsApi } from '../../api/labels';
import { queryKeys } from '../../api/queryKeys';
import { ActionMenu, type ActionMenuItem } from '../../components/ActionMenu';
import { AppButton } from '../../components/AppButton';
import { Chip } from '../../components/Chip';
import { DialogFrame } from '../../components/DialogFrame';
import { ErrorText } from '../../components/ErrorText';
import { dateKeyInZone, describeDeadline, describeDue } from '../../lib/dates';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDeadline, formatDueLabel } from '../../lib/dates/format';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { parseQuickAdd, type QuickAddParse, type QuickAddTokenKind } from '../../lib/quickadd';
import { newUuid } from '../../lib/uuid';
import { useIsOnline } from '../../lib/useIsOnline';
import { useNow } from '../../lib/useNow';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { radius, shadow, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import type { TextInputHandle } from '../auth/AuthTextField';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { LabelChip } from '../labels/LabelChip';
import { useLabels } from '../labels/useLabels';
import { QuickAddReminderChip } from '../reminders/QuickAddReminderChip';
import { useQuickAddReminders } from '../reminders/useQuickAddReminders';
import { projectDisplayName } from '../projects/appearance';
import { ProjectSectionPicker } from '../projects/ProjectSectionPicker';
import { useProjects } from '../projects/useProjects';
import { NO_DUE, type DueValue } from '../schedule/dueValue';
import { ScheduleSheet } from '../schedule/ScheduleSheet';
import { useSections } from '../sections/useSections';
import { useDateSettings } from '../settings/useDateSettings';
import { useSettings } from '../settings/useSettings';
import { dueTone } from '../tasks/dueTone';
import { DEFAULT_PRIORITY, priorityColor } from '../tasks/priority';
import { PriorityMenu } from '../tasks/PriorityMenu';
import { useCreateTask } from '../tasks/useTaskActions';
import { taskContentError } from '../tasks/validation';
import { buildCreateBody } from './buildTask';
import { DateSheet } from './DateSheet';
import { HighlightedNameInput } from './HighlightedNameInput';
import { AVAILABLE_CHIPS, CHIP_META, readQuickAddPrefs, type QuickAddChip } from './quickAddChips';
import { backspacedToken, pastedLines, tappedToken } from './quickAddText';
import type { QuickAddParams } from './quickAddTarget';
import type { RecurrenceSpec } from '../../lib/recurrence/types';
import { recurrenceLabel } from './recurrenceLabel';
import { parsedProjectId, resolveQuickAdd, type ManualChoice, type ResolvedQuickAdd } from './resolveQuickAdd';

type Overlay = 'none' | 'date' | 'priority' | 'project' | 'deadline' | 'more';

const NO_IGNORED: ReadonlySet<string> = new Set();

/**
 * M-AddTask: scrim + bottom sheet. Type a name (+ description); M6b reads Todoist's English syntax in the name
 * (#project /section %label p1 !reminder {deadline} dates, "every …") with the recognised parts highlighted and the chips
 * updated at once; tap or Backspace on a highlighted part makes it plain text again. Chips follow me/settings
 * quickAddChips (the rest under "More"). The sheet stays open after a successful add; an error keeps everything and a
 * retry reuses the Idempotency-Key. Pasting several lines asks "one task / one per line"; closing with text asks
 * "Discard changes?".
 */
export function QuickAddSheet({ params }: { params: QuickAddParams }) {
  const styles = useThemedStyles(createQuickAddSheetStyles);
  const displayPrefs = useDisplayPrefs();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: settingsData, settings } = useSettings();
  const prefs = readQuickAddPrefs(settingsData as Record<string, unknown> | undefined);
  const dateSettings = useDateSettings();
  const { all: allProjects, inbox, byId } = useProjects();
  // M12: share-to-app / widgets open the sheet with the shared text already in (`content`, `description` params).
  const [content, setContent] = useState(params.content ?? '');
  const [description, setDescription] = useState(params.description ?? '');
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string | null>(null);
  // M6c: the rule picked in the Date sheet (a rule typed as "every …" wins while it is recognised).
  const [manualRepeat, setManualRepeat] = useState<RecurrenceSpec | null>(null);
  const [due, setDue] = useState<DueValue>(() => (params.dueDate ? { ...NO_DUE, dueDate: params.dueDate } : NO_DUE));
  const [target, setTarget] = useState<{ projectId?: string; sectionId: string | null }>({
    projectId: params.projectId,
    sectionId: params.sectionId ?? null,
  });
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(NO_IGNORED);
  const [revealed, setRevealed] = useState<ReadonlySet<QuickAddChip>>(new Set());
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [pasted, setPasted] = useState<string[] | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const create = useCreateTask();
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();
  const nameRef = useRef<TextInputHandle>(null);
  const contentRef = useRef(content);
  contentRef.current = content;
  const isSubtask = !!params.parentId;

  const today = dateKeyInZone(now, timeZone);
  const wantsLabels = /(^|\s)[%@]/.test(content);
  const { labels } = useLabels(wantsLabels || labelIds.length > 0);
  const projectLookups = useMemo(
    () => allProjects.map((project) => ({ id: project.id, name: projectDisplayName(project) })),
    [allProjects],
  );
  const baseContext = {
    today,
    dateSettings,
    dateFormat: displayPrefs.dateFormat,
    smartDate: settings.smartDateRecognition,
    // A sub-task stays in its parent's project and section: # and / are not read.
    projects: isSubtask ? [] : projectLookups.map((project) => project.name),
    ignored,
  };
  const firstPass = parseQuickAdd(content, { ...baseContext, sections: [] });
  const projectId = parsedProjectId(firstPass, projectLookups) ?? target.projectId ?? inbox?.id;
  const needSections = !isSubtask && (target.sectionId !== null || /(^|\s)\//.test(content));
  const { sections } = useSections(needSections ? projectId : undefined);
  const parse: QuickAddParse = needSections
    ? parseQuickAdd(content, { ...baseContext, sections: sections.map((section) => section.name) })
    : firstPass;
  const manual: ManualChoice = { projectId: target.projectId ?? inbox?.id, sectionId: target.sectionId, due, priority, labelIds, deadline };
  const resolved: ResolvedQuickAdd = resolveQuickAdd(parse, manual, {
    projects: projectLookups,
    sections,
    labels,
    today,
  });

  const repeatSpec = resolved.recurrence ?? manualRepeat ?? undefined;
  const project = resolved.projectId ? byId.get(resolved.projectId) : undefined;
  const sectionName = sections.find((section) => section.id === resolved.sectionId)?.name;
  const projectLabel = project ? projectDisplayName(project) : '';
  const dueLabel = describeDue(resolved.due, now, timeZone);
  const hasTime = resolved.due.dueDatetime !== null;
  const reminders = useQuickAddReminders(hasTime);
  const dirty = content.trim().length > 0 || description.trim().length > 0;

  // Android Back closes the sheet: ask first when something was typed (spec 3.2 "Discard changes?").
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dirty) return false;
      setDiscardOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, [dirty]);

  function dismissKinds(...kinds: QuickAddTokenKind[]) {
    const keysToIgnore = parse.tokens.filter((token) => kinds.includes(token.kind)).map((token) => token.key);
    if (keysToIgnore.length > 0) setIgnored((current) => new Set([...current, ...keysToIgnore]));
  }

  function dismiss(key: string) {
    setIgnored((current) => new Set([...current, key]));
  }

  function changeName(next: string) {
    if (error) setError(undefined);
    const lines = pastedLines(content, next);
    if (lines) {
      setPasted(lines);
      return;
    }
    const removed = backspacedToken(content, next, parse.tokens);
    if (removed) {
      // Backspace right after a highlighted part: the part becomes plain text, nothing is deleted (Todoist).
      dismiss(removed.key);
      return;
    }
    setContent(next);
  }

  function changeSelection(event: TextInputSelectionChangeEvent) {
    const token = tappedToken(event.nativeEvent.selection, parse.tokens);
    if (!token) return;
    // A tap moves the caret without changing the text; typing changes both (then it is not a dismissal).
    const textAtTap = contentRef.current;
    setTimeout(() => {
      if (contentRef.current === textAtTap) dismiss(token.key);
    }, 0);
  }

  /** Labels typed with % that do not exist yet are created first (Todoist does the same). */
  async function ensureLabels(names: readonly string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const label = await labelsApi.create({ name }, newUuid());
      ids.push(label.id);
    }
    if (names.length > 0) await queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    return ids;
  }

  async function createOne(item: ResolvedQuickAdd) {
    const createdLabels = await ensureLabels(item.newLabelNames);
    const body = buildCreateBody({
      projectId: isSubtask ? (params.projectId ?? item.projectId) : item.projectId,
      sectionId: isSubtask ? (params.sectionId ?? null) : item.sectionId,
      parentId: params.parentId,
      content: item.content,
      description,
      priority: item.priority,
      due: item.due,
      labelIds: [...item.labelIds, ...createdLabels],
      deadline: item.deadline,
      recurrence: item.recurrence ?? manualRepeat,
    });
    const createdTask = await create.mutateAsync({ body, idempotencyKey: keys.keyFor(body) });
    keys.reset();
    // Reminder drafts belong to the task just created; a failure is shown below and never undoes the task.
    await reminders.attach(createdTask.id, item.reminders);
  }

  function afterAdded(message: string) {
    setContent('');
    setDescription('');
    setIgnored(NO_IGNORED);
    setRevealed(new Set());
    setError(undefined);
    setNotice(message);
    nameRef.current?.focus();
  }

  async function submit() {
    const problem = taskContentError(resolved.content);
    if (problem) {
      setError(problem);
      return;
    }
    await run(async () => {
      try {
        await createOne(resolved);
        afterAdded(t('quickAdd.added', { name: isSubtask ? resolved.content : projectLabel }));
      } catch (failure) {
        const view = describeError(failure);
        setNotice(undefined);
        setError(view.fields.content ?? view.message);
      }
    });
  }

  /** "Add N tasks": each line parsed on its own, the chips apply to all; stops at the first error. */
  async function submitLines(lines: string[]) {
    await run(async () => {
      let done = 0;
      let invalid: string | undefined;
      try {
        for (const line of lines) {
          const lineParse = parseQuickAdd(line, { ...baseContext, ignored: NO_IGNORED, sections: sections.map((s) => s.name) });
          const item = resolveQuickAdd(lineParse, manual, { projects: projectLookups, sections, labels, today });
          const problem = taskContentError(item.content);
          if (problem) {
            invalid = problem;
            break;
          }
          await createOne(item);
          done += 1;
        }
        if (invalid) {
          setPasted(null);
          setContent(lines.slice(done).join('\n'));
          setNotice(done > 0 ? t('quickAdd.addedSome', { done, count: lines.length }) : undefined);
          setError(invalid);
          return;
        }
        setPasted(null);
        afterAdded(t('quickAdd.addedMany', { count: done }));
      } catch (failure) {
        // The lines not created yet stay in the box (retry = "Add N tasks" again on the remaining ones).
        setPasted(lines.slice(done));
        setNotice(done > 0 ? t('quickAdd.addedSome', { done, count: lines.length }) : undefined);
        setError(describeError(failure).message);
      }
    });
  }

  function show(next: Overlay) {
    Keyboard.dismiss();
    setOverlay(next);
  }

  function close() {
    if (dirty) setDiscardOpen(true);
    else router.back();
  }

  const shownChips = visibleChips(prefs.chips, revealed, resolved);
  const hiddenAvailable = (Object.keys(CHIP_META) as QuickAddChip[]).filter(
    (chip) => chip !== 'PROJECT' && AVAILABLE_CHIPS.has(chip) && !shownChips.includes(chip),
  );
  const iconOnly = !prefs.showActionLabels;

  function chipFor(chip: QuickAddChip) {
    switch (chip) {
      case 'DATE':
        return (
          <Chip
            key={chip}
            large
            icon="calendar"
            label={dueLabel ? formatDueLabel(dueLabel) : t('quickAdd.date')}
            color={dueLabel ? dueTone(resolved.due, now, timeZone, palette) : undefined}
            onPress={() => show('date')}
            iconOnly={iconOnly && !dueLabel}
            testID="quick-add-date"
          />
        );
      case 'PRIORITY':
        return (
          <Chip
            key={chip}
            large
            icon="flag"
            label={resolved.priority < DEFAULT_PRIORITY ? `P${resolved.priority}` : t('quickAdd.priority')}
            color={resolved.priority < DEFAULT_PRIORITY ? priorityColor(resolved.priority, palette) : undefined}
            onPress={() => show('priority')}
            iconOnly={iconOnly && resolved.priority >= DEFAULT_PRIORITY}
            testID="quick-add-priority"
          />
        );
      case 'LABELS':
        return (
          <LabelChip
            key={chip}
            large
            labelIds={resolved.labelIds}
            onChange={(ids) => {
              dismissKinds('label');
              setLabelIds(ids);
            }}
            iconOnly={iconOnly}
            testID="quick-add-label"
          />
        );
      case 'REMINDERS':
        return <QuickAddReminderChip key={chip} reminders={reminders} hasTime={hasTime} timeZone={timeZone} iconOnly={iconOnly} />;
      case 'DEADLINE': {
        const label = describeDeadline(resolved.deadline, now, timeZone);
        return (
          <Chip
            key={chip}
            large
            icon="target"
            label={label ? formatDeadline(label) : t('quickAdd.deadline')}
            selected={!!label}
            onPress={() => show('deadline')}
            iconOnly={iconOnly && !label}
            testID="quick-add-deadline"
          />
        );
      }
      default:
        return null;
    }
  }

  const moreItems: ActionMenuItem[] = [
    ...hiddenAvailable.map((chip) => ({
      key: CHIP_META[chip].key,
      label: t(`quickAdd.chips.${CHIP_META[chip].key}`),
      icon: CHIP_META[chip].icon,
      onPress: () => {
        setRevealed((current) => new Set([...current, chip]));
        if (chip === 'DATE') setOverlay('date');
        if (chip === 'PRIORITY') setOverlay('priority');
        if (chip === 'DEADLINE') setOverlay('deadline');
      },
    })),
    { key: 'edit', label: t('quickAdd.editChips'), icon: 'sliders', onPress: () => router.push('/settings/quick-add') },
  ];

  const sendInactive = busy || !resolved.content.trim() || !online;
  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding" accessibilityViewIsModal>
      <Pressable
        testID="quick-add-scrim"
        accessibilityRole="button"
        accessibilityLabel={t('quickAdd.closeSheet')}
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={close}
      />
      <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
        <View style={styles.grab} />
        <HighlightedNameInput
          ref={nameRef}
          testID="quick-add-name"
          text={content}
          tokens={parse.tokens}
          onChangeText={changeName}
          onSelectionChange={changeSelection}
          placeholder={isSubtask ? t('quickAdd.subtaskPlaceholder') : t('quickAdd.placeholder')}
          placeholderTextColor={palette.mute}
          accessibilityLabel={t('quickAdd.placeholder')}
          autoFocus
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void submit()}
          style={styles.name}
        />
        {prefs.showDescription ? (
          <TextInput
            testID="quick-add-description"
            value={description}
            onChangeText={setDescription}
            placeholder={t('quickAdd.description')}
            placeholderTextColor={palette.mute}
            accessibilityLabel={t('quickAdd.description')}
            style={styles.description}
          />
        ) : null}
        <View style={styles.chips}>
          {shownChips.map(chipFor)}
          {repeatSpec ? (
            <Chip
              large
              icon="repeat"
              label={t('quickAdd.repeat', { rule: recurrenceLabel(repeatSpec, t) })}
              selected
              testID="quick-add-repeat"
            />
          ) : null}
          <Chip
            large
            icon="more-horizontal"
            label={t('quickAdd.more')}
            iconOnly
            onPress={() => show('more')}
            testID="quick-add-more"
          />
        </View>
        {parse.assignee ? <Text style={styles.hint}>{t('quickAdd.assigneeLater')}</Text> : null}
        {notice ? (
          <Text testID="quick-add-notice" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        <ErrorText message={error} testID="quick-add-error" />
        <ErrorText message={reminders.error} testID="quick-add-reminder-error" />
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
      <DateSheet
        visible={overlay === 'date'}
        value={resolved.due}
        repeat={repeatSpec ?? null}
        onSelect={(next, rule) => {
          dismissKinds('date');
          setDue(next);
          if (rule !== undefined) setManualRepeat(rule);
        }}
        onClose={() => setOverlay('none')}
        testID="quick-add-schedule"
      />
      <PriorityMenu
        visible={overlay === 'priority'}
        value={resolved.priority}
        onSelect={(next) => {
          dismissKinds('priority');
          setPriority(next);
        }}
        onClose={() => setOverlay('none')}
      />
      <ScheduleSheet
        visible={overlay === 'deadline'}
        value={{ dueDate: resolved.deadline, dueDatetime: null, durationMinutes: null }}
        mode="date"
        title={t('quickAdd.deadline')}
        noDateLabel={t('quickAdd.removeDeadline')}
        onSelect={(next) => {
          dismissKinds('deadline');
          setDeadline(next.dueDate);
        }}
        onClose={() => setOverlay('none')}
        testID="quick-add-deadline-sheet"
      />
      <ProjectSectionPicker
        visible={overlay === 'project'}
        value={{ projectId: resolved.projectId, sectionId: resolved.sectionId }}
        onSelect={(next) => {
          dismissKinds('project', 'section');
          setTarget(next);
        }}
        onClose={() => setOverlay('none')}
        testID="quick-add-picker"
      />
      <ActionMenu
        visible={overlay === 'more'}
        onClose={() => setOverlay('none')}
        items={moreItems}
        title={t('quickAdd.moreTitle')}
        testID="quick-add-more-menu"
      />
      <DialogFrame
        visible={discardOpen}
        title={t('quickAdd.discard.title')}
        onRequestClose={() => setDiscardOpen(false)}
        testID="quick-add-discard"
      >
        <Text style={styles.dialogMessage}>{t('quickAdd.discard.message')}</Text>
        <View style={styles.dialogActions}>
          <AppButton
            variant="outline"
            label={t('quickAdd.discard.keep')}
            onPress={() => setDiscardOpen(false)}
            testID="quick-add-discard-keep"
          />
          <AppButton
            variant="danger"
            label={t('quickAdd.discard.confirm')}
            onPress={() => {
              setDiscardOpen(false);
              router.back();
            }}
            testID="quick-add-discard-confirm"
          />
        </View>
      </DialogFrame>
      <DialogFrame
        visible={pasted !== null}
        title={t('quickAdd.paste.title', { count: pasted?.length ?? 0 })}
        onRequestClose={() => setPasted(null)}
        testID="quick-add-paste"
      >
        <Text style={styles.dialogMessage}>{t('quickAdd.paste.message', { count: pasted?.length ?? 0 })}</Text>
        <View style={styles.dialogColumn}>
          <AppButton
            variant="outline"
            label={t('quickAdd.paste.one')}
            disabled={busy}
            onPress={() => {
              const lines = pasted ?? [];
              setPasted(null);
              setContent(lines.join(' '));
            }}
            testID="quick-add-paste-one"
          />
          <AppButton
            variant="primary"
            label={t('quickAdd.paste.many', { count: pasted?.length ?? 0 })}
            busy={busy}
            requiresOnline
            onPress={() => void submitLines(pasted ?? [])}
            testID="quick-add-paste-many"
          />
        </View>
      </DialogFrame>
    </KeyboardAvoidingView>
  );
}

/** Chips in the row: the chosen ones in their order, then any other chip that holds a value or was opened from More. */
function visibleChips(
  chosen: readonly QuickAddChip[],
  revealed: ReadonlySet<QuickAddChip>,
  resolved: ResolvedQuickAdd,
): QuickAddChip[] {
  const withValue = new Set<QuickAddChip>();
  if (resolved.due.dueDate || resolved.due.dueDatetime) withValue.add('DATE');
  if (resolved.priority < DEFAULT_PRIORITY) withValue.add('PRIORITY');
  if (resolved.labelIds.length > 0) withValue.add('LABELS');
  if (resolved.reminders.length > 0) withValue.add('REMINDERS');
  if (resolved.deadline) withValue.add('DEADLINE');
  const extra = (Object.keys(CHIP_META) as QuickAddChip[]).filter(
    (chip) => !chosen.includes(chip) && (withValue.has(chip) || revealed.has(chip)),
  );
  return [...chosen, ...extra].filter((chip) => chip !== 'PROJECT' && AVAILABLE_CHIPS.has(chip));
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
    hint: { ...type.meta, color: palette.mute, marginBottom: 4 },
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
    dialogMessage: { ...type.bodySmall, color: palette.mute },
    dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
    dialogColumn: { gap: 8, marginTop: 18 },
  });
}
