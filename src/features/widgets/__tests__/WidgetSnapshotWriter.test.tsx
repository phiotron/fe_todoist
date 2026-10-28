import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
import { jsonResponse, problem } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { productivity } from '../../../test/m10Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { WidgetSnapshotWriter } from '../WidgetSnapshotWriter';
import { WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from '../widgetSnapshot';

async function savedSnapshot(): Promise<WidgetSnapshot | null> {
  const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
  return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
}

describe('WidgetSnapshotWriter (M12 + M10 productivity)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('writes the Today tasks and the productivity numbers (done today / daily goal) of M10', async () => {
    await renderSignedIn(<WidgetSnapshotWriter />, {
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 't1', content: 'Việc 1' })])),
      'GET /api/v1/productivity': () => jsonResponse(200, productivity()),
    });

    await waitFor(async () => {
      const snapshot = await savedSnapshot();
      expect(snapshot?.productivity).toEqual({ done: 2, goal: 5 });
    });
    const snapshot = await savedSnapshot();
    expect(snapshot?.tasks.map((task) => task.content)).toEqual(['Việc 1']);
  });

  it('keeps the tasks and leaves productivity empty when GET productivity fails', async () => {
    await renderSignedIn(<WidgetSnapshotWriter />, {
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 't1', content: 'Việc 1' })])),
      'GET /api/v1/productivity': () => problem(500, 'internal-error'),
    });

    await waitFor(async () => expect((await savedSnapshot())?.tasks).toHaveLength(1));
    expect((await savedSnapshot())?.productivity).toBeNull();
  });
});
