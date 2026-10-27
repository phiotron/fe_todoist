import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import viSchedule from '../../../i18n/locales/vi/schedule.json';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeSection } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { PriorityMenu } from '../../tasks/PriorityMenu';
import { ProjectSectionPicker } from '../ProjectSectionPicker';

const routes = {
  'GET /api/v1/projects': () =>
    jsonResponse(200, [
      inboxProject,
      makeProject({ id: 'p1', name: 'Công ty' }),
      makeProject({ id: 'p1a', name: 'Kế hoạch', parentId: 'p1' }),
    ]),
  'GET /api/v1/projects/p1/sections': () =>
    jsonResponse(200, [
      makeSection({ id: 's1', projectId: 'p1', name: 'Việc gấp' }),
      makeSection({ id: 's9', projectId: 'p1', name: 'Cũ', archivedAt: '2026-10-01T00:00:00Z' }),
    ]),
};

describe('PriorityMenu', () => {
  it('lists P1–P4 with the current one checked and returns the chosen level', async () => {
    const onSelect = jest.fn();
    await renderSignedIn(<PriorityMenu visible value={4} onSelect={onSelect} onClose={jest.fn()} />);
    expect(screen.getByText(viSchedule.schedule.priority.option.replace('{{n}}', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId('priority-menu-4')).toBeSelected();

    await fireEvent.press(screen.getByTestId('priority-menu-1'));

    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('ProjectSectionPicker', () => {
  it('lists the Inbox first then the project tree; a project leads to its active sections', async () => {
    const onSelect = jest.fn();
    await renderSignedIn(
      <ProjectSectionPicker visible value={{ projectId: undefined, sectionId: null }} onSelect={onSelect} onClose={jest.fn()} />,
      routes,
    );
    expect(await screen.findByText('Kế hoạch')).toBeOnTheScreen();
    expect(screen.getByTestId('project-picker-project-p-inbox')).toHaveTextContent(/Inbox/);

    await fireEvent.press(screen.getByTestId('project-picker-project-p1'));
    expect(await screen.findByText('Việc gấp')).toBeOnTheScreen();
    expect(screen.queryByText('Cũ')).toBeNull();

    await fireEvent.press(screen.getByTestId('project-picker-section-s1'));
    expect(onSelect).toHaveBeenCalledWith({ projectId: 'p1', sectionId: 's1' });
  });

  it('"no section" sends the project alone; without sections the project is chosen at once', async () => {
    const onSelect = jest.fn();
    const { rerender } = await renderSignedIn(
      <ProjectSectionPicker visible value={{ projectId: 'p1', sectionId: null }} onSelect={onSelect} onClose={jest.fn()} />,
      routes,
    );
    await fireEvent.press(await screen.findByTestId('project-picker-project-p1'));
    await fireEvent.press(await screen.findByTestId('project-picker-section-none'));
    expect(onSelect).toHaveBeenLastCalledWith({ projectId: 'p1', sectionId: null });

    await rerender(
      <ProjectSectionPicker
        visible
        withSections={false}
        value={{ projectId: 'p1', sectionId: null }}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('project-picker-project-p1a')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('project-picker-project-p1a'));
    expect(onSelect).toHaveBeenLastCalledWith({ projectId: 'p1a', sectionId: null });
  });
});
