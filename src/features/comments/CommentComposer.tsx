import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  COMMENT_FILE_MAX_BYTES,
  COMMENT_MAX_LENGTH,
  commentsApi,
  type AttachmentResponse,
  type CommentAuthor,
  type CommentTarget,
} from '../../api/comments';
import { describeError } from '../../api/describeError';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { Avatar } from '../../components/Avatar';
import { pickFile } from '../../lib/filePicker';
import { useIsOnline } from '../../lib/useIsOnline';
import { size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe } from '../auth/session';
import { activeMentionIds, commentTextProblem, filterMentionable, formatFileSize, insertMention, mentionFragment } from './commentRules';
import { useCommentActions, useMentionable } from './useComments';

interface CommentComposerProps {
  target: CommentTarget;
  actions: ReturnType<typeof useCommentActions>;
  /** X4: text already in the box (a share into Taskly). Read once, when the composer is created. */
  initialText?: string;
  /** X4: called after the comment was sent (the box has been cleared). */
  onSent?: () => void;
}

/** Comment box: text (≤ 15 000), one file (≤ 100 MB, uploaded first), @mention picker, Send. Clears itself once sent. */
export function CommentComposer({ target, actions, initialText = '', onSent }: CommentComposerProps) {
  const styles = useThemedStyles(createCommentComposerStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const online = useIsOnline();
  const me = useMe();
  const [text, setText] = useState(initialText);
  const [attachment, setAttachment] = useState<AttachmentResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();
  // id -> name of the people picked from the list (their "@Name" is notified if it is still in the text).
  const [picked, setPicked] = useState<ReadonlyMap<string, string>>(new Map());

  const fragment = mentionFragment(text);
  const mentionable = useMentionable(target, fragment !== null);
  const suggestions = fragment === null ? [] : filterMentionable((mentionable.data ?? []).filter((p) => p.id !== me.data?.id), fragment);

  const problem = commentTextProblem(text, attachment !== null);
  const tooLong = problem === 'tooLong';
  const canSend = problem === null && !uploading && !actions.busy && online;

  async function attach() {
    if (uploading) return;
    setLocalError(undefined);
    const file = await pickFile();
    if (!file) return;
    if (file.size !== null && file.size > COMMENT_FILE_MAX_BYTES) {
      setLocalError(t('comments.fileTooLarge'));
      return;
    }
    setUploading(true);
    try {
      setAttachment(await commentsApi.upload({ uri: file.uri, name: file.name, type: file.mimeType }));
    } catch (error) {
      setLocalError(describeError(error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!canSend) return;
    setLocalError(undefined);
    const mentionUserIds = activeMentionIds(text, picked);
    const sent = await actions.send({
      content: text.trim(),
      ...(attachment ? { attachmentId: attachment.id } : {}),
      ...(mentionUserIds.length > 0 ? { mentionUserIds } : {}),
    });
    if (sent) {
      setText('');
      setAttachment(null);
      setPicked(new Map());
      onSent?.();
    }
  }

  function pick(person: CommentAuthor) {
    setText((current) => insertMention(current, person));
    setPicked((current) => new Map(current).set(person.id, person.name));
  }

  return (
    <View style={styles.box} testID="comment-composer">
      {suggestions.length > 0 ? (
        <View style={styles.suggestions} testID="comment-mention-list">
          {suggestions.map((person) => (
            <Pressable
              key={person.id}
              testID={`comment-mention-${person.id}`}
              accessibilityRole="button"
              accessibilityLabel={person.name}
              onPress={() => pick(person)}
              style={styles.suggestion}
            >
              <Avatar name={person.name} seed={person.id} size="s" uri={person.avatarUrl} />
              <Text style={[type.body, styles.suggestionName]} numberOfLines={1}>
                {person.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {fragment !== null && !mentionable.isPending && suggestions.length === 0 ? (
        <Text style={[type.meta, styles.none]} testID="comment-mention-none">
          {t('comments.mentionNone')}
        </Text>
      ) : null}
      {attachment ? (
        <View style={styles.file} testID="comment-pending-file">
          <Feather name={attachment.isImage ? 'image' : 'file'} size={size.icon} color={palette.ink2} />
          <Text style={[type.body, styles.fileName]} numberOfLines={1}>
            {attachment.fileName} · {formatFileSize(attachment.sizeBytes)}
          </Text>
          <IconButton icon="x" label={t('comments.removeAttachment')} onPress={() => setAttachment(null)} testID="comment-remove-file" />
        </View>
      ) : null}
      {uploading ? (
        <View style={styles.file} testID="comment-uploading">
          <ActivityIndicator color={palette.acc} />
          <Text style={[type.meta, styles.fileName]}>{t('comments.uploading')}</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <IconButton icon="paperclip" label={t('comments.attach')} onPress={() => void attach()} requiresOnline disabled={uploading || attachment !== null} testID="comment-attach" />
        <IconButton icon="at-sign" label={t('comments.mention')} onPress={() => setText((current) => `${current}${current === '' || /\s$/.test(current) ? '' : ' '}@`)} testID="comment-mention-button" />
        <TextInput
          testID="comment-input"
          accessibilityLabel={t('comments.title')}
          placeholder={t('comments.placeholder')}
          placeholderTextColor={palette.mute}
          value={text}
          onChangeText={setText}
          multiline
          style={styles.input}
        />
        <IconButton
          icon="send"
          label={t('comments.send')}
          onPress={() => void submit()}
          disabled={!canSend}
          color={canSend ? palette.acc : undefined}
          testID="comment-send"
        />
      </View>
      {tooLong ? <ErrorText testID="comment-too-long" message={t('comments.tooLong', { n: COMMENT_MAX_LENGTH })} /> : null}
      <ErrorText testID="comment-error" message={localError ?? actions.error} />
    </View>
  );
}

function createCommentComposerStyles(palette: Palette) {
  return StyleSheet.create({
    box: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8, marginTop: 8 },
    row: { flexDirection: 'row', alignItems: 'flex-end' },
    input: {
      ...type.body,
      flex: 1,
      minHeight: 44,
      maxHeight: 140,
      color: palette.ink,
      borderWidth: 1,
      borderColor: palette.line2,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
    },
    suggestions: { borderWidth: 1, borderColor: palette.line2, borderRadius: 12, marginBottom: 8, backgroundColor: palette.bg },
    suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12 },
    suggestionName: { flex: 1, color: palette.ink },
    none: { color: palette.mute, marginBottom: 8 },
    file: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginBottom: 6 },
    fileName: { flex: 1, color: palette.ink },
  });
}
