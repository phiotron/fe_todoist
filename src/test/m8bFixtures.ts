import type { CommentAuthor, CommentResponse } from '../api/comments';
import type { NotificationResponse, NotificationSettingItem } from '../api/notifications';
import type { FilePickerPlatform, PickedFile } from '../lib/filePicker';
import { setFilePickerPlatform } from '../lib/filePicker';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export const AN: CommentAuthor = { id: '00000000-0000-0000-0000-000000000001', name: 'An', avatarUrl: null };
export const BINH: CommentAuthor = { id: '00000000-0000-0000-0000-000000000002', name: 'Bình', avatarUrl: null };

export function makeComment(overrides: Partial<CommentResponse> = {}): CommentResponse {
  return {
    id: nextId('c'),
    taskId: 't-1',
    projectId: null,
    author: AN,
    content: 'Nội dung comment',
    attachment: null,
    reactions: [],
    mentionUserIds: [],
    isMine: true,
    createdAt: '2026-10-28T03:00:00Z',
    ...overrides,
  };
}

export function makeNotification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: nextId('n'),
    type: 'COMMENT_MENTION',
    actor: BINH,
    taskId: 't-1',
    taskContent: 'Viết báo cáo',
    projectId: 'p-1',
    projectName: 'Ra mắt',
    commentId: 'c-1',
    commentExcerpt: '@An xem giúp',
    isRead: false,
    createdAt: '2026-10-28T03:00:00Z',
    ...overrides,
  };
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingItem[] = [
  { scope: 'PROJECT', event: 'COMMENT_MENTION', enabled: true },
  { scope: 'PROJECT', event: 'COMMENT_ADDED', enabled: true },
  { scope: 'PROJECT', event: 'TASK_ASSIGNED', enabled: true },
  { scope: 'PROJECT', event: 'TASK_COMPLETED', enabled: true },
  { scope: 'WORKSPACE', event: 'MEMBER_JOINED', enabled: true },
  { scope: 'WORKSPACE', event: 'INVITATION_ACCEPTED', enabled: true },
];

/** Installs a file picker that answers `file` (null = the user closed the picker); returns the recorded calls. */
export function installFakeFilePicker(file: PickedFile | null): { calls: Parameters<FilePickerPlatform['pick']>[0][] } {
  const calls: Parameters<FilePickerPlatform['pick']>[0][] = [];
  setFilePickerPlatform({
    pick: async (options) => {
      calls.push(options);
      return file;
    },
  });
  return { calls };
}
