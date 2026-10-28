import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { TemplateCategory } from '../../api/templates';
import { ListRow } from '../../components/ListRow';
import { QueryStateView } from '../../components/QueryStateView';
import { SectionHeader } from '../../components/SectionHeader';
import { StateView } from '../../components/StateView';
import { SubHeader } from '../../components/SubHeader';
import { gutter, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useLibraryTemplates, useMyTemplates } from './useTemplates';

const CATEGORIES: readonly TemplateCategory[] = ['FEATURED', 'PRODUCTIVITY_METHODS', 'POPULAR'];

/** Browse templates (M11 F6): My templates first, then the built-in library by group (Featured / Productivity methods / Popular). */
export function TemplatesScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const mine = useMyTemplates();
  const library = useLibraryTemplates();
  const waiting = (query: { data?: unknown; isPending: boolean; isError: boolean }) => !query.data && (query.isPending || query.isError);

  return (
    <View style={styles.fill}>
      <SubHeader title={t('templates.title')} onBack={() => router.back()} testID="templates-header" />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader title={t('templates.mine')} count={mine.data?.length} testID="templates-mine-header" />
        {waiting(mine) ? (
          <QueryStateView query={mine} testID="templates-mine-state" />
        ) : mine.data && mine.data.length === 0 ? (
          <StateView tone="ok" icon="bookmark" title={t('templates.mineEmpty')} testID="templates-mine-empty" />
        ) : (
          (mine.data ?? []).map((template) => (
            <View key={template.id} style={styles.row}>
              <ListRow
                testID={`template-row-${template.id}`}
                title={template.name}
                icon="bookmark"
                iconBox
                chevron
                right={t('templates.counts', { sections: template.sectionCount, tasks: template.taskCount })}
                onPress={() => router.push(`/templates/${template.id}`)}
              />
            </View>
          ))
        )}
        {waiting(library) ? (
          <QueryStateView query={library} testID="templates-library-state" />
        ) : (
          CATEGORIES.map((category) => {
            const items = (library.data ?? []).filter((template) => template.category === category);
            if (items.length === 0) return null;
            return (
              <View key={category}>
                <SectionHeader title={t(`templates.category.${category}`)} testID={`templates-category-${category}`} />
                {items.map((template) => (
                  <View key={template.key} style={styles.row}>
                    <ListRow
                      testID={`template-row-library-${template.key}`}
                      title={template.name}
                      icon="layers"
                      iconBox
                      chevron
                      right={t('templates.counts', { sections: template.sectionCount, tasks: template.taskCount })}
                      onPress={() => router.push(`/templates/library:${template.key}`)}
                    />
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingBottom: 120 },
    row: { paddingHorizontal: gutter },
  });
}
