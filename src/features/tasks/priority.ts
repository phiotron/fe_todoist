import { palette } from '../../theme';

/** BR-03: 1 = P1 (highest) … 4 = P4, default P4. */
export const PRIORITIES = [1, 2, 3, 4] as const;
export const DEFAULT_PRIORITY = 4;

/** Ring / flag colour of a priority (design: P1 red, P2 orange, P3 blue, P4 grey). */
export function priorityColor(priority: number): string {
  switch (priority) {
    case 1:
      return palette.p1;
    case 2:
      return palette.p2;
    case 3:
      return palette.p3;
    default:
      return palette.p4;
  }
}

/** Light fill inside the checkbox (.chk.p1 …); P4 has none. */
export function prioritySoft(priority: number): string {
  switch (priority) {
    case 1:
      return palette.p1s;
    case 2:
      return palette.p2s;
    case 3:
      return palette.p3s;
    default:
      return 'transparent';
  }
}
