import {
  canComment,
  canCompleteTasks,
  canEditTasks,
  canManageSections,
  capabilitiesOf,
  isCompleteOnly,
} from '../projectCapabilities';

const member = { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false };
const admin = { canEditTasks: true, canCompleteTasks: true, canManageSections: true, canComment: true };
const preview = { canEditTasks: false, canCompleteTasks: false, canManageSections: false, canComment: false };

describe('projectCapabilities (PERM: team projects — Member / Guest only complete tasks)', () => {
  it('a project without the field (old cache, personal fixture) or unknown → everything allowed', () => {
    expect(capabilitiesOf(undefined)).toEqual(admin);
    expect(capabilitiesOf({})).toEqual(admin);
    expect(capabilitiesOf({ capabilities: null })).toEqual(admin);
    expect(canEditTasks(undefined)).toBe(true);
    expect(canEditTasks({})).toBe(true);
  });

  it('reads each flag from the server', () => {
    const project = { capabilities: member };
    expect(canEditTasks(project)).toBe(false);
    expect(canCompleteTasks(project)).toBe(true);
    expect(canManageSections(project)).toBe(false);
    expect(canComment(project)).toBe(false);
  });

  it('isCompleteOnly: may tick but not edit (a joined Member / Guest); not for an Admin nor a preview', () => {
    expect(isCompleteOnly({ capabilities: member })).toBe(true);
    expect(isCompleteOnly({ capabilities: admin })).toBe(false);
    expect(isCompleteOnly({ capabilities: preview })).toBe(false);
    expect(isCompleteOnly(undefined)).toBe(false);
  });
});
