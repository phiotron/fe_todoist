import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { CreateFilterRequest, Filter, UpdateFilterRequest } from '../../api/filters';
import { DEFAULT_PROJECT_COLOR, type ProjectColor } from '../../api/models';
import { filterSyntaxPosition, hasProblemCode } from '../../api/problem';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { ErrorText } from '../../components/ErrorText';
import { ColorSwatches } from '../../components/ColorSwatches';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { type, useTheme } from '../../theme';
import { SEARCH_DEBOUNCE_MS } from '../search/searchTerm';
import { FILTER_NAME_MAX, FILTER_QUERY_MAX, checkFilterName, checkFilterQuery } from './filterRules';
import { describeFilterSyntax } from './filterSyntaxMessage';
import { useCreateFilter, useFilterValidation, useSetFilterFavorite, useUpdateFilter } from './useFilters';

interface FilterFormSheetProps {
  visible: boolean;
  /** Edit this filter; create a new one when absent. */
  filter?: Filter;
  onClose: () => void;
  onSaved?: (filter: Filter) => void;
  testID?: string;
}

export function FilterFormSheet({ visible, filter, onClose, onSaved, testID = 'filter-form' }: FilterFormSheetProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const create = useCreateFilter();
  const update = useUpdateFilter();
  const setFavorite = useSetFilterFavorite();
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [color, setColor] = useState<ProjectColor>(DEFAULT_PROJECT_COLOR);
  const [favorite, setFavoriteValue] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [queryError, setQueryError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    setName(filter?.name ?? '');
    setQuery(filter?.query ?? '');
    setColor(filter?.color ?? DEFAULT_PROJECT_COLOR);
    setFavoriteValue(filter?.isFavorite ?? false);
    setNameError(undefined);
    setQueryError(undefined);
    setFormError(undefined);
  }, [visible, filter?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live syntax check (spec 13 M2: "kiểm cú pháp ngay khi gõ"), ~300 ms after the last keystroke.
  const typedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(typedQuery, SEARCH_DEBOUNCE_MS);
  const queryRuleOk = checkFilterQuery(query) === null;
  const validation = useFilterValidation(visible && queryRuleOk ? debouncedQuery : '');
  const settled = queryRuleOk && debouncedQuery === typedQuery;

  let liveStatus: string | undefined;
  let liveIsError = false;
  if (settled && validation.isSuccess) {
    liveStatus = t('filters.form.valid', { n: validation.data.parts.length });
  } else if (settled && hasProblemCode(validation.error, 'filter-syntax')) {
    liveStatus = describeFilterSyntax(debouncedQuery, filterSyntaxPosition(validation.error));
    liveIsError = true;
  }

  function changeQuery(text: string) {
    setQuery(text);
    setQueryError(undefined);
  }

  async function save(trimmedName: string, trimmedQuery: string): Promise<Filter> {
    if (filter) {
      const body: UpdateFilterRequest = {};
      if (trimmedName !== filter.name) body.name = trimmedName;
      if (trimmedQuery !== filter.query) body.query = trimmedQuery;
      if (color !== filter.color) body.color = color;
      let saved = Object.keys(body).length > 0 ? await update.mutateAsync({ id: filter.id, body }) : filter;
      if (favorite !== filter.isFavorite) saved = await setFavorite.mutateAsync({ id: filter.id, favorite });
      return saved;
    }
    const body: CreateFilterRequest = { name: trimmedName, query: trimmedQuery, color };
    let saved = await create.mutateAsync({ body, idempotencyKey: keys.keyFor(body) });
    if (favorite) saved = await setFavorite.mutateAsync({ id: saved.id, favorite: true });
    keys.reset();
    return saved;
  }

  async function submit() {
    const nameProblem = checkFilterName(name);
    const queryProblem = checkFilterQuery(query);
    setNameError(
      nameProblem === 'required'
        ? t('filters.form.nameRequired')
        : nameProblem === 'tooLong'
          ? t('filters.form.nameTooLong', { n: FILTER_NAME_MAX })
          : undefined,
    );
    setQueryError(
      queryProblem === 'required'
        ? t('filters.form.queryRequired')
        : queryProblem === 'tooLong'
          ? t('filters.form.queryTooLong', { n: FILTER_QUERY_MAX })
          : undefined,
    );
    setFormError(undefined);
    if (nameProblem || queryProblem) return;
    const trimmedQuery = query.trim();
    await run(async () => {
      try {
        const saved = await save(name.trim(), trimmedQuery);
        onSaved?.(saved);
        onClose();
      } catch (error) {
        if (hasProblemCode(error, 'filter-syntax')) {
          setQueryError(describeFilterSyntax(trimmedQuery, filterSyntaxPosition(error)));
        } else {
          setFormError(describeError(error).message);
        }
      }
    });
  }

  return (
    <BottomSheet
      visible={visible}
      title={filter ? t('filters.form.editTitle') : t('filters.form.createTitle')}
      onClose={onClose}
      testID={testID}
    >
      <TextField
        testID={`${testID}-name`}
        label={t('filters.form.name')}
        value={name}
        onChangeText={setName}
        error={nameError}
      />
      <TextField
        testID={`${testID}-query`}
        label={t('filters.form.query')}
        placeholder={t('filters.form.queryPlaceholder')}
        value={query}
        onChangeText={changeQuery}
        error={queryError}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      {!queryError && liveStatus ? (
        <Text
          testID={`${testID}-query-status`}
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: liveIsError ? palette.warn : palette.ok }]}
        >
          {liveStatus}
        </Text>
      ) : null}
      <Text style={[styles.fieldLabel, { color: palette.ink2 }]}>{t('filters.form.color')}</Text>
      <ColorSwatches value={color} onChange={setColor} testID={`${testID}-color`} />
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: palette.ink }]}>{t('filters.form.favorite')}</Text>
        <Toggle
          testID={`${testID}-favorite`}
          label={t('filters.form.favorite')}
          value={favorite}
          onChange={setFavoriteValue}
        />
      </View>
      <ErrorText message={formError} testID={`${testID}-error`} />
      <View style={styles.actions}>
        <AppButton
          variant="ghost"
          label={t('filters.form.cancel')}
          onPress={onClose}
          disabled={busy}
          testID={`${testID}-cancel`}
        />
        <AppButton
          label={t('filters.form.save')}
          onPress={() => void submit()}
          busy={busy}
          requiresOnline
          testID={`${testID}-save`}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  status: { ...type.meta, marginTop: -6, marginBottom: 8 },
  fieldLabel: { ...type.label, marginTop: 4, marginBottom: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, marginTop: 8 },
  switchLabel: { ...type.body, flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
