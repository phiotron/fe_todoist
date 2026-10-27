import { palette } from '../theme';

/**
 * @deprecated M0 colour names, kept so older code keeps compiling. New code imports `palette` from src/theme.
 */
export const colors = {
  primary: palette.acc,
  onPrimary: palette.onacc,
  text: palette.ink,
  muted: palette.mute,
  danger: palette.warn,
  border: palette.line2,
  background: palette.bg,
} as const;
