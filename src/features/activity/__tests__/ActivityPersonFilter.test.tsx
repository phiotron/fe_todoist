import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import viActivity from '../../../i18n/locales/vi/activity.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse } from '../../../test/http';
import { activityItem } from '../../../test/m10Fixtures';
import { makeProject } from '../../../test/m1Fixtures';
import { makeProjectMember, makeSharedProject } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { ActivityLogView } from '../ActivityLogView';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-11-12T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const owner = makeProjectMember({ userId: testUser.id, displayName: 'An', email: testUser.email, isOwner: true });
const bob = makeProjectMember({ userId: 'u-bob', displayName: 'Bob' });
const items = [
  activityItem({ id: 'a1', objectName: 'Gọi điện', eventType: 'COMPLETED', initiatorId: bob.userId, projectId: 'p-7' }),
  activityItem({ id: 'a2', objectName: 'Gửi báo giá', eventType: 'ADDED', initiatorId: testUser.id, projectId: 'p-7' }),
  activityItem({ id: 'a3', objectName: 'Việc cũ', eventType: 'ADDED', initiatorId: null, projectId: 'p-7' }),
];

function routes(project: ReturnType<typeof makeSharedProject>, extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/activity': (request) =>
      jsonResponse(200, {
        items: request.query.get('initiatorId') === bob.userId ? [items[0]] : items,
        nextCursor: null,
      }),
    'GET /api/v1/projects': () => jsonResponse(200, [project]),
    'GET /api/v1/projects/p-7/members': () => jsonResponse(200, [owner, bob]),
    ...extra,
  };
}

describe('Activity: person filter of a shared project (X2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers a Person chip for a team project; picking a member sends initiatorId, "Everyone" removes it', async () => {
    const project = makeSharedProject({ id: 'p-7', name: 'Website', access: 'TEAM', memberCount: 2, joined: true });
    const { fetchMock } = await renderSignedIn(<ActivityLogView scope={{ projectId: 'p-7' }} />, routes(project));
    await screen.findByText('Bob đã hoàn thành: Gọi điện');
    expect(requestsTo(fetchMock, 'GET', '/api/v1/activity')[0].query.get('initiatorId')).toBeNull();

    await fireEvent.press(await screen.findByTestId('activity-log-person-chip'));
    expect(screen.getByText(viActivity.activity.filterAllPeople)).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId('activity-log-person-u-bob'));
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/activity').some((r) => r.query.get('initiatorId') === 'u-bob')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Bạn đã thêm công việc: Gửi báo giá')).toBeNull());
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0); // the chip now carries the name

    await fireEvent.press(screen.getByTestId('activity-log-person-chip'));
    await fireEvent.press(await screen.findByTestId('activity-log-person-ALL'));
    expect(await screen.findByText('Bạn đã thêm công việc: Gửi báo giá')).toBeOnTheScreen();
    expect(screen.getByText(viActivity.activity.filterPerson)).toBeOnTheScreen(); // the chip is back to its plain label
  });

  it('names who did each event: "Bạn" only for my own, the member name otherwise, a deleted account when unknown', async () => {
    const project = makeSharedProject({ id: 'p-7', name: 'Website', access: 'RESTRICTED', memberCount: 2, joined: true });
    await renderSignedIn(<ActivityLogView scope={{ projectId: 'p-7' }} />, routes(project));
    expect(await screen.findByText('Bob đã hoàn thành: Gọi điện')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã thêm công việc: Gửi báo giá')).toBeOnTheScreen();
    expect(screen.getByText(`${viActivity.activity.someone} đã thêm công việc: Việc cũ`)).toBeOnTheScreen();
  });

  it('a project shared with a collaborator (personal workspace) gets the chip too', async () => {
    const project = makeSharedProject({ id: 'p-7', name: 'Nhà', access: null, memberCount: 2, joined: true });
    await renderSignedIn(<ActivityLogView scope={{ projectId: 'p-7' }} />, routes(project));
    expect(await screen.findByTestId('activity-log-person-chip')).toBeOnTheScreen();
  });

  it('a personal project nobody shares has no Person chip and keeps "Bạn" wording', async () => {
    const project = makeSharedProject({ id: 'p-7', name: 'Việc riêng', access: null, memberCount: 1, joined: true });
    const { fetchMock } = await renderSignedIn(<ActivityLogView scope={{ projectId: 'p-7' }} />, routes(project));
    await screen.findByText('Bạn đã thêm công việc: Gửi báo giá');
    expect(screen.queryByTestId('activity-log-person-chip')).toBeNull();
    expect(screen.getByText('Bạn đã hoàn thành: Gọi điện')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/projects/p-7/members')).toHaveLength(0);
  });

  it('a team project I only preview (not joined) does not load its members', async () => {
    const project = makeSharedProject({ id: 'p-7', name: 'Website', access: 'TEAM', memberCount: 4, joined: false, canManage: false });
    const { fetchMock } = await renderSignedIn(<ActivityLogView scope={{ projectId: 'p-7' }} />, routes(project));
    await screen.findByTestId('activity-log-filters');
    expect(screen.queryByTestId('activity-log-person-chip')).toBeNull();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/projects/p-7/members')).toHaveLength(0);
  });

  it('the all-projects view: the Person chip appears after choosing a shared project and is dropped when it changes', async () => {
    const shared = makeSharedProject({ id: 'p-7', name: 'Website', access: 'TEAM', memberCount: 2, joined: true });
    const solo = makeProject({ id: 'p-8', name: 'Riêng', isInbox: false });
    const { fetchMock } = await renderSignedIn(<ActivityLogView />, {
      ...routes(shared),
      'GET /api/v1/projects': () => jsonResponse(200, [shared, solo]),
    });
    await screen.findByText('Bạn đã hoàn thành: Gọi điện'); // no project chosen: nothing tells the people apart
    expect(screen.queryByTestId('activity-log-person-chip')).toBeNull();

    await fireEvent.press(screen.getByTestId('activity-log-project-chip'));
    await fireEvent.press(await screen.findByTestId('activity-log-project-p-7'));
    await fireEvent.press(await screen.findByTestId('activity-log-person-chip'));
    await fireEvent.press(await screen.findByTestId('activity-log-person-u-bob'));
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET', '/api/v1/activity').some((r) => r.query.get('projectId') === 'p-7' && r.query.get('initiatorId') === 'u-bob')).toBe(true),
    );

    await fireEvent.press(screen.getByTestId('activity-log-project-chip'));
    await fireEvent.press(await screen.findByTestId('activity-log-project-p-8'));
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/activity').some((r) => r.query.get('projectId') === 'p-8')).toBe(true));
    expect(requestsTo(fetchMock, 'GET', '/api/v1/activity').filter((r) => r.query.get('projectId') === 'p-8').every((r) => r.query.get('initiatorId') === null)).toBe(true);
    expect(screen.queryByTestId('activity-log-person-chip')).toBeNull();
  });
});
