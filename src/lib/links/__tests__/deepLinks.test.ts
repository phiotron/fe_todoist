import { buildDeepLink, hrefOf, parseDeepLink, type DeepLinkTarget } from '../deepLinks';

const ID = '5b0d6c3e-9a4f-4f6e-8a51-2f2d7e4c1b90';
const SECTION = '0a1b2c3d-1111-4222-8333-444455556666';

describe('deep links', () => {
  it('builds the link of a task, project, section, Inbox and the shortcut screens', () => {
    expect(buildDeepLink({ kind: 'task', id: ID })).toBe(`taskly://task/${ID}`);
    expect(buildDeepLink({ kind: 'project', id: ID })).toBe(`taskly://project/${ID}`);
    expect(buildDeepLink({ kind: 'project', id: ID, sectionId: SECTION })).toBe(`taskly://project/${ID}?section=${SECTION}`);
    expect(buildDeepLink({ kind: 'inbox' })).toBe('taskly://inbox');
    expect(buildDeepLink({ kind: 'today' })).toBe('taskly://today');
    expect(buildDeepLink({ kind: 'upcoming' })).toBe('taskly://upcoming');
    expect(buildDeepLink({ kind: 'search' })).toBe('taskly://search');
    expect(buildDeepLink({ kind: 'quickAdd' })).toBe('taskly://quick-add');
  });

  it('puts shared text into the Quick Add link, escaped', () => {
    const link = buildDeepLink({ kind: 'quickAdd', content: 'Mua sữa & trứng', description: 'https://a.b/?x=1' });

    expect(link.startsWith('taskly://quick-add?')).toBe(true);
    expect(parseDeepLink(link)).toEqual({ kind: 'quickAdd', content: 'Mua sữa & trứng', description: 'https://a.b/?x=1' });
  });

  it.each<DeepLinkTarget>([
    { kind: 'task', id: ID },
    { kind: 'project', id: ID },
    { kind: 'project', id: ID, sectionId: SECTION },
    { kind: 'inbox' },
    { kind: 'today' },
    { kind: 'upcoming' },
    { kind: 'search' },
    { kind: 'quickAdd' },
  ])('reads back what it built: %j', (target) => {
    expect(parseDeepLink(buildDeepLink(target))).toEqual(target);
  });

  it('rejects anything that is not a Taskly link the app understands', () => {
    for (const bad of [
      'https://example.com/task/' + ID,
      'taskly://task/not-a-uuid',
      'taskly://task',
      'taskly://project/' + ID + '?section=nope',
      'taskly://inbox/extra',
      'taskly://settings',
      '',
    ]) {
      expect(parseDeepLink(bad)).toBeNull();
    }
  });

  it('maps a target to the router path of its screen', () => {
    expect(hrefOf({ kind: 'task', id: ID })).toBe(`/task/${ID}`);
    expect(hrefOf({ kind: 'project', id: ID, sectionId: SECTION })).toBe(`/project/${ID}?section=${SECTION}`);
    expect(hrefOf({ kind: 'inbox' })).toBe('/inbox');
    expect(hrefOf({ kind: 'quickAdd' })).toBe('/quick-add');
  });
});
