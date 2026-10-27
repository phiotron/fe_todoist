import { LIMITS, checkOptionalText, checkRequiredText } from '../limits';

describe('text limits (spec 5.9)', () => {
  it('requires non-blank text within the limit after trimming', () => {
    expect(checkRequiredText('   ', LIMITS.taskContent)).toBe('required');
    expect(checkRequiredText(` ${'a'.repeat(500)} `, LIMITS.taskContent)).toBeNull();
    expect(checkRequiredText('a'.repeat(501), LIMITS.taskContent)).toBe('tooLong');
    expect(checkRequiredText('a'.repeat(120), LIMITS.projectName)).toBeNull();
    expect(checkRequiredText('a'.repeat(121), LIMITS.projectName)).toBe('tooLong');
    expect(checkRequiredText('a'.repeat(2049), LIMITS.sectionName)).toBe('tooLong');
  });

  it('only caps optional text (descriptions of tasks, projects and sections)', () => {
    expect(checkOptionalText('', LIMITS.description)).toBeNull();
    expect(checkOptionalText('a'.repeat(16_383), LIMITS.description)).toBeNull();
    expect(checkOptionalText('a'.repeat(16_384), LIMITS.description)).toBe('tooLong');
  });
});
