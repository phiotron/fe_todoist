/** Task name limit (spec 2.1). */
export const MAX_TASK_NAME = 500;
/** Task description limit (spec 2.1). */
export const MAX_TASK_DESCRIPTION = 16_383;

export interface SharedTask {
  content: string;
  description: string;
}

/**
 * Text shared into Taskly from another app (Android share sheet, M12) → the name and description of a new task: the
 * first non-empty line is the name, the rest (links stay as they are) is the description. A first line longer than 500
 * characters is cut at the last space before the limit and the cut-off part goes to the description. null = nothing to add.
 */
export function buildSharedTask(text: string | null | undefined): SharedTask | null {
  const lines = (text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first === -1) return null;
  let content = lines[first].trim();
  let rest = lines.slice(first + 1).join('\n').trim();
  if (content.length > MAX_TASK_NAME) {
    const cut = content.lastIndexOf(' ', MAX_TASK_NAME);
    const at = cut > 0 ? cut : MAX_TASK_NAME;
    rest = [content.slice(at).trim(), rest].filter(Boolean).join('\n');
    content = content.slice(0, at).trim();
  }
  return { content, description: rest.slice(0, MAX_TASK_DESCRIPTION) };
}
