/** Input limits of spec 5.9 (the server enforces them too). */
export const LIMITS = {
  taskContent: 500,
  /** Task, project and section descriptions. */
  description: 16_383,
  projectName: 120,
  sectionName: 2048,
} as const;

export type TextProblem = 'required' | 'tooLong';

export function checkRequiredText(value: string, max: number): TextProblem | null {
  const trimmed = value.trim();
  if (!trimmed) return 'required';
  if (trimmed.length > max) return 'tooLong';
  return null;
}

export function checkOptionalText(value: string, max: number): 'tooLong' | null {
  return value.length > max ? 'tooLong' : null;
}
