import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask } from '../../../test/m1Fixtures';
import { makeLabel } from '../../../test/m2Fixtures';
import { nameText, quickAddSettingsRoute } from '../../../test/quickAddFixtures';
import { renderSignedIn } from '../../../test/screen';
import { QuickAddSheet } from '../QuickAddSheet';

// Today in these tests: Friday 2026-10-23, 10:00 in Vietnam.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const TASKS = '/api/v1/tasks';

function routes(extra: ApiRoutes = {}, settings: ApiRoutes = quickAddSettingsRoute()): ApiRoutes {
  return {
    ...settings,
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, makeProject({ id: 'pw', name: 'Work' })]),
    'GET /api/v1/projects/pw/sections': () =>
      jsonResponse(200, [makeSection({ id: 's-meet', projectId: 'pw', name: 'Meetings' })]),
    'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
    'GET /api/v1/labels': () => jsonResponse(200, [makeLabel({ id: 'l-u', name: 'urgent' })]),
    'POST /api/v1/labels': (request) =>
      jsonResponse(201, makeLabel({ id: 'l-new', name: (request.body as { name: string }).name })),
    [`POST ${TASKS}`]: () => jsonResponse(201, makeTask({ id: 't-9' })),
    'POST /api/v1/tasks/t-9/reminders': (request) =>
      jsonResponse(201, { id: 'r-1', taskId: 't-9', at: null, minuteOffset: null, createdAt: '2026-10-23T03:00:00Z', ...(request.body as object) }),
    ...extra,
  };
}

async function open(extra: ApiRoutes = {}, settings?: ApiRoutes) {
  const rendered = await renderSignedIn(<QuickAddSheet params={{}} />, routes(extra, settings));
  await screen.findByText('Inbox');
  return rendered;
}

const type = (text: string) => fireEvent.changeText(screen.getByTestId('quick-add-name'), text);
const posted = (fetchMock: Parameters<typeof requestsTo>[0]) => requestsTo(fetchMock, 'POST', TASKS);

describe('Quick Add — English syntax (M6b)', () => {
  it('"Meeting tomorrow 9-10 #Work p1 %urgent {friday}" fills name, due + duration, project, priority, label, deadline', async () => {
    const { fetchMock } = await open();
    await screen.findByText('Inbox');

    await type('Meeting tomorrow 9-10 #Work /meetings p1 %urgent {friday}');
    // The project / section chip follows the text at once.
    expect(await screen.findByText('Work · Meetings')).toBeOnTheScreen();
    expect(screen.getByTestId('quick-add-priority')).toHaveTextContent(/P1/);
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(posted(fetchMock)).toHaveLength(1));
    expect(posted(fetchMock)[0].body).toEqual({
      projectId: 'pw',
      sectionId: 's-meet',
      content: 'Meeting',
      priority: 1,
      dueDatetime: '2026-10-24T09:00:00',
      durationMinutes: 60,
      labelIds: ['l-u'],
      deadlineDate: '2026-10-30',
    });
  });

  it('highlights the recognised parts while typing', async () => {
    await open();
    await type('Call mom tomorrow p1');
    await waitFor(() => expect(screen.getAllByTestId('quick-add-highlight')).toHaveLength(2));
  });

  it('"next friday" is the Friday of next week (today is Friday → 30/10) and the date chip shows it', async () => {
    const { fetchMock } = await open();
    await type('Pay rent next friday at 3pm');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(posted(fetchMock)).toHaveLength(1));
    expect(posted(fetchMock)[0].body).toMatchObject({ content: 'Pay rent', dueDatetime: '2026-10-30T15:00:00' });
  });

  it('Backspace right after a highlighted part makes it plain text: nothing is deleted, nothing is sent as a date', async () => {
    const { fetchMock } = await open();
    await type('Call tomorrow');
    await waitFor(() => expect(screen.getAllByTestId('quick-add-highlight')).toHaveLength(1));

    await type('Call tomorro'); // one character removed from the end of the token

    await waitFor(() => expect(screen.queryAllByTestId('quick-add-highlight')).toHaveLength(0));
    expect(nameText()).toBe('Call tomorrow');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));
    await waitFor(() => expect(posted(fetchMock)).toHaveLength(1));
    expect(posted(fetchMock)[0].body).toEqual({ projectId: 'p-inbox', content: 'Call tomorrow', priority: 4 });
  });

  it('a tap inside a highlighted part dismisses it', async () => {
    await open();
    await type('Call tomorrow');
    await waitFor(() => expect(screen.getAllByTestId('quick-add-highlight')).toHaveLength(1));

    await fireEvent(screen.getByTestId('quick-add-name'), 'selectionChange', {
      nativeEvent: { selection: { start: 8, end: 8 } },
    });

    await waitFor(() => expect(screen.queryAllByTestId('quick-add-highlight')).toHaveLength(0));
    expect(nameText()).toBe('Call tomorrow');
  });

  it('smartDateRecognition off: dates stay in the name, the other tokens still work', async () => {
    const { fetchMock } = await open({}, quickAddSettingsRoute(undefined, { smartDateRecognition: false }));
    await type('Call tomorrow p2');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(posted(fetchMock)).toHaveLength(1));
    expect(posted(fetchMock)[0].body).toEqual({ projectId: 'p-inbox', content: 'Call tomorrow', priority: 2 });
  });

  it('a %label that does not exist yet is created first, then attached', async () => {
    const { fetchMock } = await open();
    await type('Clean %home');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(posted(fetchMock)).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/labels')[0].body).toMatchObject({ name: 'home' });
    expect(posted(fetchMock)[0].body).toMatchObject({ content: 'Clean', labelIds: ['l-new'] });
  });

  it('"!30 min before" creates a relative reminder after the task (needs a time)', async () => {
    const { fetchMock } = await open();
    await type('Gym tomorrow 5pm !30 min before');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t-9/reminders')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t-9/reminders')[0].body).toEqual({ type: 'RELATIVE', minuteOffset: 30 });
    expect(posted(fetchMock)[0].body).toMatchObject({ content: 'Gym', dueDatetime: '2026-10-24T17:00:00' });
  });

  it('"every monday" shows a Repeat chip and, until M6c, sends only the first date', async () => {
    const { fetchMock } = await open();
    await type('Water plants every monday');

    expect(await screen.findByTestId('quick-add-repeat')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('quick-add-submit'));
    await waitFor(() => expect(posted(fetchMock)).toHaveLength(1));
    expect(posted(fetchMock)[0].body).toEqual({
      projectId: 'p-inbox',
      content: 'Water plants',
      priority: 4,
      dueDate: '2026-10-26',
    });
  });

  it('a name made only of tokens cannot be sent', async () => {
    await open();
    await type('tomorrow p1');
    expect(screen.getByTestId('quick-add-submit')).toBeDisabled();
  });
});

describe('Quick Add — chips (M6b)', () => {
  it('default chips are Project · Date · Assignee: Priority, Labels… are under "More"', async () => {
    await open({}, {}); // no GET me/settings answer → defaults
    expect(screen.getByTestId('quick-add-date')).toBeOnTheScreen();
    expect(screen.queryByTestId('quick-add-priority')).toBeNull();
    expect(screen.queryByTestId('quick-add-label')).toBeNull();

    await fireEvent.press(screen.getByTestId('quick-add-more'));
    await fireEvent.press(await screen.findByTestId('quick-add-more-menu-labels'));
    expect(await screen.findByTestId('quick-add-label')).toBeOnTheScreen();
  });

  it('a chip hidden in Settings still appears when the text sets its value (p1)', async () => {
    await open({}, quickAddSettingsRoute(['PROJECT', 'DATE']));
    expect(screen.queryByTestId('quick-add-priority')).toBeNull();

    await type('Ship it p1');

    expect(await screen.findByTestId('quick-add-priority')).toHaveTextContent(/P1/);
  });

  it('the chips follow the order of quickAddChips', async () => {
    await open({}, quickAddSettingsRoute(['PROJECT', 'PRIORITY', 'DATE']));
    await screen.findByTestId('quick-add-priority');
    const order = screen.getAllByTestId(/^quick-add-(priority|date)$/).map((node) => node.props.testID);
    expect(order).toEqual(['quick-add-priority', 'quick-add-date']);
  });

  it('"Show description" off hides the description field; "Show action labels" off leaves icons only', async () => {
    await open({}, quickAddSettingsRoute(undefined, { quickAddShowDescription: false, quickAddShowActionLabels: false }));
    await waitFor(() => expect(screen.queryByTestId('quick-add-description')).toBeNull());
    expect(screen.getByTestId('quick-add-date')).not.toHaveTextContent(/Ngày/);
    expect(screen.getByTestId('quick-add-date')).toHaveProp('accessibilityLabel', 'Ngày');
  });

  it('"Edit chips" in More opens the Quick Add settings page', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('quick-add-more'));
    await fireEvent.press(await screen.findByTestId('quick-add-more-menu-edit'));
    expect(router.push).toHaveBeenCalledWith('/settings/quick-add');
  });

  it('the Deadline chip picks a day and sends deadlineDate', async () => {
    const { fetchMock } = await open();
    await fireEvent.press(screen.getByTestId('quick-add-deadline'));
    await fireEvent.press(await screen.findByTestId('quick-add-deadline-sheet-day-2026-10-28'));
    await fireEvent.press(screen.getByTestId('quick-add-deadline-sheet-done'));
    await type('Report');
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(posted(fetchMock)).toHaveLength(1));
    expect(posted(fetchMock)[0].body).toMatchObject({ content: 'Report', deadlineDate: '2026-10-28' });
  });
});

describe('Quick Add — paste several lines, Discard changes (M6b)', () => {
  beforeEach(() => jest.mocked(router.back).mockClear());

  it('pasting 3 lines asks; "Add 3 tasks" creates one task per line, each parsed on its own', async () => {
    const { fetchMock } = await open();

    await type('Milk\nEggs p1\n\nBread');
    expect(await screen.findByTestId('quick-add-paste')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('quick-add-paste-many'));

    await waitFor(() => expect(posted(fetchMock)).toHaveLength(3));
    expect(posted(fetchMock).map((request) => (request.body as { content: string }).content)).toEqual(['Milk', 'Eggs', 'Bread']);
    expect((posted(fetchMock)[1].body as { priority: number }).priority).toBe(1);
    await waitFor(() => expect(nameText()).toBe(''));
    expect(screen.getByTestId('quick-add-notice')).toBeOnTheScreen();
  });

  it('"Add as one task" joins the lines into the name', async () => {
    const { fetchMock } = await open();
    await type('Milk\nEggs');
    await fireEvent.press(await screen.findByTestId('quick-add-paste-one'));

    await waitFor(() => expect(nameText()).toBe('Milk Eggs'));
    expect(posted(fetchMock)).toHaveLength(0);
  });

  it('a failure in the middle keeps the lines not created yet in the box', async () => {
    let calls = 0;
    const { fetchMock } = await open({
      [`POST ${TASKS}`]: () => {
        calls += 1;
        return calls === 2 ? jsonResponse(500, { title: 'Internal Server Error' }) : jsonResponse(201, makeTask({ id: 't-9' }));
      },
    });
    await type('A\nB\nC');
    await fireEvent.press(await screen.findByTestId('quick-add-paste-many'));

    await waitFor(() => expect(posted(fetchMock)).toHaveLength(2));
    expect(await screen.findByTestId('quick-add-error')).toBeOnTheScreen();
    expect(screen.getByTestId('quick-add-notice')).toBeOnTheScreen();
  });

  it('closing with text asks "Discard changes?"; Keep editing stays, Discard closes', async () => {
    await open();
    await type('Half a thought');

    await fireEvent.press(screen.getByTestId('quick-add-scrim'));
    expect(await screen.findByTestId('quick-add-discard')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('quick-add-discard-keep'));
    expect(router.back).not.toHaveBeenCalled();
    expect(nameText()).toBe('Half a thought');

    await fireEvent.press(screen.getByTestId('quick-add-scrim'));
    await fireEvent.press(await screen.findByTestId('quick-add-discard-confirm'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('an empty sheet closes at once, no question', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('quick-add-scrim'));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('quick-add-discard')).toBeNull();
  });
});
