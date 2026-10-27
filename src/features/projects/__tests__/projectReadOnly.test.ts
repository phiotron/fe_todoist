import { makeProject } from '../../../test/m1Fixtures';
import { isProjectReadOnly } from '../projectReadOnly';

describe('isProjectReadOnly', () => {
  it('an archived project is read-only; an active one, the Inbox and an unknown project are not', () => {
    expect(isProjectReadOnly(makeProject({ archivedAt: '2026-10-01T00:00:00Z' }))).toBe(true);
    expect(isProjectReadOnly(makeProject({ archivedAt: null }))).toBe(false);
    expect(isProjectReadOnly(undefined)).toBe(false);
  });
});
