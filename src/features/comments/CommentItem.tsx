import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CommentResponse } from '../../api/comments';
import { Avatar } from '../../components/Avatar';
import { fonts, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { AttachmentCard } from './AttachmentCard';
import { highlightMentions } from './commentRules';
import { stampLabel } from './commentTime';

interface CommentItemProps {
  comment: CommentResponse;
  now: Date;
  timeZone: string;
  /** Names of the people mentioned in this comment (drawn in the accent colour). */
  mentionNames: string[];
  readOnly: boolean;
  onLongPress: (comment: CommentResponse) => void;
  onToggleReaction: (comment: CommentResponse, emoji: string, add: boolean) => void;
}

/** One comment: avatar + name + time, text with accent @mentions, file card, reaction chips; long press = actions. */
export function CommentItem({ comment, now, timeZone, mentionNames, readOnly, onLongPress, onToggleReaction }: CommentItemProps) {
  const styles = useThemedStyles(createCommentItemStyles);
  const { t } = useTranslation();
  const author = comment.author;
  const name = comment.isMine ? t('comments.you') : (author?.name ?? t('comments.deletedAuthor'));
  const segments = highlightMentions(comment.content, mentionNames);
  return (
    <Pressable
      testID={`comment-${comment.id}`}
      accessibilityHint={t('comments.react')}
      onLongPress={() => onLongPress(comment)}
      style={styles.row}
    >
      <Avatar name={author?.name ?? '?'} seed={author?.id ?? comment.id} size="m" uri={author?.avatarUrl} />
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.time}>{stampLabel(comment.createdAt, now, timeZone)}</Text>
        </View>
        {comment.content ? (
          <Text testID={`comment-text-${comment.id}`} style={styles.text}>
            {segments.map((segment, index) => (
              <Text key={index} style={segment.mention ? styles.mention : undefined}>
                {segment.text}
              </Text>
            ))}
          </Text>
        ) : null}
        {comment.attachment ? <AttachmentCard attachment={comment.attachment} testID={`comment-file-${comment.id}`} /> : null}
        {comment.reactions.length > 0 ? (
          <View style={styles.reactions}>
            {comment.reactions.map((reaction) => (
              <Pressable
                key={reaction.emoji}
                testID={`comment-reaction-${comment.id}-${reaction.emoji}`}
                accessibilityRole="button"
                accessibilityLabel={t('comments.reactionLabel', { emoji: reaction.emoji, count: reaction.count })}
                accessibilityState={{ selected: reaction.reactedByMe, disabled: readOnly }}
                disabled={readOnly}
                onPress={() => onToggleReaction(comment, reaction.emoji, !reaction.reactedByMe)}
                style={[styles.chip, reaction.reactedByMe && styles.chipOn]}
              >
                <Text style={styles.chipText}>
                  {reaction.emoji} {reaction.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function createCommentItemStyles(palette: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
    body: { flex: 1 },
    head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    name: { ...type.bodyStrong, color: palette.ink, flexShrink: 1 },
    time: { ...type.meta, color: palette.mute },
    text: { ...type.body, color: palette.ink, marginTop: 2 },
    mention: { fontFamily: fonts.semibold, color: palette.acc2 },
    reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chip: { paddingHorizontal: 10, minHeight: 32, justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: palette.line2 },
    chipOn: { backgroundColor: palette.soft, borderColor: palette.acc },
    chipText: { ...type.meta, color: palette.ink },
  });
}
