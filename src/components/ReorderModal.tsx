import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { afterIdAt, moveItem } from '../lib/reorder';
import { useIsOnline } from '../lib/useIsOnline';
import { radius, shadow, size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';
import { AppButton } from './AppButton';
import { ErrorText } from './ErrorText';
import { IconButton } from './IconButton';

export interface ReorderItem {
  id: string;
  label: string;
}

interface ReorderModalProps {
  visible: boolean;
  title: string;
  /** One container only (spec 12.4): projects, sections of a project, or root tasks of one section. */
  items: readonly ReorderItem[];
  /** Called once per move with the moved id and the id now right before it (null = top). */
  onMove: (id: string, afterId: string | null) => void;
  onClose: () => void;
  error?: string;
  testID?: string;
}

/**
 * Drag (react-native-draggable-flatlist, spec 9.2) plus ↑/↓ buttons on every row: the buttons serve screen
 * readers and keep reordering possible if dragging misbehaves on a device.
 */
export function ReorderModal({
  visible,
  title,
  items,
  onMove,
  onClose,
  error,
  testID = 'reorder',
}: ReorderModalProps) {
  const styles = useThemedStyles(createReorderModalStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const online = useIsOnline();
  const [order, setOrder] = useState<ReorderItem[]>(() => [...items]);
  // Reset only when the server order really changed (parents rebuild the array on every render).
  const signature = items.map((item) => `${item.id}:${item.label}`).join('|');
  useEffect(() => {
    setOrder([...items]);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  function apply(from: number, to: number) {
    if (!online || from === to || to < 0 || to >= order.length) return;
    const next = moveItem(order, from, to);
    setOrder(next);
    onMove(next[to].id, afterIdAt(next, to));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Gestures inside an Android Modal need their own root view. */}
      <GestureHandlerRootView style={styles.fill}>
        <View style={styles.backdrop}>
          <View style={styles.card} testID={testID}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.hint}>{t('reorder.hint')}</Text>
            <ErrorText message={error} testID={`${testID}-error`} />
            <DraggableFlatList
              testID={`${testID}-list`}
              data={order}
              keyExtractor={(item) => item.id}
              onDragEnd={({ from, to }) => apply(from, to)}
              renderItem={({ item, drag, isActive, getIndex }) => {
                const index = getIndex() ?? 0;
                return (
                  <ScaleDecorator>
                    <View style={[styles.row, isActive && styles.rowActive]} testID={`${testID}-row-${item.id}`}>
                      <Pressable
                        onLongPress={drag}
                        delayLongPress={150}
                        disabled={!online}
                        accessibilityLabel={t('reorder.drag', { name: item.label })}
                        style={styles.handle}
                      >
                        <Feather name="menu" size={size.icon} color={palette.mute} />
                      </Pressable>
                      <Text style={styles.label} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <IconButton
                        icon="arrow-up"
                        label={t('reorder.moveUp', { name: item.label })}
                        disabled={index === 0}
                        requiresOnline
                        onPress={() => apply(index, index - 1)}
                        testID={`${testID}-up-${item.id}`}
                      />
                      <IconButton
                        icon="arrow-down"
                        label={t('reorder.moveDown', { name: item.label })}
                        disabled={index === order.length - 1}
                        requiresOnline
                        onPress={() => apply(index, index + 1)}
                        testID={`${testID}-down-${item.id}`}
                      />
                    </View>
                  </ScaleDecorator>
                );
              }}
            />
            <AppButton label={t('reorder.done')} onPress={onClose} testID={`${testID}-done`} />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function createReorderModalStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: palette.scrimLight, justifyContent: 'center', padding: 16 },
    card: { backgroundColor: palette.bg, borderRadius: radius.dialog, padding: 16, maxHeight: '90%', ...shadow },
    title: { ...type.dialogTitle, color: palette.ink },
    hint: { ...type.meta, color: palette.mute, marginVertical: 6 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.listRow,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
      backgroundColor: palette.bg,
    },
    rowActive: { backgroundColor: palette.bg2 },
    handle: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
    label: { ...type.body, flex: 1, color: palette.ink },
  });
}
