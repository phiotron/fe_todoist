import fs from 'node:fs';
import path from 'node:path';
import i18n, { enTranslation, viTranslation } from '..';
import { SYNTAX_KEYS, englishWordIn, hardCodedEnglish, leaves, sourceFiles } from '../../test/viTerminology';

/**
 * VIUI: with the app in Vietnamese no visible text mixes in English product words ("Inbox", "Thêm section", "Chọn
 * label"…). The terms follow src/i18n/GLOSSARY.vi.md. Proper names stay (Taskly, Google Calendar, Outlook, P1–P4…).
 */

describe('Vietnamese terminology (VIUI)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('vi');
  });

  it('the forbidden-word check catches the mixed strings users reported', () => {
    expect(englishWordIn('Thêm section')).toBe('section');
    expect(englishWordIn('Inbox')).toBe('Inbox');
    expect(englishWordIn('Đã chuyển {{n}} task')).toBe('task');
    expect(englishWordIn('Thêm vào Google Calendar')).toBeNull();
    expect(englishWordIn('Hiện {{label}} ở đây')).toBeNull();
    expect(englishWordIn('Thêm mục')).toBeNull();
  });

  it('no Vietnamese string contains an English product word', () => {
    const offenders = leaves(viTranslation)
      .filter(([key]) => !SYNTAX_KEYS.has(key))
      .filter(([, text]) => englishWordIn(text) !== null)
      .map(([key, text]) => `${key}: ${text}`);
    expect(offenders).toEqual([]);
  });

  it('uses the glossary terms for the main places', () => {
    const t = (key: string) => i18n.t(key);
    expect(t('views.inbox.title')).toBe('Hộp thư đến');
    expect(t('views.today.title')).toBe('Hôm nay');
    expect(t('views.upcoming.title')).toBe('Sắp tới');
    expect(t('views.browse.title')).toBe('Duyệt');
    expect(t('projectScreen.addSection')).toBe('Thêm mục');
    expect(t('filtersLabels.title')).toBe('Bộ lọc & Nhãn');
    expect(t('templates.title')).toBe('Mẫu');
    expect(t('comments.title')).toBe('Bình luận');
    expect(t('taskDetail.subtasks.title')).toBe('Công việc con');
    expect(t('productivity.tabs.karma')).toBe('Điểm năng suất');
    expect(t('display.completed')).toBe('Công việc đã hoàn thành');
    expect(t('board.addTask')).toBe('Thêm công việc');
  });

  it('English stays English', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('views.inbox.title')).toBe('Inbox');
    expect(i18n.t('projectScreen.addSection')).toBe('Add section');
    expect(i18n.t('filtersLabels.title')).toBe(enTranslation.filtersLabels.title);
  });

  it('the hard-coded English check finds JSX text and literal UI props', () => {
    expect(hardCodedEnglish('<Text>Add task</Text>')).toEqual(['Add task']);
    expect(hardCodedEnglish('<Row title="Inbox" />')).toEqual(['title="Inbox"']);
    expect(hardCodedEnglish('<Text>{t("x")}</Text> () => Promise<void> <Text>Taskly</Text>')).toEqual([]);
  });

  it('components contain no hard-coded English UI text (everything goes through t())', () => {
    const offenders = sourceFiles(path.resolve(__dirname, '../..'))
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) => hardCodedEnglish(fs.readFileSync(file, 'utf8')).map((text) => `${path.basename(file)}: ${text}`));
    expect(offenders).toEqual([]);
  });

  it('ships the glossary next to the locales', () => {
    const glossary = fs.readFileSync(path.resolve(__dirname, '../GLOSSARY.vi.md'), 'utf8');
    for (const row of ['| Inbox | Hộp thư đến |', '| Section | Mục |', '| Task | Công việc |', '| Karma | Điểm năng suất |']) {
      expect(glossary).toContain(row);
    }
  });
});
