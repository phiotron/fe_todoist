import { buildSharedTask, MAX_TASK_DESCRIPTION, MAX_TASK_NAME } from '../sharedTask';

describe('buildSharedTask', () => {
  it('uses the first line as the name and the rest as the description', () => {
    expect(buildSharedTask('Mua sữa\nloại ít đường\nhttps://shop.example/p/1')).toEqual({
      content: 'Mua sữa',
      description: 'loại ít đường\nhttps://shop.example/p/1',
    });
  });

  it('a shared link alone becomes the name', () => {
    expect(buildSharedTask('  https://example.com/a?b=1  ')).toEqual({ content: 'https://example.com/a?b=1', description: '' });
  });

  it('skips blank lines at the start and normalises Windows line breaks', () => {
    expect(buildSharedTask('\r\n\r\nTên\r\nMô tả')).toEqual({ content: 'Tên', description: 'Mô tả' });
  });

  it('nothing to add for empty, blank or missing text', () => {
    expect(buildSharedTask('')).toBeNull();
    expect(buildSharedTask('  \n \n')).toBeNull();
    expect(buildSharedTask(null)).toBeNull();
    expect(buildSharedTask(undefined)).toBeNull();
  });

  it('cuts a first line longer than the name limit at a space and moves the rest to the description', () => {
    const words = Array.from({ length: 200 }, (_, index) => `từ${index}`).join(' ');
    const task = buildSharedTask(`${words}\ndòng hai`);

    expect(task).not.toBeNull();
    expect(task!.content.length).toBeLessThanOrEqual(MAX_TASK_NAME);
    expect(task!.content.endsWith(' ')).toBe(false);
    expect(`${task!.content} ${task!.description}`.replace(/\s+/g, ' ')).toContain('dòng hai');
    expect(task!.description.endsWith('dòng hai')).toBe(true);
  });

  it('cuts a long text without spaces at the limit and caps the description', () => {
    const task = buildSharedTask(`${'x'.repeat(600)}\n${'y'.repeat(MAX_TASK_DESCRIPTION + 50)}`);

    expect(task!.content).toHaveLength(MAX_TASK_NAME);
    expect(task!.description).toHaveLength(MAX_TASK_DESCRIPTION);
  });
});
