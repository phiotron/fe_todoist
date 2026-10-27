import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { ViewKey } from '../../api/viewOptions';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { Chip } from '../../components/Chip';
import { ErrorText } from '../../components/ErrorText';
import { Toggle } from '../../components/Toggle';
import { useIsOnline } from '../../lib/useIsOnline';
import { type, useTheme } from '../../theme';
import { useLabels } from '../labels/useLabels';
import { PRIORITY_FILTERS, VIEW_RULES, viewKindOf } from './displayRules';
import { dueFilterLabel, groupLabel, sortLabel } from './displayLabels';
import { useViewDisplay } from './useViewDisplay';

interface DisplaySheetProps {
  visible: boolean;
  viewKey: ViewKey;
  onClose: () => void;
  testID?: string;
}

/** Display (spec 12.7): sort / order / group / filters (+ Completed tasks on projects), applied on tap. */
export function DisplaySheet({ visible, viewKey, onClose, testID = 'display' }: DisplaySheetProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const online = useIsOnline();
  const display = useViewDisplay(viewKey);
  const { labels } = useLabels(visible);
  const rule = VIEW_RULES[viewKindOf(viewKey)];
  const { options, save } = display;
  const locked = !online;

  const section = (title: string, chips: ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.ink2 }]}>{title}</Text>
      <View style={styles.chips}>{chips}</View>
    </View>
  );

  return (
    <BottomSheet visible={visible} title={t('display.title')} onClose={onClose} testID={testID}>
      <>
        {section(
          t('display.sortTitle'),
          rule.sorts.map((sort) => (
            <Chip
              key={sort}
              label={sortLabel(sort)}
              selected={options.sortBy === sort}
              disabled={locked}
              onPress={() => save(sort === 'MANUAL' ? { sortBy: sort, sortDirection: 'ASC' } : { sortBy: sort })}
              testID={`${testID}-sort-${sort.toLowerCase()}`}
            />
          )),
        )}
        {options.sortBy !== 'MANUAL'
          ? section(t('display.orderTitle'), [
              <Chip
                key="asc"
                label={t('display.order.asc')}
                selected={options.sortDirection === 'ASC'}
                disabled={locked}
                onPress={() => save({ sortDirection: 'ASC' })}
                testID={`${testID}-order-asc`}
              />,
              <Chip
                key="desc"
                label={t('display.order.desc')}
                selected={options.sortDirection === 'DESC'}
                disabled={locked}
                onPress={() => save({ sortDirection: 'DESC' })}
                testID={`${testID}-order-desc`}
              />,
            ])
          : null}
        {rule.groups.length > 1
          ? section(
              t('display.groupTitle'),
              rule.groups.map((group) => (
                <Chip
                  key={group}
                  label={groupLabel(group, rule.hasCompleted)}
                  selected={options.groupBy === group}
                  disabled={locked}
                  onPress={() => save({ groupBy: group })}
                  testID={`${testID}-group-${group.toLowerCase()}`}
                />
              )),
            )
          : null}
        {section(t('display.priorityTitle'), [
          <Chip
            key="all"
            label={t('display.all')}
            selected={options.filterPriority === null}
            disabled={locked}
            onPress={() => save({ filterPriority: null })}
            testID={`${testID}-priority-all`}
          />,
          ...PRIORITY_FILTERS.map((n) => (
            <Chip
              key={n}
              label={t('display.priorityN', { n })}
              selected={options.filterPriority === n}
              disabled={locked}
              onPress={() => save({ filterPriority: n })}
              testID={`${testID}-priority-${n}`}
            />
          )),
        ])}
        {section(t('display.dueTitle'), [
          <Chip
            key="all"
            label={t('display.all')}
            selected={options.filterDue === null}
            disabled={locked}
            onPress={() => save({ filterDue: null })}
            testID={`${testID}-due-all`}
          />,
          ...rule.dueFilters.map((due) => (
            <Chip
              key={due}
              label={dueFilterLabel(due)}
              selected={options.filterDue === due}
              disabled={locked}
              onPress={() => save({ filterDue: due })}
              testID={`${testID}-due-${due.toLowerCase()}`}
            />
          )),
        ])}
        {labels.length > 0
          ? section(t('display.labelTitle'), [
              <Chip
                key="all"
                label={t('display.all')}
                selected={options.filterLabelId === null}
                disabled={locked}
                onPress={() => save({ filterLabelId: null })}
                testID={`${testID}-label-all`}
              />,
              ...labels.map((label) => (
                <Chip
                  key={label.id}
                  label={label.name}
                  selected={options.filterLabelId === label.id}
                  disabled={locked}
                  onPress={() => save({ filterLabelId: label.id })}
                  testID={`${testID}-label-${label.id}`}
                />
              )),
            ])
          : null}
        {rule.hasCompleted ? (
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: palette.ink }]}>{t('display.completed')}</Text>
            <Toggle
              testID={`${testID}-completed`}
              label={t('display.completed')}
              value={options.showCompleted === true}
              onChange={(value) => save({ showCompleted: value })}
              disabled={locked}
            />
          </View>
        ) : null}
        <ErrorText
          message={display.error ? describeError(display.error).message : undefined}
          testID={`${testID}-error`}
        />
        <View style={styles.actions}>
          <AppButton
            variant="ghost"
            label={t('display.reset')}
            onPress={display.reset}
            disabled={display.isDefault}
            requiresOnline
            testID={`${testID}-reset`}
          />
          <AppButton label={t('display.done')} onPress={onClose} testID={`${testID}-done`} />
        </View>
      </>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 12 },
  sectionTitle: { ...type.label, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  switchLabel: { ...type.body, flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
