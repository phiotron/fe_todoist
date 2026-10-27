import i18n from '../../i18n';
import { LIMITS, checkOptionalText, checkRequiredText } from '../../lib/limits';

/** BR-02: 1–500 characters after trimming. */
export function taskContentError(content: string): string | undefined {
  const problem = checkRequiredText(content, LIMITS.taskContent);
  if (problem === 'required') return i18n.t('taskList.validation.contentRequired');
  if (problem === 'tooLong') return i18n.t('taskList.validation.contentTooLong');
  return undefined;
}

/** Spec 5.9: descriptions of tasks, projects and sections ≤ 16 383. */
export function descriptionError(description: string): string | undefined {
  return checkOptionalText(description, LIMITS.description) ? i18n.t('taskList.validation.descriptionTooLong') : undefined;
}
