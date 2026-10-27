import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS, type Project, type ProjectColor } from '../../api/models';
import i18n from '../../i18n';
import { PROJECT_PALETTE } from '../../theme';

/** The Inbox name follows the app language (spec 10.1: "Inbox" is fixed on the server); others show their name. */
export function projectDisplayName(project: Pick<Project, 'isInbox' | 'name'>): string {
  return project.isInbox ? i18n.t('views.inbox.title') : project.name;
}

export function asProjectColor(value: string | null | undefined): ProjectColor {
  return (PROJECT_COLORS as readonly string[]).includes(value ?? '') ? (value as ProjectColor) : DEFAULT_PROJECT_COLOR;
}

/** Hex of a colour key; unknown values (a newer server enum, the Inbox's null) fall back to charcoal. */
export function projectColorHex(color: string | null | undefined): string {
  return PROJECT_PALETTE[asProjectColor(color)];
}
