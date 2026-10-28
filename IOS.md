# Taskly trên iOS — chuẩn bị và các bước người dùng cần làm

Trạng thái (mốc X5): code và cấu hình **đã sẵn sàng để build iOS**, nhưng chưa từng build/chạy thật trên iOS vì
máy dev là Windows. iOS cần **macOS + Xcode** hoặc **build đám mây EAS** (cần tài khoản Apple Developer, 99 USD/năm).
Những phần chỉ có trên Android được bảo vệ để không làm app vỡ trên iOS (mục "Tính năng × iOS").

## 1. Việc người dùng PHẢI làm (một lần)

1. **Tài khoản Apple Developer** (Apple Developer Program) và tài khoản Expo (`npm i -g eas-cli`, `eas login`).
2. **Tạo App ID** `com.taskly.app` tại developer.apple.com › Certificates, Identifiers & Profiles › Identifiers.
   Bật capability **Sign in with Apple** và **Push Notifications**. (EAS thường tự đồng bộ capability khi build;
   nếu báo lỗi capability thì bật tay.)
3. **Sign in with Apple trên web (đang dùng):** tạo thêm một **Services ID** (ví dụ `com.taskly.app.web`), gắn với App ID
   ở trên, khai báo domain + Return URL = URL công khai của `POST /api/v1/auth/apple/callback` của backend. Điền
   `EXPO_PUBLIC_APPLE_SERVICE_ID` và `EXPO_PUBLIC_APPLE_REDIRECT_URI` như bản Android.
4. **Google Sign-In:** trên Google Cloud Console tạo OAuth client loại **iOS**, Bundle ID `com.taskly.app`.
   Lấy hai giá trị của client đó (đều là định danh công khai, không phải bí mật):
   - Client ID → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - REVERSED_CLIENT_ID (dạng `com.googleusercontent.apps.…`) → `GOOGLE_IOS_URL_SCHEME`
   Giữ nguyên `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Web client) — app vẫn dùng nó để lấy ID token cho backend.
5. **Điền biến môi trường** (tên ở `.env.example`; không commit giá trị). Chạy cục bộ: file `.env`. Chạy trên EAS: tạo
   biến trong EAS (`eas env:create` hoặc trang dự án trên expo.dev), không ghi giá trị vào `eas.json`.
   Biến `GOOGLE_IOS_URL_SCHEME` được `app.config.js` đọc **lúc build** → đổi nó phải build lại. Thiếu biến thì build vẫn
   chạy, chỉ là nút Google trên iOS báo "chưa cấu hình".
6. **Build bản development (thiết bị thật):**
   ```
   eas build --profile development --platform ios
   ```
   Lần đầu EAS hỏi đăng nhập Apple (tự gõ ở terminal của bạn), tạo certificate / provisioning profile.
   Trước đó đăng ký thiết bị: `eas device:create` (mở link trên iPhone để cài hồ sơ đăng ký UDID), rồi build lại.
   Cài app từ link EAS, chạy `npx expo start --dev-client` và mở app (iPhone và máy dev cùng mạng; `EXPO_PUBLIC_API_URL`
   phải là địa chỉ máy dev truy cập được từ iPhone, không phải `localhost`).
7. Có Mac: `npx expo prebuild --platform ios` rồi `npx expo run:ios --device` (Xcode). Thư mục `ios/` là sinh tự động,
   không commit.
8. **Backend** (không thuộc repo này): `APPLE_CLIENT_IDS` phải gồm **bundle id** `com.taskly.app` và **Services ID**;
   `GOOGLE_CLIENT_IDS` nên thêm **client ID iOS** để token phát từ iOS được chấp nhận chắc chắn (app vẫn gửi token phát
   cho Web client nên thường đã đủ, nhưng thêm vào là an toàn).

Profile trong `eas.json`: `development` (dev client, `distribution: internal`, iOS thiết bị thật), `preview` (bản thử
nội bộ), `production` (bản lên store, `autoIncrement`). Không có khoá/ID thật trong file. Android giữ nguyên cách build cũ
(`expo run:android`); các profile Android trong `eas.json` chỉ là tuỳ chọn.

## 2. Tính năng × iOS

| Tính năng | iOS | Ghi chú |
| --- | --- | --- |
| Đăng nhập email, danh sách / lọc / dự án / bình luận / đồng bộ / offline | hoạt động | Mã JS dùng chung |
| Nhắc việc theo giờ (thông báo cục bộ), nút Snooze / Hoàn thành | hoạt động | Cần cấp quyền thông báo; iOS giữ tối đa 64 thông báo hẹn giờ |
| Pin reminder (thông báo dính), Urgent reminder (báo thức toàn màn hình) | ẩn | Chỉ Android; mục tương ứng không hiện trong Cài đặt › Nhắc nhở |
| Gợi ý "Alarms & reminders" (exact alarm) | ẩn | Chỉ Android 14+ |
| Nhắc theo vị trí (geofence) | hoạt động, cần thử | Giới hạn 20 vùng trên iOS (Android 100); cần quyền "Luôn cho phép"; bán kính nên ≥ 100 m |
| Chọn giờ / ngày (Quick Add, Lịch, nhắc tuyệt đối) | hoạt động | Hộp thoại picker riêng cho iOS (`IosDateTimePickerHost`) thay cho picker Android |
| Đăng nhập Apple (luồng web) | hoạt động, cần cấu hình | Cần Services ID + redirect (mục 1.3); chưa dùng nút Apple gốc |
| Đăng nhập Google | cần cấu hình | Cần client iOS (mục 1.4), nếu thiếu thì báo chưa cấu hình |
| Đăng nhập Facebook (luồng web) | hoạt động, cần cấu hình | Như Android |
| Deep link `taskly://…` (OAuth, calendar) | hoạt động | Scheme `taskly` đã khai báo; chưa dùng universal link |
| Widget màn hình chính | ẩn / không có | `react-native-android-widget` không được nạp trên iOS. Widget iOS (WidgetKit) là việc riêng, chưa làm |
| Đổi icon ứng dụng | ẩn | Dòng "Biểu tượng ứng dụng" không hiện trên iOS |
| Dynamic Color (Material You) | ẩn | Chỉ Android 12+ |
| Âm báo khi hoàn thành việc | ẩn | Công tắc không hiện trên iOS (hàm phát âm là no-op) |
| Chia sẻ văn bản vào Taskly (share to app / Share to Comment) | không có | Cần Share Extension riêng cho iOS (chưa làm) |
| Shortcut app (long-press icon) | không có | Chỉ Android; iOS cần Quick Action riêng |
| Push từ server (FCM) | cần làm thêm | App chỉ đăng ký token trên Android. iOS cần APNs key trong Firebase + đổi cách đăng ký token + backend gửi qua APNs/FCM |
| Đăng nhập Apple gốc (`expo-apple-authentication`) | cần làm thêm | Gói chưa cài. Không có nó thì `ios.usesAppleSignIn` chỉ cảnh báo và KHÔNG tạo entitlement; luồng web hiện tại không cần entitlement |

## 3. Cách code bảo vệ iOS (để sửa đúng chỗ về sau)

- `src/lib/native/platform.ts`: `isAndroid()` / `isIos()`. Mọi mục giao diện chỉ Android dùng nó (hoặc `getTasklyAndroid()`
  trả `null` ngoài Android).
- `index.ts` gọi `registerWidgetsIfAndroid()` (không import thẳng `react-native-android-widget`: thư viện này ném lỗi
  ngay khi import nếu thiếu module native, làm app sập lúc khởi động trên iOS).
- `src/lib/dateTimePicker.ts` + `src/components/IosDateTimePickerHost.tsx`: `DateTimePickerAndroid` không chạy trên iOS.
- `app.json` giữ giá trị tĩnh; `app.config.js` chỉ thêm plugin Google Sign-In khi có `GOOGLE_IOS_URL_SCHEME` hợp lệ.
- Test chạy với `Platform.OS = 'ios'`: `src/lib/native/__tests__/iosCompat.test.tsx`, `plugins/__tests__/iosConfig.test.js`.
  Trong Jest, `runAsPlatform('android' | 'ios')` (`src/test/runAsPlatform.ts`) đổi hệ điều hành cho cả file test.

## 4. Còn phải thử tay khi có Mac / EAS

Khởi động app (không sập), đăng nhập, tạo việc, chọn giờ, nhắc việc (cấp quyền thông báo, nút Snooze/Hoàn thành), nhắc
vị trí (cấp "Luôn cho phép", đi qua vùng), đăng nhập Apple / Google / Facebook, deep link quay về app, giao diện tối/sáng.
