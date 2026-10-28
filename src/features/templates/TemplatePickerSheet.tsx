import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { TemplateRef } from '../../api/templates';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorText } from '../../components/ErrorText';
import { useSnackbar } from '../../components/Snackbar';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useIsOnline } from '../../lib/useIsOnline';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useApplyTemplate, useLibraryTemplates, useMyTemplates } from './useTemplates';

interface TemplatePickerSheetProps {
  visible: boolean;
  /** The open project the chosen template is appended to. */
  projectId: string;
  onClose: () => void;
}

interface Choice {
  ref: TemplateRef;
  key: string;
  name: string;
}

/** "Apply a template" (project menu): my templates then the library; choosing one appends it to the project. */
export function TemplatePickerSheet(props: TemplatePickerSheetProps) {
  // Mounted only while open: nothing is fetched for every project screen.
  return props.visible ? <TemplatePickerSheetBody {...props} /> : null;
}

function TemplatePickerSheetBody({ visible, projectId, onClose }: TemplatePickerSheetProps) {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const online = useIsOnline();
  const snackbar = useSnackbar();
  const mine = useMyTemplates(visible);
  const library = useLibraryTemplates(visible);
  const apply = useApplyTemplate();
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();

  const choices: Choice[] = [
    ...(mine.data ?? []).map((template) => ({ ref: { source: 'MINE' as const, id: template.id }, key: template.id, name: template.name })),
    ...(library.data ?? []).map((template) => ({
      ref: { source: 'LIBRARY' as const, key: template.key },
      key: `library-${template.key}`,
      name: template.name,
    })),
  ];

  function choose(choice: Choice) {
    void run(async () => {
      try {
        const body = { projectId };
        await apply.mutateAsync({ ref: choice.ref, body, idempotencyKey: keys.keyFor({ ...choice.ref, ...body }) });
        keys.reset();
        onClose();
        snackbar.show({ message: t('templates.apply.applied') });
      } catch {
        // apply.error is shown in the sheet.
      }
    });
  }

  const loading = (mine.isPending || library.isPending) && choices.length === 0;
  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        apply.reset();
        onClose();
      }}
      title={t('templates.apply.pickTitle')}
      testID="template-picker"
    >
      {loading ? <ActivityIndicator color={palette.acc} /> : null}
      <ErrorText message={apply.error ? describeError(apply.error).message : undefined} testID="template-picker-error" />
      {choices.map((choice) => (
        <Pressable
          key={choice.key}
          testID={`template-picker-${choice.key}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || !online }}
          disabled={busy || !online}
          onPress={() => choose(choice)}
          style={[styles.row, (busy || !online) && styles.inactive]}
        >
          <Feather name="layers" size={size.icon} color={palette.ink2} />
          <View style={styles.label}>
            <Text style={[type.body, styles.text]} numberOfLines={1}>
              {choice.name}
            </Text>
          </View>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: size.menuRow,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    label: { flex: 1 },
    text: { color: palette.ink },
    inactive: { opacity: 0.4 },
  });
}
