/**
 * X4 — "Share → Comment": where a text shared into Taskly can go as a comment, and the small rules around it.
 * Pure functions only (the screens live in features/share).
 */

/** A task or a project (comments exist on both, M8b). */
export interface ShareDestination {
  kind: 'task' | 'project';
  id: string;
}

/** A destination with the name shown in the picker (kept on the device for "recent"). */
export interface NamedDestination extends ShareDestination {
  name: string;
}

/** How many recently used destinations are remembered. */
export const RECENT_DESTINATION_LIMIT = 5;

const OPEN_SCREEN = /^\/(task|project|project-comments)\/([^/?#]+)\/?$/;

/**
 * The task / project the user is looking at, from the current route path (`/task/<id>`, `/project/<id>`,
 * `/project-comments/<id>`); null on every other screen. It is the default destination of a share → comment.
 */
export function destinationFromPath(pathname: string | null | undefined): ShareDestination | null {
  const match = OPEN_SCREEN.exec(pathname ?? '');
  if (!match) return null;
  let id = match[2];
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep the raw segment
  }
  return { kind: match[1] === 'task' ? 'task' : 'project', id };
}

/** The text of a comment made from a share: all of it, line breaks normalised, trimmed. null = nothing to add. */
export function buildSharedComment(text: string | null | undefined): string | null {
  const content = (text ?? '').replace(/\r\n?/g, '\n').trim();
  return content.length > 0 ? content : null;
}

export function sameDestination(a: ShareDestination | null | undefined, b: ShareDestination | null | undefined): boolean {
  return a !== null && a !== undefined && b !== null && b !== undefined && a.kind === b.kind && a.id === b.id;
}

/** Newest first, no duplicates, at most 5; a destination without a name is ignored. */
export function addRecentDestination(list: readonly NamedDestination[], entry: NamedDestination): NamedDestination[] {
  if (!entry.name.trim()) return [...list];
  return [entry, ...list.filter((item) => !sameDestination(item, entry))].slice(0, RECENT_DESTINATION_LIMIT);
}

/** Reads what was stored; anything unexpected (corrupt JSON, wrong shape) is dropped. */
export function parseRecentDestinations(raw: string | null): NamedDestination[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is NamedDestination =>
          item !== null &&
          typeof item === 'object' &&
          ((item as NamedDestination).kind === 'task' || (item as NamedDestination).kind === 'project') &&
          typeof (item as NamedDestination).id === 'string' &&
          (item as NamedDestination).id.length > 0 &&
          typeof (item as NamedDestination).name === 'string' &&
          (item as NamedDestination).name.trim().length > 0,
      )
      .map(({ kind, id, name }) => ({ kind, id, name }))
      .slice(0, RECENT_DESTINATION_LIMIT);
  } catch {
    return [];
  }
}

/** One list per account, so another user signing in on this device never sees it. */
export function recentDestinationsStorageKey(userId: string): string {
  return `taskly.shareDestinations.${userId}`;
}

/** What the sheet does first with a share: with an open task / project it can go straight there. */
export type ShareStep = 'choose' | 'pick' | 'compose';

/**
 * "Add to comment" was chosen: the open task / project is the destination when there is one, otherwise the picker.
 */
export function stepAfterCommentChoice(current: ShareDestination | null): { step: ShareStep; destination: ShareDestination | null } {
  return current ? { step: 'compose', destination: current } : { step: 'pick', destination: null };
}
