import i18n from '../../i18n';
import { syntaxErrorExcerpt } from './filterRules';

/** Sentence for a 400 filter-syntax: the server position counts from 0, people count from 1. */
export function describeFilterSyntax(query: string, position: number | null): string {
  if (position === null) return i18n.t('filters.syntax.generic');
  if (position >= query.length) return i18n.t('filters.syntax.atEnd');
  return i18n.t('filters.syntax.at', { n: position + 1, near: syntaxErrorExcerpt(query, position) });
}
