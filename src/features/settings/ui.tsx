import { Feather } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { ListRow } from '../../components/ListRow';
import { RadioRow } from '../../components/RadioRow';
import { Toggle } from '../../components/Toggle';
import { size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

/** Building blocks of the settings pages after the approved design (M-Settings; taskly.css .sec / .lrow / .tog). */
export function createSettingsStyles(palette: Palette) {
  return StyleSheet.create({
    section: { marginBottom: 8 },
    sectionTitle: { ...type.section, color: palette.ink, paddingTop: 16, paddingBottom: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 52,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    rowTexts: { flex: 1, paddingVertical: 8 },
    rowLabel: { ...type.body, flex: 1, color: palette.ink },
    rowHint: { ...type.meta, color: palette.mute, marginTop: 2 },
    body: { ...type.body, color: palette.ink, marginBottom: 8 },
    hint: { ...type.meta, color: palette.mute, marginBottom: 8 },
    success: { ...type.meta, color: palette.ok, marginVertical: 6 },
    notice: {
      ...type.meta,
      backgroundColor: palette.p2s,
      color: palette.ink,
      padding: 12,
      borderRadius: 12,
      marginTop: 12,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    banner: { backgroundColor: palette.p2s, paddingHorizontal: 20, paddingVertical: 12 },
    bannerText: { ...type.meta, color: palette.ink },
    page: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: 20, paddingBottom: 48 },
    swatch: { width: 20, height: 20, borderRadius: 10 },
  });
}

export type SettingsStyles = ReturnType<typeof createSettingsStyles>;

export function useSettingsStyles(): SettingsStyles {
  return useThemedStyles(createSettingsStyles);
}

/** A group of settings with an optional .sec title. */
export function SettingsSection({ testID, title, children }: { testID: string; title?: string; children: ReactNode }) {
  const styles = useSettingsStyles();
  return (
    <View testID={testID} style={styles.section}>
      {title ? (
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export interface Choice<V extends string> {
  value: V;
  label: string;
  /** Drawn before the label (e.g. an accent swatch). */
  accessory?: ReactNode;
}

interface ChoiceListProps<V extends string> {
  testIDPrefix: string;
  choices: readonly Choice<V>[];
  selected: V | null;
  onSelect: (value: V) => void;
  disabled?: boolean;
}

/**
 * One radio row per choice: M1's RadioRow (.lrow with a Feather check). RadioRow only takes a Feather icon, so a choice
 * with an `accessory` (the colour swatch of a theme) is drawn here with the same metrics and the same check.
 */
export function ChoiceList<V extends string>({ testIDPrefix, choices, selected, onSelect, disabled = false }: ChoiceListProps<V>) {
  const styles = useSettingsStyles();
  const { palette } = useTheme();
  return (
    <View accessibilityRole="radiogroup">
      {choices.map((choice) => {
        const checked = choice.value === selected;
        const testID = `${testIDPrefix}-${choice.value}`;
        if (!choice.accessory) {
          return (
            <RadioRow
              key={choice.value}
              testID={testID}
              title={choice.label}
              selected={checked}
              disabled={disabled}
              onPress={() => onSelect(choice.value)}
            />
          );
        }
        return (
          <Pressable
            key={choice.value}
            testID={testID}
            accessibilityRole="radio"
            accessibilityLabel={choice.label}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => onSelect(choice.value)}
            style={styles.row}
          >
            {choice.accessory}
            <Text style={styles.rowLabel}>{choice.label}</Text>
            {checked ? <Feather name="check" size={size.icon} color={palette.acc} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

interface SwitchRowProps {
  testID: string;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/** .lrow with a .tog switch (Toggle of M1) and an optional hint under the label. */
export function SwitchRow({ testID, label, hint, value, onChange, disabled = false }: SwitchRowProps) {
  const styles = useSettingsStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rowTexts}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Toggle testID={testID} label={label} value={value} onChange={onChange} disabled={disabled} />
    </View>
  );
}

interface PickerRowProps<V extends string> {
  testID: string;
  label: string;
  /** Text of the current value, shown on the right. */
  valueLabel: string;
  /** Title of the sheet (defaults to the label). */
  title?: string;
  options: readonly Choice<V>[];
  selected: V | null;
  onSelect: (value: V) => void;
  disabled?: boolean;
}

/** .lrow showing the current value; pressing opens the options in a bottom sheet, choosing one closes it. */
export function PickerRow<V extends string>({
  testID,
  label,
  valueLabel,
  title,
  options,
  selected,
  onSelect,
  disabled = false,
}: PickerRowProps<V>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListRow
        testID={testID}
        title={label}
        right={valueLabel}
        chevron
        accessibilityLabel={`${label}, ${valueLabel}`}
        onPress={disabled ? undefined : () => setOpen(true)}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title ?? label} testID={`${testID}-sheet`}>
        <ChoiceList
          testIDPrefix={`${testID}-option`}
          choices={options}
          selected={selected}
          onSelect={(value) => {
            setOpen(false);
            onSelect(value);
          }}
        />
      </BottomSheet>
    </>
  );
}

/** Confirmation line ("Saved"); errors use ErrorText from src/components. */
export function SuccessText({ testID, text }: { testID: string; text?: string }) {
  const styles = useSettingsStyles();
  if (!text) return null;
  return (
    <Text testID={testID} accessibilityLiveRegion="polite" style={styles.success}>
      {text}
    </Text>
  );
}
