import type { Task } from '../../../api/models';
import type { ListEntry } from '../listDrop';
import { anchorOf, withoutPendingDrop, withPendingDrop } from '../usePendingDrop';

const t = (id: string, extra: Partial<Task> = {}) => ({ id, dueDate: '2026-10-24', ...extra }) as Task;
const ids = (list: readonly Task[]) => list.map((task) => task.id);

const entries: ListEntry[] = [
  { id: 'o', parentId: null, container: 'overdue' },
  { id: 'a', parentId: null, container: 'd-2026-10-24' },
  { id: 'b', parentId: null, container: 'd-2026-10-24' },
];

describe('anchorOf', () => {
  it('after the sibling given, else before the first one of the target block, else last', () => {
    expect(anchorOf(entries, 'o', null, { container: 'd-2026-10-24', afterId: 'a' })).toEqual({ afterId: 'a' });
    expect(anchorOf(entries, 'o', null, { container: 'd-2026-10-24', afterId: null })).toEqual({ beforeId: 'a' });
    expect(anchorOf(entries, 'a', null, { container: 'd-2026-10-30', afterId: null })).toEqual({});
  });
});

describe('withPendingDrop / withoutPendingDrop', () => {
  it('shows the dropped task in its new place with its new due, and takes it out of the list it left', () => {
    const moved = t('o', { dueDate: '2026-10-21' });
    const pending = { task: moved, anchor: { afterId: 'a' }, patch: { dueDate: '2026-10-24' } };
    const day = withPendingDrop([t('a'), t('b')], pending);
    expect(ids(day)).toEqual(['a', 'o', 'b']);
    expect(day[1].dueDate).toBe('2026-10-24');
    expect(ids(withoutPendingDrop([moved, t('x')], pending))).toEqual(['x']);
  });

  it('changes nothing without a pending drop', () => {
    const list = [t('a')];
    expect(withPendingDrop(list, null)).toBe(list);
    expect(withoutPendingDrop(list, null)).toBe(list);
  });
});
