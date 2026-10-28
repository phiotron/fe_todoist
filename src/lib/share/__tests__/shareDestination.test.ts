import {
  RECENT_DESTINATION_LIMIT,
  addRecentDestination,
  buildSharedComment,
  destinationFromPath,
  parseRecentDestinations,
  recentDestinationsStorageKey,
  sameDestination,
  stepAfterCommentChoice,
} from '../shareDestination';

describe('destinationFromPath (the open task / project is the default destination)', () => {
  it('a task screen gives that task', () => {
    expect(destinationFromPath('/task/5b0d6c3e')).toEqual({ kind: 'task', id: '5b0d6c3e' });
    expect(destinationFromPath('/task/5b0d6c3e/')).toEqual({ kind: 'task', id: '5b0d6c3e' });
  });

  it('a project screen or its comments screen gives that project', () => {
    expect(destinationFromPath('/project/p-1')).toEqual({ kind: 'project', id: 'p-1' });
    expect(destinationFromPath('/project-comments/p-1')).toEqual({ kind: 'project', id: 'p-1' });
  });

  it('decodes the id and survives a broken escape', () => {
    expect(destinationFromPath('/task/a%20b')).toEqual({ kind: 'task', id: 'a b' });
    expect(destinationFromPath('/task/%E0%A4%A')).toEqual({ kind: 'task', id: '%E0%A4%A' });
  });

  it('every other screen has no default destination', () => {
    for (const path of ['/', '/inbox', '/today', '/quick-add', '/project-form', '/project-share/p-1', '/project-insights', '/task', '/task/a/b', '/label/l-1', '', null, undefined]) {
      expect(destinationFromPath(path)).toBeNull();
    }
  });
});

describe('buildSharedComment', () => {
  it('keeps the whole text, links included, trimmed and with \\n line breaks', () => {
    expect(buildSharedComment('  Họp lúc 9h\r\nhttps://meet.example/x  \r\n')).toBe('Họp lúc 9h\nhttps://meet.example/x');
  });

  it('nothing to add for blank or missing text', () => {
    expect(buildSharedComment('')).toBeNull();
    expect(buildSharedComment(' \n\t ')).toBeNull();
    expect(buildSharedComment(null)).toBeNull();
    expect(buildSharedComment(undefined)).toBeNull();
  });

  it('is not cut: the comment box reports a text over 15 000 characters', () => {
    expect(buildSharedComment('a'.repeat(20_000))).toHaveLength(20_000);
  });
});

describe('stepAfterCommentChoice', () => {
  it('goes straight to the comment box when a task / project is open', () => {
    expect(stepAfterCommentChoice({ kind: 'task', id: 't-1' })).toEqual({ step: 'compose', destination: { kind: 'task', id: 't-1' } });
    expect(stepAfterCommentChoice({ kind: 'project', id: 'p-1' })).toEqual({ step: 'compose', destination: { kind: 'project', id: 'p-1' } });
  });

  it('opens the picker otherwise', () => {
    expect(stepAfterCommentChoice(null)).toEqual({ step: 'pick', destination: null });
  });
});

describe('recent destinations', () => {
  const task = (n: number) => ({ kind: 'task' as const, id: `t-${n}`, name: `Task ${n}` });

  it('newest first, no duplicates (same kind and id), at most 5', () => {
    let list = [] as ReturnType<typeof addRecentDestination>;
    for (let n = 1; n <= 7; n += 1) list = addRecentDestination(list, task(n));
    expect(list.map((item) => item.id)).toEqual(['t-7', 't-6', 't-5', 't-4', 't-3']);
    expect(list).toHaveLength(RECENT_DESTINATION_LIMIT);

    list = addRecentDestination(list, { ...task(5), name: 'Task 5 renamed' });
    expect(list.map((item) => item.id)).toEqual(['t-5', 't-7', 't-6', 't-4', 't-3']);
    expect(list[0].name).toBe('Task 5 renamed');
  });

  it('a task and a project with the same id are different destinations', () => {
    const list = addRecentDestination([task(1)], { kind: 'project', id: 't-1', name: 'Dự án' });
    expect(list).toHaveLength(2);
    expect(sameDestination(list[0], list[1])).toBe(false);
    expect(sameDestination(task(1), task(1))).toBe(true);
    expect(sameDestination(null, task(1))).toBe(false);
  });

  it('a nameless destination is not remembered', () => {
    expect(addRecentDestination([task(1)], { kind: 'task', id: 't-2', name: '  ' })).toEqual([task(1)]);
  });

  it('reads what was stored and drops anything unexpected', () => {
    expect(parseRecentDestinations(JSON.stringify([task(1), { kind: 'project', id: 'p-1', name: 'Nhà', extra: 1 }]))).toEqual([
      task(1),
      { kind: 'project', id: 'p-1', name: 'Nhà' },
    ]);
    expect(parseRecentDestinations(JSON.stringify([{ kind: 'label', id: 'l', name: 'x' }, { kind: 'task', id: '', name: 'x' }, { kind: 'task', id: 't', name: '' }, 5, null]))).toEqual([]);
    expect(parseRecentDestinations('{not json')).toEqual([]);
    expect(parseRecentDestinations('{"a":1}')).toEqual([]);
    expect(parseRecentDestinations(null)).toEqual([]);
  });

  it('is stored per account', () => {
    expect(recentDestinationsStorageKey('u-1')).not.toBe(recentDestinationsStorageKey('u-2'));
  });
});
