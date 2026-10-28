import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { AttachmentResponse } from '../../api/comments';
import { size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { formatFileSize } from './commentRules';
import { openAttachment } from './useComments';

/** The file of a comment: name + size; pressing asks for a signed link and opens it in the system viewer. */
export function AttachmentCard({ attachment, testID }: { attachment: AttachmentResponse; testID: string }) {
  const styles = useThemedStyles(createAttachmentCardStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const [failed, setFailed] = useState<string | null>(null);

  async function open() {
    setFailed(null);
    try {
      await openAttachment(attachment.id);
    } catch (error) {
      setFailed(describeError(error).message || t('comments.openFileFailed'));
    }
  }

  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t('comments.openFile', { name: attachment.fileName })}
        onPress={() => void open()}
        style={styles.card}
      >
        <Feather name={attachment.isImage ? 'image' : 'file'} size={size.icon} color={palette.ink2} />
        <View style={styles.texts}>
          <Text style={[type.body, styles.name]} numberOfLines={1}>
            {attachment.fileName}
          </Text>
          <Text style={[type.meta, styles.size]}>{formatFileSize(attachment.sizeBytes)}</Text>
        </View>
      </Pressable>
      {failed ? (
        <Text testID={`${testID}-error`} accessibilityRole="alert" style={[type.meta, styles.error]}>
          {failed}
        </Text>
      ) : null}
    </View>
  );
}

function createAttachmentCardStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: palette.line2,
      borderRadius: 12,
      marginTop: 8,
    },
    texts: { flex: 1 },
    name: { color: palette.ink },
    size: { color: palette.mute },
    error: { color: palette.warn, marginTop: 4 },
  });
}
