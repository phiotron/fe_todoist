import { apiFetch } from './client';

/** Hand-written from the backend M8b DTOs (names match); src/api/types.gen.ts is regenerated at integration. */
export interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface AttachmentResponse {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  isImage: boolean;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  userIds: string[];
}

/** A comment of a task (taskId) or of a project (projectId); exactly one of them is set. */
export interface CommentResponse {
  id: string;
  taskId: string | null;
  projectId: string | null;
  /** null = the author deleted their account. */
  author: CommentAuthor | null;
  content: string;
  attachment: AttachmentResponse | null;
  reactions: ReactionSummary[];
  mentionUserIds: string[];
  isMine: boolean;
  createdAt: string;
}

export interface CreateCommentRequest {
  /** Client-made id (spec 12.11): a retry with the same id returns the same comment. */
  id?: string;
  content: string;
  attachmentId?: string;
  mentionUserIds?: string[];
}

export interface AttachmentLinkResponse {
  url: string;
  expiresAt: string;
}

/** Item of search/objects.comments. taskId null = a project comment. */
export interface CommentSearchItem {
  id: string;
  taskId: string | null;
  projectId: string;
  projectName: string;
  taskContent: string | null;
  content: string;
}

/** A file chosen on the device, ready to upload (React Native FormData part). */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

/** The comment limit of the spec (2.1): 15 000 characters. */
export const COMMENT_MAX_LENGTH = 15_000;
/** One file per comment, at most 100 MB (spec 2.1). */
export const COMMENT_FILE_MAX_BYTES = 100 * 1024 * 1024;
/** A big upload on a slow link: 10 minutes instead of the default 15 s. */
export const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export type CommentTarget = { kind: 'task'; id: string } | { kind: 'project'; id: string };

const base = (target: CommentTarget) =>
  `/api/v1/${target.kind === 'task' ? 'tasks' : 'projects'}/${encodeURIComponent(target.id)}/comments`;
const commentPath = (commentId: string) => `/api/v1/comments/${encodeURIComponent(commentId)}`;

/** RN-style multipart part: { uri, name, type } is what fetch turns into a file on Android. */
export function toFormData(file: UploadFile): FormData {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return form;
}

export const commentsApi = {
  list: (target: CommentTarget) => apiFetch<CommentResponse[]>(base(target)),
  create: (target: CommentTarget, body: CreateCommentRequest, idempotencyKey: string) =>
    apiFetch<CommentResponse>(base(target), { method: 'POST', body, idempotencyKey }),
  /** Only the author (403 otherwise). */
  remove: (commentId: string) => apiFetch<void>(commentPath(commentId), { method: 'DELETE' }),
  mentionable: (target: CommentTarget) => apiFetch<CommentAuthor[]>(`${base(target)}/mentionable`),
  addReaction: (commentId: string, emoji: string) =>
    apiFetch<CommentResponse>(`${commentPath(commentId)}/reactions`, { method: 'POST', body: { emoji } }),
  removeReaction: (commentId: string, emoji: string) =>
    apiFetch<CommentResponse>(`${commentPath(commentId)}/reactions?emoji=${encodeURIComponent(emoji)}`, {
      method: 'DELETE',
    }),
  upload: (file: UploadFile) =>
    apiFetch<AttachmentResponse>('/api/v1/attachments', {
      method: 'POST',
      formData: toFormData(file),
      timeoutMs: UPLOAD_TIMEOUT_MS,
    }),
  link: (attachmentId: string) =>
    apiFetch<AttachmentLinkResponse>(`/api/v1/attachments/${encodeURIComponent(attachmentId)}/link`),
};
