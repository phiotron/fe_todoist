import type { Favorite } from '../../../api/models';
import { makeProject } from '../../../test/m1Fixtures';
import { makeFilter, makeLabel } from '../../../test/m2Fixtures';
import { resolveFavorites } from '../resolveFavorites';

const fav = (targetType: Favorite['targetType'], targetId: string): Favorite => ({
  targetType,
  targetId,
  createdAt: '2026-10-20T00:00:00Z',
});

describe('resolveFavorites', () => {
  it('keeps the server order and resolves each target', () => {
    const entries = resolveFavorites(
      [fav('LABEL', 'l-1'), fav('PROJECT', 'p-1'), fav('FILTER', 'f-1')],
      [makeProject({ id: 'p-1', name: 'Nhà' })],
      [makeLabel({ id: 'l-1', name: 'gap' })],
      [makeFilter({ id: 'f-1', name: 'Gấp' })],
    );
    expect(entries.map((entry) => `${entry.type}:${entry.id}`)).toEqual(['LABEL:l-1', 'PROJECT:p-1', 'FILTER:f-1']);
  });

  it('skips targets that are not in the loaded lists (deleted, archived, still loading)', () => {
    expect(resolveFavorites([fav('LABEL', 'gone'), fav('FILTER', 'f-x')], [], [], [])).toEqual([]);
  });
});
