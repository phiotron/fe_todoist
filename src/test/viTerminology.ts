import fs from 'node:fs';
import path from 'node:path';

/**
 * VIUI: forbidden English product words for Vietnamese UI text (see src/i18n/GLOSSARY.vi.md). Shared by the locale
 * check and the screen renders.
 */
/** English words that must not appear in a Vietnamese string (whole words, any case unless noted). */
export const FORBIDDEN_EN = [
  'inbox',
  'today',
  'upcoming',
  'browse',
  'sections?',
  'sub-?tasks?',
  'tasks?',
  'labels?',
  'filters?',
  'templates?',
  'comments?',
  'board',
  'calendar',
  'display',
  'settings',
  'add task',
  'karma',
  'deadlines?',
  'workspaces?',
  'menu',
  'chips?',
  'offline',
  'online',
  'app',
  'links?',
  'files?',
  'feed',
  'completed',
  'future',
  'occurrences',
  'dynamic',
  'color',
  'productivity',
  'activity',
  'team',
  'reminders?',
  'priority',
  'quick add',
  'upload',
  'widget',
];

const FORBIDDEN_PATTERN = new RegExp(`(^|[^\\p{L}-])(${FORBIDDEN_EN.join('|')})(?=$|[^\\p{L}-])`, 'iu');

/** Product names that contain a forbidden word; removed before the check. */
const PROPER_NAMES = ['Google Calendar', 'Apple Calendar', 'Google Play Services', 'iCal'];

/**
 * Keys whose text shows typing syntax the parsers only read in English (Quick Add, filter queries, email subjects):
 * the keywords are code, not words. The language picker shows "English" in English.
 */
export const SYNTAX_KEYS = new Set([
  'email.syntaxHint',
  'filters.form.queryPlaceholder',
  'quickAdd.dateSheet.inputPlaceholder',
  'settings.language.en',
]);

export function leaves(tree: unknown, prefix = ''): [string, string][] {
  if (tree === null || typeof tree !== 'object') return [[prefix, String(tree)]];
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
    leaves(value, prefix ? `${prefix}.${key}` : key),
  );
}

export function visibleText(text: string): string {
  let out = text.replace(/\{\{[^}]*\}\}/g, ' ').replace(/\$t\([^)]*\)/g, ' ');
  for (const name of PROPER_NAMES) out = out.split(name).join(' ');
  return out;
}

export function englishWordIn(text: string): string | null {
  const match = FORBIDDEN_PATTERN.exec(visibleText(text));
  return match ? match[2] : null;
}

/** Text shown as-is in any language (brand). */
const ALLOWED_LITERALS = new Set(['Taskly']);
const JSX_TEXT = /(?<![=\-])>\s*([A-Za-z][A-Za-z0-9 .,!?'&-]*?)\s*<\//g;
const UI_PROP = /\b(title|placeholder|accessibilityLabel|accessibilityHint|label|message|headerTitle)=["']([^"']*[A-Za-z][^"']*)["']/g;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** JSX text and literal UI props written in English in a component source (they must go through t()). */
export function hardCodedEnglish(source: string): string[] {
  const code = stripComments(source);
  const texts = [...code.matchAll(JSX_TEXT)].map((match) => match[1]).filter((text) => !ALLOWED_LITERALS.has(text));
  const props = [...code.matchAll(UI_PROP)].map((match) => `${match[1]}="${match[2]}"`);
  return [...texts, ...props];
}

/** .ts / .tsx files under `dir`, without tests, test helpers and generated files. */
export function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'test' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.gen.ts') ? [full] : [];
  });
}
