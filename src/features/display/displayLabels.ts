import type { DueFilter, GroupBy, Layout, SortBy } from '../../api/viewOptions';
import i18n from '../../i18n';

export function sortLabel(sort: SortBy): string {
  switch (sort) {
    case 'MANUAL':
      return i18n.t('display.sort.manual');
    case 'DATE':
      return i18n.t('display.sort.date');
    case 'DEADLINE':
      return i18n.t('display.sort.deadline');
    case 'PRIORITY':
      return i18n.t('display.sort.priority');
    case 'NAME':
      return i18n.t('display.sort.name');
    default:
      return i18n.t('display.sort.added');
  }
}

/** NONE reads "Theo section" in a project (spec 12.7: none = by section). */
export function groupLabel(group: GroupBy, inProject: boolean): string {
  switch (group) {
    case 'NONE':
      return inProject ? i18n.t('display.group.bySection') : i18n.t('display.group.none');
    case 'DATE':
      return i18n.t('display.group.date');
    case 'DEADLINE':
      return i18n.t('display.group.deadline');
    case 'PRIORITY':
      return i18n.t('display.group.priority');
    case 'PROJECT':
      return i18n.t('display.group.project');
    case 'ADDED':
      return i18n.t('display.group.added');
    default:
      return i18n.t('display.group.label');
  }
}

export function layoutLabel(layout: Layout): string {
  switch (layout) {
    case 'BOARD':
      return i18n.t('display.layout.board');
    case 'CALENDAR':
      return i18n.t('display.layout.calendar');
    default:
      return i18n.t('display.layout.list');
  }
}

export function dueFilterLabel(due: DueFilter): string {
  switch (due) {
    case 'TODAY':
      return i18n.t('display.due.today');
    case 'THIS_WEEK':
      return i18n.t('display.due.thisWeek');
    case 'NEXT_7_DAYS':
      return i18n.t('display.due.next7Days');
    case 'THIS_MONTH':
      return i18n.t('display.due.thisMonth');
    case 'NEXT_30_DAYS':
      return i18n.t('display.due.next30Days');
    case 'NO_DATE':
      return i18n.t('display.due.noDate');
    default:
      return i18n.t('display.due.overdue');
  }
}
