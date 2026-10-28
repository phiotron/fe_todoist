import { screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { ApiRoutes } from './apiRoutes';
import { testSettings } from './fixtures';
import { jsonResponse } from './http';
import type { QuickAddChip } from '../features/quickAdd/quickAddChips';

/** Every chip the sheet can draw today, so tests of the Priority / Labels / Reminders / Deadline chips find them. */
export const ALL_DRAWN_CHIPS: QuickAddChip[] = ['PROJECT', 'DATE', 'PRIORITY', 'REMINDERS', 'LABELS', 'DEADLINE'];

/** GET me/settings answering the chosen Quick Add chips (and the two switches) on top of the M3 test settings. */
export function quickAddSettingsRoute(
  chips: readonly QuickAddChip[] = ALL_DRAWN_CHIPS,
  extra: Record<string, unknown> = {},
): ApiRoutes {
  return {
    'GET /api/v1/me/settings': () =>
      jsonResponse(200, {
        ...testSettings,
        quickAddChips: [...chips],
        quickAddShowActionLabels: true,
        quickAddShowDescription: true,
        ...extra,
      }),
  };
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return '';
}

/**
 * The text of the Quick Add name field. It is drawn as styled children (recognised parts highlighted), not a `value`
 * prop (React Native forbids both), so tests read the children.
 */
export function nameText(): string {
  return textOf(screen.getByTestId('quick-add-name').props.children as ReactNode);
}
