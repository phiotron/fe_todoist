import { toCreateRequest, toOccurrenceInput } from '../../../api/reminders';
import { addDraft, applicableDrafts, draftId, planReminders, type OccurrenceInput } from '../../../lib/reminders';
import type { TasklyAndroidModule } from '../../../lib/native/tasklyAndroid';
import { FakeReminderScheduler } from '../../../test/fakeReminderScheduler';
import { reminderChipLabel, reminderLabel } from '../reminderLabel';
import { buildDesiredReminders, type ReminderLabels } from '../runReminderSync';
import { scheduleSnooze } from '../snooze';
import { reminderSignature, syncReminders } from '../syncReminders';
import type { DesiredReminder, ReminderRequest } from '../types';
import { createUrgentAwareScheduler } from '../urgentScheduler';

const NOW = Date.parse('2026-10-23T03:00:00Z');
const SETTINGS = { enabled: true, timeZone: 'Asia/Ho_Chi_Minh' };
const LABELS: ReminderLabels = { dueSoon: 'Due soon', reminder: 'Reminder' };
const FORMATS = { dateFormat: 'DMY', timeFormat: 'H24' } as const;
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}${JSON.stringify(options)}` : key) as never;

const URGENT_OCCURRENCE: OccurrenceInput = {
  key: 'r-1',
  taskId: 't-1',
  kind: 'ABSOLUTE',
  fireAt: '2026-10-24T09:00:00',
  content: 'Uống thuốc',
  urgent: true,
};

describe('snooze length (M12)', () => {
  it('uses the chosen minutes and the default 15', async () => {
    const scheduler = new FakeReminderScheduler();
    const input = { taskId: 't-1', title: 'Họp', body: 'x' };

    expect(await scheduleSnooze(scheduler, input, NOW)).toBe(NOW + 15 * 60_000);
    expect(await scheduleSnooze(scheduler, input, NOW, 45)).toBe(NOW + 45 * 60_000);
    expect(scheduler.requests.size).toBe(1);
  });

  it('pins the snoozed notification when Pin reminders is on', async () => {
    const scheduler = new FakeReminderScheduler();

    await scheduleSnooze(scheduler, { taskId: 't-1', title: 'Họp', body: 'x' }, NOW, 30, true);

    expect(scheduler.requests.get('snooze:t-1')?.pinned).toBe(true);
  });
});

describe('Pin reminders and urgent flags in the device schedule (M12)', () => {
  it('carry the flags into every desired reminder and into the signature, so a change replaces the notification', async () => {
    const plain = buildDesiredReminders([URGENT_OCCURRENCE], SETTINGS, LABELS, NOW);
    const pinned = buildDesiredReminders([URGENT_OCCURRENCE], { ...SETTINGS, pinReminders: true }, LABELS, NOW);
    const urgentHere = buildDesiredReminders([URGENT_OCCURRENCE], { ...SETTINGS, urgentHere: true }, LABELS, NOW);

    expect(plain[0].pinned).toBeUndefined();
    expect(plain[0].urgent).toBeUndefined();
    expect(pinned[0].pinned).toBe(true);
    expect(urgentHere[0].urgent).toBe(true);
    expect(new Set([plain, pinned, urgentHere].map((list) => reminderSignature(list[0]))).size).toBe(3);
  });

  it('a non-urgent occurrence never becomes urgent, even on the urgent device', () => {
    const [desired] = buildDesiredReminders(
      [{ ...URGENT_OCCURRENCE, urgent: false }],
      { ...SETTINGS, urgentHere: true },
      LABELS,
      NOW,
    );

    expect(desired.urgent).toBeUndefined();
  });

  it('turning Pin reminders on reschedules the unchanged ones', async () => {
    const scheduler = new FakeReminderScheduler();
    const before = buildDesiredReminders([URGENT_OCCURRENCE], SETTINGS, LABELS, NOW);
    await syncReminders(scheduler, before, jest.fn());

    const result = await syncReminders(
      scheduler,
      buildDesiredReminders([URGENT_OCCURRENCE], { ...SETTINGS, pinReminders: true }, LABELS, NOW),
      jest.fn(),
    );

    expect(result).toMatchObject({ scheduled: 1, unchanged: 0 });
    expect(scheduler.requests.get('r-1')?.pinned).toBe(true);
  });

  it('planReminders carries urgent from the server occurrence', () => {
    const [planned] = planReminders([URGENT_OCCURRENCE], SETTINGS, NOW);

    expect(planned.urgent).toBe(true);
    expect(planReminders([{ ...URGENT_OCCURRENCE, urgent: undefined }], SETTINGS, NOW)[0].urgent).toBeUndefined();
  });

  it('the API occurrence keeps urgent only when true', () => {
    const base = { key: 'k', taskId: 't', kind: 'ABSOLUTE', fireAt: 'f', content: 'c' } as never;

    expect(toOccurrenceInput({ ...(base as object), urgent: true } as never).urgent).toBe(true);
    expect(toOccurrenceInput({ ...(base as object), urgent: false } as never).urgent).toBeUndefined();
  });
});

function fakeNative() {
  const alarms = new Map<string, { id: string; taskId: string; signature: string }>();
  const module = {
    scheduleUrgentAlarm: jest.fn(async (request: { id: string; taskId: string; signature: string }) => {
      alarms.set(request.id, { id: request.id, taskId: request.taskId, signature: request.signature });
    }),
    cancelUrgentAlarm: jest.fn(async (id: string) => {
      alarms.delete(id);
    }),
    listUrgentAlarms: jest.fn(async () => [...alarms.values()]),
  } as unknown as TasklyAndroidModule;
  return { module, alarms };
}

function request(id: string, urgent: boolean): ReminderRequest {
  const desired: DesiredReminder = {
    id,
    taskId: `t-${id}`,
    kind: 'ABSOLUTE',
    fireAtMs: NOW + 60_000,
    title: 'Việc',
    body: 'Reminder',
    ...(urgent ? { urgent: true } : {}),
  };
  return { ...desired, signature: reminderSignature(desired) };
}

describe('createUrgentAwareScheduler', () => {
  it('sends urgent requests to the native alarm and the rest to notifications', async () => {
    const base = new FakeReminderScheduler();
    const { module, alarms } = fakeNative();
    const scheduler = createUrgentAwareScheduler(base, () => module);

    await scheduler.schedule(request('a', true));
    await scheduler.schedule(request('b', false));

    expect([...alarms.keys()]).toEqual(['a']);
    expect([...base.requests.keys()]).toEqual(['b']);
  });

  it('lists both sides, so the sync diff sees the native alarms', async () => {
    const base = new FakeReminderScheduler();
    const { module } = fakeNative();
    const scheduler = createUrgentAwareScheduler(base, () => module);
    await scheduler.schedule(request('a', true));
    await scheduler.schedule(request('b', false));

    const ids = (await scheduler.listScheduled()).map((item) => item.id).sort();

    expect(ids).toEqual(['a', 'b']);
  });

  it('moving a reminder between urgent and normal removes it from the other side (never rings twice)', async () => {
    const base = new FakeReminderScheduler();
    const { module, alarms } = fakeNative();
    const scheduler = createUrgentAwareScheduler(base, () => module);

    await scheduler.schedule(request('a', false));
    await scheduler.schedule(request('a', true));
    expect(base.requests.has('a')).toBe(false);
    expect(alarms.has('a')).toBe(true);

    await scheduler.schedule(request('a', false));
    expect(alarms.has('a')).toBe(false);
    expect(base.requests.has('a')).toBe(true);
  });

  it('cancel and cancelAll reach the native alarms too', async () => {
    const base = new FakeReminderScheduler();
    const { module, alarms } = fakeNative();
    const scheduler = createUrgentAwareScheduler(base, () => module);
    await scheduler.schedule(request('a', true));
    await scheduler.schedule(request('b', true));
    await scheduler.schedule(request('c', false));

    await scheduler.cancel('a');
    expect([...alarms.keys()]).toEqual(['b']);
    await scheduler.cancelAll();

    expect(alarms.size).toBe(0);
    expect(base.requests.size).toBe(0);
  });

  it('without the native module urgent requests fall back to notifications (Expo Go, tests)', async () => {
    const base = new FakeReminderScheduler();
    const scheduler = createUrgentAwareScheduler(base, () => null);

    await scheduler.schedule(request('a', true));
    await scheduler.cancel('a');
    await scheduler.cancelAll();

    expect(base.scheduleCalls).toBe(1);
    expect(await scheduler.listScheduled()).toEqual([]);
  });
});

describe('labels and requests of the M12 reminder kinds', () => {
  it('an urgent time reminder says so', () => {
    expect(reminderLabel({ type: 'RELATIVE', minuteOffset: 30, urgent: true }, t, FORMATS)).toContain('reminders.urgent.label');
    expect(reminderLabel({ type: 'RELATIVE', minuteOffset: 30 }, t, FORMATS)).not.toContain('urgent');
  });

  it('a location reminder says arriving or leaving with the place name', () => {
    expect(reminderLabel({ type: 'LOCATION', trigger: 'ON_ENTER', locationName: 'Nhà' }, t, FORMATS)).toBe(
      'reminders.location.enterLabel{"place":"Nhà"}',
    );
    expect(reminderLabel({ type: 'LOCATION', locationTrigger: 'ON_LEAVE', locationName: 'Nhà' }, t, FORMATS)).toBe(
      'reminders.location.leaveLabel{"place":"Nhà"}',
    );
    expect(reminderLabel({ type: 'LOCATION', trigger: 'ON_ENTER' }, t, FORMATS)).toContain('reminders.location.unknownPlace');
    expect(reminderChipLabel(['a', 'b'], t)).toBe('reminders.chip.more{"label":"a","count":1}');
  });

  it('builds the POST body of every draft kind', () => {
    expect(toCreateRequest({ type: 'ABSOLUTE', at: '2026-10-24T09:00' })).toEqual({ type: 'ABSOLUTE', at: '2026-10-24T09:00' });
    expect(toCreateRequest({ type: 'ABSOLUTE', at: '2026-10-24T09:00', urgent: true })).toEqual({
      type: 'ABSOLUTE',
      at: '2026-10-24T09:00',
      urgent: true,
    });
    expect(toCreateRequest({ type: 'RELATIVE', minuteOffset: 10, urgent: true })).toEqual({
      type: 'RELATIVE',
      minuteOffset: 10,
      urgent: true,
    });
    expect(toCreateRequest({ type: 'LOCATION', locationId: 'l-1', trigger: 'ON_LEAVE', locationName: 'Nhà' })).toEqual({
      type: 'LOCATION',
      locationId: 'l-1',
      trigger: 'ON_LEAVE',
    });
  });

  it('drafts: urgent and normal are different, location drafts need no due time', () => {
    const normal = { type: 'RELATIVE', minuteOffset: 10 } as const;
    const urgent = { type: 'RELATIVE', minuteOffset: 10, urgent: true } as const;
    const place = { type: 'LOCATION', locationId: 'l-1', trigger: 'ON_ENTER' } as const;

    expect(draftId(normal)).not.toBe(draftId(urgent));
    expect(draftId(place)).toBe('LOCATION:l-1:ON_ENTER');
    expect(addDraft([normal], urgent)).toHaveLength(2);
    expect(applicableDrafts([normal, urgent, place], false)).toEqual([place]);
    expect(applicableDrafts([normal, place], true)).toHaveLength(2);
  });
});
