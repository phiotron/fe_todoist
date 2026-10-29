import { enTranslation, viTranslation } from '..';

function valueAt(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
}
const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

const REVIEW_KEYS = [
  'review.pending', 'review.requested', 'review.cancelled', 'review.cancelTask', 'review.cancelRequest', 'review.pendingTask',
  'review.lockedDone', 'review.lockedDoneToast', 'review.approve', 'review.reject', 'review.approved', 'review.rejected', 'review.title', 'review.mineTitle',
  'review.cardCount', 'review.cardCountMore', 'review.cardNone', 'review.cardMine', 'review.requestedBy', 'review.requestedByMe',
  'review.unknownPerson', 'review.empty', 'review.emptyMine', 'review.readOnlyHint', 'review.notPending', 'review.notRestorable', 'review.select', 'review.selectAll', 'review.selectedCount', 'review.approveN', 'review.rejectN', 'review.approvedMany', 'review.rejectedMany', 'review.selectRow',
  'notifications.review.requested', 'notifications.review.approved', 'notifications.review.rejected',
  ...['REVIEW_REQUESTED', 'REVIEW_APPROVED', 'REVIEW_REJECTED', 'REVIEW_CANCELLED'].flatMap((event) => [
    `activity.event.TASK.${event}`,
    `activity.eventBy.TASK.${event}`,
    `activity.type.${event}`,
  ]),
];

describe('review i18n (vi / en)', () => {
  it.each(REVIEW_KEYS)('%s exists in both languages with the same placeholders', (key) => {
    const vi = valueAt(viTranslation, key);
    const en = valueAt(enTranslation, key);
    expect(typeof vi).toBe('string');
    expect(typeof en).toBe('string');
    expect(placeholders(vi as string)).toBe(placeholders(en as string));
  });

  it('review.json has no key outside the checked list (a new key must be added here)', () => {
    const leaves = Object.keys((viTranslation as { review: Record<string, string> }).review).map((k) => `review.${k}`);
    expect(leaves.sort()).toEqual(REVIEW_KEYS.filter((k) => k.startsWith('review.')).sort());
  });
});
