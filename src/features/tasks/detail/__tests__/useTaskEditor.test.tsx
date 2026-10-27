import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, TextInput } from 'react-native';
import type { Task } from '../../../../api/models';
import { queryKeys } from '../../../../api/queryKeys';
import viTaskList from '../../../../i18n/locales/vi/taskList.json';
import vi from '../../../../i18n/locales/vi.json';
import { requestsTo, type ApiRoutes } from '../../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../../test/http';
import { makeTask } from '../../../../test/m1Fixtures';
import { renderSignedIn } from '../../../../test/screen';
import { useTaskEditor } from '../useTaskEditor';

let server: Task;

function Harness() {
  const editor = useTaskEditor('t1');
  if (editor.gone) return <Text testID="h-gone">gone</Text>;
  if (!editor.draft) return null;
  return (
    <>
      <TextInput
        testID="h-content"
        value={editor.draft.content}
        onChangeText={(content) => editor.edit({ content })}
        onBlur={() => void editor.commit()}
      />
      <TextInput
        testID="h-description"
        value={editor.draft.description}
        onChangeText={(description) => editor.edit({ description })}
        onBlur={() => void editor.commit()}
      />
      <Pressable testID="h-p1" onPress={() => void editor.commit({ priority: 1 })} />
      <Pressable testID="h-p2" onPress={() => void editor.commit({ priority: 2 })} />
      <Pressable testID="h-keep" onPress={() => void editor.keepMine()} />
      <Pressable testID="h-latest" onPress={editor.acceptLatest} />
      <Text testID="h-conflict">{String(editor.conflict)}</Text>
      <Text testID="h-version">{String(editor.base?.version)}</Text>
      <Text testID="h-error-content">{editor.errors.content ?? ''}</Text>
      <Text testID="h-error-form">{editor.errors.form ?? ''}</Text>
    </>
  );
}

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return { 'GET /api/v1/tasks/t1': () => jsonResponse(200, server), ...extra };
}

/** PATCH handler of a server that applies the body and bumps the version. */
const applyPatch: ApiRoutes[string] = (request) => {
  server = { ...server, ...(request.body as object), version: server.version + 1 };
  return jsonResponse(200, server);
};

async function open(extra: ApiRoutes = {}) {
  const rendered = await renderSignedIn(<Harness />, routes(extra));
  await waitFor(() => expect(screen.getByTestId('h-content').props.value).toBe(server.content));
  return rendered;
}

const patches = (fetchMock: Parameters<typeof requestsTo>[0]) => requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/t1').map((r) => r.body);

describe('useTaskEditor', () => {
  beforeEach(() => {
    server = makeTask({ id: 't1', content: 'Viết báo cáo', description: 'Mô tả cũ', version: 3 });
  });

  it('saves the name when the field loses focus: only the changed field plus the version it started from', async () => {
    const { fetchMock } = await open({ 'PATCH /api/v1/tasks/t1': applyPatch });

    await fireEvent.changeText(screen.getByTestId('h-content'), '  Viết báo cáo quý ');
    expect(patches(fetchMock)).toHaveLength(0); // nothing while typing
    await fireEvent(screen.getByTestId('h-content'), 'blur');

    await waitFor(() => expect(patches(fetchMock)).toEqual([{ version: 3, content: 'Viết báo cáo quý' }]));
  });

  it('sends nothing when nothing changed; a blank name shows the message and is not sent', async () => {
    const { fetchMock } = await open({ 'PATCH /api/v1/tasks/t1': applyPatch });

    await fireEvent(screen.getByTestId('h-content'), 'blur');
    await fireEvent.changeText(screen.getByTestId('h-content'), '   ');
    await fireEvent(screen.getByTestId('h-content'), 'blur');

    expect(screen.getByTestId('h-error-content')).toHaveTextContent(viTaskList.taskList.validation.contentRequired);
    expect(patches(fetchMock)).toHaveLength(0);
  });

  it('a chip saves at once, and two quick chips are sent one after the other with the fresh version', async () => {
    const { fetchMock } = await open({ 'PATCH /api/v1/tasks/t1': applyPatch });

    await fireEvent.press(screen.getByTestId('h-p1'));
    await fireEvent.press(screen.getByTestId('h-p2'));

    await waitFor(() => expect(patches(fetchMock)).toHaveLength(2));
    expect(patches(fetchMock)).toEqual([
      { version: 3, priority: 1 },
      { version: 4, priority: 2 },
    ]);
  });

  it('409: keeps the draft, loads the latest copy, and "keep mine" sends again with the new version', async () => {
    let attempt = 0;
    const { fetchMock, queryClient } = await open({
      'PATCH /api/v1/tasks/t1': (request) => {
        attempt += 1;
        if (attempt === 1) {
          server = { ...server, content: 'Bản người khác', version: 4 };
          return problem(409, 'Conflict', { code: 'version-conflict', current: server });
        }
        return applyPatch(request);
      },
    });

    await fireEvent.changeText(screen.getByTestId('h-content'), 'Bản của tôi');
    await fireEvent(screen.getByTestId('h-content'), 'blur');

    await waitFor(() => expect(screen.getByTestId('h-conflict')).toHaveTextContent('true'));
    expect(screen.getByTestId('h-content').props.value).toBe('Bản của tôi');
    expect((queryClient.getQueryData(queryKeys.tasks.detail('t1')) as Task).content).toBe('Bản người khác');

    await fireEvent.press(screen.getByTestId('h-keep'));

    await waitFor(() => expect(patches(fetchMock)).toHaveLength(2));
    expect(patches(fetchMock)[1]).toEqual({ version: 4, content: 'Bản của tôi' });
    await waitFor(() => expect(screen.getByTestId('h-conflict')).toHaveTextContent('false'));
  });

  it('409 without `current` (the real backend): refetches the latest copy, keeps the draft and "keep mine" / "use latest" work', async () => {
    let attempt = 0;
    const { fetchMock, queryClient } = await open({
      'PATCH /api/v1/tasks/t1': (request) => {
        attempt += 1;
        if (attempt === 1) {
          server = { ...server, content: 'Bản người khác', version: 4 };
          return problem(409, 'Conflict', { code: 'version-conflict' });
        }
        return applyPatch(request);
      },
    });

    await fireEvent.changeText(screen.getByTestId('h-content'), 'Bản của tôi');
    await fireEvent(screen.getByTestId('h-content'), 'blur');

    await waitFor(() => expect(screen.getByTestId('h-conflict')).toHaveTextContent('true'));
    expect(screen.getByTestId('h-version')).toHaveTextContent('4');
    expect(screen.getByTestId('h-content').props.value).toBe('Bản của tôi');
    expect((queryClient.getQueryData(queryKeys.tasks.detail('t1')) as Task).content).toBe('Bản người khác');

    await fireEvent.press(screen.getByTestId('h-keep'));
    await waitFor(() => expect(patches(fetchMock)).toHaveLength(2));
    expect(patches(fetchMock)[1]).toEqual({ version: 4, content: 'Bản của tôi' });
    await waitFor(() => expect(screen.getByTestId('h-conflict')).toHaveTextContent('false'));
  });

  it('409 without `current`: "use latest" shows the refetched copy', async () => {
    await open({
      'PATCH /api/v1/tasks/t1': () => {
        server = { ...server, content: 'Bản người khác', version: 4 };
        return problem(409, 'Conflict', { code: 'version-conflict' });
      },
    });
    await fireEvent.changeText(screen.getByTestId('h-content'), 'Bản của tôi');
    await fireEvent(screen.getByTestId('h-content'), 'blur');
    await waitFor(() => expect(screen.getByTestId('h-conflict')).toHaveTextContent('true'));

    await fireEvent.press(screen.getByTestId('h-latest'));
    expect(screen.getByTestId('h-content').props.value).toBe('Bản người khác');
  });

  it('409: "use latest" drops the draft and shows the other version; no more saving while the conflict is open', async () => {
    const { fetchMock } = await open({
      'PATCH /api/v1/tasks/t1': () => {
        server = { ...server, content: 'Bản người khác', version: 4 };
        return problem(409, 'Conflict', { code: 'version-conflict', current: server });
      },
    });
    await fireEvent.changeText(screen.getByTestId('h-content'), 'Bản của tôi');
    await fireEvent(screen.getByTestId('h-content'), 'blur');
    await waitFor(() => expect(screen.getByTestId('h-conflict')).toHaveTextContent('true'));

    await fireEvent.press(screen.getByTestId('h-p1'));
    expect(patches(fetchMock)).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('h-latest'));
    expect(screen.getByTestId('h-content').props.value).toBe('Bản người khác');
  });

  it('a 400 on content shows under the field and keeps the text', async () => {
    await open({
      'PATCH /api/v1/tasks/t1': () => problem(400, 'Bad Request', { errors: [{ field: 'content', message: 'Tên không hợp lệ' }] }),
    });
    await fireEvent.changeText(screen.getByTestId('h-content'), 'Tên mới');
    await fireEvent(screen.getByTestId('h-content'), 'blur');

    await waitFor(() => expect(screen.getByTestId('h-error-content')).toHaveTextContent('Tên không hợp lệ'));
    expect(screen.getByTestId('h-content').props.value).toBe('Tên mới');
  });

  it('a task deleted elsewhere: 404 on save gives "gone"; a server error keeps the text and shows the message', async () => {
    let status = 500;
    await open({
      'PATCH /api/v1/tasks/t1': () =>
        status === 500
          ? problem(500, 'Error', { requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' })
          : problem(404, 'Not Found'),
    });
    await fireEvent.changeText(screen.getByTestId('h-content'), 'Sửa');
    await fireEvent(screen.getByTestId('h-content'), 'blur');
    await waitFor(() => expect(screen.getByTestId('h-error-form')).toHaveTextContent(vi.errors.server.replace('{{code}}', '7f3c9a12')));
    expect(screen.getByTestId('h-content').props.value).toBe('Sửa');

    status = 404;
    await fireEvent(screen.getByTestId('h-content'), 'blur');
    expect(await screen.findByTestId('h-gone')).toBeOnTheScreen();
  });

  it('leaving the screen saves what was typed but not yet blurred', async () => {
    const { fetchMock, unmount } = await open({ 'PATCH /api/v1/tasks/t1': applyPatch });

    await fireEvent.changeText(screen.getByTestId('h-description'), 'Mô tả mới');
    await unmount();

    await waitFor(() => expect(patches(fetchMock)).toEqual([{ version: 3, description: 'Mô tả mới' }]));
  });

  it('follows a server change while nothing is unsaved', async () => {
    const { queryClient } = await open();
    queryClient.setQueryData(queryKeys.tasks.detail('t1'), { ...server, content: 'Đổi ở máy khác', version: 4 });

    await waitFor(() => expect(screen.getByTestId('h-content').props.value).toBe('Đổi ở máy khác'));
  });

  it('spec 3.1: a close / reopen written into the cache (new version, same fields) does not cause a false 409 for a draft being typed', async () => {
    const { fetchMock, queryClient } = await open({ 'PATCH /api/v1/tasks/t1': applyPatch });

    await fireEvent.changeText(screen.getByTestId('h-content'), 'Viết báo cáo quý');
    // What applyTaskChange does after close: the same task with the NEW version and completedAt.
    server = { ...server, version: 4, completedAt: '2026-10-23T03:00:00Z' };
    queryClient.setQueryData(queryKeys.tasks.detail('t1'), server);
    await waitFor(() => expect(screen.getByTestId('h-version')).toHaveTextContent('4'));
    expect(screen.getByTestId('h-content').props.value).toBe('Viết báo cáo quý'); // the draft survives

    await fireEvent(screen.getByTestId('h-content'), 'blur');

    await waitFor(() => expect(patches(fetchMock)).toEqual([{ version: 4, content: 'Viết báo cáo quý' }]));
  });

  it('a task whose section was archived meanwhile: 409 section-archived is explained and the text kept', async () => {
    await open({ 'PATCH /api/v1/tasks/t1': () => problem(409, 'Conflict', { code: 'section-archived' }) });
    await fireEvent.changeText(screen.getByTestId('h-content'), 'Sửa');
    await fireEvent(screen.getByTestId('h-content'), 'blur');

    await waitFor(() => expect(screen.getByTestId('h-error-form')).toHaveTextContent(vi.errors.sectionArchived));
    expect(screen.getByTestId('h-conflict')).toHaveTextContent('false'); // not a version conflict
    expect(screen.getByTestId('h-content').props.value).toBe('Sửa');
  });
});
