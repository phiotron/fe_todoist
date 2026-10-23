import type { AuthResponse, UserResponse } from '../api/auth';

export const testUser: UserResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'an@example.com',
  displayName: 'An',
  locale: 'vi',
  timeZone: 'Asia/Ho_Chi_Minh',
};

export function authResponse(accessToken = 'acc-1', refreshToken = 'ref-1'): AuthResponse {
  return { accessToken, refreshToken, accessTokenExpiresIn: 900, user: testUser };
}
