import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';
import { jsonResponse, problem } from '../../../../test/http';
import { makeProject, makeSection, makeTask } from '../../../../test/m1Fixtures';
import { renderSignedIn } from '../../../../test/screen';
import type { Task } from '../../../../api/models';
import { isTaskReadOnly, taskAccess, useTaskAccess, useTaskReadOnly } from '../taskReadOnly';

const ARCHIVED = '2026-10-01T00:00:00Z';

describe('taskAccess / isTaskReadOnly (pure)', () => {
  const task = makeTask({ projectId: 'p1', sectionId: 's1' });

  it('an open task in an active project and section is editable', () => {
    expect(taskAccess(task, makeProject({ id: 'p1' }), makeSection({ id: 's1' }))).toEqual({ completed: false, archived: false, teamLimited: false, readOnly: false });
    expect(isTaskReadOnly(task, undefined, undefined)).toBe(false);
  });

  it('a completed task is read-only but not archived (it can be reopened)', () => {
    expect(taskAccess({ ...task, completedAt: '2026-10-22T00:00:00Z' }, makeProject(), undefined)).toEqual({ completed: true, archived: false, teamLimited: false, readOnly: true });
  });

  it('PERM: a task of a team project where I only complete tasks is read-only and teamLimited, not archived', () => {
    const capabilities = { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false };
    expect(taskAccess(task, { ...makeProject(), capabilities }, undefined)).toEqual({ completed: false, archived: false, teamLimited: true, readOnly: true });
  });

  it('an archived project or an archived section makes it read-only AND archived (writes answer 409)', () => {
    expect(taskAccess(task, makeProject({ archivedAt: ARCHIVED }), undefined)).toMatchObject({ archived: true, readOnly: true });
    expect(taskAccess(task, makeProject(), makeSection({ archivedAt: ARCHIVED }))).toMatchObject({ archived: true, readOnly: true });
  });
});

describe('useTaskAccess / useTaskReadOnly', () => {
  function Probe({ task }: { task: Task | undefined }) {
    const access = useTaskAccess(task);
    const readOnly = useTaskReadOnly(task);
    return (
      <Text testID="access">{`${access.completed}/${access.archived}/${access.readOnly}/${readOnly}`}</Text>
    );
  }
  const project = (archivedAt: string | null) => makeProject({ id: 'p1', archivedAt });

  it('reads the project and the section from the API (an archived section is in the sections list)', async () => {
    await renderSignedIn(<Probe task={makeTask({ projectId: 'p1', sectionId: 's1' })} />, {
      'GET /api/v1/projects/p1': () => jsonResponse(200, project(null)),
      'GET /api/v1/projects/p1/sections': () => jsonResponse(200, [makeSection({ id: 's1', projectId: 'p1', archivedAt: ARCHIVED })]),
    });
    expect(await screen.findByText('false/true/true/true')).toBeOnTheScreen();
  });

  it('an archived project (not in the active list, found by id) is read-only', async () => {
    await renderSignedIn(<Probe task={makeTask({ projectId: 'p1' })} />, {
      'GET /api/v1/projects/p1': () => jsonResponse(200, project(ARCHIVED)),
    });
    expect(await screen.findByText('false/true/true/true')).toBeOnTheScreen();
  });

  it('an active task in an active project stays editable, also while the project is still loading or failed', async () => {
    await renderSignedIn(<Probe task={makeTask({ projectId: 'p1' })} />, {
      'GET /api/v1/projects/p1': () => problem(500, 'Error'),
    });
    expect(await screen.findByText('false/false/false/false')).toBeOnTheScreen();
  });

  it('no task yet: not read-only', async () => {
    await renderSignedIn(<Probe task={undefined} />);
    expect(await screen.findByText('false/false/false/false')).toBeOnTheScreen();
  });
});
