import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CommentResponse, CommentTarget } from '../../api/comments';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { ListRow } from '../../components/ListRow';
import { useDayStableNow } from '../../lib/dayStableNow';
import { useNow } from '../../lib/useNow';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';
import { QUICK_REACTIONS } from './commentRules';
import { useCommentActions, useComments, useMentionable } from './useComments';

interface CommentThreadProps {
  target: CommentTarget;
  /** Archived project / section: the server answers 409 to every write, so the composer and the actions are hidden. */
  readOnly: boolean;
  /** Task detail draws its own "Comment (N)" title above the thread; the project screen has a header instead. */
  showTitle?: boolean;
}

const NO_NAMES: string[] = [];
const ignoreLongPress = () => undefined;

/** The comments of a task or a project, oldest first, with the composer under them (plan M8b F1 + F3). */
export function CommentThread({ target, readOnly, showTitle = false }: CommentThreadProps) {
  const styles = useThemedStyles(createCommentThreadStyles);
  const { t } = useTranslation();
  const timeZone = useUserTimeZone();
  const now = useDayStableNow(useNow(), timeZone);
  const query = useComments(target);
  const people = useMentionable(target, (query.data ?? []).some((comment) => comment.mentionUserIds.length > 0));
  const actions = useCommentActions(target);
  const [selected, setSelected] = useState<CommentResponse | null>(null);
  const [deleting, setDeleting] = useState<CommentResponse | null>(null);

  const names = useMemo(() => new Map((people.data ?? []).map((person) => [person.id, person.name])), [people.data]);
  const comments = useMemo(() => query.data ?? [], [query.data]);
  // PERF4: stable props so every CommentItem (React.memo) stays still when the thread re-renders (sheet opened, tick).
  const mentionNamesOf = useMemo(
    () =>
      new Map(
        comments.map((comment) => [
          comment.id,
          comment.mentionUserIds.map((id) => names.get(id)).filter((name): name is string => name !== undefined),
        ]),
      ),
    [comments, names],
  );
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const toggle = useCallback((comment: CommentResponse, emoji: string, add: boolean) => {
    void actionsRef.current.toggleReaction(comment.id, emoji, add);
  }, []);

  const reactionOf = (comment: CommentResponse, emoji: string) => comment.reactions.find((reaction) => reaction.emoji === emoji);

  return (
    <View testID="comment-thread">
      {showTitle ? (
        <Text accessibilityRole="header" style={styles.title}>
          {t('comments.sectionTitle', { n: comments.length })}
        </Text>
      ) : null}
      {query.data === undefined ? (
        <QueryStateView query={query} testID="comments-state" />
      ) : comments.length === 0 ? (
        <StateView tone="ok" icon="message-circle" title={t('comments.empty')} testID="comments-empty" />
      ) : (
        comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            now={now}
            timeZone={timeZone}
            mentionNames={mentionNamesOf.get(comment.id) ?? NO_NAMES}
            readOnly={readOnly}
            onLongPress={readOnly ? ignoreLongPress : setSelected}
            onToggleReaction={toggle}
          />
        ))
      )}
      <ErrorText testID="comments-delete-error" message={actions.deleteError} />
      {readOnly ? null : <CommentComposer target={target} actions={actions} />}

      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} title={t('comments.react')} testID="comment-actions">
        <View style={styles.emojis}>
          {QUICK_REACTIONS.map((emoji) => {
            const mine = selected ? reactionOf(selected, emoji)?.reactedByMe === true : false;
            return (
              <Pressable
                key={emoji}
                testID={`comment-emoji-${emoji}`}
                accessibilityRole="button"
                accessibilityLabel={emoji}
                accessibilityState={{ selected: mine }}
                onPress={() => {
                  if (selected) toggle(selected, emoji, !mine);
                  setSelected(null);
                }}
                style={[styles.emoji, mine && styles.emojiOn]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
        {selected?.isMine ? (
          <ListRow
            testID="comment-delete"
            title={t('comments.delete')}
            icon="trash-2"
            onPress={() => {
              setDeleting(selected);
              setSelected(null);
              actions.clearDeleteError();
            }}
          />
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        visible={deleting !== null}
        title={t('comments.deleteTitle')}
        message={t('comments.deleteMessage')}
        confirmLabel={t('common.delete')}
        destructive
        busy={actions.deleting}
        error={actions.deleteError}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void actions.deleteOne(deleting.id).then((done) => {
            if (done) setDeleting(null);
          });
        }}
        testID="comment-delete-dialog"
      />
    </View>
  );
}

function createCommentThreadStyles(palette: Palette) {
  return StyleSheet.create({
    title: { ...type.section, color: palette.ink, paddingTop: 16, paddingBottom: 4 },
    emojis: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
    emoji: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    emojiOn: { backgroundColor: palette.soft },
    emojiText: { fontSize: 26 },
  });
}
