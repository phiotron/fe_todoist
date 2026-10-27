import type { SettingsResponse } from '../api/settings';
import { defaultSettings, emptyStored, type AppSettings, type StoredSettings } from '../features/settings/settingsModel';
import { testSettings } from './fixtures';
import { jsonResponse, type FetchMock } from './http';
import { routeFetch, type RouteHandler } from './m3Routes';

/** AppSettings equal to testSettings (vi, Asia/Ho_Chi_Minh, spec 10 defaults). */
export function testAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...defaultSettings('vi', 'Asia/Ho_Chi_Minh'), ...overrides };
}

export function settingsResponse(overrides: Partial<SettingsResponse> = {}): SettingsResponse {
  return { ...testSettings, navTabs: [...testSettings.navTabs], ...overrides };
}

export function storedSettings(overrides: Partial<StoredSettings> = {}): StoredSettings {
  return { ...emptyStored(testAppSettings()), ...overrides };
}

export interface ServeSettingsOptions {
  /** What GET me/settings answers (default testSettings). */
  settings?: SettingsResponse;
  /** PATCH me/settings answer; default echoes the merged settings with 200. */
  patch?: RouteHandler;
  /** Extra routes for the screen under test ("POST /api/v1/me/password"…). */
  routes?: Record<string, RouteHandler>;
}

/** Fake backend for settings screens; records every PATCH me/settings body. */
export function serveSettings(fetchMock: FetchMock, options: ServeSettingsOptions = {}): { patchBodies: unknown[] } {
  let current: SettingsResponse = options.settings ?? settingsResponse();
  const patchBodies: unknown[] = [];
  routeFetch(fetchMock, {
    'GET /api/v1/me/settings': () => jsonResponse(200, current),
    'PATCH /api/v1/me/settings': async (request) => {
      patchBodies.push(request.body);
      if (options.patch) return options.patch(request);
      current = { ...current, ...(request.body as Partial<SettingsResponse>) };
      return jsonResponse(200, current);
    },
    ...options.routes,
  });
  return { patchBodies };
}
