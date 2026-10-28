/** Everything the push token registration needs from the OS and the API (injected so it is unit-testable). */
export interface PushRegistrarDeps {
  /** Only reads the permission: registration never asks for it (the Reminders settings do). */
  isPermissionGranted(): Promise<boolean>;
  /** FCM token of this device; null when the platform has none. Throws when Firebase is not configured. */
  getDeviceToken(): Promise<string | null>;
  register(token: string): Promise<void>;
  unregister(token: string): Promise<void>;
  /** Never receives the token itself. */
  log(message: string): void;
}

export type PushRegisterOutcome = 'registered' | 'already' | 'no-permission' | 'no-token' | 'failed';

export interface PushRegistrar {
  /** Registers this device's token for the signed-in user once per (user, token) per app run. Never throws. */
  registerFor(userId: string): Promise<PushRegisterOutcome>;
  /**
   * Sign-out: sends the unregister request for the registered token right away (before the session is cleared) and
   * forgets it. Best effort: never throws, and the caller does not need to wait for it.
   */
  unregisterCurrent(): Promise<void>;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown error';
}

/** M13c F6: after sign-in, register the FCM token with the server so it can push reminders to this device. */
export function createPushRegistrar(deps: PushRegistrarDeps): PushRegistrar {
  let registered: { userId: string; token: string } | null = null;
  // Bumped by sign-out: a registration started before it must not be remembered afterwards.
  let generation = 0;
  const inFlight = new Map<string, Promise<PushRegisterOutcome>>();

  async function run(userId: string): Promise<PushRegisterOutcome> {
    const startGeneration = generation;
    let granted = false;
    try {
      granted = await deps.isPermissionGranted();
    } catch {
      granted = false;
    }
    if (!granted) return 'no-permission';
    let token: string | null;
    try {
      token = await deps.getDeviceToken();
    } catch (error) {
      deps.log(`push token unavailable (Firebase not configured?): ${errorName(error)}`);
      return 'no-token';
    }
    if (!token) return 'no-token';
    if (registered && registered.userId === userId && registered.token === token) return 'already';
    try {
      await deps.register(token);
    } catch (error) {
      deps.log(`push token registration failed: ${errorName(error)}`);
      return 'failed';
    }
    if (generation === startGeneration) registered = { userId, token };
    return 'registered';
  }

  return {
    registerFor(userId) {
      const pending = inFlight.get(userId);
      if (pending) return pending;
      const next = run(userId).finally(() => {
        if (inFlight.get(userId) === next) inFlight.delete(userId);
      });
      inFlight.set(userId, next);
      return next;
    },
    async unregisterCurrent() {
      const current = registered;
      registered = null;
      generation += 1;
      inFlight.clear();
      if (!current) return;
      try {
        // Called synchronously: the request takes the session of the user who is signing out.
        await deps.unregister(current.token);
      } catch (error) {
        deps.log(`push token unregister failed: ${errorName(error)}`);
      }
    },
  };
}
