import type { Label } from '../../../api/labels';
import { makeLabel } from '../../../test/m2Fixtures';
import { labelSummary, orderedLabels, sameLabelIds } from '../labelDisplay';

const map = new Map<string, Label>([
  ['l-1', makeLabel({ id: 'l-1', name: 'gap', sortOrder: 2 })],
  ['l-2', makeLabel({ id: 'l-2', name: 'nha', sortOrder: 1 })],
  ['l-3', makeLabel({ id: 'l-3', name: 'xa', sortOrder: 3 })],
]);

describe('label display helpers', () => {
  it('orders a task’s labels by label order and skips unknown ids', () => {
    expect(orderedLabels(['l-1', 'gone', 'l-2'], map).map((l) => l.id)).toEqual(['l-2', 'l-1']);
    expect(orderedLabels(undefined, map)).toEqual([]);
  });

  it('summarises up to two names then +N', () => {
    expect(labelSummary(orderedLabels(['l-1'], map))).toBe('gap');
    expect(labelSummary(orderedLabels(['l-1', 'l-2'], map))).toBe('nha, gap');
    expect(labelSummary(orderedLabels(['l-1', 'l-2', 'l-3'], map))).toBe('nha, gap +1');
  });

  it('compares id sets ignoring order', () => {
    expect(sameLabelIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameLabelIds(['a'], ['a', 'b'])).toBe(false);
    expect(sameLabelIds([], [])).toBe(true);
  });
});
