# Taskly — Mobile

App di động Taskly, quản lý công việc kiểu Todoist. Backend nằm ở repo riêng (`backend`).

- **Stack:** React Native · Expo (TypeScript) · expo-router · TanStack Query · i18next
- **Vòng 1:** demo chạy bằng **development build** (APK riêng `com.taskly.app`, dùng `expo-dev-client`) trên
  Android emulator
- **Thiết kế:** xem spec `docs/superpowers/specs/2026-10-23-taskly-design.md` trong repo tài liệu gốc

## Cần có
- Node ≥ 22.13 (script `gen:api` dùng `--env-file-if-exists` và `import.meta.dirname`)
- Android Studio (Android SDK + JDK đi kèm) + một AVD (emulator) đang bật
- `adb` nằm ở `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` (thêm thư mục này vào `PATH`, hoặc gọi bằng
  đường dẫn đầy đủ). `npx expo run:android` cần biến `ANDROID_HOME` trỏ tới `%LOCALAPPDATA%\Android\Sdk`.
- Backend đang chạy ở cổng 8080 (xem README của repo `backend`)

## Chạy app
Thư mục `android/` do `npx expo run:android` sinh ra (CNG) và không commit.

### Lần đầu (build + cài APK)
1. Chép `.env.example` thành `.env`.
2. Cài thư viện: `npm install`
3. Chuyển cổng backend vào emulator: `adb reverse tcp:8080 tcp:8080`
4. Build và cài app lên emulator: `npx expo run:android` (lần đầu Gradle có thể mất 10–20 phút).

Chỉ cần build lại khi đổi thư viện native, plugin hoặc cấu hình native trong `app.json`.

### Hằng ngày
1. `adb reverse tcp:8080 tcp:8080`
2. `npx expo start --dev-client` (hoặc `npm start`)
3. Mở app **Taskly** trên emulator; app tự nối vào Metro (nếu không, bấm `a` trong cửa sổ Metro).

### Kết nối backend từ emulator Android 17
Emulator Android 17 (API 37) chặn app gọi `10.0.2.2` vì coi đó là mạng nội bộ — app phải có quyền
`ACCESS_LOCAL_NETWORK` ([tài liệu](https://developer.android.com/privacy-and-security/local-network-permission)),
nếu không kết nối kẹt ở `SYN_SENT`. Taskly không xin quyền này; thay vào đó app gọi `http://localhost:8080` và
`adb reverse tcp:8080 tcp:8080` chuyển cổng 8080 của emulator về máy tính. Lệnh này mất tác dụng khi emulator tắt, nên
**chạy lại mỗi lần bật emulator** (kiểm bằng `adb reverse --list`). Metro (cổng 8081) thường được Expo CLI tự
`adb reverse`; nếu app không tải được bundle thì chạy thêm `adb reverse tcp:8081 tcp:8081`.

## Lệnh
| Việc | Lệnh |
|---|---|
| Build + cài app lên emulator | `npx expo run:android` |
| Chạy Metro cho development build | `npx expo start --dev-client` |
| Test | `npx jest` |
| Kiểm tra kiểu | `npx tsc --noEmit` |
| Sinh kiểu API từ backend | `npm run gen:api` |
| Kiểm `openapi-typescript` còn sinh kiểu đúng (không cần backend) | `npm run gen:api:smoke` |

## Hợp đồng API với backend
`src/api/types.gen.ts` được sinh từ OpenAPI của backend và **được commit vào repo này**, nên app build được mà
không cần backend đang chạy. Mỗi khi backend đổi API:
1. Chạy `npm run gen:api`.
2. Chạy `npx tsc --noEmit` để bắt chỗ lệch.
3. Commit file sinh ra.

**Vì sao `package.json` có `overrides`:** `openapi-typescript@7` khai báo peer `typescript ^5`, còn Expo SDK 58 dùng
TypeScript 6. `overrides` ép nó dùng chung bản TypeScript của dự án. Sau mỗi lần nâng `typescript` hoặc
`openapi-typescript`, chạy `npm run gen:api:smoke` để chắc việc sinh kiểu vẫn đúng; khi `openapi-typescript` hỗ trợ
TypeScript 6 chính thức thì bỏ `overrides`.

## Nhắc việc (M4)

- Nhắc **cục bộ** (chưa có push từ server — M13). Server tính sẵn thời điểm nhắc (`GET /api/v1/tasks/reminders`); app đặt
  **50** lần nhắc gần nhất trên máy, id lịch = `auto:<taskId>` hoặc id nhắc.
- Phần dùng thông báo của hệ điều hành đi qua **một cổng** `src/features/reminders/platform.ts` (`ReminderPlatform`: kênh,
  nút Hoãn / Hoàn thành, quyền, đặt / huỷ lịch, bấm thông báo). Mặc định là bản "không có" (không bao giờ có quyền) để
  logic chạy và test được khi chưa cài `expo-notifications`. Bản cài thật (adapter `expo-notifications`) gắn lúc khởi động
  bằng `setReminderPlatform(...)`; thêm `expo-notifications` là thay đổi native nên phải build lại development build
  (`npx expo run:android`).
- **Nhắc tự động** cho task **có giờ** (Cài đặt → Nhắc nhở → Nhắc tự động, mặc định 30 phút trước, tắt được). Task chỉ có
  ngày không tự nhắc.
- **Nhắc riêng**: chip "Nhắc nhở" trong chi tiết task và Quick Add — thời điểm cụ thể, hoặc trước hạn (chỉ task có giờ).
  Task đã xong hoặc thuộc dự án / section lưu trữ: chỉ xem. Vuốt "Reminders" mở thẳng bảng nhắc của task.
- Đồng bộ lịch khi mở app, khi quay lại app, sau mỗi thao tác ghi thành công trên máy này, khi đổi cài đặt nhắc.
- Đăng xuất / hết phiên / đăng nhập tài khoản khác → huỷ mọi lịch nhắc.
- Giờ nhắc theo **múi giờ tài khoản** (không phải múi giờ máy). Android 14+ cần bật "Báo thức & lời nhắc" để nhắc đúng giờ.
