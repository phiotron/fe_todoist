import type { AuthResponse, UserResponse } from '../api/auth';
import type { SettingsResponse } from '../api/settings';

export const testUser: UserResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'an@example.com',
  displayName: 'An',
  locale: 'vi',
  timeZone: 'Asia/Ho_Chi_Minh',
  twoFactorEnabled: false,
  hasPassword: true,
  linkedProviders: [],
};

export function authResponse(accessToken = 'acc-1', refreshToken = 'ref-1'): AuthResponse {
  return { accessToken, refreshToken, accessTokenExpiresIn: 900, user: testUser };
}

/** Body of GET /api/v1/me/settings for the default test account: the spec 10 defaults (M4 adds its fields here). */
export const testSettings: SettingsResponse = {
  theme: 'TASKLY',
  appearance: 'AUTO',
  locale: 'vi',
  timeZone: 'Asia/Ho_Chi_Minh',
  startDay: 1,
  nextWeek: 1,
  weekendStartDay: 6,
  dateFormat: 'DMY',
  timeFormat: 'H24',
  startPage: 'TODAY',
  smartDateRecognition: true,
  swipeLeft: 'SCHEDULE',
  swipeRight: 'COMPLETE',
  navTabs: ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'],
};
