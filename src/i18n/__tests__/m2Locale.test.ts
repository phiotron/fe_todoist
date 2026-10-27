import i18n from '..';

describe('M2 locale (Vietnamese)', () => {
  it('has the sentences the M2 screens and tests rely on', () => {
    expect(i18n.t('filters.form.valid', { n: 2 })).toBe('Hợp lệ · 2 danh sách');
    expect(i18n.t('filters.syntax.at', { n: 6, near: '& today' })).toBe('Lỗi cú pháp ở ký tự thứ 6: “& today”');
    expect(i18n.t('filters.syntax.atEnd')).toBe('Lỗi cú pháp ở cuối truy vấn');
    expect(i18n.t('filters.syntax.generic')).toBe('Truy vấn không đúng cú pháp');
    expect(i18n.t('filters.delete.message', { name: 'Chưa lên lịch' })).toBe(
      'Filter “Chưa lên lịch” sẽ bị xoá. Không hoàn tác được.',
    );
    expect(i18n.t('filters.form.nameRequired')).toBe('Hãy nhập tên filter');
    expect(i18n.t('filters.form.queryRequired')).toBe('Hãy nhập truy vấn');
    expect(i18n.t('labels.form.nameRequired')).toBe('Hãy nhập tên label');
    expect(i18n.t('labels.form.nameTooLong', { n: 60 })).toBe('Tên label tối đa 60 ký tự');
    expect(i18n.t('labels.form.nameInvalid')).toBe('Tên label không được có dấu cách và các ký tự @ % # / , ( ) | & ! \\ *');
    expect(i18n.t('labels.form.nameTaken')).toBe('Đã có label cùng tên');
    expect(i18n.t('labels.chip.empty')).toBe('Label');
    expect(i18n.t('display.groups.priority', { n: 1 })).toBe('Ưu tiên 1');
    expect(i18n.t('display.groups.noDate')).toBe('Không có ngày');
    expect(i18n.t('display.groups.noDeadline')).toBe('Không có deadline');
    expect(i18n.t('display.groups.noLabel')).toBe('Không có label');
    expect(i18n.t('display.group.bySection')).toBe('Theo section');
    expect(i18n.t('search.title')).toBe('Tìm kiếm');
    expect(i18n.t('filtersLabels.title')).toBe('Filters & Labels');
  });
});
