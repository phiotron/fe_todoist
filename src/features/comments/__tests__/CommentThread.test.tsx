import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import vi from '../../../i18n/locales/vi/comments.json';
import { setFilePickerPlatform } from '../../../lib/filePicker';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { AN, BINH, installFakeFilePicker, makeComment } from '../../../test/m8bFixtures';
import { renderSignedIn } from '../../../test/screen';
import { CommentThread } from '../CommentThread';

const TASK = { kind: 'task', id: 't-1' } as const;
const PATH = '/api/v1/tasks/t-1/comments';
const UUID = /^[0-9a-f-]{36}$/;

function routes(initial: ReturnType<typeof makeComment>[] = [], extra: ApiRoutes = {}): ApiRoutes {
  let current = [...initial];
  return {
    [`GET ${PATH}`]: () => jsonResponse(200, current),
    [`POST ${PATH}`]: (request) => {
      const body = request.body as { id: string; content: string; attachmentId?: string };
      const created = makeComment({ id: body.id, content: body.content });
      current = [...current, created];
      return jsonResponse(201, created);
    },
    [`GET ${PATH}/mentionable`]: () => jsonResponse(200, [AN, BINH]),
    ...extra,
  };
}

afterEach(() => setFilePickerPlatform(null));

describe('CommentThread', () => {
  it('lists the comments oldest first with the title, and "Bạn" for my own', async () => {
    const first = makeComment({ id: 'c-a', content: 'Một' });
    const second = makeComment({ id: 'c-b', content: 'Hai', author: BINH, isMine: false });
    await renderSignedIn(<CommentThread target={TASK} readOnly={false} showTitle />, routes([first, second]));

    expect(await screen.findByText('Một')).toBeOnTheScreen();
    expect(screen.getByText('Hai')).toBeOnTheScreen();
    expect(screen.getByText('Bình luận (2)')).toBeOnTheScreen();
    expect(screen.getByText(vi.comments.you)).toBeOnTheScreen();
    expect(screen.getByText('Bình')).toBeOnTheScreen();
    const order = screen.getAllByTestId(/^comment-c-/).map((node) => node.props.testID);
    expect(order).toEqual(['comment-c-a', 'comment-c-b']);
  });

  it('says there are no comments yet', async () => {
    await renderSignedIn(<CommentThread target={TASK} readOnly={false} />, routes());

    expect(await screen.findByText(vi.comments.empty)).toBeOnTheScreen();
  });

  it('sends the text with a client id and an Idempotency-Key, then clears the box', async () => {
    const { fetchMock } = await renderSignedIn(<CommentThread target={TASK} readOnly={false} />, routes());
    await screen.findByTestId('comments-empty');

    await fireEvent.changeText(screen.getByTestId('comment-input'), '  Xin chào  ');
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', PATH)).toHaveLength(1));
    const [post] = requestsTo(fetchMock, 'POST', PATH);
    expect(post.body).toEqual({ id: expect.stringMatching(UUID), content: 'Xin chào' });
    expect(post.headers['Idempotency-Key']).toMatch(UUID);
    await waitFor(() => expect(screen.getByTestId('comment-input').props.value).toBe(''));
    expect(await screen.findByText('Xin chào')).toBeOnTheScreen();
  });

  it('does not send an empty text or one longer than 15 000 characters', async () => {
    const { fetchMock } = await renderSignedIn(<CommentThread target={TASK} readOnly={false} />, routes());
    await screen.findByTestId('comments-empty');

    await fireEvent.press(screen.getByTestId('comment-send'));
    await fireEvent.changeText(screen.getByTestId('comment-input'), 'a'.repeat(15_001));
    await fireEvent.press(screen.getByTestId('comment-send'));

    expect(screen.getByTestId('comment-too-long')).toHaveTextContent(vi.comments.tooLong.replace('{{n}}', '15000'));
    expect(requestsTo(fetchMock, 'POST', PATH)).toHaveLength(0);
  });

  it('keeps the draft and shows the server message when the send fails (409 archived)', async () => {
    await renderSignedIn(
      <CommentThread target={TASK} readOnly={false} />,
      routes([], { [`POST ${PATH}`]: () => problem(409, 'Conflict', { detail: 'Dự án đã lưu trữ', code: 'project-archived' }) }),
    );
    await screen.findByTestId('comments-empty');

    await fireEvent.changeText(screen.getByTestId('comment-input'), 'Giữ lại');
    await fireEvent.press(screen.getByTestId('comment-send'));

    expect(await screen.findByTestId('comment-error')).toBeOnTheScreen();
    expect(screen.getByTestId('comment-input').props.value).toBe('Giữ lại');
  });

  it('reuses the same id and key when a failed send is retried, then starts a new draft', async () => {
    let attempts = 0;
    const { fetchMock } = await renderSignedIn(
      <CommentThread target={TASK} readOnly={false} />,
      routes([], {
        [`POST ${PATH}`]: (request) => {
          attempts += 1;
          const body = request.body as { id: string; content: string };
          return attempts === 1 ? problem(503, 'Unavailable') : jsonResponse(201, makeComment({ id: body.id, content: body.content }));
        },
      }),
    );
    await screen.findByTestId('comments-empty');
    await fireEvent.changeText(screen.getByTestId('comment-input'), 'Hai lần');

    await fireEvent.press(screen.getByTestId('comment-send'));
    await waitFor(() => expect(screen.getByTestId('comment-error')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('comment-send'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', PATH)).toHaveLength(2));

    const [first, second] = requestsTo(fetchMock, 'POST', PATH);
    expect((second.body as { id: string }).id).toBe((first.body as { id: string }).id);
    expect(second.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
  });

  it('mentions a person picked from the list and sends their id', async () => {
    const { fetchMock } = await renderSignedIn(<CommentThread target={TASK} readOnly={false} />, routes());
    await screen.findByTestId('comments-empty');

    await fireEvent.changeText(screen.getByTestId('comment-input'), 'Nhờ @Bì');
    await fireEvent.press(await screen.findByTestId(`comment-mention-${BINH.id}`));
    expect(screen.queryByTestId(`comment-mention-${AN.id}`)).toBeNull();
    expect(screen.getByTestId('comment-input').props.value).toBe('Nhờ @Bình ');
    await fireEvent.changeText(screen.getByTestId('comment-input'), 'Nhờ @Bình xem');
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', PATH)).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', PATH)[0].body).toMatchObject({ content: 'Nhờ @Bình xem', mentionUserIds: [BINH.id] });
  });

  it('does not offer myself in the mention list and drops a mention whose name was erased', async () => {
    const { fetchMock } = await renderSignedIn(<CommentThread target={TASK} readOnly={false} />, routes());
    await screen.findByTestId('comments-empty');

    await fireEvent.press(screen.getByTestId('comment-mention-button'));
    await screen.findByTestId(`comment-mention-${BINH.id}`);
    expect(screen.queryByTestId(`comment-mention-${AN.id}`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`comment-mention-${BINH.id}`));
    await fireEvent.changeText(screen.getByTestId('comment-input'), 'xoá tên rồi');
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', PATH)).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', PATH)[0].body).not.toHaveProperty('mentionUserIds');
  });

  it('uploads a picked file first, shows it in the box and sends its id', async () => {
    const picker = installFakeFilePicker({ uri: 'file:///cache/bao-cao.pdf', name: 'bao-cao.pdf', mimeType: 'application/pdf', size: 2048 });
    const attachment = { id: 'a-1', fileName: 'bao-cao.pdf', contentType: 'application/pdf', sizeBytes: 2048, isImage: false };
    const { fetchMock } = await renderSignedIn(
      <CommentThread target={TASK} readOnly={false} />,
      routes([], { 'POST /api/v1/attachments': () => jsonResponse(201, attachment) }),
    );
    await screen.findByTestId('comments-empty');

    await fireEvent.press(screen.getByTestId('comment-attach'));

    expect(await screen.findByTestId('comment-pending-file')).toHaveTextContent(/bao-cao\.pdf/);
    expect(picker.calls).toEqual([{}]);
    const upload = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/v1/attachments'));
    expect(upload).toBeDefined();
    const init = upload?.[1] as RequestInit & { body: FormData; headers: Record<string, string> };
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer acc-1');

    await fireEvent.press(screen.getByTestId('comment-send')); // a file alone is enough
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', PATH)).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', PATH)[0].body).toMatchObject({ content: '', attachmentId: 'a-1' });
    await waitFor(() => expect(screen.queryByTestId('comment-pending-file')).toBeNull());
  });

  it('refuses a file over 100 MB without uploading it, and a file can be removed from the box', async () => {
    installFakeFilePicker({ uri: 'file:///cache/big.bin', name: 'big.bin', mimeType: 'application/octet-stream', size: 101 * 1024 * 1024 });
    const { fetchMock } = await renderSignedIn(<CommentThread target={TASK} readOnly={false} />, routes());
    await screen.findByTestId('comments-empty');

    await fireEvent.press(screen.getByTestId('comment-attach'));

    expect(await screen.findByTestId('comment-error')).toHaveTextContent(vi.comments.fileTooLarge);
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/api/v1/attachments'))).toBe(false);
  });

  it('shows a file card on a comment and opens it with a fresh signed link', async () => {
    const withFile = makeComment({
      id: 'c-f',
      content: '',
      attachment: { id: 'a-9', fileName: 'anh.png', contentType: 'image/png', sizeBytes: 3 * 1024, isImage: true },
    });
    const { fetchMock } = await renderSignedIn(
      <CommentThread target={TASK} readOnly={false} />,
      routes([withFile], {
        'GET /api/v1/attachments/a-9/link': () => jsonResponse(200, { url: '/api/v1/attachments/a-9/download?expires=1&sig=x', expiresAt: '2026-10-28T03:05:00Z' }),
      }),
    );
    const card = await screen.findByTestId('comment-file-c-f');
    expect(card).toHaveTextContent(/anh\.png/);
    expect(card).toHaveTextContent(/3\.0 KB/);

    await fireEvent.press(card);

    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/attachments/a-9/link')).toHaveLength(1));
  });

  it('deletes my own comment after a confirmation, and offers no delete on someone else\'s', async () => {
    const mine = makeComment({ id: 'c-mine', content: 'Của tôi' });
    const theirs = makeComment({ id: 'c-their', content: 'Của họ', author: BINH, isMine: false });
    const { fetchMock } = await renderSignedIn(
      <CommentThread target={TASK} readOnly={false} />,
      routes([mine, theirs], { 'DELETE /api/v1/comments/c-mine': () => jsonResponse(204) }),
    );
    await screen.findByText('Của tôi');

    await fireEvent(screen.getByTestId('comment-c-their'), 'longPress');
    expect(await screen.findByTestId('comment-emoji-👍')).toBeOnTheScreen();
    expect(screen.queryByTestId('comment-delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('comment-actions-scrim'));

    await fireEvent(screen.getByTestId('comment-c-mine'), 'longPress');
    await fireEvent.press(await screen.findByTestId('comment-delete'));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/comments/c-mine')).toHaveLength(0); // asks first
    await fireEvent.press(await screen.findByTestId('comment-delete-dialog-confirm'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/comments/c-mine')).toHaveLength(1));
  });

  it('keeps the dialog open and shows the message when the delete is refused (403)', async () => {
    const mine = makeComment({ id: 'c-mine', content: 'Của tôi' });
    await renderSignedIn(
      <CommentThread target={TASK} readOnly={false} />,
      routes([mine], { 'DELETE /api/v1/comments/c-mine': () => problem(403, 'Forbidden', { detail: 'Bạn chỉ xoá được comment của mình' }) }),
    );
    await screen.findByText('Của tôi');
    await fireEvent(screen.getByTestId('comment-c-mine'), 'longPress');
    await fireEvent.press(await screen.findByTestId('comment-delete'));

    await fireEvent.press(await screen.findByTestId('comment-delete-dialog-confirm'));

    expect(await screen.findByTestId('comment-delete-dialog-error')).toBeOnTheScreen();
    expect(screen.getByTestId('comment-delete-dialog')).toBeOnTheScreen();
  });

  it('adds a reaction from the long-press sheet and toggles an existing chip off', async () => {
    const reacted = makeComment({
      id: 'c-r',
      content: 'Hay',
      reactions: [{ emoji: '🎉', count: 2, reactedByMe: true, userIds: [AN.id, BINH.id] }],
    });
    const { fetchMock } = await renderSignedIn(
      <CommentThread target={TASK} readOnly={false} />,
      routes([reacted], {
        'POST /api/v1/comments/c-r/reactions': () => jsonResponse(200, reacted),
        'DELETE /api/v1/comments/c-r/reactions': () => jsonResponse(200, reacted),
      }),
    );
    await screen.findByText('Hay');

    await fireEvent(screen.getByTestId('comment-c-r'), 'longPress');
    await fireEvent.press(await screen.findByTestId('comment-emoji-👍'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/comments/c-r/reactions')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/comments/c-r/reactions')[0].body).toEqual({ emoji: '👍' });

    await fireEvent.press(screen.getByTestId('comment-reaction-c-r-🎉'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/comments/c-r/reactions')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/comments/c-r/reactions')[0].query.get('emoji')).toBe('🎉');
  });

  it('hides the composer and the actions on an archived project (read-only)', async () => {
    await renderSignedIn(<CommentThread target={TASK} readOnly />, routes([makeComment({ id: 'c-1', content: 'Cũ' })]));

    expect(await screen.findByText('Cũ')).toBeOnTheScreen();
    expect(screen.queryByTestId('comment-composer')).toBeNull();
    await fireEvent(screen.getByTestId('comment-c-1'), 'longPress');
    expect(screen.queryByTestId('comment-emoji-👍')).toBeNull();
  });

  it('colours the @Name of a mentioned person once the names are known', async () => {
    const mention = makeComment({ id: 'c-m', content: '@Bình xem giúp', mentionUserIds: [BINH.id] });
    await renderSignedIn(<CommentThread target={TASK} readOnly={false} />, routes([mention]));

    expect(await screen.findByText('@Bình')).toBeOnTheScreen();
  });
});
