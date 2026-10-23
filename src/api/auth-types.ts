// Hand-written M0 contract types. Replaced by types.gen.ts in Task 16, then this file is deleted.

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  locale: string;
  timeZone: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  /** Seconds (900). */
  accessTokenExpiresIn: number;
  user: UserResponse;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}
