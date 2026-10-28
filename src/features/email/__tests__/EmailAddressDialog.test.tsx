import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import viEmail from '../../../i18n/locales/vi/email.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import { EmailAddressDialog } from '../EmailAddressDialog';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const t = viEmail.email;
const PROJECT_ADDRESS = 'abcdefghijklmnopqrstuvwxyz@in.example.com';
const NEW_ADDRESS = 'zyxwvutsrqponmlkjihgfedcba@in.example.com';

const projectRoutes = (extra: ApiRoutes = {}): ApiRoutes => ({
  'PUT /api/v1/projects/p1/email-address': () =>
    jsonResponse(200, { address: PROJECT_ADDRESS, targetType: 'PROJECT', targetId: 'p1' }),
  'POST /api/v1/projects/p1/email-address/regenerate': () =>
    jsonResponse(200, { address: NEW_ADDRESS, targetType: 'PROJECT', targetId: 'p1' }),
  ...extra,
});

describe('EmailAddressDialog', () => {
  beforeEach(() => jest.mocked(Clipboard.setStringAsync).mockClear());

  it('does not ask for an address while closed', async () => {
    const { fetchMock } = await renderSignedIn(
      <EmailAddressDialog visible={false} target={{ kind: 'project', id: 'p1' }} onClose={jest.fn()} />,
      projectRoutes(),
    );
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/projects/p1/email-address')).toHaveLength(0);
  });

  it('shows the project address with the syntax hint and copies it', async () => {
    const onClose = jest.fn();
    const { fetchMock } = await renderSignedIn(
      <EmailAddressDialog visible target={{ kind: 'project', id: 'p1' }} onClose={onClose} />,
      projectRoutes(),
    );

    expect(await screen.findByText(PROJECT_ADDRESS)).toBeOnTheScreen();
    expect(screen.getByText(t.titleProject)).toBeOnTheScreen();
    expect(screen.getByText(t.hintProject)).toBeOnTheScreen();
    expect(screen.getByText(t.syntaxHint)).toBeOnTheScreen();
    expect(screen.getByText(t.secretHint)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/projects/p1/email-address')).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('email-dialog-copy'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(PROJECT_ADDRESS);
    expect(await screen.findByText(t.copied)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('email-dialog-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('uses the task endpoint and the task wording (no project syntax hint)', async () => {
    const { fetchMock } = await renderSignedIn(
      <EmailAddressDialog visible target={{ kind: 'task', id: 't1' }} onClose={jest.fn()} />,
      {
        'PUT /api/v1/tasks/t1/email-address': () =>
          jsonResponse(200, { address: PROJECT_ADDRESS, targetType: 'TASK', targetId: 't1' }),
      },
    );
    expect(await screen.findByText(PROJECT_ADDRESS)).toBeOnTheScreen();
    expect(screen.getByText(t.titleTask)).toBeOnTheScreen();
    expect(screen.getByText(t.hintTask)).toBeOnTheScreen();
    expect(screen.queryByText(t.syntaxHint)).toBeNull();
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/tasks/t1/email-address')).toHaveLength(1);
  });

  it('asks before creating a new address; cancel sends nothing, confirm replaces the address', async () => {
    const { fetchMock } = await renderSignedIn(
      <EmailAddressDialog visible target={{ kind: 'project', id: 'p1' }} onClose={jest.fn()} />,
      projectRoutes(),
    );
    await screen.findByText(PROJECT_ADDRESS);
    await fireEvent.press(screen.getByTestId('email-dialog-copy'));
    await screen.findByText(t.copied);

    await fireEvent.press(screen.getByTestId('email-dialog-regenerate'));
    expect(screen.getByText(t.regenerateTitle)).toBeOnTheScreen();
    expect(screen.getByText(t.regenerateMessage)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('email-dialog-confirm-cancel'));
    expect(screen.queryByText(t.regenerateTitle)).toBeNull();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/email-address/regenerate')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('email-dialog-regenerate'));
    await fireEvent.press(screen.getByTestId('email-dialog-confirm-ok'));
    expect(await screen.findByText(NEW_ADDRESS)).toBeOnTheScreen();
    expect(screen.queryByText(PROJECT_ADDRESS)).toBeNull();
    expect(screen.queryByText(t.copied)).toBeNull();
    expect(screen.queryByText(t.regenerateTitle)).toBeNull();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/email-address/regenerate')).toHaveLength(1);
  });

  it('shows the server error when the new address fails, keeping the old one', async () => {
    await renderSignedIn(
      <EmailAddressDialog visible target={{ kind: 'project', id: 'p1' }} onClose={jest.fn()} />,
      projectRoutes({
        'POST /api/v1/projects/p1/email-address/regenerate': () => problem(500, 'Lỗi máy chủ'),
      }),
    );
    await screen.findByText(PROJECT_ADDRESS);
    await fireEvent.press(screen.getByTestId('email-dialog-regenerate'));
    await fireEvent.press(screen.getByTestId('email-dialog-confirm-ok'));
    await waitFor(() => expect(screen.getByTestId('email-dialog-error')).toBeOnTheScreen());
    expect(screen.getByText(PROJECT_ADDRESS)).toBeOnTheScreen();
  });

  it('a failed load shows the error and Retry fetches again', async () => {
    let calls = 0;
    await renderSignedIn(
      <EmailAddressDialog visible target={{ kind: 'project', id: 'p1' }} onClose={jest.fn()} />,
      {
        'PUT /api/v1/projects/p1/email-address': () => {
          calls += 1;
          return calls === 1
            ? problem(500, 'Lỗi máy chủ')
            : jsonResponse(200, { address: PROJECT_ADDRESS, targetType: 'PROJECT', targetId: 'p1' });
        },
      },
    );
    await screen.findByTestId('email-dialog-retry');
    expect(screen.getByTestId('email-dialog-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('email-dialog-regenerate')).toBeNull();

    await fireEvent.press(screen.getByTestId('email-dialog-retry'));
    expect(await screen.findByText(PROJECT_ADDRESS)).toBeOnTheScreen();
  });
});
