import type { SettingsResponse, UpdateSettingsRequest } from '../settings';
import type { CreateReminderRequest, ReminderOccurrence, ReminderResponse } from '../reminders';
import type { components } from '../types.gen';

/**
 * Contract between the hand-written reminder / settings types and the types generated from the real backend
 * (types.gen.ts). Checked by `tsc --noEmit`: if the backend changes a field, this file stops compiling.
 */
type Schemas = components['schemas'];

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertTrue<_T extends true>(): void {}

// Reminder reads are the generated types themselves.
assertTrue<Same<ReminderOccurrence, Schemas['ReminderOccurrence']>>();
assertTrue<Same<ReminderResponse, Schemas['ReminderResponse']>>();

// Reminder writes: what the app sends is always accepted by the generated request type.
const toGenerated = (request: CreateReminderRequest): Schemas['CreateReminderRequest'] => request;

// me/settings: what the server sends can be read as the app type, and what the app sends fits the generated PATCH body.
const readSettings = (response: Schemas['SettingsResponse']): SettingsResponse => response;
const toGeneratedPatch = (patch: UpdateSettingsRequest): Schemas['UpdateSettingsRequest'] => patch as Schemas['UpdateSettingsRequest'];
const reminderFieldsOfPatch = (patch: Schemas['UpdateSettingsRequest']): UpdateSettingsRequest => patch;

describe('reminder API contract (compile-time, against types.gen.ts)', () => {
  it('turns app reminder requests into generated request bodies', () => {
    expect(toGenerated({ type: 'RELATIVE', minuteOffset: 30 })).toEqual({ type: 'RELATIVE', minuteOffset: 30 });
    expect(toGenerated({ type: 'ABSOLUTE', at: '2026-10-24T09:00' })).toEqual({ type: 'ABSOLUTE', at: '2026-10-24T09:00' });
  });

  it('reads the reminder fields of me/settings, `null` meaning automatic reminders off', () => {
    const settings = readSettings({ remindersEnabled: true, autoReminderMinutes: null } as Schemas['SettingsResponse']);

    expect(settings.remindersEnabled).toBe(true);
    expect(settings.autoReminderMinutes).toBeNull();
    expect(reminderFieldsOfPatch({ autoReminderMinutes: null })).toEqual({ autoReminderMinutes: null });
    expect(toGeneratedPatch({ remindersEnabled: false })).toEqual({ remindersEnabled: false });
  });
});
