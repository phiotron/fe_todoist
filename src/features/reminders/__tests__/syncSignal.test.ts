import { onReminderSyncRequested, requestReminderSync } from '../syncSignal';

describe('syncSignal', () => {
  it('notifies subscribers until they unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = onReminderSyncRequested(listener);

    requestReminderSync();
    unsubscribe();
    requestReminderSync();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
