import '../../../i18n';
import { describeFilterSyntax } from '../filterSyntaxMessage';

describe('describeFilterSyntax', () => {
  it('shows the position from 1 and the text from there', () => {
    expect(describeFilterSyntax('p1 & & today', 5)).toBe('Lỗi cú pháp ở ký tự thứ 6: “& today”');
  });

  it('says the query ended too early when the position is at the end', () => {
    expect(describeFilterSyntax('today |', 7)).toBe('Lỗi cú pháp ở cuối truy vấn');
  });

  it('falls back to a generic sentence without a position', () => {
    expect(describeFilterSyntax('x', null)).toBe('Truy vấn không đúng cú pháp');
  });

  it('counts the position in UTF-16 units and never cuts an emoji in half', () => {
    // "😀 " is 3 UTF-16 units, so the second "&" is at index 5 (the 6th unit).
    expect(describeFilterSyntax('\u{1F600} & &', 5)).toBe('Lỗi cú pháp ở ký tự thứ 6: “&”');
    // 11 plain units + a pair that straddles the 12-unit cut.
    const near = describeFilterSyntax('a & 12345678901\u{1F600}\u{1F600}', 4);
    expect(near).toBe('Lỗi cú pháp ở ký tự thứ 5: “12345678901…”');
  });
});
