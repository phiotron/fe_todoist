import { COMMENT_MAX_LENGTH, type CommentAuthor } from '../../api/comments';

/** Reactions offered on a long press (plan M8b F3). */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '🙏'] as const;

export type CommentTextProblem = 'empty' | 'tooLong';

/** Trimmed text must be non-empty (unless a file is attached) and at most 15 000 characters (spec 2.1). */
export function commentTextProblem(text: string, hasAttachment: boolean): CommentTextProblem | null {
  const trimmed = text.trim();
  if (trimmed.length > COMMENT_MAX_LENGTH) return 'tooLong';
  if (trimmed.length === 0 && !hasAttachment) return 'empty';
  return null;
}

const TRAILING_MENTION = /(^|\s)@([^\s@]*)$/;

/** The "@fragment" being typed at the end of the text ("" right after "@"), or null when none. */
export function mentionFragment(text: string): string | null {
  const match = TRAILING_MENTION.exec(text);
  return match ? match[2] : null;
}

/** Authors whose name starts with / contains the fragment (case-insensitive), at most 8. */
export function filterMentionable(people: readonly CommentAuthor[], fragment: string): CommentAuthor[] {
  const needle = fragment.trim().toLowerCase();
  return people.filter((person) => needle === '' || person.name.toLowerCase().includes(needle)).slice(0, 8);
}

/** Replaces the trailing "@fragment" with "@Name " (a trailing "@" typed by the user is consumed too). */
export function insertMention(text: string, person: CommentAuthor): string {
  const match = TRAILING_MENTION.exec(text);
  if (!match) return `${text}${text === '' || /\s$/.test(text) ? '' : ' '}@${person.name} `;
  return `${text.slice(0, match.index)}${match[1]}@${person.name} `;
}

/** Mentions whose "@Name" is still in the text (a deleted "@Name" is not notified). */
export function activeMentionIds(text: string, picked: ReadonlyMap<string, string>): string[] {
  return [...picked].filter(([, name]) => text.includes(`@${name}`)).map(([id]) => id);
}

export interface TextSegment {
  text: string;
  mention: boolean;
}

/** Splits the content so every "@Name" of a mentioned person can be drawn in the accent colour. */
export function highlightMentions(content: string, names: readonly string[]): TextSegment[] {
  const tokens = [...new Set(names)].filter(Boolean).map((name) => `@${name}`);
  if (tokens.length === 0) return [{ text: content, mention: false }];
  const pattern = new RegExp(`(${tokens.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})`, 'g');
  return content
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, mention: tokens.includes(part) }));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "12,3 KB" style size for the attachment card. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
