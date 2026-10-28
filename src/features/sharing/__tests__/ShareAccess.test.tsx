import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import vi from '../../../i18n/locales/vi/sharing.json';
import { API_URL } from '../../../lib/config';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse } from '../../../test/http';
import { makeProjectMember, makeSharedProject } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { ShareProjectScreen } from '../ShareProjectScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const owner = makeProjectMember({ userId: testUser.id, displayName: 'An', isOwner: true });
const bob = makeProjectMember({ userId: 'u-bob', displayName: 'Bob' });

async function open(project: ReturnType<typeof makeSharedProject>, extra: ApiRoutes = {}, members = [owner, bob]) {
  const rendered = await renderSignedIn(<ShareProjectScreen projectId="p1" />, {
    'GET /api/v1/projects/p1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p1/members': () => jsonResponse(200, members),
    'GET /api/v1/projects/p1/invitations': () => jsonResponse(200, []),
    'GET /api/v1/projects/p1/invite-link': () => jsonResponse(200, { token: null, url: null }),
    ...extra,
  });
  await screen.findByTestId(`share-member-${bob.userId}`);
  return rendered;
}

describe('Share screen: access of a team project (X2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the real access and, for whoever manages the project, switches it with a tap', async () => {
    const { fetchMock } = await open(makeSharedProject({ id: 'p1', name: 'Website', access: 'TEAM', canManage: true }), {
      'PATCH /api/v1/projects/p1': () => jsonResponse(200, makeSharedProject({ id: 'p1', access: 'RESTRICTED' })),
    });
    expect(screen.getByText(vi.sharing.accessTeamValue)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('share-access'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1')[0].body).toEqual({ access: 'RESTRICTED' });
  });

  it('a RESTRICTED project says "invited people only"; a member who cannot manage it cannot tap the row', async () => {
    const { fetchMock } = await open(makeSharedProject({ id: 'p1', name: 'Kín', access: 'RESTRICTED', canManage: false }));
    expect(screen.getByText(vi.sharing.accessRestrictedValue)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('share-access'));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1')).toHaveLength(0);
  });

  it('a personal project keeps the "everyone in <project>" line and no switch', async () => {
    const { fetchMock } = await open(makeSharedProject({ id: 'p1', name: 'Nhà', access: null }));
    expect(screen.getByText(vi.sharing.accessEveryone.replace('{{name}}', 'Nhà'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('share-access'));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1')).toHaveLength(0);
  });
});

describe('Share screen avatars (X2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('draws the picture of a member when the API sends avatarUrl, initials only otherwise', async () => {
    await open(makeSharedProject({ id: 'p1', name: 'Nhà', memberCount: 2 }), {}, [owner, { ...bob, avatarUrl: '/api/v1/users/u-bob/avatar?v=3' }]);
    const image = await screen.findByTestId('share-avatar-u-bob-image');
    expect(image.props.source).toEqual({ uri: `${API_URL}/api/v1/users/u-bob/avatar?v=3`, headers: { Authorization: expect.stringMatching(/^Bearer /) } });
    expect(screen.queryByTestId(`share-avatar-${testUser.id}-image`)).toBeNull();
  });
});
