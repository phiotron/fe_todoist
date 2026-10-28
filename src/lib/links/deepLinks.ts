/**
 * M12 — deep links of the app (scheme `taskly`, app.json). expo-router maps the path straight to a screen:
 * task/<id> → task detail, project/<id> → project, inbox → Inbox tab, quick-add → the Add task sheet…
 * Copy link builds them; the home-screen shortcuts, widgets, tile and share intent open them.
 */
export const LINK_SCHEME = 'taskly';

export type DeepLinkTarget =
  | { kind: 'task'; id: string }
  | { kind: 'project'; id: string; sectionId?: string }
  | { kind: 'inbox' }
  | { kind: 'today' }
  | { kind: 'upcoming' }
  | { kind: 'search' }
  | { kind: 'quickAdd'; content?: string; description?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Link text of a target, e.g. `taskly://task/<id>`. */
export function buildDeepLink(target: DeepLinkTarget): string {
  switch (target.kind) {
    case 'task':
      return `${LINK_SCHEME}://task/${encodeURIComponent(target.id)}`;
    case 'project': {
      const base = `${LINK_SCHEME}://project/${encodeURIComponent(target.id)}`;
      return target.sectionId ? `${base}?section=${encodeURIComponent(target.sectionId)}` : base;
    }
    case 'inbox':
    case 'today':
    case 'upcoming':
    case 'search':
      return `${LINK_SCHEME}://${target.kind}`;
    case 'quickAdd': {
      const params = new URLSearchParams();
      if (target.content) params.set('content', target.content);
      if (target.description) params.set('description', target.description);
      const query = params.toString();
      return `${LINK_SCHEME}://quick-add${query ? `?${query}` : ''}`;
    }
  }
}

/** The target of a link, or null when it is not a Taskly link we understand (ids must be UUIDs). */
export function parseDeepLink(url: string): DeepLinkTarget | null {
  const match = /^taskly:\/\/([^/?#]+)(?:\/([^?#]*))?(?:\?([^#]*))?/.exec(url.trim());
  if (!match) return null;
  const [, host, rest, query] = match;
  const params = new URLSearchParams(query ?? '');
  const id = rest ? decodeURIComponent(rest) : '';
  switch (host) {
    case 'task':
      return UUID.test(id) ? { kind: 'task', id } : null;
    case 'project': {
      if (!UUID.test(id)) return null;
      const section = params.get('section');
      if (section && !UUID.test(section)) return null;
      return section ? { kind: 'project', id, sectionId: section } : { kind: 'project', id };
    }
    case 'inbox':
    case 'today':
    case 'upcoming':
    case 'search':
      return rest ? null : { kind: host };
    case 'quick-add': {
      const content = params.get('content') ?? undefined;
      const description = params.get('description') ?? undefined;
      return { kind: 'quickAdd', ...(content ? { content } : {}), ...(description ? { description } : {}) };
    }
    default:
      return null;
  }
}

/** Router href (expo-router path) for a target. */
export function hrefOf(target: DeepLinkTarget): string {
  switch (target.kind) {
    case 'task':
      return `/task/${target.id}`;
    case 'project':
      return target.sectionId ? `/project/${target.id}?section=${target.sectionId}` : `/project/${target.id}`;
    case 'inbox':
    case 'today':
    case 'upcoming':
    case 'search':
      return `/${target.kind}`;
    case 'quickAdd': {
      const params = new URLSearchParams();
      if (target.content) params.set('content', target.content);
      if (target.description) params.set('description', target.description);
      const query = params.toString();
      return `/quick-add${query ? `?${query}` : ''}`;
    }
  }
}
