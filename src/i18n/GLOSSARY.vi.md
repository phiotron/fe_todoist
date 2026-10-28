# Bảng thuật ngữ tiếng Việt (VIUI)

Mọi chữ hiển thị khi ứng dụng ở tiếng Việt dùng đúng các thuật ngữ dưới đây, nhất quán ở mọi màn (tiêu đề, nút, menu,
thông báo, lỗi). Bản `en` giữ nguyên tiếng Anh. Kiểm tự động: `src/i18n/__tests__/viTerminology.test.ts` (quét
`locales/vi`) và `src/i18n/__tests__/viScreens.test.tsx` (render các màn chính); danh sách từ cấm ở
`src/test/viTerminology.ts`.

## Thuật ngữ

| English | Tiếng Việt |
| --- | --- |
| Inbox | Hộp thư đến |
| Today | Hôm nay |
| Upcoming | Sắp tới |
| Browse | Duyệt |
| Project | Dự án |
| Section | Mục |
| Task | Công việc |
| Sub-task | Công việc con |
| Label | Nhãn |
| Filter | Bộ lọc |
| Filters & Labels | Bộ lọc & Nhãn |
| Board | Bảng |
| List | Danh sách |
| Calendar | Lịch |
| Calendar feed | Nguồn cấp lịch |
| Display | Hiển thị |
| Settings | Cài đặt |
| Quick Add | Thêm nhanh |
| Quick Add chip | Nút thao tác |
| Add task | Thêm công việc |
| Comment | Bình luận |
| Attachment / file | Tệp đính kèm / tệp |
| Link | Liên kết |
| Template | Mẫu |
| Reminder | Nhắc nhở |
| Deadline | Hạn chót |
| Due date | Ngày đến hạn |
| Overdue | Quá hạn |
| Priority | Ưu tiên (giữ P1–P4) |
| Recurring | Lặp lại |
| Karma | Điểm năng suất |
| Productivity | Năng suất |
| Activity | Hoạt động |
| Team | Nhóm |
| Workspace | Không gian làm việc |
| Menu | Trình đơn |
| Tab bar | Thanh điều hướng |
| App | Ứng dụng |
| Offline | Ngoại tuyến |
| Dynamic Color | Màu động |
| Completed | Đã hoàn thành |
| Archive | Lưu trữ |
| Favorite | Yêu thích |
| AM / PM | SA / CH |

## Giữ nguyên

- Tên riêng: **Taskly**, Google, Google Calendar, Apple Calendar, Outlook, iCal, Facebook, Apple, Android,
  Google Play Services, Firebase; định dạng tệp (PNG, JPEG), đơn vị (MB, byte), mã QR.
- **P1–P4** (mức ưu tiên), **Email** (từ đã Việt hoá phổ biến).
- Tên do người dùng đặt (dự án, mục, nhãn, bộ lọc, công việc).
- Cú pháp gõ mà bộ phân tích chỉ đọc tiếng Anh (truy vấn bộ lọc: `today | overdue`; tiêu đề email:
  `date tomorrow 5pm`). Các chuỗi này nằm trong `SYNTAX_KEYS` của bài kiểm. Thêm nhanh đã hiểu tiếng Việt nên gợi ý
  dùng ví dụ tiếng Việt (`mai 9h`, `mỗi thứ hai 9h`, `thứ sáu tuần sau 15h`); bản en giữ `next friday 3pm`.
- Tên ngôn ngữ trong bộ chọn ngôn ngữ ("English").

## Dữ liệu từ máy chủ

- Dự án hệ thống **Inbox** có tên cố định "Inbox" trên máy chủ: ứng dụng luôn hiển thị theo ngôn ngữ (`isInbox` →
  `views.inbox.title`), qua `projectDisplayName` (có đối tượng dự án) hoặc `useProjectNameLabel` (chỉ có `projectId` +
  `projectName` của công việc).

## Ngày giờ

- Thứ: Thứ Hai … Thứ Bảy, Chủ nhật (viết tắt T2 … T7, CN); "Hôm nay", "Ngày mai", "Hôm qua".
- Dạng hạn: `Thứ Hai 09:00`, `Ngày mai 17:00`, `24/10 · Ngày mai · Thứ Bảy`; tháng: `Tháng 10, 2026`.
- Đồng hồ 12 giờ: `2:30 CH`, `9:05 SA`.
