import type { LocationReminderResponse } from '../../../api/locations';
import { handleGeofenceEvent, type LocationNotification } from '../geofenceHandler';
import { MAX_GEOFENCES, planGeofences, planSignature, shouldNotify } from '../geofencePlan';

function item(id: string, trigger: 'ON_ENTER' | 'ON_LEAVE' = 'ON_ENTER', extra: Partial<LocationReminderResponse> = {}): LocationReminderResponse {
  return {
    reminderId: `r-${id}`,
    taskId: `t-${id}`,
    content: `Việc ${id}`,
    locationId: `l-${id}`,
    name: `Nơi ${id}`,
    latitude: 10.5,
    longitude: 106.5,
    radius: 200,
    trigger,
    ...extra,
  };
}

describe('planGeofences', () => {
  it('registers nothing while reminders are off', () => {
    expect(planGeofences([item('1')], false)).toEqual({ regions: [], meta: {} });
  });

  it('turns ON_ENTER into an arrival region and ON_LEAVE into a departure region', () => {
    const plan = planGeofences([item('1', 'ON_ENTER'), item('2', 'ON_LEAVE', { radius: 500 })], true);

    expect(plan.regions).toEqual([
      { identifier: 'r-1', latitude: 10.5, longitude: 106.5, radius: 200, notifyOnEnter: true, notifyOnExit: false },
      { identifier: 'r-2', latitude: 10.5, longitude: 106.5, radius: 500, notifyOnEnter: false, notifyOnExit: true },
    ]);
    expect(plan.meta['r-2']).toEqual({
      reminderId: 'r-2',
      taskId: 't-2',
      title: 'Việc 2',
      placeName: 'Nơi 2',
      trigger: 'ON_LEAVE',
    });
  });

  it('keeps one region per reminder and at most 100 (Android limit)', () => {
    expect(planGeofences([item('1'), item('1')], true).regions).toHaveLength(1);
    const many = Array.from({ length: MAX_GEOFENCES + 20 }, (_, index) => item(String(index)));

    const plan = planGeofences(many, true);

    expect(plan.regions).toHaveLength(MAX_GEOFENCES);
    expect(Object.keys(plan.meta)).toHaveLength(MAX_GEOFENCES);
    expect(plan.regions[0].identifier).toBe('r-0');
  });

  it('a signature changes only when a region changes', () => {
    const base = planSignature(planGeofences([item('1')], true));

    expect(planSignature(planGeofences([item('1')], true))).toBe(base);
    expect(planSignature(planGeofences([item('1', 'ON_LEAVE')], true))).not.toBe(base);
    expect(planSignature(planGeofences([item('1', 'ON_ENTER', { radius: 300 })], true))).not.toBe(base);
    expect(planSignature(planGeofences([], true))).toBe('');
  });
});

describe('shouldNotify', () => {
  const meta = planGeofences([item('1', 'ON_LEAVE')], true).meta['r-1'];

  it('fires only for the direction the reminder asked for', () => {
    expect(shouldNotify(meta, 'exit')).toBe(true);
    expect(shouldNotify(meta, 'enter')).toBe(false);
    expect(shouldNotify(undefined, 'exit')).toBe(false);
  });
});

describe('handleGeofenceEvent', () => {
  const plan = planGeofences([item('1', 'ON_ENTER'), item('2', 'ON_LEAVE')], true);
  const text = (key: string, place: string) => `${key}:${place}`;

  function deps() {
    const shown: LocationNotification[] = [];
    return {
      shown,
      value: {
        loadMeta: jest.fn(async () => plan.meta),
        notify: jest.fn(async (notification: LocationNotification) => {
          shown.push(notification);
        }),
        text: text as never,
      },
    };
  }

  it('shows the notification with the task name and a sentence about the place', async () => {
    const { shown, value } = deps();

    expect(await handleGeofenceEvent('enter', 'r-1', value)).toBe(true);

    expect(shown).toEqual([
      { id: 'location:r-1', taskId: 't-1', title: 'Việc 1', body: 'reminders.location.notificationEnter:Nơi 1' },
    ]);
  });

  it('says "left" for a departure', async () => {
    const { shown, value } = deps();

    await handleGeofenceEvent('exit', 'r-2', value);

    expect(shown[0].body).toBe('reminders.location.notificationLeave:Nơi 2');
  });

  it('ignores the wrong direction, unknown regions and failures', async () => {
    const { shown, value } = deps();

    expect(await handleGeofenceEvent('exit', 'r-1', value)).toBe(false);
    expect(await handleGeofenceEvent('enter', 'unknown', value)).toBe(false);
    value.notify.mockRejectedValueOnce(new Error('boom'));
    expect(await handleGeofenceEvent('enter', 'r-1', value)).toBe(false);
    expect(shown).toEqual([]);
  });
});
