import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { CommentTarget } from '../../api/comments';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorText } from '../../components/ErrorText';
import { useSnackbar } from '../../components/Snackbar';
import { useIsConnected } from '../../lib/useIsOnline';
import {
  buildSharedComment,
  stepAfterCommentChoice,
  type NamedDestination,
  type ShareDestination,
  type ShareStep,
} from '../../lib/share/shareDestination';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe } from '../auth/session';
import { CommentComposer } from '../comments/CommentComposer';
import { useCommentActions } from '../comments/useComments';
import { projectDisplayName } from '../projects/appearance';
import { isProjectReadOnly } from '../projects/projectReadOnly';
import { useProject } from '../projects/useProjects';
import { useTaskAccess } from '../tasks/detail/taskReadOnly';
import { useTask } from '../tasks/detail/useTask';
import { ShareTargetPicker } from './ShareTargetPicker';
import { useRecentDestinations } from './useRecentDestinations';

interface SharedContentSheetProps {
  /** The text shared into Taskly (never blank: the handler checks). */
  text: string;
  /** The task / project open on screen when the share arrived: the default destination of "Add to comment". */
  currentDestination: ShareDestination | null;
  /** "Create task": the handler opens Quick Add with the text and closes the sheet. */
  onCreateTask: () => void;
  onClose: () => void;
}

/**
 * X4 (Todoist "share → Task or Comment"): what to do with text shared into Taskly. Step 1 chooses Task / Comment; a
 * Comment goes to the open task / project, or to one picked in step 2; step 3 is the comment box with the text already in.
 * Cancel (Back, the scrim, the button) closes without sending anything.
 */
export function SharedContentSheet({ text, currentDestination, onCreateTask, onClose }: SharedContentSheetProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createSheetStyles);
  const snackbar = useSnackbar();
  const me = useMe();
  const recent = useRecentDestinations(me.data?.id);
  const [step, setStep] = useState<ShareStep>('choose');
  const [destination, setDestination] = useState<ShareDestination | null>(null);
  const content = buildSharedComment(text) ?? '';

  function chooseComment() {
    const next = stepAfterCommentChoice(currentDestination);
    setDestination(next.destination);
    setStep(next.step);
  }

  function picked(entry: NamedDestination) {
    setDestination({ kind: entry.kind, id: entry.id });
    setStep('compose');
  }

  function sent(entry: NamedDestination) {
    recent.remember(entry);
    snackbar.show({ message: t('shareTarget.sent') });
    onClose();
  }

  return (
    <BottomSheet visible onClose={onClose} title={step === 'pick' ? t('shareTarget.pickTitle') : t('shareTarget.title')} testID="share-sheet">
      <Text style={[type.body, styles.preview]} numberOfLines={step === 'compose' ? 2 : 4} testID="share-preview">
        {content}
      </Text>
      {step === 'choose' ? (
        <View testID="share-choose">
          <AppButton label={t('shareTarget.createTask')} icon="check-circle" onPress={onCreateTask} full testID="share-choose-task" />
          <Text style={[type.meta, styles.hint]}>{t('shareTarget.createTaskHint')}</Text>
          <AppButton
            label={t('shareTarget.addComment')}
            icon="message-circle"
            variant="outline"
            onPress={chooseComment}
            full
            testID="share-choose-comment"
          />
          <Text style={[type.meta, styles.hint]}>{t('shareTarget.addCommentHint')}</Text>
        </View>
      ) : null}
      {step === 'pick' ? <ShareTargetPicker recent={recent.items} onPick={picked} /> : null}
      {step === 'compose' && destination ? (
        <ComposeStep
          key={`${destination.kind}-${destination.id}`}
          destination={destination}
          text={content}
          onChange={() => setStep('pick')}
          onSent={sent}
        />
      ) : null}
      <AppButton variant="ghost" label={t('shareTarget.cancel')} onPress={onClose} full testID="share-cancel" />
    </BottomSheet>
  );
}

interface ComposeStepProps {
  destination: ShareDestination;
  text: string;
  onChange: () => void;
  onSent: (destination: NamedDestination) => void;
}

/**
 * The comment box for one destination, after checking it can take a comment: the task / project is loaded first
 * (404 / 403 → the reason and "choose another"; an archived project → read-only notice; a completed task → a note,
 * M8b still allows comments on it). The text stays in the box when sending fails (offline, 403, 404, 409…).
 */
function ComposeStep({ destination, text, onChange, onSent }: ComposeStepProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createSheetStyles);
  const online = useIsConnected();
  const task = useTask(destination.kind === 'task' ? destination.id : undefined);
  const project = useProject(destination.kind === 'project' ? destination.id : undefined);
  const access = useTaskAccess(task.data);
  const query = destination.kind === 'task' ? task : project;

  if (query.isError) {
    return (
      <View testID="share-compose-error">
        <ErrorText message={describeError(query.error).message} />
        <AppButton variant="outline" label={t('shareTarget.chooseAnother')} onPress={onChange} full testID="share-choose-another" />
      </View>
    );
  }
  if (query.data === undefined) {
    return (
      <View style={styles.loading} testID="share-compose-loading">
        <ActivityIndicator />
        <Text style={type.meta}>{t('shareTarget.loadingTarget')}</Text>
      </View>
    );
  }

  const name = destination.kind === 'task' ? (task.data?.content ?? '') : project.data ? projectDisplayName(project.data) : '';
  const archived = destination.kind === 'task' ? access.archived : isProjectReadOnly(project.data);
  const completed = destination.kind === 'task' && access.completed;
  const named: NamedDestination = { ...destination, name };

  return (
    <View testID="share-compose">
      <View style={styles.target}>
        <Text style={[type.bodyStrong, styles.targetName]} numberOfLines={2} testID="share-compose-target">
          {t('shareTarget.composeTo', { name })}
        </Text>
        <AppButton variant="ghost" size="sm" label={t('shareTarget.change')} onPress={onChange} testID="share-change" />
      </View>
      {completed ? (
        <Text style={[type.meta, styles.note]} testID="share-task-completed">
          {t('shareTarget.taskCompleted')}
        </Text>
      ) : null}
      {archived ? (
        <ErrorText testID="share-archived" message={t('shareTarget.archived')} />
      ) : (
        <>
          {online ? null : <ErrorText testID="share-offline" message={t('shareTarget.offline')} />}
          <ComposeBox target={commentTarget(destination)} text={text} onSent={() => onSent(named)} />
        </>
      )}
    </View>
  );
}

const commentTarget = (destination: ShareDestination): CommentTarget => ({ kind: destination.kind, id: destination.id });

/** useCommentActions needs a stable target, so the box is its own component. */
function ComposeBox({ target, text, onSent }: { target: CommentTarget; text: string; onSent: () => void }) {
  const actions = useCommentActions(target);
  return <CommentComposer target={target} actions={actions} initialText={text} onSent={onSent} />;
}

function createSheetStyles(palette: Palette) {
  return StyleSheet.create({
    preview: {
      color: palette.ink2,
      borderLeftWidth: 3,
      borderLeftColor: palette.acc,
      paddingLeft: 10,
      marginBottom: 14,
    },
    hint: { color: palette.mute, marginTop: 4, marginBottom: 12 },
    loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
    target: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    targetName: { flex: 1, color: palette.ink },
    note: { color: palette.mute, marginBottom: 6 },
  });
}
