import { createPushRegistrar, type PushRegistrarDeps } from '../pushRegistrar';

type MockedDeps = { [K in keyof PushRegistrarDeps]: jest.MockedFunction<PushRegistrarDeps[K]> };

function fakeDeps(overrides: Partial<PushRegistrarDeps> = {}): MockedDeps {
  return {
    isPermissionGranted: jest.fn(async () => true),
    getDeviceToken: jest.fn(async (): Promise<string | null> => 'device-token-1'),
    register: jest.fn(async (_token: string) => undefined),
    unregister: jest.fn(async (_token: string) => undefined),
    log: jest.fn(),
    ...overrides,
  } as MockedDeps;
}

describe('createPushRegistrar', () => {
  it('registers the device token once per (user, token) per app run', async () => {
    const deps = fakeDeps();
    const registrar = createPushRegistrar(deps);

    await expect(registrar.registerFor('user-1')).resolves.toBe('registered');
    await expect(registrar.registerFor('user-1')).resolves.toBe('already');

    expect(deps.register).toHaveBeenCalledTimes(1);
    expect(deps.register).toHaveBeenCalledWith('device-token-1');
  });

  it('registers again for another user or a rotated token', async () => {
    const deps = fakeDeps();
    const registrar = createPushRegistrar(deps);

    await registrar.registerFor('user-1');
    await registrar.registerFor('user-2');
    deps.getDeviceToken.mockResolvedValueOnce('device-token-2');
    await registrar.registerFor('user-2');

    expect(deps.register.mock.calls).toEqual([['device-token-1'], ['device-token-1'], ['device-token-2']]);
  });

  it('shares a registration still in flight for the same user', async () => {
    const deps = fakeDeps();
    const registrar = createPushRegistrar(deps);

    const [a, b] = await Promise.all([registrar.registerFor('user-1'), registrar.registerFor('user-1')]);

    expect([a, b]).toEqual(['registered', 'registered']);
    expect(deps.register).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the notification permission (never asks for it)', async () => {
    const deps = fakeDeps({ isPermissionGranted: jest.fn(async () => false) });
    const registrar = createPushRegistrar(deps);

    await expect(registrar.registerFor('user-1')).resolves.toBe('no-permission');

    expect(deps.getDeviceToken).not.toHaveBeenCalled();
    expect(deps.register).not.toHaveBeenCalled();
  });

  it('skips with a warning when no device token can be read (Firebase not configured)', async () => {
    const deps = fakeDeps({
      getDeviceToken: jest.fn(async () => {
        throw new Error('Default FirebaseApp is not initialized');
      }),
    });
    const registrar = createPushRegistrar(deps);

    await expect(registrar.registerFor('user-1')).resolves.toBe('no-token');

    expect(deps.register).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledTimes(1);
    expect(deps.log.mock.calls[0][0]).toMatch(/push token/i);
  });

  it('skips quietly when the platform has no device token', async () => {
    const deps = fakeDeps({ getDeviceToken: jest.fn(async () => null) });

    await expect(createPushRegistrar(deps).registerFor('user-1')).resolves.toBe('no-token');

    expect(deps.register).not.toHaveBeenCalled();
    expect(deps.log).not.toHaveBeenCalled();
  });

  it('a failed registration is logged without the token and tried again next time', async () => {
    const deps = fakeDeps();
    deps.register.mockRejectedValueOnce(new TypeError('Network request failed'));
    const registrar = createPushRegistrar(deps);

    await expect(registrar.registerFor('user-1')).resolves.toBe('failed');
    await expect(registrar.registerFor('user-1')).resolves.toBe('registered');

    expect(deps.register).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain('device-token-1');
  });

  it('a failing permission check is a skip, not a crash', async () => {
    const deps = fakeDeps({
      isPermissionGranted: jest.fn(async () => {
        throw new Error('boom');
      }),
    });

    await expect(createPushRegistrar(deps).registerFor('user-1')).resolves.toBe('no-permission');
  });

  it('unregisterCurrent sends the registered token right away and forgets it', async () => {
    const deps = fakeDeps();
    const registrar = createPushRegistrar(deps);
    await registrar.registerFor('user-1');

    const done = registrar.unregisterCurrent();
    // Sent synchronously: the request must leave before sign-out clears the session.
    expect(deps.unregister).toHaveBeenCalledWith('device-token-1');
    await done;

    await registrar.unregisterCurrent();
    expect(deps.unregister).toHaveBeenCalledTimes(1);
    // Signing in again registers the token again.
    await expect(registrar.registerFor('user-1')).resolves.toBe('registered');
  });

  it('unregisterCurrent never throws and does nothing when nothing was registered', async () => {
    const deps = fakeDeps({
      unregister: jest.fn(async () => {
        throw new Error('offline');
      }),
    });
    const registrar = createPushRegistrar(deps);

    await expect(registrar.unregisterCurrent()).resolves.toBeUndefined();
    expect(deps.unregister).not.toHaveBeenCalled();

    await registrar.registerFor('user-1');
    await expect(registrar.unregisterCurrent()).resolves.toBeUndefined();
    expect(deps.log).toHaveBeenCalled();
  });

  it('a registration that finishes after sign-out is not remembered', async () => {
    let finish: () => void = () => undefined;
    const deps = fakeDeps({
      register: jest.fn(
        () =>
          new Promise<undefined>((resolve) => {
            finish = () => resolve(undefined);
          }),
      ),
    });
    const registrar = createPushRegistrar(deps);

    const pending = registrar.registerFor('user-1');
    await Promise.resolve();
    await Promise.resolve();
    await registrar.unregisterCurrent();
    finish();
    await pending;

    // Nothing remembered: the next sign-in registers again and a later sign-out has nothing to send.
    await registrar.unregisterCurrent();
    expect(deps.unregister).not.toHaveBeenCalled();
  });
});
