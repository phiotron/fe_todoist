/**
 * Todoist's "* " prefix (Quick Add, spec 3.2 M6b): a task whose name starts with "* " has no checkbox and cannot be
 * completed. The prefix stays in `content` (the API stores it as typed); lists show the name without it.
 */
export function isUncompletable(content: string): boolean {
  return content.startsWith('* ');
}

/** The name as shown: without the leading "* " of an uncompletable task. */
export function displayContent(content: string): string {
  return isUncompletable(content) ? content.slice(2) : content;
}
