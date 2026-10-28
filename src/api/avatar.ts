import type { UserResponse } from './auth';
import { apiFetch } from './client';
import { toFormData, type UploadFile } from './comments';

/** Avatar: JPEG or PNG, at most 4 MB (spec 2.1). Both calls answer the updated user (backend M8b). */
export const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png'] as const;

export const avatarApi = {
  upload: (file: UploadFile) =>
    apiFetch<UserResponse>('/api/v1/me/avatar', { method: 'POST', formData: toFormData(file), timeoutMs: 60_000 }),
  remove: () => apiFetch<UserResponse>('/api/v1/me/avatar', { method: 'DELETE' }),
};
