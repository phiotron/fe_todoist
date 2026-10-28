import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';
import type { QuickAddToken } from '../../lib/quickadd';
import { useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import type { TextInputHandle } from '../auth/AuthTextField';
import { segments } from './quickAddText';

interface HighlightedNameInputProps extends Omit<TextInputProps, 'value' | 'children'> {
  text: string;
  tokens: readonly QuickAddToken[];
}

/**
 * The Quick Add name with recognised parts highlighted while typing (spec 3.2 M6b; Todoist paints them orange, Taskly
 * uses the teal accent on its soft background). The text is given as styled children instead of `value`.
 */
export const HighlightedNameInput = forwardRef<TextInputHandle, HighlightedNameInputProps>(function HighlightedNameInput(
  { text, tokens, ...props },
  ref,
) {
  const styles = useThemedStyles(createHighlightStyles);
  return (
    <TextInput ref={ref} {...props}>
      {segments(text, tokens).map((segment, index) =>
        segment.highlighted ? (
          <Text key={index} testID="quick-add-highlight" style={styles.highlight}>
            {segment.text}
          </Text>
        ) : (
          <Text key={index}>{segment.text}</Text>
        ),
      )}
    </TextInput>
  );
});

function createHighlightStyles(palette: Palette) {
  return StyleSheet.create({
    highlight: { backgroundColor: palette.soft, color: palette.acc2 },
  });
}
