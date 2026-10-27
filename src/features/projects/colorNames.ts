import type { ProjectColor } from '../../api/models';
import i18n from '../../i18n';

/** Spoken names of the 20 colours (accessibility label of a swatch). Literal keys, so the i18n scan checks them. */
const NAMES: Record<ProjectColor, () => string> = {
  berry_red: () => i18n.t('projects.colors.berry_red'),
  red: () => i18n.t('projects.colors.red'),
  orange: () => i18n.t('projects.colors.orange'),
  yellow: () => i18n.t('projects.colors.yellow'),
  olive_green: () => i18n.t('projects.colors.olive_green'),
  lime_green: () => i18n.t('projects.colors.lime_green'),
  green: () => i18n.t('projects.colors.green'),
  mint_green: () => i18n.t('projects.colors.mint_green'),
  teal: () => i18n.t('projects.colors.teal'),
  sky_blue: () => i18n.t('projects.colors.sky_blue'),
  light_blue: () => i18n.t('projects.colors.light_blue'),
  blue: () => i18n.t('projects.colors.blue'),
  grape: () => i18n.t('projects.colors.grape'),
  violet: () => i18n.t('projects.colors.violet'),
  lavender: () => i18n.t('projects.colors.lavender'),
  magenta: () => i18n.t('projects.colors.magenta'),
  salmon: () => i18n.t('projects.colors.salmon'),
  charcoal: () => i18n.t('projects.colors.charcoal'),
  grey: () => i18n.t('projects.colors.grey'),
  taupe: () => i18n.t('projects.colors.taupe'),
};

export function projectColorName(color: ProjectColor): string {
  return NAMES[color]();
}
