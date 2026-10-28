import {
  activeMentionIds,
  commentTextProblem,
  filterMentionable,
  formatFileSize,
  highlightMentions,
  insertMention,
  mentionFragment,
} from '../commentRules';
import { stampLabel } from '../commentTime';
import { AN, BINH } from '../../../test/m8bFixtures';

describe('commentTextProblem', () => {
  it('rejects empty text unless a file is attached', () => {
    expect(commentTextProblem('   ', false)).toBe('empty');
    expect(commentTextProblem('   ', true)).toBeNull();
    expect(commentTextProblem('xin chào', false)).toBeNull();
  });

  it('accepts 15 000 characters and rejects 15 001 (trimmed)', () => {
    expect(commentTextProblem('a'.repeat(15_000), false)).toBeNull();
    expect(commentTextProblem(`  ${'a'.repeat(15_000)}  `, false)).toBeNull();
    expect(commentTextProblem('a'.repeat(15_001), false)).toBe('tooLong');
  });
});

describe('mentions', () => {
  it('finds the fragment typed after the last @', () => {
    expect(mentionFragment('xin chào @Bi')).toBe('Bi');
    expect(mentionFragment('@')).toBe('');
    expect(mentionFragment('xin chào')).toBeNull();
    expect(mentionFragment('mail a@b')).toBeNull();
    expect(mentionFragment('@Bình đã xem ')).toBeNull();
  });

  it('filters people by the fragment, ignoring case', () => {
    expect(filterMentionable([AN, BINH], '')).toEqual([AN, BINH]);
    expect(filterMentionable([AN, BINH], 'bì')).toEqual([BINH]);
    expect(filterMentionable([AN, BINH], 'zzz')).toEqual([]);
  });

  it('replaces the fragment with the full name and a space', () => {
    expect(insertMention('xin chào @Bi', BINH)).toBe('xin chào @Bình ');
    expect(insertMention('@', AN)).toBe('@An ');
    expect(insertMention('xin chào', AN)).toBe('xin chào @An ');
  });

  it('keeps only the mentions whose @Name is still in the text', () => {
    const picked = new Map([
      [AN.id, 'An'],
      [BINH.id, 'Bình'],
    ]);
    expect(activeMentionIds('@An xem giúp', picked)).toEqual([AN.id]);
    expect(activeMentionIds('không ai cả', picked)).toEqual([]);
  });

  it('splits the content so mentions can be coloured', () => {
    expect(highlightMentions('@An và @Bình xem', ['An', 'Bình'])).toEqual([
      { text: '@An', mention: true },
      { text: ' và ', mention: false },
      { text: '@Bình', mention: true },
      { text: ' xem', mention: false },
    ]);
    expect(highlightMentions('không có', [])).toEqual([{ text: 'không có', mention: false }]);
    expect(highlightMentions('a.b (c) @A.B', ['A.B'])).toEqual([
      { text: 'a.b (c) ', mention: false },
      { text: '@A.B', mention: true },
    ]);
  });
});

describe('formatFileSize', () => {
  it('uses B, KB and MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('stampLabel', () => {
  const now = new Date('2026-10-28T05:00:00Z');
  it('shows the time for today and the date + time otherwise, in the account zone', () => {
    expect(stampLabel('2026-10-28T03:15:00Z', now, 'Asia/Ho_Chi_Minh')).toBe('10:15');
    expect(stampLabel('2026-10-27T03:15:00Z', now, 'Asia/Ho_Chi_Minh')).toBe('27/10 10:15');
    // 18:00Z on the 27th is already the 28th in Ho Chi Minh (UTC+7)
    expect(stampLabel('2026-10-27T18:00:00Z', now, 'Asia/Ho_Chi_Minh')).toBe('01:00');
  });
});
